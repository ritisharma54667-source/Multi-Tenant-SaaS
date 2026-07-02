// ============================================================
// BILLING ROUTES  /api/v1/billing
// ============================================================
// GET  /          — current plan, limits, and live usage counts.
//                    Any authenticated member can view this
//                    (seeing "you're at 24/25 contacts" shouldn't
//                    require manage_billing — everyone hits the
//                    limit, only the owner can lift it).
// POST /change-plan — switch tenant plan. Gated behind
//                    manage_billing (owner-only, per Phase 3's
//                    permission table — this is the first route
//                    that actually uses that permission).
//
// No real payment processor — see config/plans.js for why, and
// what swapping in Stripe later would look like.
// ============================================================

import { Router } from 'express';
import { withTenantClient } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { resolveTenantContext } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/permissions.js';
import { PLANS, PLAN_LIMITS, PLAN_META } from '../config/plans.js';
import { logAction } from '../utils/auditLog.js';
import { z } from 'zod';
import { validate } from '../validation/schemas.js';

const router = Router();
const guard  = [requireAuth, resolveTenantContext];

const changePlanSchema = z.object({
  plan: z.enum(PLANS),
});

// Serialize Infinity as "unlimited" — Infinity doesn't survive JSON.
function serializeLimit(n) {
  return n === Infinity ? 'unlimited' : n;
}

// ── GET / — current plan, limits, and live usage ────────────
router.get('/', ...guard, async (req, res, next) => {
  try {
    const data = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      const tenantResult = await client.query('SELECT plan FROM tenants WHERE id = $1', [req.tenantId]);
      const plan = tenantResult.rows[0]?.plan || 'free';

      const [contactsCount, dealsCount, membersCount] = await Promise.all([
        client.query('SELECT COUNT(*) FROM contacts WHERE tenant_id = $1', [req.tenantId]),
        client.query('SELECT COUNT(*) FROM deals WHERE tenant_id = $1', [req.tenantId]),
        client.query('SELECT COUNT(*) FROM memberships WHERE tenant_id = $1', [req.tenantId]),
      ]);

      const limits = PLAN_LIMITS[plan];

      return {
        plan,
        planMeta: PLAN_META[plan],
        usage: {
          contacts: { count: parseInt(contactsCount.rows[0].count), limit: serializeLimit(limits.contacts) },
          deals:    { count: parseInt(dealsCount.rows[0].count),    limit: serializeLimit(limits.deals) },
          members:  { count: parseInt(membersCount.rows[0].count),  limit: serializeLimit(limits.members) },
        },
      };
    });

    res.json(data);
  } catch (err) { next(err); }
});

// ── GET /plans — static plan catalog for the pricing/upgrade UI ──
router.get('/plans', ...guard, async (req, res) => {
  res.json({
    plans: PLANS.map((id) => ({
      id,
      ...PLAN_META[id],
      limits: {
        contacts: serializeLimit(PLAN_LIMITS[id].contacts),
        deals: serializeLimit(PLAN_LIMITS[id].deals),
        members: serializeLimit(PLAN_LIMITS[id].members),
      },
    })),
  });
});

// ── POST /change-plan ────────────────────────────────────────
router.post('/change-plan', ...guard, requirePermission(PERMISSIONS.MANAGE_BILLING), async (req, res, next) => {
  const result = validate(changePlanSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const newPlan = result.data.plan;

  try {
    const data = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      const current = await client.query('SELECT plan, name FROM tenants WHERE id = $1', [req.tenantId]);
      const oldPlan = current.rows[0]?.plan;
      const tenantName = current.rows[0]?.name;

      // Downgrading below current usage is allowed (matches how most
      // real billing systems behave — you're just "over" until you
      // trim data or upgrade again; existing rows aren't deleted).
      const updated = await client.query(
        'UPDATE tenants SET plan = $1 WHERE id = $2 RETURNING plan',
        [newPlan, req.tenantId]
      );

      await logAction(client, {
        tenantId: req.tenantId,
        actor: req.user,
        action: 'billing.plan_changed',
        targetType: 'tenant',
        targetId: req.tenantId,
        targetLabel: tenantName,
        metadata: { from: oldPlan, to: newPlan },
      });

      return { plan: updated.rows[0].plan, oldPlan };
    });

    res.json({ plan: data.plan, planMeta: PLAN_META[data.plan] });
  } catch (err) { next(err); }
});

export default router;
