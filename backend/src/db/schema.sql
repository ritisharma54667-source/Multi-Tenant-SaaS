-- ============================================================
-- DATABASE SCHEMA — Phase 1 (Foundation)
-- ============================================================
-- This file sets up the CORE multi-tenant tables:
--   tenants, users, memberships
--
-- It also establishes the ROW-LEVEL SECURITY (RLS) PATTERN that
-- every future business table (leads, contacts, deals, etc. in
-- later phases) MUST follow. Read the comments carefully — this
-- is the backbone of tenant isolation for the whole project.
-- ============================================================

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- TENANTS
-- Each row = one organization / workspace.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',  -- free | pro | enterprise (used in billing phase)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- USERS
-- A user is global (can belong to multiple tenants via memberships).
-- Password is hashed with bcrypt, never stored in plaintext.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- PASSWORD RESET (added post-Phase-8)
-- ------------------------------------------------------------
-- Only a HASH of the reset token is stored, never the raw token
-- (same principle as password_hash) — the raw token only ever
-- exists in the email link and briefly in the request body when
-- the user submits it. A stolen database dump alone can't be used
-- to reset anyone's password.
-- ------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- MEMBERSHIPS
-- Joins a user to a tenant with a specific role.
-- This table is the SOURCE OF TRUTH for "who can access which tenant".
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member', -- owner | admin | manager | member | viewer
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

-- ------------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS) PATTERN
-- ------------------------------------------------------------
-- The idea: every request sets a Postgres session variable
-- `app.current_tenant_id` AFTER verifying the JWT server-side
-- (see backend/src/middleware/tenantContext.js). Postgres then
-- automatically filters every query on RLS-enabled tables to
-- only that tenant's rows — even if a developer forgets a
-- WHERE clause somewhere. This is the "defense in depth" layer
-- on top of application-level filtering.
--
-- IMPORTANT: the app DB user must NOT be a superuser, or RLS
-- is bypassed entirely. Create a non-superuser role for the app
-- in production.
-- ------------------------------------------------------------

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Policy: a row is visible only if its tenant_id matches the
-- session's current tenant context.
DROP POLICY IF EXISTS tenant_isolation_memberships ON memberships;
CREATE POLICY tenant_isolation_memberships ON memberships
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ------------------------------------------------------------
-- TEMPLATE FOR FUTURE BUSINESS TABLES (Phase 4 onward)
-- ------------------------------------------------------------
-- Copy this pattern for every new tenant-scoped table:
--
--   CREATE TABLE leads (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
--     ... your columns ...
--   );
--   ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_isolation_leads ON leads
--     USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
--
-- Never skip this. Every business table = tenant_id column + RLS policy.
-- ------------------------------------------------------------

-- ============================================================
-- PHASE 4: CORE CRM TABLES
-- ============================================================

-- ------------------------------------------------------------
-- CONTACTS
-- A contact belongs to exactly one tenant. tenant_id is always
-- set server-side from req.tenantId — never trusted from the client.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  status      TEXT NOT NULL DEFAULT 'lead',   -- lead | active | churned
  owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_owner  ON contacts(tenant_id, owner_id);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_contacts ON contacts;
CREATE POLICY tenant_isolation_contacts ON contacts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ------------------------------------------------------------
-- DEALS
-- A deal is linked to a contact (optional) and has a Kanban stage.
-- value is in the tenant's chosen currency (Phase 7 adds currency config).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  value        NUMERIC(15,2) DEFAULT 0,
  stage        TEXT NOT NULL DEFAULT 'lead',
  -- stages: lead | qualified | proposal | negotiation | won | lost
  contact_id   UUID REFERENCES contacts(id) ON DELETE SET NULL,
  owner_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  expected_close_date DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_tenant ON deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage  ON deals(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_deals_owner  ON deals(tenant_id, owner_id);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_deals ON deals;
CREATE POLICY tenant_isolation_deals ON deals
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS deals_updated_at ON deals;
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- PHASE 6: AUDIT LOGS
-- ============================================================
-- One row per meaningful action inside a workspace: invites,
-- role changes, removals, and CRM create/update/delete/stage
-- events. actor_id is nullable + ON DELETE SET NULL so a log
-- entry survives even if the acting user's account is later
-- deleted — actor_name is captured at write-time for that reason.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name   TEXT NOT NULL,
  action       TEXT NOT NULL,   -- e.g. 'member.invited', 'deal.stage_changed'
  target_type  TEXT,            -- 'membership' | 'contact' | 'deal'
  target_id    UUID,
  target_label TEXT,            -- human-readable snapshot (name/title/email)
  metadata     JSONB,           -- e.g. { "from": "member", "to": "manager" }
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(tenant_id, action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
