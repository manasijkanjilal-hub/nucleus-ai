// =============================================================================
// /api/providers — list selectable AI providers for the generation UI
// -----------------------------------------------------------------------------
//   GET → enabled + configured providers (name, label, models, pricing) plus
//         the platform default. Used by the campaign generator's provider
//         dropdown. Any authenticated user; no secrets are exposed.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/rbac';
import { getProviderConfigs, getDefaultProviderName } from '@/lib/ai-providers/provider-config';

export async function GET() {
  const guard = await requireAuth();
  if (!guard.authorized) return guard.response;

  try {
    const configs = await getProviderConfigs();
    const [defaultName] = [await getDefaultProviderName()];

    // Only providers that are enabled and usable (have a key) appear in the UI.
    const providers = configs
      .filter((c) => c.enabled && c.configured)
      .map((c) => ({
        name: c.name,
        label: c.label,
        defaultModel: c.defaultModel,
        models: c.models.map((m) => ({
          id: m.id,
          label: m.label,
          inputPer1M: m.inputPer1M,
          outputPer1M: m.outputPer1M,
        })),
        isDefault: c.name === defaultName,
      }));

    return NextResponse.json({ providers, default: defaultName });
  } catch (error: any) {
    console.error('Providers list error:', error);
    return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 });
  }
}
