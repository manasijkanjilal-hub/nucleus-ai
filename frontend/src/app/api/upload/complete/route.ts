export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';

export async function POST(request: Request) {
  const guard = await requirePermission('document:create');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  try {
    const { cloudStoragePath, isPublic, fileName, fileType, brandId } = await request.json();
    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }
    const doc = await prisma.uploadedDocument.create({
      data: {
        fileName,
        fileType: fileType || 'unknown',
        cloudStoragePath,
        isPublic: isPublic ?? false,
        brandId: brandId || null,
        status: 'uploaded',
        userId: user.id,
      },
    });
    await recordAudit({
      userId: user.id,
      action: 'document.upload',
      entity: 'UploadedDocument',
      entityId: doc.id,
      changes: { fileName, brandId: brandId || null },
      request,
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    console.error('Upload complete error:', error);
    return NextResponse.json({ error: 'Failed to save upload record' }, { status: 500 });
  }
}
