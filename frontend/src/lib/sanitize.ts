// =============================================================================
// Nucleus AI — Input Sanitization Helpers
// =============================================================================
// Lightweight, dependency-free sanitizers to defend against stored/reflected
// XSS. These strip or neutralize HTML in user-supplied text fields before the
// data is persisted or echoed back.
//
// Note: React escapes content by default on render, so these are a
// defense-in-depth layer (especially for values rendered in non-React
// contexts, emails, or returned in API JSON consumed elsewhere).
// =============================================================================

/**
 * Strip all HTML tags and dangerous protocol handlers from a string, then
 * trim whitespace. Returns an empty string for non-string input.
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    // Remove <script>...</script> blocks entirely (including content).
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove any remaining HTML tags.
    .replace(/<\/?[^>]+(>|$)/g, '')
    // Neutralize javascript:/data: URIs.
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    // Strip inline event handlers like onclick=
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/** Sanitize and lowercase an email address. */
export function sanitizeEmail(input: unknown): string {
  return sanitizeText(input).toLowerCase();
}

/**
 * Recursively sanitize all string values in a plain object (one level of
 * arrays/objects). Useful for free-form payloads like brand profiles.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      out[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => (typeof v === 'string' ? sanitizeText(v) : v));
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}
