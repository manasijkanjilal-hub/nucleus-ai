// =============================================================================
// /api/admin/ai-providers/test — test a provider connection (admin only)
// -----------------------------------------------------------------------------
//   POST { provider, apiKey? } → runs a tiny generation to verify connectivity.
//   If apiKey is provided it is tested directly (not persisted); otherwise the
//   effective key (DB override → env) is used. Returns latency + a sample.
//   Access: ADMIN and above (admin:access permission).
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/middleware/rbac';
import { firstZodError } from '@/lib/validations/auth';
import { getProvider, isProviderName } from '@/lib/ai-providers/factory';
import { resolveProvider } from '@/lib/ai-providers/provider-config';

const testSchema = z.object({
  provider: z.string().trim().min(1),
  apiKey: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { provider, apiKey } = parsed.data;
  if (!isProviderName(provider)) {
    return NextResponse.json({ error: 'Unknown AI provider' }, { status: 400 });
  }

  // Use the supplied key (transient test) or the effective DB/env key.
  const instance = apiKey
    ? getProvider(provider, apiKey)
    : await resolveProvider(provider);

  const started = Date.now();
  try {
    const result = await instance.generate({
      prompt: 'Say hello in exactly five words.',
      maxTokens: 50,
      temperature: 0,
    });
    const latencyMs = Date.now() - started;

    return NextResponse.json({
      success: true,
      mocked: result.mocked,
      model: result.model,
      latencyMs,
      sample: result.content.slice(0, 200),
      // When mocked, no real key was reachable.
      message: result.mocked
        ? 'No API key configured — provider runs in mock mode.'
        : 'Connection successful.',
    });
  } catch (error: any) {
    const latencyMs = Date.now() - started;
    return NextResponse.json(
      {
        success: false,
        latencyMs,
        error: error?.message || 'Connection test failed',
      },
      { status: 200 }, // 200 so the UI can show the failure detail gracefully
    );
  }
}
