// =============================================================================
// Nucleus AI — Admin: invite a user
// POST /api/admin/users/invite
// Creates a PENDING_VERIFICATION user with a random password and emails an
// invitation link (reuses the password-reset flow to set their password).
// =============================================================================

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import { canManageUserRole, type Role } from '@/lib/permissions';
import { generateToken, expiryFromNow } from '@/lib/tokens';
import { sendInviteEmail, isEmailConfigured } from '@/lib/email';

export const dynamic = 'force-dynamic';

const inviteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Invalid email'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER']),
});

export async function POST(req: Request) {
  const guard = await requirePermission('user:create');
  if (!guard.authorized) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { name, email, role } = parsed.data;

  if (!canManageUserRole(guard.user.role, role)) {
    return NextResponse.json(
      { error: `You cannot invite a user with the ${role} role.` },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'A user with this email already exists.' },
        { status: 409 }
      );
    }

    // Random password — the invitee sets their own via the reset link.
    const randomPassword = generateToken(24);
    const hashed = await bcrypt.hash(randomPassword, 10);
    const token = generateToken(32);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        status: 'PENDING_VERIFICATION',
        emailVerified: false,
        passwordResetToken: token,
        passwordResetExpires: expiryFromNow(72), // 3-day invite window
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    const result = await sendInviteEmail(email, token, guard.user.name);

    await recordAudit({
      userId: guard.user.id,
      action: 'user.invite',
      entity: 'User',
      entityId: user.id,
      changes: { email, role },
      request: req,
    });

    return NextResponse.json(
      {
        user,
        emailSent: result.sent,
        // Surface the link in dev so invites can be tested without SMTP.
        devInviteToken:
          !isEmailConfigured && process.env.NODE_ENV !== 'production'
            ? token
            : undefined,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[admin/users/invite] error', err);
    return NextResponse.json({ error: 'Failed to invite user' }, { status: 500 });
  }
}
