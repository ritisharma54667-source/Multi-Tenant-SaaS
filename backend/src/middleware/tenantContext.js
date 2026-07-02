// ============================================================
// TENANT CONTEXT MIDDLEWARE
// ============================================================
// Fully wired in Phase 3 now that requireAuth (Phase 2) sets
// req.user reliably.
//
// Flow on every protected, tenant-scoped request:
//   1. requireAuth runs → req.user is a verified JWT payload
//   2. THIS runs → checks memberships table, confirms the user
//      actually belongs to the requested tenant, then:
//        a. attaches req.tenantId and req.role
//        b. sets the Postgres session variable so RLS fires
//   3. requireRole / requirePermission check req.role
//   4. The route handler queries the DB — RLS silently filters
//      any row that doesn't belong to req.tenantId
//
// Security rule: the frontend sends X-Tenant-Id as a REQUEST.
// The backend confirms it. Never trust, always verify.
// ============================================================

import { pool, query } from '../db/pool.js';

export async function resolveTenantContext(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required before tenant resolution.' });
    }

    const requestedTenantId = req.headers['x-tenant-id'];
    if (!requestedTenantId) {
      return res.status(400).json({ error: 'Missing X-Tenant-Id header.' });
    }

    // Confirm membership server-side
    const result = await query(
      `SELECT role FROM memberships WHERE user_id = $1 AND tenant_id = $2`,
      [req.user.id, requestedTenantId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this tenant.' });
    }

    req.tenantId = requestedTenantId;
    req.role = result.rows[0].role;

    // Set the Postgres session variable so RLS policies activate
    // for ANY query run during this request via withTenantClient.
    // We store it on req so route handlers can pass it to withTenantClient.
    req.setTenantContext = async (client) => {
      await client.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [req.tenantId]);
    };

    next();
  } catch (err) {
    next(err);
  }
}

