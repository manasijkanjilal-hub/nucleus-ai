export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/tokens';
import { sendVerificationEmail, isEmailConfigured } from '@/lib/email';
import { resendVerificationSchema, firstZodError } from '@/lib/validations/auth';

/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 * Re-issues a verification token & email. Always returns success to avoid
 * leaking which emails are registered.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = resendVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const normalized = parsed.data.email;

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
