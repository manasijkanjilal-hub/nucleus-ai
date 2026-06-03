export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

/**
 * POST /api/auth/verify-email
 * Body: { token: string }
 * Marks the user as verified when the token matches.
 */
export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification link' },
        { status: 400 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: 'Email already verified', alreadyVerified: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        // Activate the account if it was awaiting verification.
        status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
      },
    });

    await recordAudit({
      userId: user.id,
      action: 'user.email_verified',
      entity: 'User',
      entityId: user.id,
      request,
    });

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('verify-email error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
