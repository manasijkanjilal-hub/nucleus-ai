// =============================================================================
// /api/analytics — usage analytics aggregations (Prisma-backed)
// -----------------------------------------------------------------------------
//   GET → {
//     totals: { campaigns, generations, tokensUsed, cost },
//     recentGenerations: [...last 10],
//     topBrands: [...by generation count],
//   }
//   Access: any authenticated user. ADMIN+ see all data; others see only
//   data scoped to the brands they own.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
};

// Supported date ranges (days). 'all' means no lower bound.
function rangeToSince(range: string | null): Date | null {
  switch (range) {
    case '7':
      return new Date(Date.now() - 7 * 86400_000);
    case '90':
      return new Date(Date.now() - 90 * 86400_000);
    case 'all':
      return null;
    case '30':
    default:
      return new Date(Date.now() - 30 * 86400_000);
  }
}

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const isAdmin = hasMinRole(user.role, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') ?? '30';
    const since = rangeToSince(range);
    const dateFilter = since ? { createdAt: { gte: since } } : {};

    // Scope filters --------------------------------------------------------
    // Non-admins: campaigns/generations belonging to brands they own.
    const scope = isAdmin ? {} : { brand: { userId: user.id } };
    const campaignWhere = scope;
    const genWhere = { ...scope, ...dateFilter };

    const [campaignCount, generationCount, genAgg, recent, brandIds, providerGroups, contentTypeGroups, trendRows] =
      await Promise.all([
        prisma.campaign.count({ where: campaignWhere }),
        prisma.aIGeneration.count({ where: genWhere }),
        prisma.aIGeneration.aggregate({
          where: genWhere,
          _sum: { tokensUsed: true, cost: true },
        }),
        prisma.aIGeneration.findMany({
          where: genWhere,
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            brand: { select: { name: true } },
            campaign: { select: { name: true } },
          },
        }),
        // Group generations by brand for the "top brands" table.
        prisma.aIGeneration.groupBy({
          by: ['brandId'],
          where: genWhere,
          _count: { _all: true },
          _sum: { tokensUsed: true, cost: true },
          orderBy: { _count: { brandId: 'desc' } },
          take: 5,
        }),
        // Group generations by AI provider for the provider comparison.
        prisma.aIGeneration.groupBy({
          by: ['provider'],
          where: genWhere,
          _count: { _all: true },
          _sum: { tokensUsed: true, cost: true },
          orderBy: { _count: { provider: 'desc' } },
        }),
        // Group generations by content type for the distribution pie chart.
        prisma.aIGeneration.groupBy({
          by: ['contentType'],
          where: genWhere,
          _count: { _all: true },
          orderBy: { _count: { contentType: 'desc' } },
        }),
        // Lightweight rows for the daily generation trend (createdAt only).
        prisma.aIGeneration.findMany({
          where: genWhere,
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    // Build a daily generation-trend series. If 'all', span from first record;
    // otherwise span the selected window so the chart always shows the range.
    const trendDays = range === '7' ? 7 : range === '90' ? 90 : range === 'all' ? null : 30;
    const dayCounts = new Map<string, number>();
    for (const r of trendRows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    }
    let generationTrend: { date: string; generations: number }[] = [];
    if (trendDays) {
      for (let i = trendDays - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        generationTrend.push({ date: d, generations: dayCounts.get(d) ?? 0 });
      }
    } else {
      generationTrend = Array.from(dayCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, generations]) => ({ date, generations }));
    }

    // Resolve brand names for the grouped result.
    const ids = brandIds.map((b) => b.brandId);
    const brands = ids.length
      ? await prisma.brandProfile.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(brands.map((b) => [b.id, b.name]));

    const CONTENT_LABELS: Record<string, string> = {
      google_ads: 'Google Ads', facebook_ads: 'Facebook Ads', instagram_post: 'Instagram Post',
      linkedin_post: 'LinkedIn Post', blog_post: 'Blog Post', email_campaign: 'Email Campaign',
      landing_page: 'Landing Page', video_script: 'Video Script',
    };

    return NextResponse.json({
      scope: isAdmin ? 'all' : 'own',
      range,
      // Daily generation counts across the selected window.
      generationTrend,
      // Content-type distribution for the pie chart.
      byContentType: contentTypeGroups.map((c) => ({
        contentType: c.contentType,
        label: CONTENT_LABELS[c.contentType] ?? c.contentType,
        generations: c._count._all,
      })),
      totals: {
        campaigns: campaignCount,
        generations: generationCount,
        tokensUsed: genAgg._sum.tokensUsed ?? 0,
        cost: Number(genAgg._sum.cost ?? 0),
      },
      recentGenerations: recent.map((g) => ({
        id: g.id,
        contentType: g.contentType,
        brandName: g.brand?.name ?? null,
        campaignName: g.campaign?.name ?? null,
        tokensUsed: g.tokensUsed,
        cost: Number(g.cost),
        createdAt: g.createdAt,
      })),
      topBrands: brandIds.map((b) => ({
        brandId: b.brandId,
        brandName: nameById.get(b.brandId) ?? 'Unknown',
        generations: b._count._all,
        tokensUsed: b._sum.tokensUsed ?? 0,
        cost: Number(b._sum.cost ?? 0),
      })),
      // Per-provider comparison (generations, tokens, cost). Success rate is
      // 100% because only successful generations are persisted.
      byProvider: providerGroups.map((p) => ({
        provider: p.provider,
        label: PROVIDER_LABELS[p.provider] ?? p.provider,
        generations: p._count._all,
        tokensUsed: p._sum.tokensUsed ?? 0,
        cost: Number(p._sum.cost ?? 0),
      })),
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
