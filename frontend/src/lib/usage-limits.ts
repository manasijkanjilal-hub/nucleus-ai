// =============================================================================
// Nucleus AI — Usage Limit Enforcement
// -----------------------------------------------------------------------------
// Resolves a user's plan + usage and enforces resource limits. Limits come
// from the plan config (src/lib/plans.ts) which is the source of truth; the
// Subscription row stores the rolling monthly generation counter and a cached
// copy of the generation/brand limits.
//
// Counting strategy:
//   • generations — a monthly counter on the Subscription (reset by webhook /
//     cron via resetMonthlyUsage).
//   • brands / documents / campaigns — counted live from the DB so they never
//     drift from reality.
//
// All check* helpers throw `UsageLimitError` (HTTP 403) when a limit is hit.
// =============================================================================

import { prisma } from '@/lib/prisma';
import { getPlan, isUnlimited, type PlanId, type PlanLimits } from '@/lib/plans';
import type { Subscription } from '@prisma/client';

export type LimitedResource = 'generations' | 'brands' | 'documents' | 'campaigns';

export class UsageLimitError extends Error {
  status = 403;
  resource: LimitedResource;
  limit: number;
  used: number;
  plan: PlanId;
  constructor(resource: LimitedResource, used: number, limit: number, plan: PlanId) {
    super(
      `You have reached your ${resource} limit (${used}/${limit}) on the ${plan} plan. ` +
        `Upgrade your plan to continue.`,
    );
    this.name = 'UsageLimitError';
    this.resource = resource;
    this.used = used;
    this.limit = limit;
    this.plan = plan;
  }
}

/**
 * Get the user's subscription, creating a default FREE one if none exists.
 * Also keeps the cached limit columns in sync with the current plan config.
 */
export async function getOrCreateSubscription(userId: string): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) {
    // Keep cached limits aligned with plan config (handles plan-config changes).
    const plan = getPlan(existing.plan);
    if (
      existing.generationsLimit !== plan.limits.generations ||
      existing.brandsLimit !== plan.limits.brands
    ) {
      return prisma.subscription.update({
        where: { userId },
        data: {
          generationsLimit: plan.limits.generations,
          brandsLimit: plan.limits.brands,
        },
      });
    }
    return existing;
  }

  const free = getPlan('FREE');
  return prisma.subscription.create({
    data: {
      userId,
      plan: 'FREE',
      status: 'ACTIVE',
      generationsLimit: free.limits.generations,
      brandsLimit: free.limits.brands,
    },
  });
}

/** Resolve a user's effective plan limits from their subscription. */
export async function getUserLimits(userId: string): Promise<PlanLimits> {
  const sub = await getOrCreateSubscription(userId);
  return getPlan(sub.plan).limits;
}

// -----------------------------------------------------------------------------
// Live usage counts
// -----------------------------------------------------------------------------

export async function countBrands(userId: string): Promise<number> {
  return prisma.brandProfile.count({ where: { userId } });
}

export async function countDocuments(userId: string): Promise<number> {
  return prisma.document.count({ where: { uploadedBy: userId } });
}

export async function countCampaigns(userId: string): Promise<number> {
  return prisma.campaign.count({ where: { brand: { userId } } });
}

// -----------------------------------------------------------------------------
// Generation usage (monthly counter)
// -----------------------------------------------------------------------------

export async function checkGenerationLimit(userId: string): Promise<void> {
  const sub = await getOrCreateSubscription(userId);
  const limit = getPlan(sub.plan).limits.generations;
  if (isUnlimited(limit)) return;
  if (sub.generationsUsed >= limit) {
    throw new UsageLimitError('generations', sub.generationsUsed, limit, sub.plan as PlanId);
  }
}

export async function incrementGenerationUsage(userId: string): Promise<void> {
  // Ensure a row exists first.
  await getOrCreateSubscription(userId);
  await prisma.subscription.update({
    where: { userId },
    data: { generationsUsed: { increment: 1 } },
  });
}

/** Reset the monthly generation counter (called by webhook on renewal / cron). */
export async function resetMonthlyUsage(userId: string): Promise<void> {
  await prisma.subscription.updateMany({
    where: { userId },
    data: { generationsUsed: 0 },
  });
}

// -----------------------------------------------------------------------------
// Resource creation limits (counted live)
// -----------------------------------------------------------------------------

export async function checkBrandLimit(userId: string): Promise<void> {
  const sub = await getOrCreateSubscription(userId);
  const limit = getPlan(sub.plan).limits.brands;
  if (isUnlimited(limit)) return;
  const used = await countBrands(userId);
  if (used >= limit) {
    throw new UsageLimitError('brands', used, limit, sub.plan as PlanId);
  }
}

export async function checkDocumentLimit(userId: string): Promise<void> {
  const sub = await getOrCreateSubscription(userId);
  const limit = getPlan(sub.plan).limits.documents;
  if (isUnlimited(limit)) return;
  const used = await countDocuments(userId);
  if (used >= limit) {
    throw new UsageLimitError('documents', used, limit, sub.plan as PlanId);
  }
}

export async function checkCampaignLimit(userId: string): Promise<void> {
  const sub = await getOrCreateSubscription(userId);
  const limit = getPlan(sub.plan).limits.campaigns;
  if (isUnlimited(limit)) return;
  const used = await countCampaigns(userId);
  if (used >= limit) {
    throw new UsageLimitError('campaigns', used, limit, sub.plan as PlanId);
  }
}

// -----------------------------------------------------------------------------
// Usage summary (for /api/billing/usage and the billing dashboard)
// -----------------------------------------------------------------------------

export interface ResourceUsage {
  used: number;
  limit: number; // -1 = unlimited
  unlimited: boolean;
  percent: number; // 0..100, 0 when unlimited
}

export interface UsageSummary {
  plan: PlanId;
  status: string;
  generations: ResourceUsage;
  brands: ResourceUsage;
  documents: ResourceUsage;
  campaigns: ResourceUsage;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

function toResourceUsage(used: number, limit: number): ResourceUsage {
  const unlimited = isUnlimited(limit);
  return {
    used,
    limit,
    unlimited,
    percent: unlimited || limit === 0 ? (unlimited ? 0 : 100) : Math.min(100, Math.round((used / limit) * 100)),
  };
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const sub = await getOrCreateSubscription(userId);
  const limits = getPlan(sub.plan).limits;
  const [brands, documents, campaigns] = await Promise.all([
    countBrands(userId),
    countDocuments(userId),
    countCampaigns(userId),
  ]);
  return {
    plan: sub.plan as PlanId,
    status: sub.status,
    generations: toResourceUsage(sub.generationsUsed, limits.generations),
    brands: toResourceUsage(brands, limits.brands),
    documents: toResourceUsage(documents, limits.documents),
    campaigns: toResourceUsage(campaigns, limits.campaigns),
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}
