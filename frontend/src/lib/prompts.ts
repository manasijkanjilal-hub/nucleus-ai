// =============================================================================
// Prompt templates for AI content generation
// -----------------------------------------------------------------------------
// Each content type has a tailored instruction template. Every template is
// composed with the brand context (voice, guidelines, audience) and any
// retrieved Context Vault snippets so generations stay on-brand.
// =============================================================================

export interface BrandContext {
  name: string;
  industry?: string | null;
  targetAudience?: string | null;
  brandVoice?: string | null;
  description?: string | null;
  guidelines?: string | null;
  website?: string | null;
}

export interface ContentTypeDef {
  value: string;
  label: string;
  /** Type-specific guidance appended to the system prompt. */
  instructions: string;
}

/** All supported content types, in display order. */
export const CONTENT_TYPES: ContentTypeDef[] = [
  {
    value: 'google_ads',
    label: 'Google Ads',
    instructions:
      'Write Google Search ad copy. Provide 3 distinct headlines (max 30 characters each), ' +
      '2 descriptions (max 90 characters each), and a recommended display path. ' +
      'Be punchy, benefit-driven, and include a clear call to action.',
  },
  {
    value: 'facebook_ads',
    label: 'Facebook Ads',
    instructions:
      'Write a Facebook/Meta ad. Provide a primary text (~125 characters), a headline (max 40 characters), ' +
      'a link description, and a call-to-action button suggestion. Make it scroll-stopping and audience-relevant.',
  },
  {
    value: 'instagram_post',
    label: 'Instagram Post',
    instructions:
      'Write an engaging Instagram caption with a strong hook in the first line, value or story in the body, ' +
      'a clear call to action, and 8-12 relevant hashtags. Suggest an idea for the accompanying visual.',
  },
  {
    value: 'linkedin_post',
    label: 'LinkedIn Post',
    instructions:
      'Write a professional LinkedIn post. Open with a compelling hook, deliver insight or a point of view in ' +
      'short scannable paragraphs, end with a question or call to action, and add 3-5 professional hashtags.',
  },
  {
    value: 'blog_post',
    label: 'Blog Post',
    instructions:
      'Write a well-structured blog post with an SEO-friendly title, an engaging introduction, ' +
      'clear H2/H3 section headings, informative body content, and a concluding call to action. ' +
      'Use Markdown formatting.',
  },
  {
    value: 'email_campaign',
    label: 'Email Campaign',
    instructions:
      'Write a marketing email. Provide a subject line, a preview/preheader text, a personalized greeting, ' +
      'persuasive body copy organized in short paragraphs, and a prominent call-to-action button label.',
  },
  {
    value: 'landing_page',
    label: 'Landing Page Copy',
    instructions:
      'Write conversion-focused landing page copy: a hero headline and subheadline, 3-4 key benefit bullets, ' +
      'a short social-proof line, an FAQ-style objection handler, and a primary call-to-action. Use Markdown.',
  },
  {
    value: 'video_script',
    label: 'Video Script',
    instructions:
      'Write a short-form video script (30-60 seconds). Include a hook (0-3s), the main message broken into ' +
      'timed beats, on-screen text suggestions, and a closing call to action. Format as a scene-by-scene script.',
  },
];

const CONTENT_TYPE_MAP = new Map(CONTENT_TYPES.map((c) => [c.value, c]));

export function getContentType(value: string): ContentTypeDef | undefined {
  return CONTENT_TYPE_MAP.get(value);
}

export function isValidContentType(value: string): boolean {
  return CONTENT_TYPE_MAP.has(value);
}

/** Format the brand context into a readable block for the prompt. */
function formatBrandBlock(brand: BrandContext): string {
  const lines: string[] = [`Brand name: ${brand.name}`];
  if (brand.industry) lines.push(`Industry: ${brand.industry}`);
  if (brand.targetAudience) lines.push(`Target audience: ${brand.targetAudience}`);
  if (brand.brandVoice) lines.push(`Brand voice / tone: ${brand.brandVoice}`);
  if (brand.description) lines.push(`About the brand: ${brand.description}`);
  if (brand.guidelines) lines.push(`Brand guidelines: ${brand.guidelines}`);
  if (brand.website) lines.push(`Website: ${brand.website}`);
  return lines.join('\n');
}

/** Format retrieved Context Vault snippets into a reference block. */
function formatContextBlock(snippets: string[]): string {
  if (!snippets.length) return '';
  const joined = snippets
    .map((s, i) => `[${i + 1}] ${s.trim()}`)
    .join('\n\n');
  return (
    '\n\nReference material from the brand\'s Context Vault (use it to stay accurate and on-brand; ' +
    'do not fabricate facts that contradict it):\n' +
    joined
  );
}

/**
 * Build the system prompt: role, brand context, content-type instructions,
 * and retrieved context snippets.
 */
export function buildSystemPrompt(
  contentType: string,
  brand: BrandContext,
  contextSnippets: string[] = [],
): string {
  const def = getContentType(contentType);
  const typeLabel = def?.label ?? contentType;
  const typeInstructions =
    def?.instructions ?? 'Write high-quality marketing content for the request.';

  return [
    `You are an expert marketing copywriter creating ${typeLabel} content for the brand below.`,
    'Always match the brand voice, respect the guidelines, and speak to the target audience.',
    '',
    '--- BRAND CONTEXT ---',
    formatBrandBlock(brand),
    '--- END BRAND CONTEXT ---',
    '',
    `--- TASK: ${typeLabel} ---`,
    typeInstructions,
    formatContextBlock(contextSnippets),
  ].join('\n');
}

/**
 * Build the user prompt from the user's brief / additional context.
 */
export function buildUserPrompt(
  contentType: string,
  additionalContext: string,
): string {
  const def = getContentType(contentType);
  const typeLabel = def?.label ?? contentType;
  const brief = additionalContext?.trim()
    ? additionalContext.trim()
    : `Create compelling ${typeLabel} content for the brand.`;
  return `Brief / additional context:\n${brief}`;
}
