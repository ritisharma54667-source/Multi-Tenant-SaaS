// ============================================================
// DEALS ROUTES  /api/v1/deals
// ============================================================
// Same tenant-RLS pattern as contacts.
//
// GET    /              list (by stage, search, pagination)
// POST   /              create
// GET    /:id           get one
// PUT    /:id           full update
// PATCH  /:id/stage     move to a different Kanban stage
// DELETE /:id           delete
//
// Stages: lead → qualified → proposal → negotiation → won | lost
// ============================================================

import { Router } from 'express';
import { withTenantClient } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { resolveTenantContext } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/permissions.js';
import { z } from 'zod';
import { validate } from '../validation/schemas.js';
import { logAction } from '../utils/auditLog.js';
import { checkLimit } from '../config/plans.js';

const router = Router();
const guard  = [requireAuth, resolveTenantContext];

export const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

// ── Schemas ─────────────────────────────────────────────────
const dealSchema = z.object({
  title:               z.string().min(1, 'Title is required').max(300),
  value:               z.number().min(0).optional().default(0),
  stage:               z.enum(DEAL_STAGES).optional().default('lead'),
  contact_id:          z.string().uuid().optional().nullable(),
  owner_id:            z.string().uuid().optional().nullable(),
  expected_close_date: z.string().optional().nullable(),
  notes:               z.string().max(5000).optional(),
});

const stageSchema = z.object({
  stage: z.enum(DEAL_STAGES),
});

// ── GET / ───────────────────────────────────────────────────
router.get('/', ...guard, requirePermission(PERMISSIONS.VIEW_DEALS), async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1'));
    const limit  = Math.min(100, parseInt(req.query.limit || '50'));
    const offset = (page - 1) * limit;
    const stage  = req.query.stage  || '';
    const search = req.query.search?.trim() || '';

    const rows = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      const conditions = ['1=1'];
      const params     = [];

      if (stage) {
        params.push(stage);
        conditions.push(`d.stage = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`d.title ILIKE $${params.length}`);
      }

      const where = conditions.join(' AND ');

      const countResult = await client.query(
        `SELECT COUNT(*) FROM deals d WHERE ${where}`, params
      );
      const total = parseInt(countResult.rows[0].count);

      params.push(limit, offset);
      const dataResult = await client.query(
        `SELECT d.*, c.name AS contact_name, u.name AS owner_name
         FROM deals d
         LEFT JOIN contacts c ON c.id = d.contact_id
         LEFT JOIN users   u ON u.id = d.owner_id
         WHERE ${where}
         ORDER BY d.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return { deals: dataResult.rows, total };
    });

    res.json({
      deals: rows.deals,
      pagination: { page, limit, total: rows.total, pages: Math.ceil(rows.total / limit) },
    });
  } catch (err) { next(err); }
});

// ── GET /kanban — grouped by stage for the board view ───────
router.get('/kanban', ...guard, requirePermission(PERMISSIONS.VIEW_DEALS), async (req, res, next) => {
  try {
    const data = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);
      const r = await client.query(
        `SELECT d.*, c.name AS contact_name, u.name AS owner_name
         FROM deals d
         LEFT JOIN contacts c ON c.id = d.contact_id
         LEFT JOIN users   u ON u.id = d.owner_id
         ORDER BY d.created_at DESC`
      );
      return r.rows;
    });

    // Group into stage buckets
    const board = Object.fromEntries(DEAL_STAGES.map((s) => [s, []]));
    data.forEach((deal) => {
      if (board[deal.stage]) board[deal.stage].push(deal);
    });

    // Stage totals (value sum per column)
    const totals = Object.fromEntries(
      DEAL_STAGES.map((s) => [
        s,
        board[s].reduce((sum, d) => sum + parseFloat(d.value || 0), 0),
      ])
    );

    res.json({ board, totals });
  } catch (err) { next(err); }
});

