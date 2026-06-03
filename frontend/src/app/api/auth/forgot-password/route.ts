export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, expiryFromNow } from '@/lib/tokens';
import { sendPasswordResetEmail, isEmailConfigured } from '@/lib/email';
import { recordAudit } from '@/lib/audit';
import { forgotPasswordSchema, firstZodError } from '@/lib/validations/auth';

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 * Generates a 1-hour reset token and emails a reset link. Always returns a
 * generic success message to avoid user enumeration.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const normalized = parsed.data.email;

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    let devToken: string | undefined;

    if (user) {
      const token = generateToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expiryFromNow(1), // 1 hour
        },
      });
      try {
        await sendPasswordResetEmail(user.email, token);
      } catch (e) {
        console.error('reset email error:', e);
      }
      await recordAudit({
        userId: user.id,
        action: 'user.password_reset_requested',
        entity: 'User',
        entityId: user.id,
        request,
      });
      if (!isEmailConfigured) devToken = token;
    }

    return NextResponse.json({
      message: 'If an account exists for that email, a password reset link has been sent.',
      ...(devToken ? { devResetToken: devToken } : {}),
    });
  } catch (error) {
    console.error('forgot-password error:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
