// =============================================================================
// OpenAI client wrapper
// -----------------------------------------------------------------------------
// Thin wrapper around the OpenAI SDK used by the AI content generation system.
//   • Centralizes model + pricing config.
//   • Tracks token usage and computes cost.
//   • Provides a deterministic mock fallback when no API key is configured so
//     the app remains fully functional (and testable) in dev / CI environments.
// =============================================================================

import OpenAI from 'openai';

/** Default model for content generation. */
export const DEFAULT_MODEL = 'gpt-4o-mini';
export const DEFAULT_PROVIDER = 'openai';

// gpt-4o-mini pricing (USD per 1M tokens). Source: OpenAI pricing.
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
};

export interface GenerationResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
  provider: string;
  mocked: boolean;
}

export interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Compute the USD cost of a generation given token counts.
 * Returns a number rounded to 6 decimal places.
 */
export function computeCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = PRICING[model] ?? PRICING[DEFAULT_MODEL];
  const cost =
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Rough token estimate (~4 chars/token) used for the mock fallback. */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  if (!_client) _client = new OpenAI({ apiKey });
  return _client;
}

/** Whether a real OpenAI key is configured. */
export function isOpenAIConfigured(): boolean {
  return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
}

/**
 * Build a deterministic mock completion. Keeps the app usable without a key.
 */
function buildMockContent(systemPrompt: string, userPrompt: string): string {
  return [
    '⚠️ This is AI-generated sample content produced in mock mode (no OpenAI API key configured).',
    '',
    'Based on your brief, here is a draft you can refine:',
    '',
    userPrompt.slice(0, 600),
    '',
    '— Headline: Unlock more with a solution built around your brand.',
    '— Body: We crafted this message to match your brand voice and audience. ' +
      'Connect a real OpenAI API key (OPENAI_API_KEY) to generate production-quality, ' +
      'context-aware content tailored to your guidelines.',
    '— Call to action: Get started today.',
  ].join('\n');
}

/**
 * Generate content. Uses the OpenAI Chat Completions API when configured,
 * otherwise returns deterministic mock output. Always returns token + cost data.
 */
export async function generateContent(
  opts: GenerateOptions,
): Promise<GenerationResult> {
  const model = opts.model || DEFAULT_MODEL;
  const client = getClient();

  // --- Mock fallback --------------------------------------------------------
  if (!client) {
    const content = buildMockContent(opts.systemPrompt, opts.userPrompt);
    const promptTokens = estimateTokens(opts.systemPrompt + opts.userPrompt);
    const completionTokens = estimateTokens(content);
    return {
      content,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cost: computeCost(model, promptTokens, completionTokens),
      model,
      provider: DEFAULT_PROVIDER,
      mocked: true,
    };
  }

  // --- Real API call --------------------------------------------------------
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1500,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content?.trim() ?? '';
    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens ?? estimateTokens(opts.systemPrompt + opts.userPrompt);
    const completionTokens = usage?.completion_tokens ?? estimateTokens(content);

    return {
      content,
      promptTokens,
      completionTokens,
      totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
      cost: computeCost(model, promptTokens, completionTokens),
      model,
      provider: DEFAULT_PROVIDER,
      mocked: false,
    };
  } catch (err: any) {
    const message = err?.error?.message || err?.message || 'OpenAI request failed';
    const status = err?.status || err?.statusCode;
    const e = new Error(message) as Error & { status?: number };
    e.status = typeof status === 'number' ? status : 502;
    throw e;
  }
}
