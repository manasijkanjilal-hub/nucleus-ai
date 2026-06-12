// =============================================================================
// PATCH /api/notifications/[id]/read — mark a single notification as read
// -----------------------------------------------------------------------------
// Only the owning user may mark their own notification as read.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  const { id } = await params;

  try {
    // Scope the update to the owner so users can't touch others' notifications.
    const result = await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }
    return NextResponse.json({ id, read: true });
  } catch (error: any) {
    console.error('Mark notification read error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
