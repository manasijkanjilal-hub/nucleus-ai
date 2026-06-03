// =============================================================================
// /api/campaigns — list & create campaigns (Prisma-backed)
// -----------------------------------------------------------------------------
//   GET   → list campaigns (admins see all; others see campaigns for the
//           brands they own). Includes brand name + generation counts.
//   POST  → create a campaign under a brand the user can access.
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

const VALID_STATUS = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required').max(200),
  brandId: z.string().trim().min(1, 'A brand is required'),
  description: z.string().trim().max(5000).optional().nullable(),
  type: z.string().trim().max(200).optional().nullable(),
  goals: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(VALID_STATUS).optional().default('DRAFT'),
});

const clean = (v: string | null | undefined) =>
  v == null ? null : sanitizeText(v) || null;

export async function GET() {
  const guard = await requirePermission('campaign:read');
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const isAdmin = hasMinRole(user.role, 'ADMIN');
    // Non-admins only see campaigns whose brand they own.
    const where = isAdmin ? {} : { brand: { userId: user.id } };

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        brand: { select: { id: true, name: true } },
        _count: { select: { aiGenerations: true } },
      },
    });

    return NextResponse.json(
      campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        goals: c.goals,
        status: c.status,
        brandId: c.brandId,
        brandName: c.brand?.name ?? null,
        generationCount: c._count.aiGenerations,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    );
  } catch (error: any) {
    console.error('List campaigns error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission('campaign:create');
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { brandId, status } = parsed.data;

  try {
    // Verify the brand exists and the user may use it.
    const brand = await prisma.brandProfile.findUnique({ where: { id: brandId } });
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }
    if (!hasMinRole(user.role, 'ADMIN') && brand.userId !== user.id) {
      return NextResponse.json(
        { error: 'You do not have access to this brand' },
        { status: 403 },
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: sanitizeText(parsed.data.name),
        description: clean(parsed.data.description),
        type: clean(parsed.data.type),
        goals: clean(parsed.data.goals),
        status,
        brandId,
        createdBy: user.id,
      },
    });

    await recordAudit({
      userId: user.id,
      action: 'campaign.create',
      entity: 'Campaign',
      entityId: campaign.id,
      changes: { name: campaign.name, brandId },
      request,
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error: any) {
    console.error('Create campaign error:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
