export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { processDocumentPipeline } from '@/lib/document-pipeline';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/documents/[id]/process
 * Trigger (or re-trigger) processing of a document: extract -> chunk -> embed
 * -> store. Drives status PENDING -> PROCESSING -> COMPLETED | FAILED.
 *
 * Exposed separately from PATCH so background workers / status pollers can call
 * a dedicated endpoint.
 */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission('document:update');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  if (!hasMinRole(user.role, 'ADMIN') && doc.uploadedBy !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden — you can only process your own documents' },
      { status: 403 }
    );
  }

  const result = await processDocumentPipeline(id);

  await recordAudit({
    userId: user.id,
    action: 'document.process',
    entity: 'Document',
    entityId: id,
    changes: { success: result.success, chunkCount: result.chunkCount },
    request: req,
  });

  return NextResponse.json(
    { success: result.success, result },
    { status: result.success ? 200 : 422 }
  );
}
