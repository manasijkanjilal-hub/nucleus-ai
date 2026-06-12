// =============================================================================
// Nucleus AI — Email Service (event emails)
// -----------------------------------------------------------------------------
// Higher-level, event-oriented email helpers built on top of `lib/email.ts`
// (which wraps nodemailer and falls back to console logging when SMTP is not
// configured). These are used by the notification layer and auth flows.
//
// Functions:
//   • sendWelcomeEmail(user)
//   • sendPasswordResetEmail(user, token)   ← re-exported from lib/email
//   • sendGenerationCompleteEmail(user, generation)
//   • sendLimitWarningEmail(user, usage)
// =============================================================================

import { sendEmail, APP_URL, isEmailConfigured } from '@/lib/email';

export { sendPasswordResetEmail, isEmailConfigured } from '@/lib/email';

interface EmailUser {
  email: string;
  name?: string | null;
}

/** Shared branded email shell. */
function layout(
  title: string,
  body: string,
  cta?: { label: string; url: string },
): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a2e;">
    <div style="font-size:22px;font-weight:700;color:#4f46e5;margin-bottom:24px;">Nucleus AI</div>
    <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#3f3f46;">${body}</div>
    ${
      cta
        ? `<div style="margin:28px 0;">
             <a href="${cta.url}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">${cta.label}</a>
           </div>`
        : ''
    }
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0;" />
    <div style="font-size:12px;color:#a1a1aa;">© ${new Date().getFullYear()} Nucleus AI. You can manage email preferences in your account settings.</div>
  </div>`;
}

function greeting(user: EmailUser): string {
  const name = user.name?.trim();
  return name ? `Hi ${name},` : 'Hi there,';
}

// -----------------------------------------------------------------------------
// Event emails
// -----------------------------------------------------------------------------

export async function sendWelcomeEmail(user: EmailUser) {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to Nucleus AI 🎉',
    html: layout(
      'Welcome to Nucleus AI',
      `<p>${greeting(user)}</p>
       <p>Your account is ready. Nucleus AI helps you generate on-brand marketing
       content, organize it into campaigns, and track performance — all in one place.</p>
       <p>Get started by creating a brand profile and uploading your brand knowledge
       to the Context Vault.</p>`,
      { label: 'Open Dashboard', url: `${APP_URL}/dashboard` },
    ),
    text: `${greeting(user)}\n\nWelcome to Nucleus AI! Your account is ready. Get started at ${APP_URL}/dashboard`,
  });
}

interface GenerationInfo {
  id?: string;
  contentTypeLabel?: string;
  contentType?: string;
  campaignName?: string | null;
}

export async function sendGenerationCompleteEmail(
  user: EmailUser,
  generation: GenerationInfo,
) {
  const label = generation.contentTypeLabel || generation.contentType || 'content';
  const campaignNote = generation.campaignName
    ? ` for the campaign “${generation.campaignName}”`
    : '';
  return sendEmail({
    to: user.email,
    subject: `Your ${label} is ready`,
    html: layout(
      'Your content is ready',
      `<p>${greeting(user)}</p>
       <p>Your AI-generated <strong>${label}</strong>${campaignNote} has finished
       generating and is ready to review.</p>`,
      { label: 'View Content', url: `${APP_URL}/campaign-generator` },
    ),
    text: `${greeting(user)}\n\nYour AI-generated ${label}${campaignNote} is ready. View it at ${APP_URL}/campaign-generator`,
  });
}

interface UsageInfo {
  resource: string; // e.g. "generations"
  used: number;
  limit: number;
  percent: number;
  plan?: string;
}

export async function sendLimitWarningEmail(user: EmailUser, usage: UsageInfo) {
  const atLimit = usage.percent >= 100;
  const title = atLimit ? 'Usage limit reached' : 'Approaching your usage limit';
  const body = atLimit
    ? `<p>${greeting(user)}</p>
       <p>You've reached your <strong>${usage.resource}</strong> limit
       (${usage.used}/${usage.limit}) on the ${usage.plan ?? 'current'} plan.
       Upgrade to keep generating content.</p>`
    : `<p>${greeting(user)}</p>
       <p>You've used <strong>${usage.percent}%</strong> of your
       ${usage.resource} quota (${usage.used}/${usage.limit}) on the
       ${usage.plan ?? 'current'} plan. Consider upgrading before you run out.</p>`;
  return sendEmail({
    to: user.email,
    subject: atLimit ? `You've reached your ${usage.resource} limit` : `You're at ${usage.percent}% of your ${usage.resource} limit`,
    html: layout(title, body, { label: 'View Plans', url: `${APP_URL}/billing/plans` }),
    text: `${greeting(user)}\n\n${atLimit ? `You've reached` : `You're at ${usage.percent}% of`} your ${usage.resource} limit (${usage.used}/${usage.limit}). Manage your plan at ${APP_URL}/billing/plans`,
  });
}
