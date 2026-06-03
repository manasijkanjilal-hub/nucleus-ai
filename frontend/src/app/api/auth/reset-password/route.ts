export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

/**
 * GET /api/auth/reset-password?token=...
 * Validates a reset token without consuming it (used by the reset page).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token is required' }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
  const valid =
    !!user && !!user.passwordResetExpires && user.passwordResetExpires > new Date();
  return NextResponse.json({ valid });
}

/**
 * POST /api/auth/reset-password
 * Body: { token: string, password: string }
 * Consumes the token and updates the password. Also invalidates all existing
 * sessions by bumping sessionVersion.
 */
export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Reset token is required' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpires: null,
        // Unlock & clear failed attempts; invalidate other sessions.
        loginAttempts: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
        // If this was an invite, verify and activate the account.
        emailVerified: true,
        status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
      },
    });

    await recordAudit({
      userId: user.id,
      action: 'user.password_reset',
      entity: 'User',
      entityId: user.id,
      request,
    });

    return NextResponse.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('reset-password error:', error);
    return NextResponse.json({ error: 'Password reset failed' }, { status: 500 });
  }
}
