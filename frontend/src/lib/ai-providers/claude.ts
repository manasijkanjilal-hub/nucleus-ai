// =============================================================================
// Anthropic Claude provider — implements AIProvider on @anthropic-ai/sdk.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
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

// Use stable, current model ids. Pricing per the task spec / Anthropic pricing.
const MODELS: ModelInfo[] = [
  { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', inputPer1M: 0.25, outputPer1M: 1.25 },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', inputPer1M: 3, outputPer1M: 15 },
];

export class ClaudeProvider implements AIProvider {
  name = 'claude' as const;
  label = 'Anthropic Claude';
  models = MODELS;
  defaultModel = 'claude-3-haiku-20240307';

  private apiKey: string | undefined;
  private client: Anthropic | null = null;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey || process.env.ANTHROPIC_API_KEY || '').trim() || undefined;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  estimateCost(tokens: number): number {
    const p = pricingForModel(this.models, this.defaultModel);
    return computeCost(p, tokens / 2, tokens / 2);
  }

  private getClient(): Anthropic | null {
    if (!this.apiKey) return null;
    if (!this.client) this.client = new Anthropic({ apiKey: this.apiKey });
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
      const message = await client.messages.create({
        model,
        max_tokens: params.maxTokens ?? 1500,
        temperature: params.temperature ?? 0.7,
        ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
        messages: [{ role: 'user', content: params.prompt }],
      });

      // Concatenate text blocks from the response content.
      const content = (message.content ?? [])
        .map((block: any) => (block?.type === 'text' ? block.text : ''))
        .join('')
        .trim();

      const promptTokens =
        message.usage?.input_tokens ?? estimateTokens((params.systemPrompt ?? '') + params.prompt);
      const completionTokens = message.usage?.output_tokens ?? estimateTokens(content);

      return {
        content,
        promptTokens,
        completionTokens,
        tokensUsed: promptTokens + completionTokens,
        model,
        provider: this.name,
        cost: computeCost(pricing, promptTokens, completionTokens),
        mocked: false,
      };
    } catch (err: any) {
      throw toProviderError(err, 'Claude request failed');
    }
  }
}
