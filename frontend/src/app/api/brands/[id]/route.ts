export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { sanitizeText } from '@/lib/sanitize';

const brandUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  industry: z.string().trim().max(200).optional().nullable(),
  targetAudience: z.string().trim().max(2000).optional().nullable(),
  brandVoice: z.string().trim().max(2000).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  logo: z.string().trim().max(2000).optional().nullable(),
  guidelines: z.string().trim().max(10000).optional().nullable(),
  brandColors: z.any().optional(),
});

const cleanField = (v: string | null | undefined) =>
  v == null ? null : sanitizeText(v) || null;

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = brandUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }
    const b = parsed.data;
    const updated = await prisma.brandProfile.update({
      where: { id },
      data: {
        name: b.name ? sanitizeText(b.name) : brand.name,
        industry: cleanField(b.industry),
        targetAudience: cleanField(b.targetAudience),
        brandVoice: cleanField(b.brandVoice),
        description: cleanField(b.description),
        website: cleanField(b.website),
        logo: cleanField(b.logo),
        guidelines: cleanField(b.guidelines),
        brandColors: b.brandColors ?? undefined,
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
