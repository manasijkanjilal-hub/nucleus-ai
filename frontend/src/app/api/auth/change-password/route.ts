export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import { changePasswordSchema, firstZodError } from '@/lib/validations/auth';

/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 * Verifies the current password before updating to the new one.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: guard.user.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) {
      return NextResponse.json(
        { error: 'New password must be different from the current password' },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    await recordAudit({
      userId: user.id,
      action: 'user.password_changed',
      entity: 'User',
      entityId: user.id,
      request,
    });

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('change-password error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
