// =============================================================================
// Nucleus AI — Admin Health Dashboard API
// =============================================================================
// GET /api/admin/health
// Lightweight system health snapshot for the admin dashboard:
//   - database connectivity
//   - active user count
//   - recent error count (audit entries with 'error'/'fail' in the action,
//     within the last 24h)
//   - backend API reachability (best-effort, optional)
// ADMIN+ only.
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;

  // --- Database connectivity ------------------------------------------------
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbLatencyMs: number | null = null;
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    console.error('[admin/health] db check failed', err);
    dbStatus = 'error';
  }

  // --- Active users + recent errors ----------------------------------------
  const since = new Date();
  since.setHours(since.getHours() - 24);

  let activeUsers = 0;
  let recentErrors = 0;
  if (dbStatus === 'ok') {
    try {
      [activeUsers, recentErrors] = await Promise.all([
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.auditLog.count({
          where: {
            createdAt: { gte: since },
            OR: [
              { action: { contains: 'error', mode: 'insensitive' } },
              { action: { contains: 'fail', mode: 'insensitive' } },
            ],
          },
        }),
      ]);
    } catch (err) {
      console.error('[admin/health] metric query failed', err);
    }
  }

  // --- Backend API reachability (best-effort) -------------------------------
  let backendStatus: 'ok' | 'error' | 'unknown' = 'unknown';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backendUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${backendUrl.replace(/\/$/, '')}/health`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      backendStatus = res.ok ? 'ok' : 'error';
    } catch {
      backendStatus = 'error';
    }
  }

  const overall =
    dbStatus === 'ok' && backendStatus !== 'error' ? 'healthy' : 'degraded';

  return NextResponse.json({
    overall,
    database: { status: dbStatus, latencyMs: dbLatencyMs },
    backendApi: { status: backendStatus },
    activeUsers,
    recentErrors,
    checkedAt: new Date().toISOString(),
  });
}
