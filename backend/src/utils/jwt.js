// ============================================================
// JWT UTILITIES
// ============================================================
// Used starting Phase 2 for login/signup. Scaffolded now so the
// folder structure and env vars are already correct.
//
// Access tokens: short-lived, sent on every request.
// Refresh tokens: longer-lived, used to mint new access tokens.
// tenant_id is intentionally NOT baked into the access token —
// per the auth rules, tenant context is re-verified per request
// via the memberships table, not trusted from a stale token claim.
// ============================================================

import jwt from 'jsonwebtoken';

export function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}
