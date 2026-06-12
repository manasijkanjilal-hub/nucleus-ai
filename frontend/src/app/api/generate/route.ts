// =============================================================================
// POST /api/generate — AI content generation
// -----------------------------------------------------------------------------
// Flow:
//   1. AuthZ: requires the `content:generate` permission (EDITOR and above).
//   2. Rate limit: 50 generations / hour / user.
//   3. Validate input (brandId, contentType, additionalContext, campaignId?).
//   4. Verify brand access (owner, or ADMIN+ sees all).
//   5. Retrieve brand context from the Context Vault (semantic search).
//   6. Build prompt, call OpenAI (gpt-4o-mini) — mock fallback if no key.
//   7. Persist the AIGeneration record + audit log.
//   8. Return the generated content with token + cost metadata.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { hasMinRole } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { sanitizeText } from '@/lib/sanitize';
import { firstZodError } from '@/lib/validations/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import {
  checkGenerationLimit,
  incrementGenerationUsage,
  getUsageSummary,
  UsageLimitError,
} from '@/lib/usage-limits';
import { notifyGenerationComplete, notifyLimitWarning } from '@/lib/notifications';
import {
  buildSystemPrompt,
  buildUserPrompt,
  isValidContentType,
  getContentType,
  type BrandContext,
} from '@/lib/prompts';
import { generateWithFallback, isProviderName } from '@/lib/ai-providers/factory';
import { getGenerationOrder, resolveProvider } from '@/lib/ai-providers/provider-config';

const GENERATE_LIMIT = 50; // generations per hour
const GENERATE_WINDOW_MS = 60 * 60 * 1000;

const generateSchema = z.object({
  brandId: z.string().trim().min(1, 'A brand is required'),
  contentType: z
    .string()
    .trim()
    .min(1, 'Content type is required')
    .refine(isValidContentType, 'Unsupported content type'),
  additionalContext: z.string().trim().max(5000).optional().default(''),
  campaignId: z.string().trim().min(1).optional().nullable(),
  // Provider: 'auto' (default, with fallback), or a specific provider name.
  provider: z.string().trim().min(1).optional().default('auto'),
  model: z.string().trim().min(1).optional(),
});

/**
 * Retrieve relevant brand context snippets from the Context Vault backend.
 * Best-effort: returns [] on any failure so generation still proceeds.
 */
