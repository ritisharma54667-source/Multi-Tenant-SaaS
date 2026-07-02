// ============================================================
// AUTH ROUTES
// ============================================================
// POST /api/v1/auth/signup           — creates user + their first tenant
//                                       (org onboarding) + owner membership,
//                                       all in one DB transaction
// POST /api/v1/auth/login            — verifies credentials, returns tokens
//                                       + the user's tenant memberships
// POST /api/v1/auth/refresh          — exchanges a refresh token for a new
//                                       access token
// GET  /api/v1/auth/me                — returns current user (requires auth)
// POST /api/v1/auth/forgot-password  — emails a reset link if the address
//                                       has an account (added post-Phase-8)
// POST /api/v1/auth/reset-password   — consumes the token from that email,
//                                       sets a new password
// ============================================================

import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { slugify, withRandomSuffix } from '../utils/slug.js';
import { generateResetToken, hashResetToken } from '../utils/resetToken.js';
import { sendMail } from '../utils/mailer.js';
import {
  signupSchema, loginSchema, refreshSchema,
  forgotPasswordSchema, resetPasswordSchema, validate,
} from '../validation/schemas.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ------------------------------------------------------------
// POST /signup
// Creates: user -> tenant -> membership(role=owner), atomically.
// If any step fails, the whole transaction rolls back — you never
// end up with an orphaned user-with-no-tenant or tenant-with-no-owner.
// ------------------------------------------------------------
router.post('/signup', authLimiter, async (req, res, next) => {
  const result = validate(signupSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const { name, email, password, organizationName } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Reject duplicate email up front (also enforced by DB UNIQUE constraint)
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await hashPassword(password);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name`,
      [email, passwordHash, name]
    );
    const user = userResult.rows[0];

    // Generate a unique slug for the new org
    let slug = slugify(organizationName);
    const slugTaken = await client.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (slugTaken.rows.length > 0) slug = withRandomSuffix(slug);

    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id, name, slug, plan`,
      [organizationName, slug]
    );
    const tenant = tenantResult.rows[0];

    await client.query(
      `INSERT INTO memberships (user_id, tenant_id, role) VALUES ($1, $2, 'owner')`,
      [user.id, tenant.id]
    );

    await client.query('COMMIT');

    const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
    const refreshToken = signRefreshToken({ sub: user.id });

    res.status(201).json({
      user,
      accessToken,
      refreshToken,
      memberships: [{ tenantId: tenant.id, tenantName: tenant.name, role: 'owner', plan: tenant.plan }],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------
// POST /login
// ------------------------------------------------------------
router.post('/login', authLimiter, async (req, res, next) => {
  const result = validate(loginSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const { email, password } = result.data;

  try {
    const userResult = await query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email]
    );

    // Same error for "no such user" and "wrong password" — don't leak
    // which one it was, that's a user-enumeration vector.
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const membershipsResult = await query(
      `SELECT m.tenant_id, m.role, t.name AS tenant_name, t.plan
       FROM memberships m JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = $1`,
      [user.id]
    );

    const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
    const refreshToken = signRefreshToken({ sub: user.id });

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
      memberships: membershipsResult.rows.map((m) => ({
        tenantId: m.tenant_id,
        tenantName: m.tenant_name,
        role: m.role,
        plan: m.plan,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// POST /refresh
// ------------------------------------------------------------
router.post('/refresh', async (req, res, next) => {
  const result = validate(refreshSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  try {
    const payload = verifyRefreshToken(result.data.refreshToken);

    const userResult = await query('SELECT id, email, name FROM users WHERE id = $1', [payload.sub]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }
    const user = userResult.rows[0];

    const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
    res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});

// ------------------------------------------------------------
// GET /me
// ------------------------------------------------------------
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const membershipsResult = await query(
      `SELECT m.tenant_id, m.role, t.name AS tenant_name, t.plan
       FROM memberships m JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = $1`,
      [req.user.id]
    );

    res.json({
      user: req.user,
      memberships: membershipsResult.rows.map((m) => ({
        tenantId: m.tenant_id,
        tenantName: m.tenant_name,
        role: m.role,
        plan: m.plan,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// POST /forgot-password
// ------------------------------------------------------------
// Always returns the same generic success message, whether or not
// the email exists — telling the caller "that email isn't
// registered" is a user-enumeration vector (same principle already
// applied to /login's "invalid email or password" message).
// ------------------------------------------------------------
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  const result = validate(forgotPasswordSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const GENERIC_MESSAGE = { message: 'If an account exists for that email, a reset link has been sent.' };

  try {
    const userResult = await query('SELECT id, name FROM users WHERE email = $1', [result.data.email]);
    if (userResult.rows.length === 0) {
      return res.json(GENERIC_MESSAGE); // don't reveal whether the email exists
    }
    const user = userResult.rows[0];

    const { rawToken, tokenHash, expiresAt } = generateResetToken();
    await query(
      'UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3',
      [tokenHash, expiresAt, user.id]
    );

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
    await sendMail({
      to: result.data.email,
      subject: 'Reset your password',
      text: `Hi ${user.name}, click this link to reset your password (expires in 30 minutes): ${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
    });

    res.json(GENERIC_MESSAGE);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// POST /reset-password
// ------------------------------------------------------------
// Looks the user up by TOKEN, not by email (the frontend never
// even asks for the email again) — the hashed token in the URL is
// the only thing proving "this is the person who received the
// email." Checks expiry, then clears the token on success so it
// can't be reused (single-use, per standard reset-flow practice).
// ------------------------------------------------------------
router.post('/reset-password', authLimiter, async (req, res, next) => {
  const result = validate(resetPasswordSchema, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });

  const { token, password } = result.data;
  const tokenHash = hashResetToken(token);

  try {
    const userResult = await query(
      'SELECT id, reset_token_expires_at FROM users WHERE reset_token_hash = $1',
      [tokenHash]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'This reset link is invalid. Request a new one.' });
    }

    const user = userResult.rows[0];
    if (new Date(user.reset_token_expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired. Request a new one.' });
    }

    const passwordHash = await hashPassword(password);
    await query(
      'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password updated. You can log in with your new password now.' });
  } catch (err) {
    next(err);
  }
});

export default router;
