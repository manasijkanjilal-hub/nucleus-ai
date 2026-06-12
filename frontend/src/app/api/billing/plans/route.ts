// =============================================================================
// GET /api/billing/plans — list all plans, marking the user's current plan
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/rbac';
import { PLANS, PLAN_ORDER } from '@/lib/plans';
import { getOrCreateSubscription } from '@/lib/usage-limits';

export async function GET() {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  const sub = await getOrCreateSubscription(user.id);

  const plans = PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      limits: p.limits,
      features: p.features,
      // Whether this plan is purchasable via Stripe self-serve checkout.
      purchasable: Boolean(p.stripePriceId),
      stripePriceId: p.stripePriceId,
      isCurrent: p.id === sub.plan,
    };
  });

  return NextResponse.json({ currentPlan: sub.plan, plans });
}
