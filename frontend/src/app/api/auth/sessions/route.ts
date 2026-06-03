export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';

/**
 * GET /api/auth/sessions
 * Returns the current session/security info for the signed-in user.
 *
 * Note: the app uses stateless JWT sessions, so individual device sessions
 * are not persisted server-side. We surface the security-relevant metadata
 * (last login, account state) plus the current request's device, and offer
 * a "logout from all devices" action that invalidates all issued tokens.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;

  const user = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: { lastLogin: true, sessionVersion: true, createdAt: true },
  });

  const userAgent = request.headers.get('user-agent') || 'Unknown device';
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'Unknown';

  return NextResponse.json({
    current: {
      userAgent,
      ipAddress,
      lastLogin: user?.lastLogin ?? null,
    },
    accountCreated: user?.createdAt ?? null,
    sessionVersion: user?.sessionVersion ?? 0,
  });
}

/**
 * DELETE /api/auth/sessions
 * "Logout from all devices" — increments sessionVersion so every previously
 * issued JWT (including the caller's) is rejected on its next request.
 */
export async function DELETE(request: Request) {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;

  await prisma.user.update({
    where: { id: guard.user.id },
    data: { sessionVersion: { increment: 1 } },
  });

  await recordAudit({
    userId: guard.user.id,
    action: 'user.logout_all_devices',
    entity: 'User',
    entityId: guard.user.id,
    request,
  });

  return NextResponse.json({ message: 'Signed out from all devices.' });
}
