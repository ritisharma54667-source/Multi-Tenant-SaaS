// ============================================================
// usePermission HOOK
// ============================================================
// Returns helpers for the current user's role in the active tenant.
//
// Usage:
//   const { can, hasMinRole, role } = usePermission();
//   if (can('invite_member')) { ... }
//   if (hasMinRole('admin')) { ... }
// ============================================================

import { useApp } from '../context/AppContext.jsx';
import { can as canFn, hasMinRole as hasMinRoleFn } from '../config/permissions.js';

export function usePermission() {
  const { tenant } = useApp();
  const role = tenant?.role ?? 'viewer';

  return {
    role,
    can: (permission) => canFn(role, permission),
    hasMinRole: (minRole) => hasMinRoleFn(role, minRole),
  };
}
