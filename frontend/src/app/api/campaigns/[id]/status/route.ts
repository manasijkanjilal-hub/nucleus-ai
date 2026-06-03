// =============================================================================
// /api/campaigns/[id]/status — change a campaign's status
// -----------------------------------------------------------------------------
//   PATCH { status } → update the campaign status.
//   Valid: DRAFT | ACTIVE | PAUSED | COMPLETED | ARCHIVED
//   Requires `campaign:update`. Access: ADMIN+ or the brand owner.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { firstZodError } from '@/lib/validations/auth';

const VALID_STATUS = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;

const statusSchema = z.object({
  status: z.enum(VALID_STATUS),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission('campaign:update');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { status } = parsed.data;

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

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status },
    });

    await recordAudit({
      userId: user.id,
      action: 'campaign.status.update',
      entity: 'Campaign',
      entityId: id,
      changes: { from: campaign.status, to: status },
      request,
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error: any) {
    console.error('Update campaign status error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
