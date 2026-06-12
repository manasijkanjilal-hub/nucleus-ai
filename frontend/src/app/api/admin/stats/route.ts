// =============================================================================
// Nucleus AI — Admin Stats API
// =============================================================================
// GET /api/admin/stats
// Returns aggregate metrics for the admin dashboard: user counts by role/status,
// brand count, campaign counts by status, document count, signup trend, and
// recent audit activity.
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import type { Role } from '@/lib/permissions';
import { getPlan, PLAN_ORDER, type PlanId } from '@/lib/plans';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;

  try {
    const [
      totalUsers,
      usersByRole,
      usersByStatus,
      totalBrands,
      totalCampaigns,
      campaignsByStatus,
      totalDocuments,
      recentAudit,
      recentUsers,
      subsByPlan,
      paidInvoices,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.brandProfile.count(),
      prisma.campaign.count(),
      prisma.campaign.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.uploadedDocument.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { createdAt: true },
      }),
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

    // Billing metrics ---------------------------------------------------------
    const planActiveCounts: Record<string, number> = {};
    for (const row of subsByPlan) planActiveCounts[row.plan] = row._count._all;
    let mrr = 0;
    let activeSubscriptions = 0;
    for (const id of PLAN_ORDER) {
      const count = planActiveCounts[id] ?? 0;
      const price = getPlan(id as PlanId).price;
      if (id !== 'FREE') activeSubscriptions += count;
      if (price) mrr += price * count;
    }
    const totalRevenue = Number(paidInvoices._sum.amount ?? 0);

    // Normalise role counts
    const roleCounts: Record<Role, number> = {
      SUPER_ADMIN: 0,
      ADMIN: 0,
      EDITOR: 0,
      VIEWER: 0,
    };
    for (const r of usersByRole) {
      roleCounts[r.role as Role] = r._count._all;
    }

    // Normalise status counts
    const statusCounts: Record<string, number> = {
      ACTIVE: 0,
      SUSPENDED: 0,
      PENDING_VERIFICATION: 0,
    };
    for (const s of usersByStatus) {
      statusCounts[s.status] = s._count._all;
    }

    // Normalise campaign status counts
    const campaignStatusCounts: Record<string, number> = {
      DRAFT: 0,
      ACTIVE: 0,
      PAUSED: 0,
      COMPLETED: 0,
      ARCHIVED: 0,
    };
    for (const c of campaignsByStatus) {
      campaignStatusCounts[c.status] = c._count._all;
    }

    // Build a 7-day signup trend (oldest -> newest)
    const today = new Date();
    const trend: { date: string; users: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const count = recentUsers.filter(
        (u) => u.createdAt >= day && u.createdAt < next
      ).length;
      trend.push({
        date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        users: count,
      });
    }

    return NextResponse.json({
      users: {
        total: totalUsers,
        byRole: roleCounts,
        byStatus: statusCounts,
      },
      brands: { total: totalBrands },
      campaigns: {
        total: totalCampaigns,
        byStatus: campaignStatusCounts,
        active: campaignStatusCounts.ACTIVE,
      },
      documents: { total: totalDocuments },
      billing: {
        mrr,
        arr: mrr * 12,
        totalRevenue,
        activeSubscriptions,
        byPlan: PLAN_ORDER.map((id) => ({
          plan: id,
          name: getPlan(id as PlanId).name,
          activeCount: planActiveCounts[id] ?? 0,
        })),
      },
      signupTrend: trend,
      recentActivity: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        actor: a.user?.name ?? a.user?.email ?? 'System',
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error('[admin/stats] error', err);
    return NextResponse.json(
      { error: 'Failed to load stats' },
      { status: 500 }
    );
  }
}
