// =============================================================================
// OpenAI provider — implements AIProvider on top of the OpenAI SDK.
// Keeps a deterministic mock fallback so the app works without an API key.
// =============================================================================

import OpenAI from 'openai';
import {
  type AIProvider,
  type GenerateParams,
  type GenerateResult,
  type ModelInfo,
  buildMockContent,
  computeCost,
  estimateTokens,
  pricingForModel,
  toProviderError,
} from './base';

const MODELS: ModelInfo[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', inputPer1M: 0.15, outputPer1M: 0.6 },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', inputPer1M: 0.5, outputPer1M: 1.5 },
  { id: 'gpt-4o', label: 'GPT-4o', inputPer1M: 2.5, outputPer1M: 10 },
  { id: 'gpt-4', label: 'GPT-4', inputPer1M: 30, outputPer1M: 60 },
];

export class OpenAIProvider implements AIProvider {
  name = 'openai' as const;
  label = 'OpenAI';
  models = MODELS;
  defaultModel = 'gpt-4o-mini';

  private apiKey: string | undefined;
  private client: OpenAI | null = null;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey || process.env.OPENAI_API_KEY || '').trim() || undefined;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /** OpenAI is always usable — it falls back to deterministic mock output. */
  isAvailable(): boolean {
    return true;
  }

  estimateCost(tokens: number): number {
    const p = pricingForModel(this.models, this.defaultModel);
    // Assume a ~50/50 prompt/completion split for a rough estimate.
    return computeCost(p, tokens / 2, tokens / 2);
  }

  private getClient(): OpenAI | null {
    if (!this.apiKey) return null;
    if (!this.client) this.client = new OpenAI({ apiKey: this.apiKey });
    return this.client;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const model = params.model || this.defaultModel;
    const pricing = pricingForModel(this.models, model);
    const client = this.getClient();

    if (!client) {
      const content = buildMockContent(params.prompt, this.label);
      const promptTokens = estimateTokens((params.systemPrompt ?? '') + params.prompt);
      const completionTokens = estimateTokens(content);
      return {
        content,
        promptTokens,
        completionTokens,
        tokensUsed: promptTokens + completionTokens,
        model,
        provider: this.name,
        cost: computeCost(pricing, promptTokens, completionTokens),
        mocked: true,
      };
    }

    try {
      const messages: { role: 'system' | 'user'; content: string }[] = [];
      if (params.systemPrompt) messages.push({ role: 'system', content: params.systemPrompt });
      messages.push({ role: 'user', content: params.prompt });

      const completion = await client.chat.completions.create({
        model,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 1500,
        messages,
      });

      const content = completion.choices?.[0]?.message?.content?.trim() ?? '';
      const usage = completion.usage;
      const promptTokens = usage?.prompt_tokens ?? estimateTokens((params.systemPrompt ?? '') + params.prompt);
      const completionTokens = usage?.completion_tokens ?? estimateTokens(content);

      return {
        content,
        promptTokens,
        completionTokens,
        tokensUsed: usage?.total_tokens ?? promptTokens + completionTokens,
        model,
        provider: this.name,
        cost: computeCost(pricing, promptTokens, completionTokens),
        mocked: false,
      };
    } catch (err: any) {
      throw toProviderError(err, 'OpenAI request failed');
    }
  }
}
