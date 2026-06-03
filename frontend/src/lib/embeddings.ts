/**
 * Embeddings service for the Context Vault.
 *
 * Generates vector embeddings for text chunks using OpenAI's
 * `text-embedding-3-small` model (1536 dimensions). When no OpenAI API key is
 * configured the service degrades gracefully to a deterministic, locally
 * computed pseudo-embedding so the rest of the pipeline (chunking, vector
 * storage, semantic search) remains fully functional in development and CI.
 *
 * Features:
 *   - Batch processing (chunks are embedded in batches to respect API limits)
 *   - Retry with exponential backoff on transient failures
 *   - Token usage + cost tracking
 */

import OpenAI from 'openai';

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
export const VECTOR_DIMENSION = Number(process.env.VECTOR_DIMENSION || 1536);

/** Max inputs per OpenAI embeddings request. */
const BATCH_SIZE = 96;

/** USD price per 1K tokens for text-embedding-3-small. */
const PRICE_PER_1K_TOKENS = 0.00002;

export interface EmbeddingUsage {
  /** Total tokens billed by the embedding provider. */
  totalTokens: number;
  /** Estimated cost in USD. */
  estimatedCostUsd: number;
  /** Number of input texts embedded. */
  inputCount: number;
  /** Whether the deterministic local fallback was used. */
  usedFallback: boolean;
  /** Model identifier used. */
  model: string;
}

export interface EmbedResult {
  embeddings: number[][];
  usage: EmbeddingUsage;
}

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!_client) {
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export function isEmbeddingProviderConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Deterministic fallback embedding. Produces a normalized 1536-dim vector
 * derived from a simple hashed bag-of-tokens. Not semantically meaningful at
 * the level of a real model, but stable for the same input — which keeps the
 * vector store and search code paths testable without an API key.
 */
export function fallbackEmbedding(text: string): number[] {
  const vec = new Array<number>(VECTOR_DIMENSION).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    // FNV-1a style hash for stable bucketing.
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % VECTOR_DIMENSION;
    // Secondary hash for a small signed weight.
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign * (1 + (Math.abs(h >> 8) % 5) / 5);
  }

  // L2 normalize so cosine similarity behaves well.
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

function estimateTokens(text: string): number {
  // Rough heuristic: ~4 chars per token.
  return Math.max(1, Math.ceil(text.length / 4));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Embed a batch of texts with retry/backoff. Throws on persistent failure so
 * the caller can mark the document as FAILED.
 */
async function embedBatchWithOpenAI(
  client: OpenAI,
  inputs: string[],
  maxRetries = 3
): Promise<{ vectors: number[][]; tokens: number }> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= maxRetries) {
    try {
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
      });
      const vectors = res.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding as number[]);
      const tokens = res.usage?.total_tokens ?? 0;
      return { vectors, tokens };
    } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? err?.response?.status;
      // Retry only on rate-limit / transient server errors.
      const retriable = status === 429 || (status >= 500 && status < 600);
      if (!retriable || attempt === maxRetries) break;
      const backoff = Math.min(8000, 500 * 2 ** attempt);
      await sleep(backoff);
      attempt++;
    }
  }
  throw new Error(
    `OpenAI embedding request failed: ${
      (lastErr as any)?.message ?? String(lastErr)
    }`
  );
}

/**
 * Generate embeddings for an array of texts.
 *
 * @param texts  Input strings (e.g. document chunks).
 * @returns      Embeddings (in the same order) plus usage/cost metadata.
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbedResult> {
  const cleaned = texts.map((t) => (t ?? '').toString());
  if (cleaned.length === 0) {
    return {
      embeddings: [],
      usage: {
        totalTokens: 0,
        estimatedCostUsd: 0,
        inputCount: 0,
        usedFallback: !isEmbeddingProviderConfigured(),
        model: EMBEDDING_MODEL,
      },
    };
  }

  const client = getClient();

  // --- Fallback path (no API key): deterministic local embeddings ----------
  if (!client) {
    const embeddings = cleaned.map((t) => fallbackEmbedding(t));
    const totalTokens = cleaned.reduce((s, t) => s + estimateTokens(t), 0);
    return {
      embeddings,
      usage: {
        totalTokens,
        estimatedCostUsd: 0,
        inputCount: cleaned.length,
        usedFallback: true,
        model: `${EMBEDDING_MODEL} (local-fallback)`,
      },
    };
  }

  // --- Real provider path: batch the requests ------------------------------
  const embeddings: number[][] = [];
  let totalTokens = 0;
  for (let i = 0; i < cleaned.length; i += BATCH_SIZE) {
    const batch = cleaned.slice(i, i + BATCH_SIZE);
    const { vectors, tokens } = await embedBatchWithOpenAI(client, batch);
    embeddings.push(...vectors);
    totalTokens += tokens;
  }

  return {
    embeddings,
    usage: {
      totalTokens,
      estimatedCostUsd: (totalTokens / 1000) * PRICE_PER_1K_TOKENS,
      inputCount: cleaned.length,
      usedFallback: false,
      model: EMBEDDING_MODEL,
    },
  };
}

/** Embed a single query string. */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embeddings } = await generateEmbeddings([text]);
  return embeddings[0] ?? fallbackEmbedding(text);
}
