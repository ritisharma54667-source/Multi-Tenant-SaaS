// ============================================================
// PERMISSIONS — single source of truth for RBAC
// ============================================================
// Every role maps to a set of actions it's allowed to perform.
// Middleware (requireRole, requirePermission) reads from here —
// no permission logic is scattered across route handlers.
//
// Roles in ascending order of trust:
//   viewer < member < manager < admin < owner
//
// Keep this file in sync with the frontend's copy at
// src/config/permissions.js — they must match.
// ============================================================

export const ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

// Role hierarchy: higher index = more trust
export const ROLE_RANK = {
  viewer:  0,
  member:  1,
  manager: 2,
  admin:   3,
  owner:   4,
};

// All granular permissions that exist in the system
export const PERMISSIONS = {
  // Team management
  INVITE_MEMBER:      'invite_member',
  REMOVE_MEMBER:      'remove_member',
  CHANGE_ROLE:        'change_role',
  VIEW_MEMBERS:       'view_members',

  // CRM data
  CREATE_CONTACT:     'create_contact',
  EDIT_CONTACT:       'edit_contact',
  DELETE_CONTACT:     'delete_contact',
  VIEW_CONTACTS:      'view_contacts',

  CREATE_DEAL:        'create_deal',
  EDIT_DEAL:          'edit_deal',
  DELETE_DEAL:        'delete_deal',
  VIEW_DEALS:         'view_deals',

  // Analytics
  VIEW_ANALYTICS:     'view_analytics',
  EXPORT_DATA:        'export_data',

  // Workspace admin
  MANAGE_SETTINGS:    'manage_settings',
  VIEW_AUDIT_LOG:     'view_audit_log',
  MANAGE_BILLING:     'manage_billing',
  DELETE_WORKSPACE:   'delete_workspace',
};

// What each role is allowed to do
export const ROLE_PERMISSIONS = {
  viewer: [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.VIEW_DEALS,
    PERMISSIONS.VIEW_MEMBERS,
  ],
  member: [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.VIEW_DEALS,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.CREATE_CONTACT,
    PERMISSIONS.EDIT_CONTACT,
    PERMISSIONS.CREATE_DEAL,
    PERMISSIONS.EDIT_DEAL,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
  manager: [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.VIEW_DEALS,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.CREATE_CONTACT,
    PERMISSIONS.EDIT_CONTACT,
    PERMISSIONS.DELETE_CONTACT,
    PERMISSIONS.CREATE_DEAL,
    PERMISSIONS.EDIT_DEAL,
    PERMISSIONS.DELETE_DEAL,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.INVITE_MEMBER,
  ],
  admin: [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.VIEW_DEALS,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.CREATE_CONTACT,
    PERMISSIONS.EDIT_CONTACT,
    PERMISSIONS.DELETE_CONTACT,
    PERMISSIONS.CREATE_DEAL,
    PERMISSIONS.EDIT_DEAL,
    PERMISSIONS.DELETE_DEAL,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.INVITE_MEMBER,
    PERMISSIONS.REMOVE_MEMBER,
    PERMISSIONS.CHANGE_ROLE,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_AUDIT_LOG,
  ],
  owner: Object.values(PERMISSIONS), // owner can do everything
};

// Helper: does this role have this permission?
export function can(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Helper: is roleA at least as trusted as roleB?
export function hasMinRole(role, minRole) {
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[minRole] ?? 999);
}
