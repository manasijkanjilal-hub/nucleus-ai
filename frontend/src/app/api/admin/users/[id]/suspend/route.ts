// =============================================================================
// Nucleus AI — Admin: suspend a user
// POST /api/admin/users/:id/suspend
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import { canManageUserRole, type Role } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission('user:update');
  if (!guard.authorized) return guard.response;

  const { id } = await ctx.params;
  if (id === guard.user.id) {
    return NextResponse.json(
      { error: 'You cannot suspend your own account.' },
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
        { error: 'You do not have permission to manage this user.' },
        { status: 403 }
      );
    }

    // Suspending also invalidates active sessions.
    const user = await prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED', sessionVersion: { increment: 1 } },
      select: { id: true, status: true },
    });

    await recordAudit({
      userId: guard.user.id,
      action: 'user.suspend',
      entity: 'User',
      entityId: id,
      request: req,
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error('[admin/users/:id/suspend] error', err);
    return NextResponse.json({ error: 'Failed to suspend user' }, { status: 500 });
  }
}
