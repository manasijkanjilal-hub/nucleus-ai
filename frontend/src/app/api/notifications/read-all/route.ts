// =============================================================================
// POST /api/notifications/read-all — mark all of the user's notifications read
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';

export async function POST() {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ updated: result.count });
  } catch (error: any) {
    console.error('Mark all read error:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
