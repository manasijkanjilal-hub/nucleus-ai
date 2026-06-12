// =============================================================================
// POST /api/billing/webhook — Stripe webhook receiver
// -----------------------------------------------------------------------------
// Verifies the Stripe signature against the raw request body and keeps our
// Subscription / Invoice tables in sync with Stripe. This route is PUBLIC
// (no auth) but is secured by signature verification.
//
// Handled events:
//   • checkout.session.completed        → activate the new subscription
//   • customer.subscription.created      → sync plan/status/periods
//   • customer.subscription.updated      → sync plan/status/periods/cancel flag
//   • customer.subscription.deleted      → revert to FREE, mark CANCELED
//   • invoice.paid / invoice.payment_succeeded → record invoice, reset usage
//   • invoice.payment_failed             → mark PAST_DUE
// =============================================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  getStripe,
  isStripeConfigured,
  constructWebhookEvent,
  getPeriodStart,
  getPeriodEnd,
  mapStripeStatus,
} from '@/lib/stripe-service';
import { getPlan, planIdForPriceId, type PlanId } from '@/lib/plans';

/** Resolve our internal userId from a Stripe customer id or metadata. */
async function resolveUserId(opts: {
  metadataUserId?: string | null;
  customerId?: string | null;
}): Promise<string | null> {
  if (opts.metadataUserId) {
    const u = await prisma.user.findUnique({ where: { id: opts.metadataUserId } });
    if (u) return u.id;
  }
  if (opts.customerId) {
    const sub = await prisma.subscription.findFirst({
      where: { stripeCustomerId: opts.customerId },
    });
    if (sub) return sub.userId;
  }
  return null;
}

/** Update our Subscription row from a Stripe subscription object. */
async function syncSubscription(stripeSub: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id;
  const metadataUserId = (stripeSub.metadata?.userId as string | undefined) ?? null;
  const userId = await resolveUserId({ metadataUserId, customerId });
  if (!userId) {
    console.warn('Webhook: could not resolve user for subscription', stripeSub.id);
    return;
  }

  const priceId = stripeSub.items.data[0]?.price?.id ?? null;
  const plan: PlanId = (priceId && planIdForPriceId(priceId)) || 'FREE';
  const planCfg = getPlan(plan);
  const status = mapStripeStatus(stripeSub.status);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      status: status as any,
      stripeCustomerId: customerId ?? null,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: priceId,
      currentPeriodStart: getPeriodStart(stripeSub),
      currentPeriodEnd: getPeriodEnd(stripeSub),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end ?? false,
      generationsLimit: planCfg.limits.generations,
      brandsLimit: planCfg.limits.brands,
    },
    update: {
      plan,
      status: status as any,
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: priceId,
      currentPeriodStart: getPeriodStart(stripeSub),
      currentPeriodEnd: getPeriodEnd(stripeSub),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end ?? false,
      generationsLimit: planCfg.limits.generations,
      brandsLimit: planCfg.limits.brands,
    },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (!session.subscription) return;
  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;
  const stripeSub = await getStripe().subscriptions.retrieve(subId);
  // Carry the userId from the checkout session into the subscription metadata
  // path if Stripe didn't propagate it.
  if (!stripeSub.metadata?.userId && session.metadata?.userId) {
    stripeSub.metadata = { ...stripeSub.metadata, userId: session.metadata.userId };
  }
  await syncSubscription(stripeSub);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const userId = await resolveUserId({
    metadataUserId: (invoice.metadata?.userId as string | undefined) ?? null,
    customerId,
  });
  if (!userId) {
    console.warn('Webhook: could not resolve user for invoice', invoice.id);
    return;
  }

  // Record the invoice (idempotent on stripeInvoiceId).
  if (invoice.id) {
    await prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        userId,
        stripeInvoiceId: invoice.id,
        amount: (invoice.amount_paid ?? invoice.amount_due ?? 0) / 100,
        currency: (invoice.currency ?? 'usd').toUpperCase(),
        status: invoice.status ?? 'paid',
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(),
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      },
      update: {
        amount: (invoice.amount_paid ?? invoice.amount_due ?? 0) / 100,
        status: invoice.status ?? 'paid',
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(),
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      },
    });
  }

  // A successful recurring payment resets the monthly generation counter.
  await prisma.subscription.updateMany({
    where: { userId },
    data: { generationsUsed: 0, status: 'ACTIVE' },
  });
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const userId = await resolveUserId({
    metadataUserId: (invoice.metadata?.userId as string | undefined) ?? null,
    customerId,
  });
  if (!userId) return;
  await prisma.subscription.updateMany({
    where: { userId },
    data: { status: 'PAST_DUE' },
  });
}

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id;
  const userId = await resolveUserId({
    metadataUserId: (stripeSub.metadata?.userId as string | undefined) ?? null,
    customerId,
  });
  if (!userId) return;
  const free = getPlan('FREE');
  await prisma.subscription.updateMany({
    where: { userId },
    data: {
      plan: 'FREE',
      status: 'CANCELED',
      stripeSubscriptionId: null,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      generationsLimit: free.limits.generations,
      brandsLimit: free.limits.brands,
    },
  });
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error?.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error?.message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (error: any) {
    // Log but still return 200-class so Stripe doesn't hammer retries for a
    // transient DB hiccup we can't fix by retrying immediately. Use 500 only
    // for unexpected, retry-worthy failures.
    console.error(`Webhook handler error for ${event.type}:`, error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
