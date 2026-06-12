// =============================================================================
// Provider configuration (DB-aware) — merges admin-managed ProviderSetting
// rows with environment variables. Resolves providers with the correct API key
// (DB override → env), and exposes config/status for the admin UI + selector.
// =============================================================================

import { prisma } from '@/lib/prisma';
import { type AIProvider, type ModelInfo, type ProviderName } from './base';
import { PROVIDER_NAMES, getProvider } from './factory';

export interface ProviderConfig {
  name: ProviderName;
  label: string;
  models: ModelInfo[];
  defaultModel: string;
  /** A usable API key exists (DB override or env var). */
  configured: boolean;
  /** Where the key comes from. */
  keySource: 'db' | 'env' | 'none';
  /** Admin enable/disable flag. */
  enabled: boolean;
  /** Whether this is the platform default provider. */
  isDefault: boolean;
}

interface SettingRow {
  apiKey: string | null;
  enabled: boolean;
  isDefault: boolean;
}

/** Load all ProviderSetting rows as a map (best-effort — empty on error). */
async function loadSettings(): Promise<Map<string, SettingRow>> {
  try {
    const rows = await prisma.providerSetting.findMany();
    return new Map(
      rows.map((r) => [r.provider, { apiKey: r.apiKey, enabled: r.enabled, isDefault: r.isDefault }]),
    );
  } catch {
    return new Map();
  }
}

/** Resolve the effective API key for a provider (DB override → env). */
function envKeyFor(name: ProviderName): string | undefined {
  switch (name) {
    case 'openai':
      return process.env.OPENAI_API_KEY?.trim() || undefined;
    case 'gemini':
      return (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY)?.trim() || undefined;
    case 'claude':
      return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
    default:
      return undefined;
  }
}

/**
 * Construct a provider with its effective key (DB override beats env).
 * Used by the generation route so admin-saved keys take effect.
 */
export async function resolveProvider(name: string): Promise<AIProvider> {
  const settings = await loadSettings();
  const row = settings.get(name);
  const dbKey = row?.apiKey?.trim() || undefined;
  return getProvider(name, dbKey); // provider falls back to env when undefined
}

/** Full config + status for every provider (for admin UI & selector). */
export async function getProviderConfigs(): Promise<ProviderConfig[]> {
  const settings = await loadSettings();

  return PROVIDER_NAMES.map((name) => {
    const row = settings.get(name);
    const dbKey = row?.apiKey?.trim() || undefined;
    const envKey = envKeyFor(name);
    const keySource: ProviderConfig['keySource'] = dbKey ? 'db' : envKey ? 'env' : 'none';
    const base = getProvider(name); // for metadata only

    return {
      name,
      label: base.label,
      models: base.models,
      defaultModel: base.defaultModel,
      configured: keySource !== 'none',
      keySource,
      enabled: row?.enabled ?? true,
      isDefault: row?.isDefault ?? false,
    };
  });
}

/**
 * Determine the generation order for a requested provider.
 * - explicit provider → [provider, ...other available]
 * - 'auto' / undefined → [default, ...other available]
 * Only enabled + configured providers are included (OpenAI is always last-
 * resort capable via its mock, handled in generateWithFallback).
 */
export async function getGenerationOrder(requested?: string): Promise<{
  primary: string;
  fallbacks: string[];
}> {
  const configs = await getProviderConfigs();
  const usable = configs.filter((c) => c.enabled && c.configured).map((c) => c.name);

  // Default provider: explicit isDefault, else first usable, else 'openai'.
  const defaultName =
    configs.find((c) => c.isDefault && c.enabled && c.configured)?.name ??
    usable[0] ??
    'openai';

  let primary: string;
  if (requested && requested !== 'auto') {
    primary = requested;
  } else {
    primary = defaultName;
  }

  // Fallbacks: all other usable providers, default first.
  const fallbacks = [defaultName, ...usable].filter(
    (n, i, arr) => n !== primary && arr.indexOf(n) === i,
  );

  return { primary, fallbacks };
}

/** The platform default provider name (best-effort). */
export async function getDefaultProviderName(): Promise<string> {
  const { primary } = await getGenerationOrder('auto');
  return primary;
}
