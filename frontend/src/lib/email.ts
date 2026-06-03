// =============================================================================
// Nucleus AI — Email Sending Utility
// =============================================================================
// Thin wrapper around nodemailer. In development (or when SMTP is not
// configured) emails are logged to the console and the verification/reset
// links are returned so they can be surfaced in the API response for testing.
// =============================================================================

import nodemailer, { type Transporter } from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  SMTP_FROM,
  NEXTAUTH_URL,
} = process.env;

export const APP_URL = NEXTAUTH_URL || 'http://localhost:3000';
const FROM = SMTP_FROM || 'Nucleus AI <noreply@nucleus-ai.com>';

/** Whether real SMTP delivery is configured. */
export const isEmailConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!isEmailConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
  }
  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email. Returns `{ sent: boolean }`. When SMTP is not configured the
 * message is logged to the server console instead of being delivered.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<{ sent: boolean }> {
  const t = getTransporter();
  if (!t) {
    console.log('───────────────────────────────────────────────');
    console.log('[email] SMTP not configured — logging email instead:');
    console.log(`  To:      ${opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  Body:\n${opts.text || opts.html}`);
    console.log('───────────────────────────────────────────────');
    return { sent: false };
  }
  await t.sendMail({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return { sent: true };
}

// -----------------------------------------------------------------------------
// Branded email templates
// -----------------------------------------------------------------------------

function layout(title: string, body: string, cta?: { label: string; url: string }): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a2e;">
    <div style="font-size:22px;font-weight:700;color:#4f46e5;margin-bottom:24px;">Nucleus AI</div>
    <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#3f3f46;">${body}</div>
    ${
      cta
        ? `<div style="margin:28px 0;">
             <a href="${cta.url}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">${cta.label}</a>
           </div>
           <div style="font-size:13px;color:#71717a;">Or copy this link into your browser:<br/>
             <a href="${cta.url}" style="color:#4f46e5;word-break:break-all;">${cta.url}</a>
           </div>`
        : ''
    }
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0;" />
    <div style="font-size:12px;color:#a1a1aa;">© ${new Date().getFullYear()} Nucleus AI. If you didn't request this, you can safely ignore this email.</div>
  </div>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: 'Verify your Nucleus AI email address',
    html: layout(
      'Confirm your email',
      'Thanks for signing up for Nucleus AI! Please confirm your email address to activate your account.',
      { label: 'Verify Email', url }
    ),
    text: `Verify your email address by visiting: ${url}`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: 'Reset your Nucleus AI password',
    html: layout(
      'Reset your password',
      'We received a request to reset your password. This link expires in <strong>1 hour</strong>. If you did not request a reset, you can ignore this email.',
      { label: 'Reset Password', url }
    ),
    text: `Reset your password by visiting (expires in 1 hour): ${url}`,
  });
}

export async function sendInviteEmail(to: string, token: string, inviterName?: string | null) {
  const url = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&invite=1`;
  return sendEmail({
    to,
    subject: "You've been invited to Nucleus AI",
    html: layout(
      'You have been invited',
      `${inviterName ? `${inviterName} has` : 'You have been'} invited you to join Nucleus AI. Set your password to get started.`,
      { label: 'Accept Invitation', url }
    ),
    text: `You've been invited to Nucleus AI. Set your password: ${url}`,
  });
}
