// =============================================================================
// Nucleus AI — Admin Audit Logs API
// =============================================================================
// GET /api/admin/audit-logs
// Returns paginated audit log entries with search + date-range filtering.
// Query params:
//   search  — matches user email OR action OR entity (case-insensitive)
//   from    — ISO date (inclusive lower bound on createdAt)
//   to      — ISO date (inclusive upper bound on createdAt)
//   page    — 1-based page number (default 1)
//   limit   — rows per page (default 50, max 200)
// =============================================================================

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() ?? '';
    const fromRaw = url.searchParams.get('from')?.trim() ?? '';
    const toRaw = url.searchParams.get('to')?.trim() ?? '';

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50)
    );

    const where: Prisma.AuditLogWhereInput = {};

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Date range on createdAt
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromRaw) {
      const d = new Date(fromRaw);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (toRaw) {
      const d = new Date(toRaw);
      if (!Number.isNaN(d.getTime())) {
        // Make the upper bound inclusive of the whole day.
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }
    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        userName: l.user?.name ?? null,
        userEmail: l.user?.email ?? null,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        changes: l.changes,
        createdAt: l.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('[admin/audit-logs] error', err);
    return NextResponse.json(
      { error: 'Failed to load audit logs' },
      { status: 500 }
    );
  }
}
