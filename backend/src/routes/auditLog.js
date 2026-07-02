// ============================================================
// AUDIT LOG ROUTES  /api/v1/audit-log
// ============================================================
// Read-only view into the audit_logs table written by
// utils/auditLog.js from team.js, contacts.js, and deals.js.
// Gated behind 'view_audit_log' — admin/owner only, per the
// permission table defined back in Phase 3.
//
// GET /  — paginated, newest first, optional ?action= and
//          ?targetType= filters
// ============================================================

import { Router } from 'express';
import { withTenantClient } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { resolveTenantContext } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();
const guard  = [requireAuth, resolveTenantContext];

router.get('/', ...guard, requirePermission(PERMISSIONS.VIEW_AUDIT_LOG), async (req, res, next) => {
  try {
    const page       = Math.max(1, parseInt(req.query.page  || '1'));
    const limit       = Math.min(100, Math.max(1, parseInt(req.query.limit || '25')));
    const offset      = (page - 1) * limit;
    const action      = req.query.action || '';
    const targetType  = req.query.targetType || '';

    const data = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      const conditions = ['1=1'];
      const params = [];

      if (action) {
        params.push(action);
        conditions.push(`action = $${params.length}`);
      }
      if (targetType) {
        params.push(targetType);
        conditions.push(`target_type = $${params.length}`);
      }
      const where = conditions.join(' AND ');

      const countResult = await client.query(
        `SELECT COUNT(*) FROM audit_logs WHERE ${where}`, params
      );
      const total = parseInt(countResult.rows[0].count);

      params.push(limit, offset);
      const rowsResult = await client.query(
        `SELECT id, actor_id, actor_name, action, target_type, target_id, target_label, metadata, created_at
         FROM audit_logs
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return { logs: rowsResult.rows, total };
    });

    res.json({
      logs: data.logs,
      pagination: { page, limit, total: data.total, pages: Math.ceil(data.total / limit) },
    });
  } catch (err) { next(err); }
});

// ── GET /actions — distinct action types seen so far, for the
//    frontend's filter dropdown (small, cheap, no pagination needed) ─
router.get('/actions', ...guard, requirePermission(PERMISSIONS.VIEW_AUDIT_LOG), async (req, res, next) => {
  try {
    const actions = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);
      const r = await client.query(
        `SELECT DISTINCT action FROM audit_logs ORDER BY action`
      );
      return r.rows.map((row) => row.action);
    });
    res.json({ actions });
  } catch (err) { next(err); }
});

export default router;
