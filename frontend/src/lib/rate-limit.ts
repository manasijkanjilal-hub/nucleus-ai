// =============================================================================
// Nucleus AI — In-Memory Rate Limiter
// =============================================================================
// A lightweight, dependency-free sliding-window rate limiter suitable for
// single-instance deployments and the Next.js Node runtime.
//
// For multi-instance / serverless deployments, swap the in-memory store for a
// shared backend (e.g. Upstash Redis) by reimplementing `hit()`.
// =============================================================================

interface Bucket {
  /** Timestamps (ms) of requests within the current window. */
  hits: number[];
}

const store = new Map<string, Bucket>();

// Periodically prune empty buckets to avoid unbounded memory growth.
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 min

function maybeSweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of store.entries()) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  /** Whether the request is allowed (under the limit). */
  success: boolean;
  /** Configured maximum requests per window. */
  limit: number;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Unix ms timestamp when the window resets (oldest hit + windowMs). */
  reset: number;
  /** Seconds the client should wait before retrying (only when blocked). */
  retryAfter: number;
}

export interface RateLimitOptions {
  /** Unique identifier (e.g. `login:1.2.3.4`). */
  key: string;
  /** Max requests allowed within the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

/**
 * Record a hit for `key` and report whether it is within the limit.
 * Uses a sliding window: only hits within the last `windowMs` count.
 */
export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  maybeSweep(now, windowMs);

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    store.set(key, bucket);
  }

  // Drop timestamps outside the window.
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  const used = bucket.hits.length;
  const oldest = bucket.hits[0] ?? now;
  const reset = oldest + windowMs;

  if (used >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset,
      retryAfter: Math.max(1, Math.ceil((reset - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - (used + 1)),
    reset,
    retryAfter: 0,
  };
}

/**
 * Extract the best-effort client IP from a request's headers.
 * Falls back to a constant so the limiter still works behind misconfigured
 * proxies (all anonymous traffic shares a bucket — fail safe, not fail open).
 */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return (
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    h.get('x-vercel-forwarded-for') ||
    'unknown'
  );
}

/** Standard 429 headers for a blocked response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
    'Retry-After': String(result.retryAfter),
  };
}

// -----------------------------------------------------------------------------
// Preset policies (per the security spec)
// -----------------------------------------------------------------------------
export const RATE_LIMITS = {
  /** Login / signup: 5 requests per minute. */
  AUTH: { limit: 5, windowMs: 60 * 1000 },
  /** Password reset: 3 requests per hour. */
  PASSWORD_RESET: { limit: 3, windowMs: 60 * 60 * 1000 },
} as const;

/**
 * Convenience helper for API route handlers (Node runtime).
 * Returns a `RateLimitResult`; the caller decides how to respond.
 *
 *   const rl = enforceRateLimit(req, 'signup', RATE_LIMITS.AUTH);
 *   if (!rl.success) return tooManyRequests(rl);
 */
export function enforceRateLimit(
  req: Request,
  scope: string,
  policy: { limit: number; windowMs: number }
): RateLimitResult {
  const ip = getClientIp(req);
  return rateLimit({ key: `${scope}:${ip}`, ...policy });
}
