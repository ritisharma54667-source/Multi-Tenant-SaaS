// ============================================================
// TEAM MEMBERS ROUTES
// ============================================================
// All routes require: requireAuth → resolveTenantContext (confirms
// membership + sets RLS) → then the specific permission check.
//
// GET    /api/v1/team           — list all members (view_members)
// POST   /api/v1/team/invite    — invite by email (invite_member)
// PATCH  /api/v1/team/:memberId/role  — change role (change_role)
// DELETE /api/v1/team/:memberId       — remove member (remove_member)
//
// Phase 6: invite/role-change/removal now attempt a real
// notification email via utils/mailer.js (falls back to a
// console log if SMTP isn't configured — see .env.example), and
// every one of these actions writes a row to audit_logs via
// utils/auditLog.js so admins can see who did what, from /audit-log.
// ============================================================

import { Router } from 'express';
import { pool, query, withTenantClient } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { resolveTenantContext } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS, ROLE_RANK } from '../config/permissions.js';
import { z } from 'zod';
import { validate } from '../validation/schemas.js';
import { sendMail } from '../utils/mailer.js';
import { logAction } from '../utils/auditLog.js';
import { checkLimit } from '../config/plans.js';

const router = Router();

// Every route here is tenant-scoped
const tenantGuard = [requireAuth, resolveTenantContext];

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'member', 'viewer']),
});

const changeRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'member', 'viewer']),
});

