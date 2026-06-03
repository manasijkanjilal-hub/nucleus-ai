export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';

/** Returns the brand if the user may access it, else null. Admins+ bypass ownership. */
async function getAccessibleBrand(id: string, userId: string, role: string) {
  const brand = await prisma.brandProfile.findUnique({ where: { id } });
  if (!brand) return { brand: null, forbidden: false };
  if (!hasMinRole(role as any, 'ADMIN') && brand.userId !== userId) {
    return { brand: null, forbidden: true };
  }
  return { brand, forbidden: false };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission('brand:update');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  try {
    const { id } = await params;
    const { brand, forbidden } = await getAccessibleBrand(id, user.id, user.role);
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const body = await request.json();
    const updated = await prisma.brandProfile.update({
      where: { id },
      data: {
        name: body.name ?? brand.name,
        industry: body.industry ?? null,
        targetAudience: body.targetAudience ?? null,
        brandVoice: body.brandVoice ?? null,
        description: body.description ?? null,
        website: body.website ?? null,
        logo: body.logo ?? null,
        guidelines: body.guidelines ?? null,
        brandColors: body.brandColors ?? undefined,
      },
    });
    await recordAudit({
      userId: user.id,
      action: 'brand.update',
      entity: 'BrandProfile',
      entityId: id,
      request,
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update brand error:', error);
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission('brand:delete');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  try {
    const { id } = await params;
    const { brand, forbidden } = await getAccessibleBrand(id, user.id, user.role);
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    await prisma.brandProfile.delete({ where: { id } });
    await recordAudit({
      userId: user.id,
      action: 'brand.delete',
      entity: 'BrandProfile',
      entityId: id,
      changes: { name: brand.name },
      request,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete brand error:', error);
    return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 });
  }
}
