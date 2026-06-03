export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { sanitizeText } from '@/lib/sanitize';
import { generateEmbedding } from '@/lib/embeddings';
import { searchVectors } from '@/lib/vector-store';

const SearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000),
  brandId: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(50).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
});

/**
 * POST /api/documents/search
 * Semantic search across embedded document chunks.
 * Body: { query, brandId?, limit?, scoreThreshold? }
 *
 * Results are scoped to documents the user is allowed to see (non-admins only
 * see hits from their own documents).
 */
export async function POST(req: Request) {
  const guard = await requirePermission('document:read');
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = SearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const query = sanitizeText(parsed.data.query);
  const { brandId, limit = 10, scoreThreshold } = parsed.data;

  try {
    // Embed the query.
    const queryVector = await generateEmbedding(query);

    // Over-fetch so we can post-filter by ownership without losing results.
    const rawHits = await searchVectors(queryVector, {
      limit: hasMinRole(user.role, 'ADMIN') ? limit : limit * 4,
      brandId: brandId ?? undefined,
      scoreThreshold,
    });

    // Resolve which documents the user may see.
    const docIds = Array.from(
      new Set(rawHits.map((h) => String(h.payload.documentId)))
    );
    const docs = await prisma.document.findMany({
      where: { id: { in: docIds } },
      select: {
        id: true,
        name: true,
        type: true,
        uploadedBy: true,
        brandId: true,
        brand: { select: { id: true, name: true } },
      },
    });
    const docMap = new Map(docs.map((d) => [d.id, d]));

    const visible = rawHits.filter((h) => {
      const d = docMap.get(String(h.payload.documentId));
      if (!d) return false;
      if (hasMinRole(user.role, 'ADMIN')) return true;
      return d.uploadedBy === user.id;
    });

    const results = visible.slice(0, limit).map((h) => {
      const d = docMap.get(String(h.payload.documentId));
      return {
        documentId: String(h.payload.documentId),
        documentName: d?.name ?? h.payload.documentName ?? 'Unknown',
        documentType: d?.type ?? null,
        brand: d?.brand ?? null,
        chunkIndex: Number(h.payload.chunkIndex ?? 0),
        text: String(h.payload.originalText ?? ''),
        score: h.score,
      };
    });

    return NextResponse.json({ query, count: results.length, results });
  } catch (error: any) {
    console.error('Semantic search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
