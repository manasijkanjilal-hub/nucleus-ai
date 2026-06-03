// =============================================================================
// Nucleus AI — Admin Brands API (single resource)
// =============================================================================
// PUT    /api/admin/brands/:id — update brand
// DELETE /api/admin/brands/:id — delete brand
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

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  industry: z.string().trim().max(120).optional().or(z.literal('')),
  targetAudience: z.string().trim().max(500).optional().or(z.literal('')),
  brandVoice: z.string().trim().max(500).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  website: z.string().trim().url('Invalid URL').optional().or(z.literal('')),
  logoUrl: z.string().trim().url('Invalid URL').optional().or(z.literal('')),
  guidelines: z.string().trim().max(5000).optional().or(z.literal('')),
  brandColors: z.array(z.string()).optional(),
});

export async function PUT(req: Request, ctx: Ctx) {
  const guard = await requirePermission('brand:update');
  if (!guard.authorized) return guard.response;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const d = parsed.data;

  try {
    const existing = await prisma.brandProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const data: Prisma.BrandProfileUpdateInput = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.industry !== undefined) data.industry = d.industry || null;
    if (d.targetAudience !== undefined) data.targetAudience = d.targetAudience || null;
    if (d.brandVoice !== undefined) data.brandVoice = d.brandVoice || null;
    if (d.description !== undefined) data.description = d.description || null;
    if (d.website !== undefined) data.website = d.website || null;
    if (d.logoUrl !== undefined) data.logoUrl = d.logoUrl || null;
    if (d.guidelines !== undefined) data.guidelines = d.guidelines || null;
    if (d.brandColors !== undefined) data.brandColors = d.brandColors;

    const brand = await prisma.brandProfile.update({
      where: { id },
      data,
      select: brandSelect,
    });

    await recordAudit({
      userId: guard.user.id,
      action: 'brand.update',
      entity: 'BrandProfile',
      entityId: id,
      changes: { name: brand.name },
      request: req,
    });

    return NextResponse.json({ brand });
  } catch (err) {
    console.error('[admin/brands/:id PUT] error', err);
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const guard = await requirePermission('brand:delete');
  if (!guard.authorized) return guard.response;

  const { id } = await ctx.params;

  try {
    const existing = await prisma.brandProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    await prisma.brandProfile.delete({ where: { id } });

    await recordAudit({
      userId: guard.user.id,
      action: 'brand.delete',
      entity: 'BrandProfile',
      entityId: id,
      changes: { name: existing.name },
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/brands/:id DELETE] error', err);
    return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 });
  }
}
