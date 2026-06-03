export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/tokens';
import { sendVerificationEmail, isEmailConfigured } from '@/lib/email';

/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 * Re-issues a verification token & email. Always returns success to avoid
 * leaking which emails are registered.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const normalized = String(email || '').toLowerCase().trim();
    if (!normalized) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    let devToken: string | undefined;

    if (user && !user.emailVerified) {
      const token = generateToken();
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken: token },
      });
      try {
        await sendVerificationEmail(user.email, token);
      } catch (e) {
        console.error('resend verification email error:', e);
      }
      if (!isEmailConfigured) devToken = token;
    }

    return NextResponse.json({
      message: 'If an unverified account exists for that email, a verification link has been sent.',
      ...(devToken ? { devVerificationToken: devToken } : {}),
    });
  } catch (error) {
    console.error('resend-verification error:', error);
    return NextResponse.json({ error: 'Failed to resend verification' }, { status: 500 });
  }
}
