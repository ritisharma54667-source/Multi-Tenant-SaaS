// ============================================================
// RATE LIMITING
// ============================================================
// Two limiters:
//   - globalLimiter: IP-based, applies to every request as a
//     blunt first line of defense.
//   - tenantLimiter: Phase 8 upgrade promised back in Phase 2.
//     Keyed by the X-Tenant-Id header when present (falls back to
//     IP for routes hit before a tenant is known, e.g. /auth/login).
//     This means one noisy/compromised workspace can't eat another
//     tenant's quota on a shared IP (e.g. both behind the same
//     corporate NAT) — each tenant gets its own bucket.
// ============================================================

import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                  // generous default; tightened per-route later
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter limiter reserved for auth endpoints (login/signup) in Phase 2,
// to slow down brute-force attempts.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// Per-tenant quota, applied globally alongside globalLimiter. Higher
// ceiling than the IP limiter since it's a second, independent bucket
// rather than a replacement — a busy workspace with several team
// members hitting the API from different IPs is still one tenant.
export const tenantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-tenant-id'] || req.ip,
  message: { error: 'This workspace is making too many requests. Please slow down.' },
});
