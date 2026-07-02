# Multi-Tenant SaaS CRM — Phase 2: Auth & Tenant Onboarding

Builds on Phase 1's foundation. This phase makes the tenant isolation
pattern actually fire: real signup/login, JWT issuance, refresh-token
rotation on 401, and workspace switching that the backend independently
re-verifies on every request.

## What's new in this phase

**Backend**
- `POST /api/v1/auth/signup` — creates user + first tenant + owner
  membership in **one DB transaction** (rolls back fully on any failure)
- `POST /api/v1/auth/login` — verifies credentials, returns access +
  refresh tokens and the user's tenant memberships
- `POST /api/v1/auth/refresh` — exchanges refresh token for new access token
- `GET /api/v1/auth/me` — returns current user (requires valid access token)
- `GET/POST /api/v1/tenants` — list user's workspaces / create an
  additional one
- `requireAuth` middleware — verifies the JWT and attaches `req.user`;
  runs before `resolveTenantContext` (from Phase 1) on any tenant-scoped
  route added from Phase 4 onward
- zod schema validation on every body-accepting route
- `helmet` for security headers
- Passwords hashed with bcrypt (12 rounds), never stored or logged in plaintext

**Frontend**
- `/signup` — combined account + organization onboarding form
- `/login`
- `/dashboard` — protected route, proves the full auth → tenant flow works
- `/workspaces/new` — create an additional workspace while logged in
- Workspace switcher dropdown in the navbar (reads from `tenantStore`)
- `apiClient` now auto-refreshes the access token on a 401 and retries
  the original request once; logs the user out if refresh also fails
- `ProtectedRoute` component guards authenticated pages (UX convenience
  only — actual data access is always re-verified server-side)

## Setup

Same as Phase 1, plus:

```bash
cd backend
npm install        # picks up zod, helmet
npm run db:setup    # re-run is safe, schema unchanged this phase
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Try it: go to `/signup`, create an account + org name, you'll land on
`/dashboard` already authenticated with a real JWT and a confirmed
tenant membership. Open dev tools → Network and check the `X-Tenant-Id`
header is being sent, and that the backend is the one deciding access
(try editing localStorage's tenant ID to something fake — the next API
call should 403, not silently succeed).

## Honest gaps to know about

- Refresh tokens are stored in localStorage via Zustand persist, not an
  httpOnly cookie. That's a known tradeoff for dev speed — fine for a
  portfolio piece, worth fixing (httpOnly + secure cookie) before any
  real production use.
- No email verification or password reset yet — out of scope for this phase.
- `resolveTenantContext` (Phase 1) still isn't called by any route yet,
  because there's no tenant-scoped *data* to protect until Phase 4 (CRM
  module). It's tested implicitly here only through the `/tenants` routes
  which use simpler membership checks directly.

## Next: Phase 3 — Role-Based Access Control
Permission middleware per role (owner/admin/manager/member/viewer), team
members page, invite flow.

