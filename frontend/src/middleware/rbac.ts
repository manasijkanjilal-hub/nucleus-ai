// =============================================================================
// Nucleus AI — RBAC Server-Side Middleware / Route Guards
// =============================================================================
// Helpers for protecting API route handlers (App Router) based on the
// authenticated user's role and granular permissions.
//
// Usage in an API route:
//
//   import { requirePermission } from '@/middleware/rbac';
//
//   export async function POST(req: Request) {
//     const guard = await requirePermission('brand:create');
//     if (!guard.authorized) return guard.response;
//     const { user } = guard;           // typed { id, email, role, status, ... }
//     ...
//   }
// =============================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  type Role,
  type Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasMinRole,
} from '@/lib/permissions';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
}

type GuardSuccess = { authorized: true; user: SessionUser; response?: never };
type GuardFailure = { authorized: false; user?: never; response: NextResponse };
export type GuardResult = GuardSuccess | GuardFailure;

function unauthorized(message = 'Unauthorized'): GuardFailure {
  return {
    authorized: false,
    response: NextResponse.json({ error: message }, { status: 401 }),
  };
}

function forbidden(message = 'Forbidden — insufficient permissions'): GuardFailure {
  return {
    authorized: false,
    response: NextResponse.json({ error: message }, { status: 403 }),
  };
}

/**
 * Resolve the current authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    role: (session.user as any).role ?? 'VIEWER',
    status: (session.user as any).status ?? 'ACTIVE',
  };
}

/**
 * Require an authenticated, ACTIVE user (no specific permission).
 */
export async function requireAuth(): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.status !== 'ACTIVE') {
    return forbidden('Account is not active');
  }
  return { authorized: true, user };
}

/**
 * Require the user to hold a specific permission.
 */
export async function requirePermission(permission: Permission): Promise<GuardResult> {
  const guard = await requireAuth();
  if (!guard.authorized) return guard;
  if (!hasPermission(guard.user.role, permission)) {
    return forbidden();
  }
  return guard;
}

/**
 * Require the user to hold ANY of the given permissions.
 */
export async function requireAnyPermission(permissions: Permission[]): Promise<GuardResult> {
  const guard = await requireAuth();
  if (!guard.authorized) return guard;
  if (!hasAnyPermission(guard.user.role, permissions)) {
    return forbidden();
  }
  return guard;
}

/**
 * Require the user to hold ALL of the given permissions.
 */
export async function requireAllPermissions(permissions: Permission[]): Promise<GuardResult> {
  const guard = await requireAuth();
  if (!guard.authorized) return guard;
  if (!hasAllPermissions(guard.user.role, permissions)) {
    return forbidden();
  }
  return guard;
}

/**
 * Require the user to have at least the given role (hierarchical).
 */
export async function requireRole(minRole: Role): Promise<GuardResult> {
  const guard = await requireAuth();
  if (!guard.authorized) return guard;
  if (!hasMinRole(guard.user.role, minRole)) {
    return forbidden();
  }
  return guard;
}
