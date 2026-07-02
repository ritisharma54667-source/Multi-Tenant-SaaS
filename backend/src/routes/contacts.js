// ============================================================
// CONTACTS ROUTES  /api/v1/contacts
// ============================================================
// Every query runs through withTenantClient() which:
//   1. Checks out a DB client
//   2. Sets app.current_tenant_id for the session
//   3. RLS then silently filters all rows to that tenant
//
// So even if a bug forgot the WHERE clause, Postgres won't
// return another tenant's contacts. Defense in depth.
//
// GET    /              list (pagination + search + status filter)
// POST   /              create
// GET    /:id           get one
// PUT    /:id           full update
// PATCH  /:id          partial update
// DELETE /:id           delete
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

// All contact routes: auth → tenant → then per-route permission
const guard = [requireAuth, resolveTenantContext];

// ── Schemas ─────────────────────────────────────────────────
const contactSchema = z.object({
  name:    z.string().min(1, 'Name is required').max(200),
  email:   z.string().email().optional().or(z.literal('')),
  phone:   z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  status:  z.enum(['lead', 'active', 'churned']).optional(),
  notes:   z.string().max(5000).optional(),
  owner_id: z.string().uuid().optional().nullable(),
});

const partialContactSchema = contactSchema.partial();

// ── GET / ───────────────────────────────────────────────────
router.get('/', ...guard, requirePermission(PERMISSIONS.VIEW_CONTACTS), async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1'));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20')));
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const status = req.query.status || '';

    const rows = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      // Build WHERE conditions dynamically
      const conditions = ['1=1'];
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(c.name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.company ILIKE $${params.length})`);
      }
      if (status) {
        params.push(status);
        conditions.push(`c.status = $${params.length}`);
      }

      const where = conditions.join(' AND ');

      // Count for pagination
      const countResult = await client.query(
        `SELECT COUNT(*) FROM contacts c WHERE ${where}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Fetch page
      params.push(limit, offset);
      const dataResult = await client.query(
        `SELECT c.*, u.name AS owner_name
         FROM contacts c
         LEFT JOIN users u ON u.id = c.owner_id
         WHERE ${where}
         ORDER BY c.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return { contacts: dataResult.rows, total };
    });

    res.json({
      contacts: rows.contacts,
      pagination: { page, limit, total: rows.total, pages: Math.ceil(rows.total / limit) },
    });
  } catch (err) { next(err); }
});

// ── POST / ──────────────────────────────────────────────────
router.post('/', ...guard, requirePermission(PERMISSIONS.CREATE_CONTACT), async (req, res, next) => {
  const result = validate(contactSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const { name, email, phone, company, status = 'lead', notes, owner_id } = result.data;

  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      const tenantResult = await client.query('SELECT plan FROM tenants WHERE id = $1', [req.tenantId]);
      const plan = tenantResult.rows[0]?.plan || 'free';
      const limitCheck = await checkLimit(client, req.tenantId, plan, 'contacts');
      if (!limitCheck.allowed) {
        const err = new Error(
          `Your ${plan} plan is limited to ${limitCheck.limit} contacts (you have ${limitCheck.count}). Upgrade to add more.`
        );
        err.status = 402;
        throw err;
      }

      const r = await client.query(
        `INSERT INTO contacts (tenant_id, name, email, phone, company, status, notes, owner_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.tenantId, name, email || null, phone || null, company || null, status, notes || null, owner_id || req.user.id]
      );
      const contact = r.rows[0];
      await logAction(client, {
        tenantId: req.tenantId,
        actor: req.user,
        action: 'contact.created',
        targetType: 'contact',
        targetId: contact.id,
        targetLabel: contact.name,
      });
      return contact;
    });
    res.status(201).json({ contact: row });
  } catch (err) { next(err); }
});

// ── GET /:id ────────────────────────────────────────────────
router.get('/:id', ...guard, requirePermission(PERMISSIONS.VIEW_CONTACTS), async (req, res, next) => {
  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);
      const r = await client.query(
        `SELECT c.*, u.name AS owner_name
         FROM contacts c LEFT JOIN users u ON u.id = c.owner_id
         WHERE c.id = $1`,
        [req.params.id]
      );
      return r.rows[0];
    });
    if (!row) return res.status(404).json({ error: 'Contact not found.' });
    res.json({ contact: row });
  } catch (err) { next(err); }
});

// ── PUT /:id ────────────────────────────────────────────────
router.put('/:id', ...guard, requirePermission(PERMISSIONS.EDIT_CONTACT), async (req, res, next) => {
  const result = validate(contactSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const { name, email, phone, company, status, notes, owner_id } = result.data;

  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);
      const r = await client.query(
        `UPDATE contacts SET name=$1, email=$2, phone=$3, company=$4,
         status=$5, notes=$6, owner_id=$7
         WHERE id=$8 RETURNING *`,
        [name, email||null, phone||null, company||null, status||'lead', notes||null, owner_id||null, req.params.id]
      );
      const contact = r.rows[0];
      if (contact) {
        await logAction(client, {
          tenantId: req.tenantId,
          actor: req.user,
          action: 'contact.updated',
          targetType: 'contact',
          targetId: contact.id,
          targetLabel: contact.name,
        });
      }
      return contact;
    });
    if (!row) return res.status(404).json({ error: 'Contact not found.' });
    res.json({ contact: row });
  } catch (err) { next(err); }
});

// ── PATCH /:id ──────────────────────────────────────────────
router.patch('/:id', ...guard, requirePermission(PERMISSIONS.EDIT_CONTACT), async (req, res, next) => {
  const result = validate(partialContactSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const fields = result.data;
  const keys   = Object.keys(fields);
  if (keys.length === 0) return res.status(400).json({ error: 'No fields to update.' });

  // Build SET clause dynamically
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values     = keys.map((k) => fields[k]);

  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);
      const r = await client.query(
        `UPDATE contacts SET ${setClauses} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, req.params.id]
      );
      const contact = r.rows[0];
      if (contact) {
        await logAction(client, {
          tenantId: req.tenantId,
          actor: req.user,
          action: 'contact.updated',
          targetType: 'contact',
          targetId: contact.id,
          targetLabel: contact.name,
          metadata: { fields: keys },
        });
      }
      return contact;
    });
    if (!row) return res.status(404).json({ error: 'Contact not found.' });
    res.json({ contact: row });
  } catch (err) { next(err); }
});

// ── DELETE /:id ─────────────────────────────────────────────
router.delete('/:id', ...guard, requirePermission(PERMISSIONS.DELETE_CONTACT), async (req, res, next) => {
  try {
    const row = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);
      const r = await client.query(
        `DELETE FROM contacts WHERE id = $1 RETURNING id, name`, [req.params.id]
      );
      const contact = r.rows[0];
      if (contact) {
        await logAction(client, {
          tenantId: req.tenantId,
          actor: req.user,
          action: 'contact.deleted',
          targetType: 'contact',
          targetId: contact.id,
          targetLabel: contact.name,
        });
      }
      return contact;
    });
    if (!row) return res.status(404).json({ error: 'Contact not found.' });
    res.json({ message: 'Contact deleted.' });
  } catch (err) { next(err); }
});

export default router;