// ------------------------------------------------------------
// GET / — list members in current tenant
// ------------------------------------------------------------
router.get('/', ...tenantGuard, requirePermission(PERMISSIONS.VIEW_MEMBERS), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.id, m.role, m.created_at, u.id AS user_id, u.name, u.email
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.tenant_id = $1
       ORDER BY m.created_at ASC`,
      [req.tenantId]
    );
    res.json({ members: result.rows });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// POST /invite
// ------------------------------------------------------------
router.post('/invite', ...tenantGuard, requirePermission(PERMISSIONS.INVITE_MEMBER), async (req, res, next) => {
  const result = validate(inviteSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const { email, role } = result.data;

  // You cannot invite someone with a role higher than your own.
  // E.g. a manager (rank 2) cannot promote someone to admin (rank 3).
  if (ROLE_RANK[role] >= ROLE_RANK[req.role]) {
    return res.status(403).json({
      error: `You cannot assign the '${role}' role — it is equal to or higher than your own.`,
    });
  }

  const client = await pool.connect();
  try {
    // Check if user exists
    const userResult = await client.query('SELECT id, name FROM users WHERE email = $1', [email]);

    // Look up the workspace name once, used in both notification emails below
    const tenantResult = await client.query('SELECT name, plan FROM tenants WHERE id = $1', [req.tenantId]);
    const tenantName = tenantResult.rows[0]?.name || 'your workspace';
    const tenantPlan = tenantResult.rows[0]?.plan || 'free';

    if (userResult.rows.length === 0) {
      // No account yet — send (or log) an invite email so they know
      // to sign up. We can't create the membership until they exist,
      // so this is a notification-only path, no DB write here.
      const mailResult = await sendMail({
        to: email,
        subject: `You've been invited to join ${tenantName}`,
        text: `${req.user.name} invited you to join "${tenantName}" as ${role}. ` +
              `Sign up with this email address to accept the invite.`,
      });

      await withTenantClient(req.tenantId, async (c) => {
        await logAction(c, {
          tenantId: req.tenantId,
          actor: req.user,
          action: 'member.invited',
          targetType: 'membership',
          targetLabel: email,
          metadata: { role, emailMode: mailResult.mode },
        });
      });

      return res.status(202).json({
        message: mailResult.delivered
          ? 'Invite email sent — they need to sign up with this email to join.'
          : 'User not found. Invite logged to the backend console (no SMTP configured — see .env.example).',
        email,
      });
    }

    const invitee = userResult.rows[0];

    // Check if already a member
    const existing = await client.query(
      'SELECT id FROM memberships WHERE user_id = $1 AND tenant_id = $2',
      [invitee.id, req.tenantId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This user is already a member of this workspace.' });
    }

    const limitCheck = await checkLimit(client, req.tenantId, tenantPlan, 'members');
    if (!limitCheck.allowed) {
      return res.status(402).json({
        error: `Your ${tenantPlan} plan is limited to ${limitCheck.limit} team members (you have ${limitCheck.count}). Upgrade to add more.`,
      });
    }

    const membershipResult = await client.query(
      `INSERT INTO memberships (user_id, tenant_id, role) VALUES ($1, $2, $3)
       RETURNING id, role, created_at`,
      [invitee.id, req.tenantId, role]
    );

    const mailResult = await sendMail({
      to: email,
      subject: `You've been added to ${tenantName}`,
      text: `${req.user.name} added you to "${tenantName}" as ${role}. Log in to get started.`,
    });

    await withTenantClient(req.tenantId, async (c) => {
      await logAction(c, {
        tenantId: req.tenantId,
        actor: req.user,
        action: 'member.invited',
        targetType: 'membership',
        targetId: membershipResult.rows[0].id,
        targetLabel: email,
        metadata: { role, emailMode: mailResult.mode },
      });
    });

    res.status(201).json({
      member: {
        ...membershipResult.rows[0],
        userId: invitee.id,
        name: invitee.name,
        email,
      },
    });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------
// PATCH /:memberId/role — change a member's role
// ------------------------------------------------------------
router.patch('/:memberId/role', ...tenantGuard, requirePermission(PERMISSIONS.CHANGE_ROLE), async (req, res, next) => {
  const result = validate(changeRoleSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const { role: newRole } = result.data;
  const { memberId } = req.params;

  // Same rank-guard as invite
  if (ROLE_RANK[newRole] >= ROLE_RANK[req.role]) {
    return res.status(403).json({
      error: `You cannot assign the '${newRole}' role — it is equal to or higher than your own.`,
    });
  }

  try {
    // Fetch the target membership + user info, confirm it belongs to this tenant
    const memberResult = await query(
      `SELECT m.user_id, m.role, u.name, u.email
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND m.tenant_id = $2`,
      [memberId, req.tenantId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in this workspace.' });
    }

    const target = memberResult.rows[0];

    // You cannot demote/change the role of someone equal or higher rank than you
    if (ROLE_RANK[target.role] >= ROLE_RANK[req.role]) {
      return res.status(403).json({ error: 'You cannot change the role of this member.' });
    }

    // Prevent demoting the last owner
    if (target.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await query(
        `SELECT COUNT(*) FROM memberships WHERE tenant_id = $1 AND role = 'owner'`,
        [req.tenantId]
      );
      if (parseInt(ownerCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Workspace must have at least one owner.' });
      }
    }

    const updated = await query(
      'UPDATE memberships SET role = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, role',
      [newRole, memberId, req.tenantId]
    );

    const oldRole = target.role;
    const mailResult = await sendMail({
      to: target.email,
      subject: `Your role was updated`,
      text: `${req.user.name} changed your role from ${oldRole} to ${newRole}.`,
    });

    await withTenantClient(req.tenantId, async (c) => {
      await logAction(c, {
        tenantId: req.tenantId,
        actor: req.user,
        action: 'member.role_changed',
        targetType: 'membership',
        targetId: memberId,
        targetLabel: target.name,
        metadata: { from: oldRole, to: newRole, emailMode: mailResult.mode },
      });
    });

    res.json({ member: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// DELETE /:memberId — remove a member
// ------------------------------------------------------------
router.delete('/:memberId', ...tenantGuard, requirePermission(PERMISSIONS.REMOVE_MEMBER), async (req, res, next) => {
  const { memberId } = req.params;

  try {
    const memberResult = await query(
      `SELECT m.user_id, m.role, u.name, u.email
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND m.tenant_id = $2`,
      [memberId, req.tenantId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in this workspace.' });
    }

    const target = memberResult.rows[0];

    // Cannot remove someone of equal or higher rank
    if (ROLE_RANK[target.role] >= ROLE_RANK[req.role]) {
      return res.status(403).json({ error: 'You cannot remove this member.' });
    }

    // Cannot remove the last owner
    if (target.role === 'owner') {
      const ownerCount = await query(
        `SELECT COUNT(*) FROM memberships WHERE tenant_id = $1 AND role = 'owner'`,
        [req.tenantId]
      );
      if (parseInt(ownerCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last owner of the workspace.' });
      }
    }

    // Prevent self-removal via this endpoint (use leave/delete account later)
    if (target.user_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot remove yourself. Use the leave workspace option.' });
    }

    await query('DELETE FROM memberships WHERE id = $1 AND tenant_id = $2', [memberId, req.tenantId]);

    const mailResult = await sendMail({
      to: target.email,
      subject: `You've been removed from a workspace`,
      text: `${req.user.name} removed you from a workspace you were a member of.`,
    });

    await withTenantClient(req.tenantId, async (c) => {
      await logAction(c, {
        tenantId: req.tenantId,
        actor: req.user,
        action: 'member.removed',
        targetType: 'membership',
        targetId: memberId,
        targetLabel: target.name,
        metadata: { role: target.role, emailMode: mailResult.mode },
      });
    });

    res.json({ message: 'Member removed.' });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// GET /permissions — return current user's permissions in this
// tenant (useful for the frontend to drive UI conditionally)
// ------------------------------------------------------------
router.get('/permissions', ...tenantGuard, async (req, res) => {
  const { ROLE_PERMISSIONS } = await import('../config/permissions.js');
  res.json({
    role: req.role,
    permissions: ROLE_PERMISSIONS[req.role] ?? [],
  });
});

export default router;
