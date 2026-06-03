// =============================================================================
// Nucleus AI — Admin Brands API (collection)
// =============================================================================
// GET  /api/admin/brands — paginated list with search
// POST /api/admin/brands — create a brand profile
// =============================================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const brandSelect = {
  id: true,
  name: true,
  industry: true,
  targetAudience: true,
  brandVoice: true,
  description: true,
  website: true,
  logoUrl: true,
  brandColors: true,
  guidelines: true,
  userId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
  _count: { select: { campaigns: true, documents: true } },
} satisfies Prisma.BrandProfileSelect;

// ----------------------------------------------------------------------------
// GET
// ----------------------------------------------------------------------------
export async function GET(req: Request) {
  const guard = await requirePermission('brand:read');
  if (!guard.authorized) return guard.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20)
  );
  const search = searchParams.get('search')?.trim() ?? '';

  const where: Prisma.BrandProfileWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { industry: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const [total, brands] = await Promise.all([
      prisma.brandProfile.count({ where }),
      prisma.brandProfile.findMany({
        where,
        select: brandSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      brands,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error('[admin/brands GET] error', err);
    return NextResponse.json({ error: 'Failed to load brands' }, { status: 500 });
  }
}

// ----------------------------------------------------------------------------
// POST
// ----------------------------------------------------------------------------
const brandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').max(160),
  industry: z.string().trim().max(120).optional().or(z.literal('')),
  targetAudience: z.string().trim().max(500).optional().or(z.literal('')),
  brandVoice: z.string().trim().max(500).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  website: z.string().trim().url('Invalid URL').optional().or(z.literal('')),
  logoUrl: z.string().trim().url('Invalid URL').optional().or(z.literal('')),
  guidelines: z.string().trim().max(5000).optional().or(z.literal('')),
  brandColors: z.array(z.string()).optional(),
  ownerId: z.string().optional(),
});

export async function POST(req: Request) {
  const guard = await requirePermission('brand:create');
  if (!guard.authorized) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = brandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Resolve owner: explicit ownerId (must exist) or the acting admin.
  let ownerId = guard.user.id;
  if (d.ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: d.ownerId } });
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 400 });
    }
    ownerId = owner.id;
  }

  try {
    const brand = await prisma.brandProfile.create({
      data: {
        name: d.name,
        industry: d.industry || null,
        targetAudience: d.targetAudience || null,
        brandVoice: d.brandVoice || null,
        description: d.description || null,
        website: d.website || null,
        logoUrl: d.logoUrl || null,
        guidelines: d.guidelines || null,
        brandColors: d.brandColors ?? undefined,
        userId: ownerId,
        createdBy: guard.user.id,
      },
      select: brandSelect,
    });

    await recordAudit({
      userId: guard.user.id,
      action: 'brand.create',
      entity: 'BrandProfile',
      entityId: brand.id,
      changes: { name: d.name },
      request: req,
    });

    return NextResponse.json({ brand }, { status: 201 });
  } catch (err) {
    console.error('[admin/brands POST] error', err);
    return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 });
  }
}
