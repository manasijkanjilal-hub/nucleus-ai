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

export async function GET() {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const isAdmin = hasMinRole(user.role, 'ADMIN');

    // Scope filters --------------------------------------------------------
    // Non-admins: campaigns/generations belonging to brands they own.
    const campaignWhere = isAdmin ? {} : { brand: { userId: user.id } };
    const genWhere = isAdmin ? {} : { brand: { userId: user.id } };
    const brandWhere = isAdmin ? {} : { userId: user.id };

    const [campaignCount, generationCount, genAgg, recent, brandIds, providerGroups] =
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
      ]);

    // Resolve brand names for the grouped result.
    const ids = brandIds.map((b) => b.brandId);
    const brands = ids.length
      ? await prisma.brandProfile.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(brands.map((b) => [b.id, b.name]));

    return NextResponse.json({
      scope: isAdmin ? 'all' : 'own',
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
