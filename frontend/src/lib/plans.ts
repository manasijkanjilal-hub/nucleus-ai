// =============================================================================
// Nucleus AI — Subscription Plan Configuration
// -----------------------------------------------------------------------------
// Single source of truth for plan pricing, Stripe price IDs, resource limits,
// and marketing feature lists. A limit value of -1 means "unlimited".
//
// Stripe price IDs are read from env so the same code works across test/live
// modes. FREE / ENTERPRISE have no Stripe price (Free = no charge, Enterprise =
// contact sales / custom invoicing).
// =============================================================================

export type PlanId = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface PlanLimits {
  generations: number; // monthly AI generations (-1 = unlimited)
  brands: number;
  documents: number;
  campaigns: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in USD. `null` = contact sales (Enterprise). */
  price: number | null;
  stripePriceId: string | null;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    price: 0,
    stripePriceId: null,
    limits: { generations: 10, brands: 1, documents: 5, campaigns: 3 },
    features: [
      '10 AI generations per month',
      '1 brand profile',
      '5 documents in Context Vault',
      '3 active campaigns',
      'Basic analytics',
    ],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    price: 29,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID ?? null,
    limits: { generations: 100, brands: 3, documents: 50, campaigns: 10 },
    features: [
      '100 AI generations per month',
      '3 brand profiles',
      '50 documents in Context Vault',
      '10 active campaigns',
      'Advanced analytics',
      'Priority support',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    price: 99,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: { generations: -1, brands: 10, documents: 500, campaigns: -1 },
    features: [
      'Unlimited AI generations',
      '10 brand profiles',
      '500 documents in Context Vault',
      'Unlimited campaigns',
      'Advanced analytics with exports',
      'Multi-AI provider support',
      'Priority support',
      'API access',
    ],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: null, // contact sales
    stripePriceId: null,
    limits: { generations: -1, brands: -1, documents: -1, campaigns: -1 },
    features: [
      'Everything in Pro',
      'Unlimited brands',
      'Unlimited documents',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'White-label options',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

/** Returns the plan config for a plan id (defaults to FREE if unknown). */
export function getPlan(planId: string | null | undefined): Plan {
  if (planId && planId in PLANS) return PLANS[planId as PlanId];
  return PLANS.FREE;
}

/** Resolve the plan id that owns a given Stripe price id, or null. */
export function planIdForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const id of PLAN_ORDER) {
    if (PLANS[id].stripePriceId && PLANS[id].stripePriceId === priceId) return id;
  }
  return null;
}

/** True when the limit represents "unlimited". */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/** Numeric rank for upgrade/downgrade comparisons. */
export function planRank(planId: PlanId): number {
  return PLAN_ORDER.indexOf(planId);
}
