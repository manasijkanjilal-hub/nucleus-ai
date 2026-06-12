export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { sanitizeText } from '@/lib/sanitize';
import { checkBrandLimit, UsageLimitError } from '@/lib/usage-limits';

const brandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').max(200),
  industry: z.string().trim().max(200).optional().nullable(),
  targetAudience: z.string().trim().max(2000).optional().nullable(),
  brandVoice: z.string().trim().max(2000).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  logo: z.string().trim().max(2000).optional().nullable(),
  guidelines: z.string().trim().max(10000).optional().nullable(),
  brandColors: z.any().optional(),
});

/** Sanitize free-text string fields (XSS defense-in-depth). */
function cleanBrand(data: z.infer<typeof brandSchema>) {
  const clean = (v: string | null | undefined) =>
    v == null ? null : sanitizeText(v) || null;
  return {
    name: sanitizeText(data.name),
    industry: clean(data.industry),
    targetAudience: clean(data.targetAudience),
    brandVoice: clean(data.brandVoice),
    description: clean(data.description),
    website: clean(data.website),
    logo: clean(data.logo),
    guidelines: clean(data.guidelines),
    brandColors: data.brandColors ?? undefined,
  };
}

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
    let body: unknown;
    try {
      body = await request.json();
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
    // Enforce the plan's brand limit.
    await checkBrandLimit(user.id);

    const data = cleanBrand(parsed.data);
    const brand = await prisma.brandProfile.create({
      data: {
        ...data,
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
    if (error instanceof UsageLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          upgradeRequired: true,
          resource: error.resource,
          plan: error.plan,
          used: error.used,
          limit: error.limit,
        },
        { status: 403 },
      );
    }
    console.error('Create brand error:', error);
    return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 });
  }
}
