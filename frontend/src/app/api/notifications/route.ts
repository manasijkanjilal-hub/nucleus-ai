// =============================================================================
// GET /api/notifications — list the current user's notifications
// -----------------------------------------------------------------------------
// Query params:
//   • filter = 'all' | 'unread'   (default 'all')
//   • limit  = number (default 20, max 100)
//   • offset = number (default 0)
// Returns: { notifications, unreadCount, total }
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') === 'unread' ? 'unread' : 'all';
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where = {
      userId: user.id,
      ...(filter === 'unread' ? { read: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        metadata: n.metadata ?? null,
        createdAt: n.createdAt,
      })),
      total,
      unreadCount,
    });
  } catch (error: any) {
    console.error('List notifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
