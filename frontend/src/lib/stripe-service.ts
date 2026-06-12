// =============================================================================
// Nucleus AI — Stripe Service
// -----------------------------------------------------------------------------
// Thin, well-typed wrapper around the Stripe Node SDK. The client is lazily
// initialised so the app still builds/runs without Stripe keys configured
// (billing endpoints then return a clear "not configured" error).
//
// Production notes:
//   • New subscriptions use Stripe Checkout (hosted, PCI-compliant, handles
//     SCA / 3-D Secure automatically).
//   • Existing subscribers upgrade/downgrade via the Subscriptions API.
//   • Self-service management (payment methods, invoices, cancellation) uses
//     the Stripe Billing Customer Portal.
//   • Webhooks are verified with STRIPE_WEBHOOK_SECRET.
// =============================================================================

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/** True when a Stripe secret key is present in the environment. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Lazily construct (and cache) the Stripe client. Throws if unconfigured. */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeNotConfiguredError();
  }
  _stripe = new Stripe(key, {
    // Pin a reasonable network timeout; SDK uses its built-in pinned API version.
    timeout: 20_000,
    maxNetworkRetries: 2,
    appInfo: { name: 'Nucleus AI', version: '1.0.0' },
  });
  return _stripe;
}

/** Raised when a Stripe operation is attempted without configuration. */
export class StripeNotConfiguredError extends Error {
  status = 503;
  constructor() {
    super('Billing is not configured. Set STRIPE_SECRET_KEY to enable payments.');
    this.name = 'StripeNotConfiguredError';
  }
}

// -----------------------------------------------------------------------------
// Customers
// -----------------------------------------------------------------------------

export async function createCustomer(user: {
  id: string;
  email: string;
  name?: string | null;
}): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });
}

/** Return an existing customer id, or create one and return its id. */
export async function ensureCustomer(
  existingCustomerId: string | null | undefined,
  user: { id: string; email: string; name?: string | null },
): Promise<string> {
  if (existingCustomerId) {
    try {
      const c = await getStripe().customers.retrieve(existingCustomerId);
      if (c && !(c as Stripe.DeletedCustomer).deleted) return existingCustomerId;
    } catch {
      // fall through and create a fresh customer
    }
  }
  const created = await createCustomer(user);
  return created.id;
}

// -----------------------------------------------------------------------------
// Checkout (new subscriptions)
// -----------------------------------------------------------------------------

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    client_reference_id: params.userId,
    subscription_data: { metadata: { userId: params.userId } },
    metadata: { userId: params.userId },
  });
}

// -----------------------------------------------------------------------------
// Subscriptions (upgrade / downgrade / cancel)
// -----------------------------------------------------------------------------

export async function createSubscription(
  customerId: string,
  priceId: string,
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });
}

/**
 * Change the price of an existing subscription.
 *  - Upgrades take effect immediately with prorated charges.
 *  - Downgrades are scheduled to take effect at period end (no proration)
 *    when `atPeriodEnd` is true.
 */
export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string,
  opts: { atPeriodEnd?: boolean } = {},
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = sub.items.data[0]?.id;
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: opts.atPeriodEnd ? 'none' : 'create_prorations',
  });
}

/** Cancel at period end (keeps access until the cycle finishes). */
export async function cancelSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/** Reactivate a subscription previously set to cancel at period end. */
export async function reactivateSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

// -----------------------------------------------------------------------------
// Customer Portal
// -----------------------------------------------------------------------------

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// -----------------------------------------------------------------------------
// Webhooks
// -----------------------------------------------------------------------------

/** Verify and parse a webhook payload. Throws on signature mismatch. */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Safely read the current period end (unix→Date) from a subscription. */
export function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const raw =
    (sub as any).current_period_end ??
    (sub.items?.data?.[0] as any)?.current_period_end ??
    null;
  return raw ? new Date(raw * 1000) : null;
}

export function getPeriodStart(sub: Stripe.Subscription): Date | null {
  const raw =
    (sub as any).current_period_start ??
    (sub.items?.data?.[0] as any)?.current_period_start ??
    null;
  return raw ? new Date(raw * 1000) : null;
}

/** Map a Stripe subscription status to our SubscriptionStatus enum string. */
export function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'incomplete':
    case 'incomplete_expired':
      return 'INCOMPLETE';
    default:
      return 'INCOMPLETE';
  }
}
