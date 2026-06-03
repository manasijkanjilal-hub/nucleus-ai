export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { deleteFile } from '@/lib/document-storage';
import {
  deleteVectorsByDocument,
  searchVectors,
  getVectorStoreBackend,
} from '@/lib/vector-store';
import { fallbackEmbedding } from '@/lib/embeddings';
import { processDocumentPipeline } from '@/lib/document-pipeline';

type Params = { params: Promise<{ id: string }> };

/** Can the user act on this document? Owners always; ADMIN+ for any. */
function canManage(
  role: string,
  ownerId: string,
  userId: string
): boolean {
  if (hasMinRole(role as any, 'ADMIN')) return true;
  return ownerId === userId;
}

/**
 * GET /api/documents/[id]
 * Returns document details plus its stored chunks (from the vector store).
 */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission('document:read');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  const { id } = await params;

  try {
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        uploader: { select: { id: true, name: true, email: true } },
      },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    // Non-admins may only view their own documents.
    if (!hasMinRole(user.role, 'ADMIN') && doc.uploadedBy !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch chunks for this document from the vector store. We do a filtered
    // search with a neutral query vector just to enumerate stored chunks.
    let chunks: { chunkIndex: number; text: string }[] = [];
    try {
      const hits = await searchVectors(fallbackEmbedding(doc.name), {
        documentId: id,
        limit: 1000,
      });
      chunks = hits
        .map((h) => ({
          chunkIndex: Number(h.payload.chunkIndex ?? 0),
          text: String(h.payload.originalText ?? ''),
        }))
        .sort((a, b) => a.chunkIndex - b.chunkIndex);
    } catch (e) {
      console.error('Chunk fetch error:', e);
    }

    return NextResponse.json({
      document: doc,
      chunks,
      vectorBackend: await getVectorStoreBackend(),
    });
  } catch (error: any) {
    console.error('Get document error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id]
 * Removes the document row, its embeddings, and the stored file.
 * Owners can delete their own; ADMIN+ can delete any.
 */
export async function DELETE(req: Request, { params }: Params) {
  const guard = await requirePermission('document:delete');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  const { id } = await params;

  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (!canManage(user.role, doc.uploadedBy, user.id)) {
      return NextResponse.json(
        { error: 'Forbidden — you can only delete your own documents' },
        { status: 403 }
      );
    }

    // Remove embeddings, file, then DB row.
    await deleteVectorsByDocument(id).catch((e) =>
      console.error('Vector delete error:', e)
    );
    await deleteFile(doc.filePath);
    await prisma.document.delete({ where: { id } });

    await recordAudit({
      userId: user.id,
      action: 'document.delete',
      entity: 'Document',
      entityId: id,
      changes: { name: doc.name },
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[id]
 * Reprocess the document (re-extract, re-embed, re-store). Requires update
 * permission and ownership (or ADMIN+).
 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission('document:update');
  if (!guard.authorized) return guard.response;
  const { user } = guard;
  const { id } = await params;

  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (!canManage(user.role, doc.uploadedBy, user.id)) {
      return NextResponse.json(
        { error: 'Forbidden — you can only reprocess your own documents' },
        { status: 403 }
      );
    }

    const result = await processDocumentPipeline(id);

    await recordAudit({
      userId: user.id,
      action: 'document.reprocess',
      entity: 'Document',
      entityId: id,
      changes: { success: result.success },
      request: req,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Reprocessing failed', result },
        { status: 422 }
      );
    }
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Reprocess document error:', error);
    return NextResponse.json(
      { error: 'Failed to reprocess document' },
      { status: 500 }
    );
  }
}
