// ============================================================
// REQUIRE AUTH MIDDLEWARE
// ============================================================
// Verifies the access token from the Authorization header and
// attaches the decoded payload to req.user. This MUST run before
// resolveTenantContext on any protected, tenant-scoped route —
// tenant resolution depends on req.user.id being trustworthy.
//
// Note: this only proves WHO the user is. It does NOT prove
// which tenant they're allowed into — that's a separate check
// done by resolveTenantContext against the memberships table.
// Never skip one step because the other passed.
// ============================================================

import { verifyAccessToken } from '../utils/jwt.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = verifyAccessToken(token); // throws if invalid/expired
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired access token.' });
  }
}
