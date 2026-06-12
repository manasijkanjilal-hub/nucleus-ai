// =============================================================================
// AI Provider abstraction — shared interface for OpenAI, Gemini & Claude.
// -----------------------------------------------------------------------------
// Every concrete provider implements `AIProvider`, giving the generation layer
// a single, consistent surface regardless of the underlying vendor SDK.
// =============================================================================

export type ProviderName = 'openai' | 'gemini' | 'claude';

/** Per-model pricing (USD per 1M tokens) + display label. */
export interface ModelInfo {
  id: string;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
}

export interface GenerateParams {
  /** The user prompt / brief. */
  prompt: string;
  /** Optional system instructions (brand voice, guidelines, etc.). */
  systemPrompt?: string;
  /** Override the provider's default model. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  tokensUsed: number; // total
  model: string;
  provider: ProviderName;
  cost: number;
  /** True when produced by a deterministic fallback (no real API key). */
  mocked: boolean;
}

export interface AIProvider {
  /** Stable identifier: 'openai' | 'gemini' | 'claude'. */
  name: ProviderName;
  /** Human-friendly label for UI. */
  label: string;
  /** Supported models (first = default). */
  models: ModelInfo[];
  /** Default model id. */
  defaultModel: string;

  /** Generate content. Throws on hard failure (used by fallback logic). */
  generate(params: GenerateParams): Promise<GenerateResult>;
  /** Rough USD cost estimate for a total token count (blended rate). */
  estimateCost(tokens: number): number;
  /** Whether this provider is usable for a generation right now. */
  isAvailable(): boolean;
  /** Whether a real API key is configured (vs. mock/unconfigured). */
  isConfigured(): boolean;
}

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

/** Rough token estimate (~4 chars/token). Used for mocks & fallbacks. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Compute USD cost from token counts and a model's pricing. */
export function computeCost(
  pricing: { inputPer1M: number; outputPer1M: number },
  promptTokens: number,
  completionTokens: number,
): number {
  const cost =
    (promptTokens / 1_000_000) * pricing.inputPer1M +
    (completionTokens / 1_000_000) * pricing.outputPer1M;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Find a model's pricing within a provider's model list (falls back to first). */
export function pricingForModel(models: ModelInfo[], modelId: string): ModelInfo {
  return models.find((m) => m.id === modelId) ?? models[0];
}

/** Deterministic mock content so the app stays functional without API keys. */
export function buildMockContent(prompt: string, providerLabel: string): string {
  return [
    `⚠️ Sample content generated in mock mode (no ${providerLabel} API key configured).`,
    '',
    'Based on your brief, here is a draft you can refine:',
    '',
    (prompt || '').slice(0, 600),
    '',
    '— Headline: Unlock more with a solution built around your brand.',
    '— Body: We crafted this message to match your brand voice and audience. ' +
      `Add a real ${providerLabel} API key to generate production-quality, ` +
      'context-aware content tailored to your guidelines.',
    '— Call to action: Get started today.',
  ].join('\n');
}

/** Normalize SDK errors into an Error carrying an HTTP-ish status code. */
export function toProviderError(err: any, fallbackMsg: string): Error & { status?: number } {
  const message =
    err?.error?.message || err?.response?.data?.error?.message || err?.message || fallbackMsg;
  const status = err?.status || err?.statusCode || err?.response?.status;
  const e = new Error(message) as Error & { status?: number };
  e.status = typeof status === 'number' ? status : 502;
  return e;
}
