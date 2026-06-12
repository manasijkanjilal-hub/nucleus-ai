// =============================================================================
// POST /api/billing/subscribe — start or change a paid subscription
// -----------------------------------------------------------------------------
// Body: { priceId: string }
//   • No existing Stripe subscription → create a Checkout Session, return URL.
//   • Existing subscription → upgrade (immediate, prorated) or downgrade
//     (scheduled at period end) via the Subscriptions API.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import { firstZodError } from '@/lib/validations/auth';
import { planIdForPriceId, planRank, getPlan } from '@/lib/plans';
import {
  isStripeConfigured,
  ensureCustomer,
  createCheckoutSession,
  updateSubscription,
  StripeNotConfiguredError,
} from '@/lib/stripe-service';
import { getOrCreateSubscription } from '@/lib/usage-limits';

const schema = z.object({ priceId: z.string().trim().min(1, 'priceId is required') });

function appBaseUrl(request: Request): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin
  );
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Billing is not configured. Set STRIPE_SECRET_KEY to enable payments.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { priceId } = parsed.data;

  // The price must map to one of our purchasable plans.
  const targetPlan = planIdForPriceId(priceId);
  if (!targetPlan) {
    return NextResponse.json({ error: 'Unknown or unsupported price' }, { status: 400 });
  }

  try {
    const sub = await getOrCreateSubscription(user.id);

    // Ensure a Stripe customer exists and persist its id.
    const customerId = await ensureCustomer(sub.stripeCustomerId, {
      id: user.id,
      email: user.email,
      name: user.name,
    });
    if (customerId !== sub.stripeCustomerId) {
      await prisma.subscription.update({
        where: { userId: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const base = appBaseUrl(request);

    // Existing active subscription → modify in place (upgrade / downgrade).
    if (sub.stripeSubscriptionId && sub.status !== 'CANCELED') {
      const isDowngrade = planRank(targetPlan) < planRank(sub.plan as any);
      const updated = await updateSubscription(sub.stripeSubscriptionId, priceId, {
        atPeriodEnd: isDowngrade,
      });

      await recordAudit({
        userId: user.id,
        action: isDowngrade ? 'billing.downgrade' : 'billing.upgrade',
        entity: 'Subscription',
        entityId: sub.id,
        changes: { from: sub.plan, to: targetPlan, priceId },
        request,
      });

      return NextResponse.json({
        mode: 'update',
        change: isDowngrade ? 'downgrade' : 'upgrade',
        effective: isDowngrade ? 'period_end' : 'immediate',
        plan: targetPlan,
        subscriptionId: updated.id,
        message: isDowngrade
          ? `Downgrade to ${getPlan(targetPlan).name} will take effect at the end of your billing period.`
          : `Upgraded to ${getPlan(targetPlan).name}.`,
      });
    }

    // No subscription yet → hosted Checkout.
    const session = await createCheckoutSession({
      customerId,
      priceId,
      userId: user.id,
      successUrl: `${base}/billing?checkout=success`,
      cancelUrl: `${base}/billing/plans?checkout=canceled`,
    });

    await recordAudit({
      userId: user.id,
      action: 'billing.checkout.start',
      entity: 'Subscription',
      entityId: sub.id,
      changes: { plan: targetPlan, priceId },
      request,
    });

    return NextResponse.json({ mode: 'checkout', url: session.url, plan: targetPlan });
  } catch (error: any) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Subscribe error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to start subscription' },
      { status: 500 },
    );
  }
}
