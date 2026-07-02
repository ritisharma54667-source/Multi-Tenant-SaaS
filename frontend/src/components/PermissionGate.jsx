// ============================================================
// PERMISSION GATE
// ============================================================
// Renders children only if the current user has the required
// permission. Renders nothing (or a fallback) otherwise.
//
// Usage:
//   <PermissionGate permission="invite_member">
//     <InviteButton />
//   </PermissionGate>
//
//   <PermissionGate minRole="admin" fallback={<p>Admins only</p>}>
//     <AdminPanel />
//   </PermissionGate>
// ============================================================

import { usePermission } from '../hooks/usePermission.js';

export default function PermissionGate({ permission, minRole, fallback = null, children }) {
  const { can, hasMinRole } = usePermission();

  const allowed =
    (permission ? can(permission) : true) &&
    (minRole ? hasMinRole(minRole) : true);

  return allowed ? children : fallback;
}
