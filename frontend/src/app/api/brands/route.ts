export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';

export async function GET() {
  const guard = await requirePermission('brand:read');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  try {
    // Admins and above see all brands; others see only their own.
    const where = hasMinRole(user.role, 'ADMIN') ? {} : { userId: user.id };
    const brands = await prisma.brandProfile.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(brands);
  } catch (error: any) {
    console.error('Get brands error:', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission('brand:create');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  try {
    const body = await request.json();
    if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }
    const brand = await prisma.brandProfile.create({
      data: {
        name: body.name.trim(),
        industry: body.industry || null,
        targetAudience: body.targetAudience || null,
        brandVoice: body.brandVoice || null,
        description: body.description || null,
        website: body.website || null,
        logo: body.logo || null,
        guidelines: body.guidelines || null,
        brandColors: body.brandColors ?? undefined,
        userId: user.id,
        createdBy: user.id,
      },
    });
    await recordAudit({
      userId: user.id,
      action: 'brand.create',
      entity: 'BrandProfile',
      entityId: brand.id,
      changes: { name: brand.name },
      request,
    });
    return NextResponse.json(brand, { status: 201 });
  } catch (error: any) {
    console.error('Create brand error:', error);
    return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 });
  }
}
