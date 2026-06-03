export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';

export async function GET() {
  const guard = await requirePermission('document:read');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  try {
    // Admins and above see all documents; others see only their own.
    const where = hasMinRole(user.role, 'ADMIN') ? {} : { userId: user.id };
    const docs = await prisma.uploadedDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(docs);
  } catch (error: any) {
    console.error('Get documents error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
