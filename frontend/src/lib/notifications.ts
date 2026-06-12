// =============================================================================
// Nucleus AI — Notification Service
// -----------------------------------------------------------------------------
// Central helper for creating in-app notifications and (optionally) sending a
// matching email. All functions are best-effort: they never throw, so they
// can be safely awaited inside request handlers without breaking the flow.
//
// In-app notifications are always created. Email delivery is gated by the
// user's `emailNotifications` preference and whether the event type opts into
// email.
// =============================================================================

import { prisma } from '@/lib/prisma';
import type { NotificationType, Prisma } from '@prisma/client';
import {
  sendWelcomeEmail,
  sendGenerationCompleteEmail,
  sendLimitWarningEmail,
} from '@/lib/email-service';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Create an in-app notification. Best-effort — logs and swallows errors.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<{ id: string } | null> {
  try {
    const n = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata,
      },
      select: { id: true },
    });
    return n;
  } catch (err) {
    console.error('[notifications] create failed:', err);
    return null;
  }
}

/** Whether the user has email notifications enabled (defaults to true). */
async function emailEnabled(userId: string): Promise<{ email: string; name: string | null } | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, emailNotifications: true },
    });
    if (!user || !user.emailNotifications) return null;
    return { email: user.email, name: user.name };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Event-specific helpers (in-app + optional email)
// -----------------------------------------------------------------------------

export async function notifyWelcome(userId: string, email: string, name?: string | null) {
  await createNotification({
    userId,
    type: 'WELCOME',
    title: 'Welcome to Nucleus AI',
    message: 'Your account is ready. Create a brand profile and start generating content.',
  });
  // Welcome email always sent (account lifecycle), independent of preferences.
  try {
    await sendWelcomeEmail({ email, name });
  } catch (e) {
    console.error('[notifications] welcome email failed:', e);
  }
}

export async function notifyGenerationComplete(
  userId: string,
  generation: { id: string; contentTypeLabel?: string; contentType?: string; campaignName?: string | null },
) {
  const label = generation.contentTypeLabel || generation.contentType || 'content';
  await createNotification({
    userId,
    type: 'GENERATION_COMPLETE',
    title: 'Content generated',
    message: `Your ${label} is ready to review.`,
    metadata: { generationId: generation.id, contentType: generation.contentType ?? null },
  });
  const user = await emailEnabled(userId);
  if (user) {
    try {
      await sendGenerationCompleteEmail(user, generation);
    } catch (e) {
      console.error('[notifications] generation email failed:', e);
    }
  }
}

export async function notifyLimitWarning(
  userId: string,
  usage: { resource: string; used: number; limit: number; percent: number; plan?: string },
) {
  const atLimit = usage.percent >= 100;
  await createNotification({
    userId,
    type: 'LIMIT_WARNING',
    title: atLimit ? 'Usage limit reached' : 'Approaching usage limit',
    message: atLimit
      ? `You've reached your ${usage.resource} limit (${usage.used}/${usage.limit}). Upgrade to continue.`
      : `You've used ${usage.percent}% of your ${usage.resource} quota (${usage.used}/${usage.limit}).`,
    metadata: { resource: usage.resource, used: usage.used, limit: usage.limit, percent: usage.percent },
  });
  const user = await emailEnabled(userId);
  if (user) {
    try {
      await sendLimitWarningEmail(user, usage);
    } catch (e) {
      console.error('[notifications] limit email failed:', e);
    }
  }
}

export async function notifyCampaignStatus(
  userId: string,
  campaign: { id: string; name: string; status: string },
) {
  await createNotification({
    userId,
    type: 'CAMPAIGN_STATUS',
    title: 'Campaign status updated',
    message: `Campaign “${campaign.name}” is now ${campaign.status}.`,
    metadata: { campaignId: campaign.id, status: campaign.status },
  });
}

/**
 * Broadcast a system announcement to every user (in-app only).
 * Uses createMany for efficiency. Best-effort.
 */
export async function notifyAllUsers(title: string, message: string): Promise<number> {
  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    if (users.length === 0) return 0;
    const result = await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: 'SYSTEM_ANNOUNCEMENT' as NotificationType,
        title,
        message,
      })),
    });
    return result.count;
  } catch (err) {
    console.error('[notifications] broadcast failed:', err);
    return 0;
  }
}
