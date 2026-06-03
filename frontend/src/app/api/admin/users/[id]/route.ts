// =============================================================================
// Nucleus AI — Admin Users API (single resource)
// =============================================================================
// GET    /api/admin/users/:id — fetch one user (with recent audit)
// PUT    /api/admin/users/:id — update name / role / status / password
// DELETE /api/admin/users/:id — delete a user
// =============================================================================

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import { canManageUserRole, type Role } from '@/lib/permissions';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerified: true,
  lastLogin: true,
  createdAt: true,
  _count: { select: { brandProfiles: true, campaigns: true } },
} satisfies Prisma.UserSelect;

type Ctx = { params: Promise<{ id: string }> };

// ----------------------------------------------------------------------------
// GET
// ----------------------------------------------------------------------------
export async function GET(req: Request, ctx: Ctx) {
  const guard = await requirePermission('user:read');
  if (!guard.authorized) return guard.response;

  const { id } = await ctx.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const audit = await prisma.auditLog.findMany({
      where: { OR: [{ userId: id }, { entity: 'User', entityId: id }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json({ user, audit });
  } catch (err) {
    console.error('[admin/users/:id GET] error', err);
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }
}

// ----------------------------------------------------------------------------
// PUT
// ----------------------------------------------------------------------------
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
  password: z.string().min(8).optional(),
});

export async function PUT(req: Request, ctx: Ctx) {
  const guard = await requirePermission('user:update');
  if (!guard.authorized) return guard.response;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { name, role, status, password } = parsed.data;

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Must be allowed to manage the target's *current* role
    if (!canManageUserRole(guard.user.role, target.role as Role)) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this user.' },
        { status: 403 }
      );
    }
    // And the *new* role if changing
    if (role && role !== target.role) {
      if (!canManageUserRole(guard.user.role, role)) {
        return NextResponse.json(
          { error: `You cannot assign the ${role} role.` },
          { status: 403 }
        );
      }
    }

    // Prevent self role/status downgrade lockout
    if (id === guard.user.id && (role || status)) {
      if (role && role !== guard.user.role) {
        return NextResponse.json(
          { error: 'You cannot change your own role.' },
          { status: 400 }
        );
      }
      if (status && status !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'You cannot deactivate your own account.' },
          { status: 400 }
        );
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    if (status !== undefined) {
      data.status = status;
      if (status === 'ACTIVE') data.emailVerified = true;
    }
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    await recordAudit({
      userId: guard.user.id,
      action: 'user.update',
      entity: 'User',
      entityId: id,
      changes: {
        ...(name !== undefined ? { name } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(password ? { password: 'changed' } : {}),
      },
      request: req,
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error('[admin/users/:id PUT] error', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// ----------------------------------------------------------------------------
// DELETE
// ----------------------------------------------------------------------------
export async function DELETE(req: Request, ctx: Ctx) {
  const guard = await requirePermission('user:delete');
  if (!guard.authorized) return guard.response;

  const { id } = await ctx.params;

  if (id === guard.user.id) {
    return NextResponse.json(
      { error: 'You cannot delete your own account.' },
      { status: 400 }
    );
  }

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!canManageUserRole(guard.user.role, target.role as Role)) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this user.' },
        { status: 403 }
      );
    }

    await prisma.user.delete({ where: { id } });

    await recordAudit({
      userId: guard.user.id,
      action: 'user.delete',
      entity: 'User',
      entityId: id,
      changes: { email: target.email, role: target.role },
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/users/:id DELETE] error', err);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
