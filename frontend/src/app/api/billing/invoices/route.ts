// =============================================================================
// GET /api/billing/invoices — the signed-in user's invoice history
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';

export async function GET() {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        amount: Number(inv.amount),
        currency: inv.currency,
        status: inv.status,
        paidAt: inv.paidAt,
        invoiceUrl: inv.invoiceUrl,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Invoices error:', error);
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 });
  }
}
