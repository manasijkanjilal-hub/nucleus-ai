export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { generateToken } from '@/lib/tokens';
import { sendVerificationEmail, isEmailConfigured } from '@/lib/email';
import { signupSchema, firstZodError } from '@/lib/validations/auth';
import { sanitizeText } from '@/lib/sanitize';

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // ---- Input validation (Zod) ----
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const normalizedEmail = parsed.data.email; // already lowercased & trimmed
    const password = parsed.data.password;
    const name = parsed.data.name ? sanitizeText(parsed.data.name) : null;

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
        name: name || null,
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
