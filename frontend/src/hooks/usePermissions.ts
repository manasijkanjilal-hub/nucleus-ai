'use client';

// =============================================================================
// Nucleus AI — Client-side permission hook
// =============================================================================
// Reads the current user's role from the NextAuth session and exposes
// permission-check helpers for conditionally rendering UI.
//
// Usage:
//   const { can, isAtLeast, role } = usePermissions();
//   {can('brand:create') && <CreateBrandButton />}
//   {isAtLeast('ADMIN') && <AdminPanelLink />}
// =============================================================================

import { useSession } from 'next-auth/react';
import {
  type Role,
  type Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasMinRole,
  assignableRoles,
} from '@/lib/permissions';

export function usePermissions() {
  const { data: session, status } = useSession();
  const role = ((session?.user as any)?.role as Role | undefined) ?? null;

  return {
    role,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    /** Check a single permission. */
    can: (permission: Permission) => hasPermission(role, permission),
    /** Check if user has any of the permissions. */
    canAny: (permissions: Permission[]) => hasAnyPermission(role, permissions),
    /** Check if user has all of the permissions. */
    canAll: (permissions: Permission[]) => hasAllPermissions(role, permissions),
    /** Hierarchical role check. */
    isAtLeast: (minRole: Role) => hasMinRole(role, minRole),
    /** Roles this user may assign to others. */
    assignableRoles: () => assignableRoles(role),
  };
}
