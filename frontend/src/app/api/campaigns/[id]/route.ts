// =============================================================================
// /api/campaigns/[id] — fetch a single campaign (Prisma-backed)
// -----------------------------------------------------------------------------
//   GET → campaign detail including brand info and generation aggregates.
//         Access: ADMIN+ see all; others only campaigns for brands they own.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission('campaign:read');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  const { id } = await params;

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, industry: true, userId: true } },
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { aiGenerations: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Ownership check (brand owner or ADMIN+).
    if (!hasMinRole(user.role, 'ADMIN') && campaign.brand?.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Token / cost aggregates for this campaign.
    const agg = await prisma.aIGeneration.aggregate({
      where: { campaignId: id },
      _sum: { tokensUsed: true, cost: true },
    });

    return NextResponse.json({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      goals: campaign.goals,
      status: campaign.status,
      brandId: campaign.brandId,
      brandName: campaign.brand?.name ?? null,
      brandIndustry: campaign.brand?.industry ?? null,
      createdByName: campaign.creator?.name ?? campaign.creator?.email ?? null,
      generationCount: campaign._count.aiGenerations,
      totalTokens: agg._sum.tokensUsed ?? 0,
      totalCost: Number(agg._sum.cost ?? 0),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    });
  } catch (error: any) {
    console.error('Get campaign error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}
