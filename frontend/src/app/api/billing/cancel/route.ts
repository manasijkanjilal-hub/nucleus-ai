// =============================================================================
// POST /api/billing/cancel — cancel the current subscription at period end
// -----------------------------------------------------------------------------
// Keeps access until the end of the paid period (Stripe cancel_at_period_end).
// Body (optional): { reactivate?: boolean } to undo a pending cancellation.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import { firstZodError } from '@/lib/validations/auth';
import {
  isStripeConfigured,
  cancelSubscription,
  reactivateSubscription,
  StripeNotConfiguredError,
} from '@/lib/stripe-service';
import { getOrCreateSubscription } from '@/lib/usage-limits';

const schema = z.object({ reactivate: z.boolean().optional() });

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const reactivate = parsed.data.reactivate ?? false;

  const sub = await getOrCreateSubscription(user.id);

  if (!sub.stripeSubscriptionId) {
    return NextResponse.json(
      { error: 'You do not have an active paid subscription to cancel.' },
      { status: 400 },
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Billing is not configured. Set STRIPE_SECRET_KEY to enable payments.' },
      { status: 503 },
    );
  }

  try {
    if (reactivate) {
      await reactivateSubscription(sub.stripeSubscriptionId);
      const updated = await prisma.subscription.update({
        where: { userId: user.id },
        data: { cancelAtPeriodEnd: false, canceledAt: null },
      });
      await recordAudit({
        userId: user.id,
        action: 'billing.reactivate',
        entity: 'Subscription',
        entityId: sub.id,
        request,
      });
      return NextResponse.json({
        cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        message: 'Your subscription will continue and will not be canceled.',
      });
    }

    await cancelSubscription(sub.stripeSubscriptionId);
    const updated = await prisma.subscription.update({
      where: { userId: user.id },
      data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
    });
    await recordAudit({
      userId: user.id,
      action: 'billing.cancel',
      entity: 'Subscription',
      entityId: sub.id,
      changes: { plan: sub.plan },
      request,
    });
    return NextResponse.json({
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
      currentPeriodEnd: updated.currentPeriodEnd,
      message: 'Your subscription will be canceled at the end of the current billing period.',
    });
  } catch (error: any) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update subscription' },
      { status: 500 },
    );
  }
}
