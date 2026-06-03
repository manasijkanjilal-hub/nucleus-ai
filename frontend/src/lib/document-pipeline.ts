/**
 * End-to-end processing pipeline for a Context Vault document.
 *
 * Given a persisted Document row, this:
 *   1. Reads the stored file.
 *   2. Extracts text and chunks it.
 *   3. Generates embeddings (OpenAI or local fallback).
 *   4. Upserts chunk vectors into the vector store.
 *   5. Updates the Document row with status, counts, vector ids and metadata.
 *
 * Status transitions: PENDING -> PROCESSING -> COMPLETED | FAILED.
 * It is safe to call repeatedly (reprocess): existing vectors for the document
 * are deleted first so there are no duplicates.
 */

import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { readFile } from './document-storage';
import {
  processDocument,
  type SupportedDocType,
} from './document-processor';
import { generateEmbeddings } from './embeddings';
import {
  upsertVectors,
  deleteVectorsByDocument,
  type VectorPoint,
} from './vector-store';

export interface PipelineResult {
  success: boolean;
  documentId: string;
  chunkCount: number;
  wordCount: number;
  pageCount: number | null;
  vectorIds: string[];
  usedFallback: boolean;
  estimatedCostUsd: number;
  error?: string;
}

export async function processDocumentPipeline(
  documentId: string
): Promise<PipelineResult> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    return {
      success: false,
      documentId,
      chunkCount: 0,
      wordCount: 0,
      pageCount: null,
      vectorIds: [],
      usedFallback: false,
      estimatedCostUsd: 0,
      error: 'Document not found',
    };
  }

  // Mark as processing.
  await prisma.document.update({
    where: { id: documentId },
    data: {
      processingStatus: 'PROCESSING',
      embeddingStatus: 'PROCESSING',
      errorMessage: null,
    },
  });

  try {
    if (!doc.filePath) throw new Error('Document has no stored file path');

    const buffer = await readFile(doc.filePath);
    const docType = doc.type as SupportedDocType;

    // 1 + 2: extract & chunk.
    const processed = await processDocument(buffer, docType);
    if (processed.chunks.length === 0) {
      throw new Error('No extractable text found in document');
    }

    // Clear any previous vectors (reprocess-safe).
    await deleteVectorsByDocument(documentId);

    // 3: embed.
    const { embeddings, usage } = await generateEmbeddings(processed.chunks);

    // 4: upsert vectors.
    const points: VectorPoint[] = processed.chunks.map((chunk, i) => ({
      id: randomUUID(),
      vector: embeddings[i],
      payload: {
        documentId: doc.id,
        brandId: doc.brandId ?? null,
        chunkIndex: i,
        originalText: chunk,
        documentName: doc.name,
      },
    }));
    await upsertVectors(points);
    const vectorIds = points.map((p) => p.id);

    // 5: persist results.
    const metadata = {
      pageCount: processed.pageCount,
      wordCount: processed.wordCount,
      chunkCount: processed.chunkCount,
      embeddingModel: usage.model,
      usedFallback: usage.usedFallback,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: usage.estimatedCostUsd,
      processedAt: new Date().toISOString(),
    };

    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'COMPLETED',
        embeddingStatus: 'COMPLETED',
        chunkCount: processed.chunkCount,
        wordCount: processed.wordCount,
        vectorIds: vectorIds as unknown as object,
        errorMessage: null,
        metadata: metadata as unknown as object,
      },
    });

    return {
      success: true,
      documentId,
      chunkCount: processed.chunkCount,
      wordCount: processed.wordCount,
      pageCount: processed.pageCount,
      vectorIds,
      usedFallback: usage.usedFallback,
      estimatedCostUsd: usage.estimatedCostUsd,
    };
  } catch (err: any) {
    const message = err?.message ?? 'Processing failed';
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingStatus: 'FAILED',
        embeddingStatus: 'FAILED',
        errorMessage: String(message).slice(0, 500),
      },
    });
    return {
      success: false,
      documentId,
      chunkCount: 0,
      wordCount: 0,
      pageCount: null,
      vectorIds: [],
      usedFallback: false,
      estimatedCostUsd: 0,
      error: message,
    };
  }
}
