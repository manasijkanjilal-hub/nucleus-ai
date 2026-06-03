// =============================================================================
// /api/campaigns/[id]/content — list AI generations for a campaign
// -----------------------------------------------------------------------------
//   GET → all AIGeneration records linked to this campaign.
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
      include: { brand: { select: { userId: true } } },
    });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (!hasMinRole(user.role, 'ADMIN') && campaign.brand?.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const generations = await prisma.aIGeneration.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });

    return NextResponse.json(
      generations.map((g) => ({
        id: g.id,
        contentType: g.contentType,
        content: g.generatedContent,
        provider: g.provider,
        model: g.model,
        tokensUsed: g.tokensUsed,
        cost: Number(g.cost),
        createdBy: g.user?.name ?? g.user?.email ?? null,
        createdAt: g.createdAt,
      })),
    );
  } catch (error: any) {
    console.error('Campaign content error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign content' }, { status: 500 });
  }
}
