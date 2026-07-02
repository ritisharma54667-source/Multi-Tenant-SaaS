// ============================================================
// RBAC MIDDLEWARE
// ============================================================
// Two composable guards used on any route that needs role/
// permission checking:
//
//   requireRole('admin')          — user must have AT LEAST that
//                                    role in the current tenant
//   requirePermission('invite_member') — user must have that
//                                    specific permission
//
// Both depend on req.role which is set by resolveTenantContext
// (the middleware that checks the memberships table) — so call
// order on any route must be:
//
//   requireAuth → resolveTenantContext → requireRole / requirePermission
// ============================================================

import { hasMinRole, can, ROLE_RANK } from '../config/permissions.js';

// requireRole(minRole)
// ---------------------------------------------------------------
// Guards routes that need a minimum role level. E.g.:
//   router.delete('/workspace', requireAuth, resolveTenantContext,
//                 requireRole('owner'), deleteWorkspaceHandler)
export function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.role) {
      return res.status(403).json({ error: 'Tenant context not resolved.' });
    }
    if (!hasMinRole(req.role, minRole)) {
      return res.status(403).json({
        error: `This action requires the '${minRole}' role or higher.`,
      });
    }
    next();
  };
}

// requirePermission(permission)
// ---------------------------------------------------------------
// Guards routes at the granular permission level. E.g.:
//   router.post('/contacts', requireAuth, resolveTenantContext,
//               requirePermission('create_contact'), createContactHandler)
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.role) {
      return res.status(403).json({ error: 'Tenant context not resolved.' });
    }
    if (!can(req.role, permission)) {
      return res.status(403).json({
        error: `Missing permission: '${permission}'.`,
      });
    }
    next();
  };
}
