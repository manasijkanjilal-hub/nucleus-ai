export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import {
  validateFile,
  safeDisplayName,
  type SupportedDocType,
} from '@/lib/document-processor';
import { saveFile } from '@/lib/document-storage';
import { processDocumentPipeline } from '@/lib/document-pipeline';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/documents
 * List Context Vault documents with optional filters.
 * Query params: brandId, status (processingStatus), type, q (name search).
 * VIEWER/EDITOR see their own; ADMIN+ see all.
 */
export async function GET(req: Request) {
  const guard = await requirePermission('document:read');
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const q = searchParams.get('q');

    const where: Prisma.DocumentWhereInput = {};
    if (!hasMinRole(user.role, 'ADMIN')) {
      where.uploadedBy = user.id;
    }
    if (brandId) where.brandId = brandId;
    if (status) where.processingStatus = status as any;
    if (type) where.type = type as any;
    if (q) where.name = { contains: q, mode: 'insensitive' };

    const docs = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        brand: { select: { id: true, name: true } },
        uploader: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ documents: docs });
  } catch (error: any) {
    console.error('List documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents
 * Multipart upload of one or more files. Each file is validated, stored, a
 * Document row is created, and processing runs synchronously (MVP). Status
 * fields let the client poll for progress on larger deployments.
 *
 * Rate limited to 10 uploads/hour/user.
 */
export async function POST(req: Request) {
  const guard = await requirePermission('document:create');
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  // Rate limit: 10 uploads per hour per user.
  const rl = rateLimit({
    key: `document-upload:${user.id}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Upload rate limit exceeded. Try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    // formData() also throws when the request body exceeds platform limits.
    return NextResponse.json(
      {
        error:
          'Could not read upload. Ensure it is multipart/form-data and each file is within the 10MB limit.',
      },
      { status: 400 }
    );
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  const single = formData.get('file');
  if (files.length === 0 && single instanceof File) files.push(single);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const brandIdRaw = formData.get('brandId');
  const brandId =
    typeof brandIdRaw === 'string' && brandIdRaw.trim() ? brandIdRaw.trim() : null;

  // If a brand is specified, ensure it exists (defensive).
  if (brandId) {
    const brand = await prisma.brandProfile.findUnique({ where: { id: brandId } });
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 400 });
    }
  }

  const results: any[] = [];

  for (const file of files) {
    const displayName = safeDisplayName(file.name || 'untitled');
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const validation = validateFile({
        fileName: file.name || displayName,
        mimeType: file.type || '',
        size: buffer.length,
        buffer,
      });

      if (!validation.valid || !validation.docType) {
        results.push({
          fileName: displayName,
          success: false,
          error: validation.error ?? 'Invalid file',
        });
        continue;
      }

      const docType: SupportedDocType = validation.docType;
      const { storedName, filePath } = await saveFile(buffer, docType);

      const doc = await prisma.document.create({
        data: {
          name: displayName,
          fileName: storedName,
          type: docType,
          filePath,
          fileSize: buffer.length,
          mimeType: file.type || null,
          brandId,
          uploadedBy: user.id,
          processingStatus: 'PENDING',
          embeddingStatus: 'PENDING',
        },
      });

      await recordAudit({
        userId: user.id,
        action: 'document.upload',
        entity: 'Document',
        entityId: doc.id,
        changes: { name: displayName, type: docType, fileSize: buffer.length },
        request: req,
      });

      // Process synchronously (MVP). Failures are captured on the row.
      const pipeline = await processDocumentPipeline(doc.id);

      results.push({
        id: doc.id,
        fileName: displayName,
        success: pipeline.success,
        processingStatus: pipeline.success ? 'COMPLETED' : 'FAILED',
        chunkCount: pipeline.chunkCount,
        wordCount: pipeline.wordCount,
        error: pipeline.error,
      });
    } catch (err: any) {
      console.error('Upload processing error:', err);
      results.push({
        fileName: displayName,
        success: false,
        error: err?.message ?? 'Upload failed',
      });
    }
  }

  const anySuccess = results.some((r) => r.success);
  return NextResponse.json(
    { results },
    { status: anySuccess ? 201 : 400, headers: rateLimitHeaders(rl) }
  );
}
