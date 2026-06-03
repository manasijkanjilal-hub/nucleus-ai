// =============================================================================
// Nucleus AI — Secure Token Helpers
// =============================================================================
// Cryptographically-secure random tokens for email verification, password
// reset, and invitations. Tokens are URL-safe hex strings.
// =============================================================================

import { randomBytes } from 'crypto';

/** Generate a URL-safe random token (default 32 bytes → 64 hex chars). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Expiry timestamp `hours` from now (default 1 hour). */
export function expiryFromNow(hours = 1): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
