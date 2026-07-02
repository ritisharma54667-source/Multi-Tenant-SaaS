// ============================================================
// TENANT ROUTES
// ============================================================
// GET    /api/v1/tenants          — list tenants the current user belongs to
// POST   /api/v1/tenants          — create a NEW workspace (user becomes owner)
// DELETE /api/v1/tenants/current  — permanently delete the ACTIVE workspace
//                                    (Phase 8, owner-only, type-to-confirm)
//
// Note: there's no "switch tenant" endpoint here on purpose — switching
// is a frontend concern (pick a tenantId, send it as X-Tenant-Id on
// subsequent requests). The backend's job is only to CONFIRM access,
// which resolveTenantContext does on every tenant-scoped route from
// Phase 4 onward (the CRM data routes).
// ============================================================

import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { resolveTenantContext } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/permissions.js';
import { createTenantSchema, validate } from '../validation/schemas.js';
import { slugify, withRandomSuffix } from '../utils/slug.js';
import { z } from 'zod';

const router = Router();

router.use(requireAuth); // every route below requires a verified user

// ------------------------------------------------------------
// GET /
// ------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.tenant_id, m.role, t.name AS tenant_name, t.slug, t.plan
       FROM memberships m JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = $1
       ORDER BY m.created_at ASC`,
      [req.user.id]
    );

    res.json({
      memberships: result.rows.map((r) => ({
        tenantId: r.tenant_id,
        tenantName: r.tenant_name,
        slug: r.slug,
        plan: r.plan,
        role: r.role,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// POST /
// Lets an already-logged-in user spin up an ADDITIONAL workspace
// (e.g. someone running two separate businesses). They become
// owner of the new tenant only — existing tenants are untouched.
// ------------------------------------------------------------
router.post('/', async (req, res, next) => {
  const result = validate(createTenantSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let slug = slugify(result.data.name);
    const slugTaken = await client.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (slugTaken.rows.length > 0) slug = withRandomSuffix(slug);

    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id, name, slug, plan`,
      [result.data.name, slug]
    );
    const tenant = tenantResult.rows[0];

    await client.query(
      `INSERT INTO memberships (user_id, tenant_id, role) VALUES ($1, $2, 'owner')`,
      [req.user.id, tenant.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      role: 'owner',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------
// DELETE /current
// ------------------------------------------------------------
// Permanently deletes the active workspace and everything in it
// (memberships, contacts, deals, audit logs all cascade via the
// ON DELETE CASCADE foreign keys set up back in Phase 1/6). Owner
// only — this is the first route to use DELETE_WORKSPACE, which
// has sat unused in the permission table since Phase 3.
//
// Requires the exact workspace name in the body as a type-to-
// confirm safety check, on top of the permission check — the same
// pattern GitHub/Vercel use for irreversible deletes.
// ------------------------------------------------------------
const deleteWorkspaceSchema = z.object({
  confirmName: z.string().min(1, 'Type the workspace name to confirm.'),
});

router.delete(
  '/current',
  resolveTenantContext,
  requirePermission(PERMISSIONS.DELETE_WORKSPACE),
  async (req, res, next) => {
    const result = validate(deleteWorkspaceSchema, req.body);
    if (!result.success) return res.status(400).json({ error: result.error });

    try {
      const tenantResult = await query('SELECT name FROM tenants WHERE id = $1', [req.tenantId]);
      const tenant = tenantResult.rows[0];
      if (!tenant) return res.status(404).json({ error: 'Workspace not found.' });

      if (result.data.confirmName !== tenant.name) {
        return res.status(400).json({
          error: `Workspace name didn't match. Type "${tenant.name}" exactly to confirm deletion.`,
        });
      }

      await query('DELETE FROM tenants WHERE id = $1', [req.tenantId]);

      res.json({ message: 'Workspace deleted.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
