// =============================================================================
// Provider factory — construct providers, list available ones, and run
// generation with automatic fallback across providers.
// =============================================================================

import { type AIProvider, type GenerateParams, type GenerateResult, type ProviderName } from './base';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { ClaudeProvider } from './claude';

export const PROVIDER_NAMES: ProviderName[] = ['openai', 'gemini', 'claude'];

export function isProviderName(name: string): name is ProviderName {
  return (PROVIDER_NAMES as string[]).includes(name);
}

/**
 * Construct a provider by name. Optionally pass an explicit API key
 * (e.g. a DB-stored override); otherwise the provider reads its env var.
 */
export function getProvider(name: string, apiKey?: string): AIProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'claude':
      return new ClaudeProvider(apiKey);
    default:
      throw new Error(`Unknown AI provider: ${name}`);
  }
}

/** All providers (constructed from env keys). */
export function getAllProviders(): AIProvider[] {
  return PROVIDER_NAMES.map((n) => getProvider(n));
}

/** Providers that are usable right now (env-key based). */
export function getAvailableProviders(): AIProvider[] {
  return getAllProviders().filter((p) => p.isAvailable());
}

export type ProviderResolver = (name: string) => Promise<AIProvider> | AIProvider;

export interface FallbackResult extends GenerateResult {
  /** Provider names attempted, in order, before success. */
  attemptedProviders: string[];
}

/**
 * Generate content, trying the primary provider first and falling back to the
 * provided list on failure. `resolve` lets callers inject DB-aware providers
 * (key overrides, enabled flags); it defaults to env-based construction.
 *
 * Throws only when every provider in the chain fails.
 */
export async function generateWithFallback(
  params: GenerateParams,
  primary: string,
  fallbacks: string[] = [],
  resolve: ProviderResolver = getProvider,
): Promise<FallbackResult> {
  const order = [primary, ...fallbacks].filter((n, i, arr) => n && arr.indexOf(n) === i);
  const attempted: string[] = [];
  const errors: string[] = [];

  for (const name of order) {
    let provider: AIProvider;
    try {
      provider = await resolve(name);
    } catch {
      continue; // unknown provider name
    }
    if (!provider.isAvailable()) continue;

    attempted.push(name);
    try {
      const result = await provider.generate(params);
      return { ...result, attemptedProviders: attempted };
    } catch (err: any) {
      errors.push(`${name}: ${err?.message ?? 'failed'}`);
      // try next provider
    }
  }

  // Last resort: OpenAI always has a deterministic mock fallback.
  if (!attempted.includes('openai')) {
    attempted.push('openai');
    const result = await new OpenAIProvider().generate(params);
    return { ...result, attemptedProviders: attempted };
  }

  const e = new Error(
    `All providers failed${errors.length ? `: ${errors.join('; ')}` : ''}`,
  ) as Error & { status?: number };
  e.status = 502;
  throw e;
}