// ── POST / ──────────────────────────────────────────────────
router.post('/', ...guard, requirePermission(PERMISSIONS.CREATE_DEAL), async (req, res, next) => {
  const result = validate(dealSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const { title, value, stage, contact_id, owner_id, expected_close_date, notes } = result.data;

  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      const tenantResult = await client.query('SELECT plan FROM tenants WHERE id = $1', [req.tenantId]);
      const plan = tenantResult.rows[0]?.plan || 'free';
      const limitCheck = await checkLimit(client, req.tenantId, plan, 'deals');
      if (!limitCheck.allowed) {
        const err = new Error(
          `Your ${plan} plan is limited to ${limitCheck.limit} deals (you have ${limitCheck.count}). Upgrade to add more.`
        );
        err.status = 402;
        throw err;
      }

      const r = await client.query(
        `INSERT INTO deals (tenant_id, title, value, stage, contact_id, owner_id, expected_close_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.tenantId, title, value, stage, contact_id||null, owner_id||req.user.id, expected_close_date||null, notes||null]
      );
      const deal = r.rows[0];
      await logAction(client, {
        tenantId: req.tenantId,
        actor: req.user,
        action: 'deal.created',
        targetType: 'deal',
        targetId: deal.id,
        targetLabel: deal.title,
        metadata: { stage: deal.stage, value: deal.value },
      });
      return deal;
    });
    res.status(201).json({ deal: row });
  } catch (err) { next(err); }
});

// ── GET /:id ────────────────────────────────────────────────
router.get('/:id', ...guard, requirePermission(PERMISSIONS.VIEW_DEALS), async (req, res, next) => {
  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);
      const r = await client.query(
        `SELECT d.*, c.name AS contact_name, u.name AS owner_name
         FROM deals d
         LEFT JOIN contacts c ON c.id = d.contact_id
         LEFT JOIN users   u ON u.id = d.owner_id
         WHERE d.id = $1`,
        [req.params.id]
      );
      return r.rows[0];
    });
    if (!row) return res.status(404).json({ error: 'Deal not found.' });
    res.json({ deal: row });
  } catch (err) { next(err); }
});

// ── PUT /:id ────────────────────────────────────────────────
router.put('/:id', ...guard, requirePermission(PERMISSIONS.EDIT_DEAL), async (req, res, next) => {
  const result = validate(dealSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const { title, value, stage, contact_id, owner_id, expected_close_date, notes } = result.data;

  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);
      const r = await client.query(
        `UPDATE deals SET title=$1, value=$2, stage=$3, contact_id=$4,
         owner_id=$5, expected_close_date=$6, notes=$7
         WHERE id=$8 RETURNING *`,
        [title, value, stage, contact_id||null, owner_id||null, expected_close_date||null, notes||null, req.params.id]
      );
      const deal = r.rows[0];
      if (deal) {
        await logAction(client, {
          tenantId: req.tenantId,
          actor: req.user,
          action: 'deal.updated',
          targetType: 'deal',
          targetId: deal.id,
          targetLabel: deal.title,
        });
      }
      return deal;
    });
    if (!row) return res.status(404).json({ error: 'Deal not found.' });
    res.json({ deal: row });
  } catch (err) { next(err); }
});

// ── PATCH /:id/stage — move a card on the Kanban board ──────
router.patch('/:id/stage', ...guard, requirePermission(PERMISSIONS.EDIT_DEAL), async (req, res, next) => {
  const result = validate(stageSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      const existing = await client.query(`SELECT stage, title FROM deals WHERE id=$1`, [req.params.id]);
      if (existing.rows.length === 0) return null;
      const oldStage = existing.rows[0].stage;

      const r = await client.query(
        `UPDATE deals SET stage=$1 WHERE id=$2 RETURNING *`,
        [result.data.stage, req.params.id]
      );
      const deal = r.rows[0];

      if (deal && oldStage !== deal.stage) {
        await logAction(client, {
          tenantId: req.tenantId,
          actor: req.user,
          action: 'deal.stage_changed',
          targetType: 'deal',
          targetId: deal.id,
          targetLabel: deal.title,
          metadata: { from: oldStage, to: deal.stage },
        });
      }
      return deal;
    });
    if (!row) return res.status(404).json({ error: 'Deal not found.' });
    res.json({ deal: row });
  } catch (err) { next(err); }
});

// ── DELETE /:id ─────────────────────────────────────────────
router.delete('/:id', ...guard, requirePermission(PERMISSIONS.DELETE_DEAL), async (req, res, next) => {
  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);
      const r = await client.query(
        `DELETE FROM deals WHERE id=$1 RETURNING id, title`, [req.params.id]
      );
      const deal = r.rows[0];
      if (deal) {
        await logAction(client, {
          tenantId: req.tenantId,
          actor: req.user,
          action: 'deal.deleted',
          targetType: 'deal',
          targetId: deal.id,
          targetLabel: deal.title,
        });
      }
      return deal;
    });
    if (!row) return res.status(404).json({ error: 'Deal not found.' });
    res.json({ message: 'Deal deleted.' });
  } catch (err) { next(err); }
});

export default router;
