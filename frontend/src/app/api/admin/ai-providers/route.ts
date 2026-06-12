// =============================================================================
// /api/admin/ai-providers — manage AI provider settings (admin only)
// -----------------------------------------------------------------------------
//   GET  → list every provider with status (configured / enabled / default),
//          models + pricing, and usage stats (generations + cost) per provider.
//   POST → upsert a provider's settings: { provider, apiKey?, enabled?, isDefault? }.
//          API keys are write-only — never returned by GET.
//   Access: ADMIN and above (admin:access permission).
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import { firstZodError } from '@/lib/validations/auth';
import { getProviderConfigs } from '@/lib/ai-providers/provider-config';
import { isProviderName } from '@/lib/ai-providers/factory';

// ----------------------------------------------------------------------------
// GET — list providers + status + usage stats
// ----------------------------------------------------------------------------
export async function GET() {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;

  try {
    const configs = await getProviderConfigs();

    // Usage stats per provider (platform-wide). Only successful generations are
    // persisted, so success rate is reported as 100%.
    const stats = await prisma.aIGeneration.groupBy({
      by: ['provider'],
      _count: { _all: true },
      _sum: { tokensUsed: true, cost: true },
    });
    const statsByProvider = new Map(
      stats.map((s) => [
        s.provider,
        {
          generations: s._count._all,
          tokensUsed: s._sum.tokensUsed ?? 0,
          cost: Number(s._sum.cost ?? 0),
        },
      ]),
    );

    const providers = configs.map((c) => {
      const usage = statsByProvider.get(c.name) ?? {
        generations: 0,
        tokensUsed: 0,
        cost: 0,
      };
      return {
        name: c.name,
        label: c.label,
        models: c.models,
        defaultModel: c.defaultModel,
        configured: c.configured, // boolean only — never expose the key
        keySource: c.keySource,
        enabled: c.enabled,
        isDefault: c.isDefault,
        stats: {
          generations: usage.generations,
          tokensUsed: usage.tokensUsed,
          cost: usage.cost,
          // No per-generation status/latency is tracked; only successful
          // generations are stored, so success rate is effectively 100%.
          successRate: usage.generations > 0 ? 100 : null,
        },
      };
    });

    return NextResponse.json({ providers });
  } catch (error: any) {
    console.error('AI providers list error:', error);
    return NextResponse.json(
      { error: 'Failed to load AI providers' },
      { status: 500 },
    );
  }
}

// ----------------------------------------------------------------------------
// POST — upsert provider settings
// ----------------------------------------------------------------------------
const updateSchema = z.object({
  provider: z.string().trim().min(1),
  // Empty string clears the stored key (revert to env). Omit to leave unchanged.
  apiKey: z.string().trim().optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(request: Request) {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { provider, apiKey, enabled, isDefault } = parsed.data;
  if (!isProviderName(provider)) {
    return NextResponse.json({ error: 'Unknown AI provider' }, { status: 400 });
  }

  try {
    // Build the patch. apiKey: undefined → leave; '' → clear; value → set.
    const data: {
      apiKey?: string | null;
      enabled?: boolean;
      isDefault?: boolean;
    } = {};
    if (apiKey !== undefined) data.apiKey = apiKey === '' ? null : apiKey;
    if (enabled !== undefined) data.enabled = enabled;
    if (isDefault !== undefined) data.isDefault = isDefault;

    const result = await prisma.$transaction(async (tx) => {
      // If marking this provider default, unset any existing default first.
      if (isDefault === true) {
        await tx.providerSetting.updateMany({
          where: { isDefault: true, provider: { not: provider } },
          data: { isDefault: false },
        });
      }
      return tx.providerSetting.upsert({
        where: { provider },
        create: {
          provider,
          apiKey: data.apiKey ?? null,
          enabled: data.enabled ?? true,
          isDefault: data.isDefault ?? false,
        },
        update: data,
      });
    });

    await recordAudit({
      userId: user.id,
      action: 'admin.ai_provider.update',
      entity: 'ProviderSetting',
      entityId: result.id,
      // Never log the raw key — only whether one was set/cleared.
      changes: {
        provider,
        ...(apiKey !== undefined ? { apiKeyChanged: apiKey !== '' ? 'set' : 'cleared' } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
      },
      request,
    });

    return NextResponse.json({
      ok: true,
      provider: {
        name: result.provider,
        enabled: result.enabled,
        isDefault: result.isDefault,
        configured: Boolean(result.apiKey) || undefined, // env may still apply
      },
    });
  } catch (error: any) {
    console.error('AI provider update error:', error);
    return NextResponse.json(
      { error: 'Failed to update AI provider' },
      { status: 500 },
    );
  }
}
