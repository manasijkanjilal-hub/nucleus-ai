// =============================================================================
// PATCH /api/generate/[id] — save a generation to a campaign
// -----------------------------------------------------------------------------
// Links an existing AIGeneration to a campaign. Either:
//   • campaignId  — attach to an existing campaign (must belong to same brand), or
//   • campaignName — create a new DRAFT campaign under the brand and attach.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { sanitizeText } from '@/lib/sanitize';
import { firstZodError } from '@/lib/validations/auth';

const saveSchema = z
  .object({
    campaignId: z.string().trim().min(1).optional(),
    campaignName: z.string().trim().min(1).max(200).optional(),
  })
  .refine((d) => d.campaignId || d.campaignName, {
    message: 'Provide a campaignId or a campaignName',
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission('content:generate');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  try {
    const generation = await prisma.aIGeneration.findUnique({ where: { id } });
    if (!generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    // Access: owner of the generation, or ADMIN+.
    const isAdmin = hasMinRole(user.role, 'ADMIN');
    if (!isAdmin && generation.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let campaignId = parsed.data.campaignId ?? null;

    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign || campaign.brandId !== generation.brandId) {
        return NextResponse.json(
          { error: 'Invalid campaign for this brand' },
          { status: 400 },
        );
      }
    } else {
      // Create a new DRAFT campaign under the generation's brand.
      const campaign = await prisma.campaign.create({
        data: {
          name: sanitizeText(parsed.data.campaignName || 'Untitled Campaign'),
          brandId: generation.brandId,
          createdBy: user.id,
          status: 'DRAFT',
        },
      });
      campaignId = campaign.id;
    }

    const updated = await prisma.aIGeneration.update({
      where: { id },
      data: { campaignId },
    });

    await recordAudit({
      userId: user.id,
      action: 'ai.generation.save',
      entity: 'AIGeneration',
      entityId: id,
      changes: { campaignId },
      request,
    });

    return NextResponse.json({ id: updated.id, campaignId });
  } catch (error: any) {
    console.error('Save generation error:', error);
    return NextResponse.json({ error: 'Failed to save generation' }, { status: 500 });
  }
}
