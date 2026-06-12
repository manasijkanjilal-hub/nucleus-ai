// =============================================================================
// GET /api/billing/usage — current usage vs limits for the signed-in user
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/rbac';
import { getUsageSummary } from '@/lib/usage-limits';

export async function GET() {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const usage = await getUsageSummary(user.id);
    return NextResponse.json(usage);
  } catch (error: any) {
    console.error('Usage summary error:', error);
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
  }
}
