// =============================================================================
// Google Gemini provider — implements AIProvider on @google/generative-ai.
// =============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
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
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', inputPer1M: 0.075, outputPer1M: 0.3 },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', inputPer1M: 1.25, outputPer1M: 5 },
];

export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;
  label = 'Google Gemini';
  models = MODELS;
  defaultModel = 'gemini-1.5-flash';

  private apiKey: string | undefined;
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string) {
    this.apiKey =
      (apiKey || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '').trim() ||
      undefined;
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

  private getClient(): GoogleGenerativeAI | null {
    if (!this.apiKey) return null;
    if (!this.client) this.client = new GoogleGenerativeAI(this.apiKey);
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
      const genModel = client.getGenerativeModel({
        model,
        ...(params.systemPrompt
          ? { systemInstruction: params.systemPrompt }
          : {}),
        generationConfig: {
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens ?? 1500,
        },
      });

      const result = await genModel.generateContent(params.prompt);
      const response = result.response;
      const content = (response.text() ?? '').trim();

      // Gemini returns usageMetadata with token counts when available.
      const usage = response.usageMetadata;
      const promptTokens =
        usage?.promptTokenCount ?? estimateTokens((params.systemPrompt ?? '') + params.prompt);
      const completionTokens = usage?.candidatesTokenCount ?? estimateTokens(content);

      return {
        content,
        promptTokens,
        completionTokens,
        tokensUsed: usage?.totalTokenCount ?? promptTokens + completionTokens,
        model,
        provider: this.name,
        cost: computeCost(pricing, promptTokens, completionTokens),
        mocked: false,
      };
    } catch (err: any) {
      throw toProviderError(err, 'Gemini request failed');
    }
  }
}
