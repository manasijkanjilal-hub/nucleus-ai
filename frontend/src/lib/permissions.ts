// =============================================================================
// Nucleus AI — RBAC Permission Definitions
// =============================================================================
// Central source of truth for roles, permissions, and the permission matrix.
// Used by both server-side route guards (middleware/rbac.ts) and client-side
// UI permission checks (hooks/usePermissions).
// =============================================================================

/** Roles, ordered from least to most privileged. */
export type Role = 'VIEWER' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN';

/** Numeric rank for hierarchical comparisons (higher = more privileged). */
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

/**
 * Granular permissions. Format: `<resource>:<action>`.
 * Add new permissions here and wire them into ROLE_PERMISSIONS below.
 */
export type Permission =
  // Brands
  | 'brand:create'
  | 'brand:read'
  | 'brand:update'
  | 'brand:delete'
  // Campaigns
  | 'campaign:create'
  | 'campaign:read'
  | 'campaign:update'
  | 'campaign:delete'
  // Documents / Context Vault
  | 'document:create'
  | 'document:read'
  | 'document:update'
  | 'document:delete'
  // Content generation (AI workflows)
  | 'content:generate'
  // User / team management
  | 'user:create'
  | 'user:read'
  | 'user:update'
  | 'user:delete'
  | 'user:manage_roles'
  // Admin panel & system
  | 'admin:access'
  | 'audit:read'
  | 'settings:manage';

/** All permissions — convenient for SUPER_ADMIN. */
export const ALL_PERMISSIONS: Permission[] = [
  'brand:create', 'brand:read', 'brand:update', 'brand:delete',
  'campaign:create', 'campaign:read', 'campaign:update', 'campaign:delete',
  'document:create', 'document:read', 'document:update', 'document:delete',
  'content:generate',
  'user:create', 'user:read', 'user:update', 'user:delete', 'user:manage_roles',
  'admin:access', 'audit:read', 'settings:manage',
];

const VIEWER_PERMISSIONS: Permission[] = [
  'brand:read',
  'campaign:read',
  'document:read',
];

const EDITOR_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  'brand:create', 'brand:update',
  'campaign:create', 'campaign:update',
  'document:create', 'document:update', 'document:delete',
  'content:generate',
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...EDITOR_PERMISSIONS,
  'brand:delete',
  'campaign:delete',
  // Team management — Admins manage Editors & Viewers (enforced separately)
  'user:create', 'user:read', 'user:update', 'user:delete', 'user:manage_roles',
  'admin:access',
  'audit:read',
];

/**
 * The Permission Matrix.
 * SUPER_ADMIN has every permission; other roles inherit upward.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  VIEWER: VIEWER_PERMISSIONS,
  EDITOR: EDITOR_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  SUPER_ADMIN: ALL_PERMISSIONS,
};

// -----------------------------------------------------------------------------
// Core permission helpers (pure functions — safe for client & server)
// -----------------------------------------------------------------------------

/** Returns true if the given role has the given permission. */
export function hasPermission(
  role: Role | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Returns true if the role has ALL of the given permissions. */
export function hasAllPermissions(
  role: Role | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/** Returns true if the role has ANY of the given permissions. */
export function hasAnyPermission(
  role: Role | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** Returns true if `role` rank is >= `minRole` rank. */
export function hasMinRole(
  role: Role | null | undefined,
  minRole: Role
): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/**
 * Whether `actorRole` is allowed to manage (create/update/delete) a user with
 * `targetRole`. Rules:
 *  - SUPER_ADMIN can manage anyone.
 *  - ADMIN can only manage EDITOR and VIEWER (not other ADMINs or SUPER_ADMINs).
 *  - Everyone else: no.
 */
export function canManageUserRole(
  actorRole: Role | null | undefined,
  targetRole: Role
): boolean {
  if (actorRole === 'SUPER_ADMIN') return true;
  if (actorRole === 'ADMIN') {
    return targetRole === 'EDITOR' || targetRole === 'VIEWER';
  }
  return false;
}

/** Roles an actor is allowed to assign to other users. */
export function assignableRoles(actorRole: Role | null | undefined): Role[] {
  if (actorRole === 'SUPER_ADMIN') {
    return ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'];
  }
  if (actorRole === 'ADMIN') {
    return ['EDITOR', 'VIEWER'];
  }
  return [];
}
