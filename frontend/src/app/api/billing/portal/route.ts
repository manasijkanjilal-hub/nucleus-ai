// =============================================================================
// POST /api/billing/portal — open the Stripe Billing Customer Portal
// -----------------------------------------------------------------------------
// Lets subscribers manage payment methods, view invoices, and cancel/upgrade
// through Stripe's hosted, PCI-compliant portal. Returns a redirect URL.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';
import {
  isStripeConfigured,
  ensureCustomer,
  createPortalSession,
  StripeNotConfiguredError,
} from '@/lib/stripe-service';
import { getOrCreateSubscription } from '@/lib/usage-limits';

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

  try {
    const sub = await getOrCreateSubscription(user.id);

    // Ensure a Stripe customer exists (so the portal has something to manage).
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

    const session = await createPortalSession(customerId, `${appBaseUrl(request)}/billing`);
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Billing portal error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to open billing portal' },
      { status: 500 },
    );
  }
}
