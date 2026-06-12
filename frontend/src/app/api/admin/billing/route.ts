// =============================================================================
// GET /api/admin/billing — admin overview of all subscriptions + revenue
// -----------------------------------------------------------------------------
// Query params:
//   plan   — filter by plan (FREE|STARTER|PRO|ENTERPRISE)
//   status — filter by status (ACTIVE|CANCELED|PAST_DUE|TRIALING|INCOMPLETE)
//   q      — search by user name / email
//   page   — 1-based page (default 1), 20 per page
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { getPlan, PLAN_ORDER, type PlanId } from '@/lib/plans';
import type { Prisma } from '@prisma/client';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;

  const { searchParams } = new URL(request.url);
  const plan = searchParams.get('plan');
  const status = searchParams.get('status');
  const q = searchParams.get('q')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const where: Prisma.SubscriptionWhereInput = {};
  if (plan && PLAN_ORDER.includes(plan as PlanId)) where.plan = plan as any;
  if (status) where.status = status as any;
  if (q) {
    where.user = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    };
  }

  try {
    const [subscriptions, total, byPlan, paidInvoices] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { user: { select: { name: true, email: true, role: true } } },
      }),
      prisma.subscription.count({ where }),
      prisma.subscription.groupBy({
        by: ['plan'],
        where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { status: { in: ['paid', 'succeeded'] } },
        _sum: { amount: true },
      }),
    ]);

    // Monthly Recurring Revenue from active paid subscriptions.
    const planActiveCounts: Record<string, number> = {};
    for (const row of byPlan) planActiveCounts[row.plan] = row._count._all;
    let mrr = 0;
    for (const id of PLAN_ORDER) {
      const price = getPlan(id).price;
      if (price) mrr += price * (planActiveCounts[id] ?? 0);
    }

    const totalRevenue = Number(paidInvoices._sum.amount ?? 0);

    return NextResponse.json({
      summary: {
        mrr,
        arr: mrr * 12,
        totalRevenue,
        activeSubscriptions: PLAN_ORDER.reduce(
          (n, id) => (id === 'FREE' ? n : n + (planActiveCounts[id] ?? 0)),
          0,
        ),
        byPlan: PLAN_ORDER.map((id) => ({
          plan: id,
          name: getPlan(id).name,
          activeCount: planActiveCounts[id] ?? 0,
        })),
      },
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        user: {
          name: s.user?.name ?? null,
          email: s.user?.email ?? '',
          role: s.user?.role ?? null,
        },
        plan: s.plan,
        status: s.status,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        currentPeriodEnd: s.currentPeriodEnd,
        generationsUsed: s.generationsUsed,
        createdAt: s.createdAt,
      })),
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    });
  } catch (error: any) {
    console.error('[admin/billing] error', error);
    return NextResponse.json({ error: 'Failed to load billing data' }, { status: 500 });
  }
}
