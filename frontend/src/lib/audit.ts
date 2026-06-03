// =============================================================================
// Nucleus AI — Audit Logging Helper
// =============================================================================
// Records security-relevant actions to the AuditLog table. Failures are
// swallowed (best-effort) so logging never breaks the primary request flow.
// =============================================================================

import { prisma } from '@/lib/prisma';

export interface AuditEntry {
  userId?: string | null;
  action: string; // e.g. 'brand.create', 'user.delete'
  entity: string; // e.g. 'BrandProfile', 'User'
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  request?: Request;
}

/** Extract client IP + user agent from a Request (best effort). */
function extractClientInfo(request?: Request): { ipAddress?: string; userAgent?: string } {
  if (!request) return {};
  const headers = request.headers;
  const ipAddress =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined;
  const userAgent = headers.get('user-agent') || undefined;
  return { ipAddress, userAgent };
}

/**
 * Write an audit log entry. Best-effort: never throws.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const { ipAddress, userAgent } = extractClientInfo(entry.request);
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        changes: (entry.changes ?? undefined) as any,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error('[audit] Failed to record audit entry:', err);
  }
}
