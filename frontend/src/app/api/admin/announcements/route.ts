// =============================================================================
// POST /api/admin/announcements — broadcast a system announcement to all users
// -----------------------------------------------------------------------------
// Creates an in-app SYSTEM_ANNOUNCEMENT notification for every user.
// Requires `admin:access` (ADMIN / SUPER_ADMIN).
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/middleware/rbac';
import { notifyAllUsers } from '@/lib/notifications';
import { recordAudit } from '@/lib/audit';
import { sanitizeText } from '@/lib/sanitize';
import { firstZodError } from '@/lib/validations/auth';

const announcementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

export async function POST(request: Request) {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  const title = sanitizeText(parsed.data.title);
  const message = sanitizeText(parsed.data.message);

  try {
    const count = await notifyAllUsers(title, message);

    await recordAudit({
      userId: user.id,
      action: 'admin.announcement',
      entity: 'Notification',
      changes: { title, recipients: count },
      request,
    });

    return NextResponse.json({ sent: count });
  } catch (error: any) {
    console.error('Announcement error:', error);
    return NextResponse.json({ error: 'Failed to send announcement' }, { status: 500 });
  }
}
