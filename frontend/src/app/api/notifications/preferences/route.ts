// =============================================================================
// /api/notifications/preferences — get/update notification preferences
// -----------------------------------------------------------------------------
//   GET   → { emailNotifications }
//   PATCH → { emailNotifications: boolean }  (in-app is always on)
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';
import { firstZodError } from '@/lib/validations/auth';

export async function GET() {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailNotifications: true },
    });
    return NextResponse.json({ emailNotifications: u?.emailNotifications ?? true });
  } catch (error: any) {
    console.error('Get preferences error:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

const prefsSchema = z.object({
  emailNotifications: z.boolean(),
});

export async function PATCH(request: Request) {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailNotifications: parsed.data.emailNotifications },
      select: { emailNotifications: true },
    });
    return NextResponse.json({ emailNotifications: updated.emailNotifications });
  } catch (error: any) {
    console.error('Update preferences error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
