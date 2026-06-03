export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { generateToken } from '@/lib/tokens';
import { sendVerificationEmail, isEmailConfigured } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // ---- Input validation ----
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = generateToken();
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name ? String(name).trim() : null,
        // New self-service signups default to the lowest-privilege role.
        role: 'VIEWER',
        // Account starts unverified until the email link is confirmed.
        status: 'PENDING_VERIFICATION',
        emailVerified: false,
        emailVerificationToken: verificationToken,
      },
    });

    // Send the verification email (best-effort; logged in dev).
    let emailSent = false;
    try {
      const res = await sendVerificationEmail(user.email, verificationToken);
      emailSent = res.sent;
    } catch (e) {
      console.error('Failed to send verification email:', e);
    }

    await recordAudit({
      userId: user.id,
      action: 'user.signup',
      entity: 'User',
      entityId: user.id,
      changes: { email: user.email },
      request,
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        message: 'Account created. Please check your email to verify your account.',
        emailSent,
        // In dev (no SMTP), surface the token so the flow can be tested.
        ...(isEmailConfigured ? {} : { devVerificationToken: verificationToken }),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
