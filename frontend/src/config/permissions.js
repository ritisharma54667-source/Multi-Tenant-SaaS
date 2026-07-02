// ============================================================
// FRONTEND PERMISSIONS CONFIG
// ============================================================
// Mirrors backend/src/config/permissions.js exactly.
// Used by usePermission() hook and PermissionGate component to
// conditionally show/hide UI elements based on the current user's
// role in the active tenant.
//
// IMPORTANT: this is for UX only. It never bypasses the backend.
// Every real action is re-authorized server-side — hiding a button
// doesn't protect data, the API does.
// ============================================================

export const ROLE_RANK = {
  viewer:  0,
  member:  1,
  manager: 2,
  admin:   3,
  owner:   4,
};

export const PERMISSIONS = {
  INVITE_MEMBER:    'invite_member',
  REMOVE_MEMBER:    'remove_member',
  CHANGE_ROLE:      'change_role',
  VIEW_MEMBERS:     'view_members',
  CREATE_CONTACT:   'create_contact',
  EDIT_CONTACT:     'edit_contact',
  DELETE_CONTACT:   'delete_contact',
  VIEW_CONTACTS:    'view_contacts',
  CREATE_DEAL:      'create_deal',
  EDIT_DEAL:        'edit_deal',
  DELETE_DEAL:      'delete_deal',
  VIEW_DEALS:       'view_deals',
  VIEW_ANALYTICS:   'view_analytics',
  EXPORT_DATA:      'export_data',
  MANAGE_SETTINGS:  'manage_settings',
  VIEW_AUDIT_LOG:   'view_audit_log',
  MANAGE_BILLING:   'manage_billing',
  DELETE_WORKSPACE: 'delete_workspace',
};

export const ROLE_PERMISSIONS = {
  viewer:  ['view_contacts', 'view_deals', 'view_members'],
  member:  ['view_contacts', 'view_deals', 'view_members', 'create_contact', 'edit_contact', 'create_deal', 'edit_deal', 'view_analytics'],
  manager: ['view_contacts', 'view_deals', 'view_members', 'create_contact', 'edit_contact', 'delete_contact', 'create_deal', 'edit_deal', 'delete_deal', 'view_analytics', 'export_data', 'invite_member'],
  admin:   ['view_contacts', 'view_deals', 'view_members', 'create_contact', 'edit_contact', 'delete_contact', 'create_deal', 'edit_deal', 'delete_deal', 'view_analytics', 'export_data', 'invite_member', 'remove_member', 'change_role', 'manage_settings', 'view_audit_log'],
  owner:   Object.values(PERMISSIONS !== undefined ? PERMISSIONS : {}),
};

// Build owner permissions from the full list
ROLE_PERMISSIONS.owner = Object.values(PERMISSIONS);

export function can(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasMinRole(role, minRole) {
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[minRole] ?? 999);
}
