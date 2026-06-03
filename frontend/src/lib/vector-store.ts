/**
 * Vector store abstraction for the Context Vault.
 *
 * Primary backend is Qdrant (via @qdrant/js-client-rest). When Qdrant is not
 * reachable the store transparently falls back to an in-memory index that is
 * persisted to a local JSON file, so the full upsert / search / delete flow
 * keeps working in development and CI without external services.
 *
 * Each point stored carries a rich payload so search results can be rendered
 * and filtered without a second DB round-trip:
 *   { documentId, brandId, chunkIndex, originalText, ...metadata }
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { promises as fs } from 'fs';
import path from 'path';
import { VECTOR_DIMENSION } from './embeddings';

export interface ChunkPayload {
  documentId: string;
  brandId: string | null;
  chunkIndex: number;
  originalText: string;
  documentName?: string;
  [key: string]: unknown;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: ChunkPayload;
}

export interface SearchHit {
  id: string;
  score: number;
  payload: ChunkPayload;
}

const COLLECTION = process.env.QDRANT_COLLECTION || 'nucleus_context';
const QDRANT_URL = process.env.QDRANT_URL || '';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || undefined;
const FALLBACK_FILE = path.join(
  process.env.DOCUMENT_STORAGE_DIR || path.join(process.cwd(), '.uploads'),
  'vector-store.json'
);

// ---------------------------------------------------------------------------
// Qdrant client (lazy, with health detection)
// ---------------------------------------------------------------------------
let _client: QdrantClient | null = null;
let _qdrantHealthy: boolean | null = null;
let _collectionReady = false;

function getQdrant(): QdrantClient | null {
  if (!QDRANT_URL) return null;
  if (!_client) {
    _client = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });
  }
  return _client;
}

/** Probe Qdrant once and cache the result for the lifetime of the process. */
async function qdrantAvailable(): Promise<boolean> {
  if (_qdrantHealthy !== null) return _qdrantHealthy;
  const client = getQdrant();
  if (!client) {
    _qdrantHealthy = false;
    return false;
  }
  try {
    await client.getCollections();
    _qdrantHealthy = true;
  } catch {
    _qdrantHealthy = false;
  }
  return _qdrantHealthy;
}

async function ensureCollection(client: QdrantClient): Promise<void> {
  if (_collectionReady) return;
  try {
    const existing = await client.getCollections();
    const found = existing.collections?.some((c) => c.name === COLLECTION);
    if (!found) {
      await client.createCollection(COLLECTION, {
        vectors: { size: VECTOR_DIMENSION, distance: 'Cosine' },
      });
    }
    // Indexes that let us filter efficiently.
    for (const field of ['documentId', 'brandId']) {
      try {
        await client.createPayloadIndex(COLLECTION, {
          field_name: field,
          field_schema: 'keyword',
        });
      } catch {
        /* index may already exist */
      }
    }
    _collectionReady = true;
  } catch (err) {
    throw new Error(`Failed to ensure Qdrant collection: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// In-memory / file fallback
// ---------------------------------------------------------------------------
type FallbackStore = Record<string, VectorPoint>;
let _fallbackCache: FallbackStore | null = null;

async function loadFallback(): Promise<FallbackStore> {
  if (_fallbackCache) return _fallbackCache;
  try {
    const raw = await fs.readFile(FALLBACK_FILE, 'utf8');
    _fallbackCache = JSON.parse(raw) as FallbackStore;
  } catch {
    _fallbackCache = {};
  }
  return _fallbackCache;
}

async function saveFallback(store: FallbackStore): Promise<void> {
  _fallbackCache = store;
  await fs.mkdir(path.dirname(FALLBACK_FILE), { recursive: true });
  await fs.writeFile(FALLBACK_FILE, JSON.stringify(store), 'utf8');
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Where is data currently being stored? Useful for diagnostics/tests. */
export async function getVectorStoreBackend(): Promise<'qdrant' | 'memory'> {
  return (await qdrantAvailable()) ? 'qdrant' : 'memory';
}

/** Upsert a batch of points for a document. */
export async function upsertVectors(points: VectorPoint[]): Promise<void> {
  if (points.length === 0) return;

  if (await qdrantAvailable()) {
    const client = getQdrant()!;
    await ensureCollection(client);
    await client.upsert(COLLECTION, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload as Record<string, unknown>,
      })),
    });
    return;
  }

  // Fallback
  const store = await loadFallback();
  for (const p of points) store[p.id] = p;
  await saveFallback(store);
}

/** Delete all points belonging to a document. */
export async function deleteVectorsByDocument(
  documentId: string
): Promise<void> {
  if (await qdrantAvailable()) {
    const client = getQdrant()!;
    await ensureCollection(client);
    await client.delete(COLLECTION, {
      wait: true,
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
    });
    return;
  }

  const store = await loadFallback();
  for (const id of Object.keys(store)) {
    if (store[id].payload.documentId === documentId) delete store[id];
  }
  await saveFallback(store);
}

/** Delete explicit point ids. */
export async function deleteVectorsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (await qdrantAvailable()) {
    const client = getQdrant()!;
    await ensureCollection(client);
    await client.delete(COLLECTION, { wait: true, points: ids });
    return;
  }
  const store = await loadFallback();
  for (const id of ids) delete store[id];
  await saveFallback(store);
}

export interface SearchOptions {
  limit?: number;
  /** Restrict results to a single brand (or null for unbranded). */
  brandId?: string | null;
  /** Restrict results to a single document. */
  documentId?: string;
  /** Minimum score threshold. */
  scoreThreshold?: number;
}

/** Semantic search across stored chunks. */
export async function searchVectors(
  queryVector: number[],
  options: SearchOptions = {}
): Promise<SearchHit[]> {
  const { limit = 10, brandId, documentId, scoreThreshold } = options;

  if (await qdrantAvailable()) {
    const client = getQdrant()!;
    await ensureCollection(client);
    const must: any[] = [];
    if (brandId !== undefined && brandId !== null) {
      must.push({ key: 'brandId', match: { value: brandId } });
    }
    if (documentId) {
      must.push({ key: 'documentId', match: { value: documentId } });
    }
    const res = await client.search(COLLECTION, {
      vector: queryVector,
      limit,
      with_payload: true,
      score_threshold: scoreThreshold,
      filter: must.length ? { must } : undefined,
    });
    return res.map((r) => ({
      id: String(r.id),
      score: r.score ?? 0,
      payload: (r.payload ?? {}) as unknown as ChunkPayload,
    }));
  }

  // Fallback: brute-force cosine similarity.
  const store = await loadFallback();
  let candidates = Object.values(store);
  if (brandId !== undefined && brandId !== null) {
    candidates = candidates.filter((p) => p.payload.brandId === brandId);
  }
  if (documentId) {
    candidates = candidates.filter((p) => p.payload.documentId === documentId);
  }
  const scored = candidates
    .map((p) => ({
      id: p.id,
      score: cosineSimilarity(queryVector, p.vector),
      payload: p.payload,
    }))
    .filter((h) => (scoreThreshold ? h.score >= scoreThreshold : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}

/** Count of points for a document (diagnostics). */
export async function countVectorsByDocument(
  documentId: string
): Promise<number> {
  if (await qdrantAvailable()) {
    const client = getQdrant()!;
    await ensureCollection(client);
    const res = await client.count(COLLECTION, {
      filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
      exact: true,
    });
    return res.count ?? 0;
  }
  const store = await loadFallback();
  return Object.values(store).filter(
    (p) => p.payload.documentId === documentId
  ).length;
}