async function retrieveBrandContext(
  brandId: string,
  query: string,
  contentType: string,
): Promise<string[]> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!base) return [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${base}/api/v1/context/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query || contentType,
        brand_id: brandId,
        limit: 5,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results
      .map((r: any) => r?.payload?.text)
      .filter((t: any): t is string => typeof t === 'string' && t.trim().length > 0);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  // 1. Permission ------------------------------------------------------------
  const guard = await requirePermission('content:generate');
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  // 2. Rate limit (per user) -------------------------------------------------
  const rl = rateLimit({
    key: `generate:${user.id}`,
    limit: GENERATE_LIMIT,
    windowMs: GENERATE_WINDOW_MS,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Generation rate limit exceeded. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  // 3. Validate input --------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { brandId, contentType, campaignId } = parsed.data;
  const additionalContext = sanitizeText(parsed.data.additionalContext || '');
  // Provider selection: 'auto' (default) tries the platform default then
  // falls back; a specific name forces that provider first (still with fallback).
  const requestedProvider = parsed.data.provider || 'auto';
  if (requestedProvider !== 'auto' && !isProviderName(requestedProvider)) {
    return NextResponse.json({ error: 'Unknown AI provider' }, { status: 400 });
  }
  const requestedModel = parsed.data.model;

  try {
    // 3b. Usage limit (monthly generation quota) -----------------------------
    await checkGenerationLimit(user.id);

    // 4. Brand access check --------------------------------------------------
    const brand = await prisma.brandProfile.findUnique({ where: { id: brandId } });
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }
    const isAdmin = hasMinRole(user.role, 'ADMIN');
    if (!isAdmin && brand.userId !== user.id) {
      return NextResponse.json(
        { error: 'You do not have access to this brand' },
        { status: 403 },
      );
    }

    // Optional campaign validation (must belong to the same brand).
    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign || campaign.brandId !== brandId) {
        return NextResponse.json(
          { error: 'Invalid campaign for this brand' },
          { status: 400 },
        );
      }
    }

    // 5. Retrieve brand context ----------------------------------------------
    const snippets = await retrieveBrandContext(brandId, additionalContext, contentType);

    // 6. Build prompt + generate ---------------------------------------------
    const brandContext: BrandContext = {
      name: brand.name,
      industry: brand.industry,
      targetAudience: brand.targetAudience,
      brandVoice: brand.brandVoice,
      description: brand.description,
      guidelines: brand.guidelines,
      website: brand.website,
    };
    const systemPrompt = buildSystemPrompt(contentType, brandContext, snippets);
    const userPrompt = buildUserPrompt(contentType, additionalContext);

    // Determine provider order (DB-aware: respects enabled flags, default, keys).
    const { primary, fallbacks } = await getGenerationOrder(requestedProvider);

    let generation;
    try {
      generation = await generateWithFallback(
        { prompt: userPrompt, systemPrompt, model: requestedModel },
        primary,
        fallbacks,
        resolveProvider, // DB-aware resolver (key overrides + env fallback)
      );
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 502;
      return NextResponse.json(
        { error: err?.message || 'Content generation failed' },
        { status },
      );
    }

    // 7. Persist -------------------------------------------------------------
    const record = await prisma.aIGeneration.create({
      data: {
        contentType,
        prompt: userPrompt,
        generatedContent: generation.content,
        provider: generation.provider,
        model: generation.model,
        tokensUsed: generation.tokensUsed,
        cost: generation.cost,
        brandId,
        userId: user.id,
        campaignId: campaignId ?? null,
      },
    });

    // Count this generation against the monthly quota.
    await incrementGenerationUsage(user.id);

    // Notifications (best-effort — never block or fail the response).
    try {
      const contentTypeLabel = getContentType(contentType)?.label ?? contentType;
      await notifyGenerationComplete(user.id, {
        id: record.id,
        contentType,
        contentTypeLabel,
      });

      // Usage warning: notify at 80%+ (approaching) and 100% (reached).
      const summary = await getUsageSummary(user.id);
      const gen = summary.generations;
      if (!gen.unlimited && gen.percent >= 80) {
        await notifyLimitWarning(user.id, {
          resource: 'generations',
          used: gen.used,
          limit: gen.limit,
          percent: gen.percent,
          plan: summary.plan,
        });
      }
    } catch (e) {
      console.error('[generate] notification step failed:', e);
    }

    await recordAudit({
      userId: user.id,
      action: 'ai.generate',
      entity: 'AIGeneration',
      entityId: record.id,
      changes: { contentType, brandId, tokensUsed: generation.tokensUsed },
      request,
    });

    // 8. Respond -------------------------------------------------------------
    return NextResponse.json(
      {
        id: record.id,
        contentType,
        contentTypeLabel: getContentType(contentType)?.label ?? contentType,
        content: generation.content,
        provider: generation.provider,
        model: generation.model,
        tokensUsed: generation.tokensUsed,
        promptTokens: generation.promptTokens,
        completionTokens: generation.completionTokens,
        cost: generation.cost,
        mocked: generation.mocked,
        contextSnippetsUsed: snippets.length,
        createdAt: record.createdAt,
      },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (error: any) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          upgradeRequired: true,
          resource: error.resource,
          plan: error.plan,
          used: error.used,
          limit: error.limit,
        },
        { status: 403 },
      );
    }
    console.error('Generate error:', error);
    return NextResponse.json({ error: 'Content generation failed' }, { status: 500 });
  }
}
