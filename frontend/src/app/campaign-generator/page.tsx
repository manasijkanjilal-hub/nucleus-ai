'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import { GradientButton } from '@/components/ui/button-gradient';
import { fireConfetti } from '@/components/ui/animated/Confetti';
import { Typewriter } from '@/components/ui/typewriter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, Copy, Check, RefreshCw, Save, AlertCircle, Coins, Hash, Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Mirror of the server-side content types (kept in sync with src/lib/prompts.ts).
const CONTENT_TYPES = [
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'instagram_post', label: 'Instagram Post' },
  { value: 'linkedin_post', label: 'LinkedIn Post' },
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'email_campaign', label: 'Email Campaign' },
  { value: 'landing_page', label: 'Landing Page Copy' },
  { value: 'video_script', label: 'Video Script' },
];

interface GenerationResponse {
  id: string;
  contentTypeLabel: string;
  content: string;
  provider?: string;
  model: string;
  tokensUsed: number;
  cost: number;
  mocked: boolean;
  contextSnippetsUsed: number;
}

interface ProviderOption {
  name: string;
  label: string;
  defaultModel: string;
  models: { id: string; label: string; inputPer1M: number; outputPer1M: number }[];
  isDefault: boolean;
}

// Display labels for providers (used to render the selected provider in results).
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
};

function CampaignGeneratorInner() {
  const { can } = usePermissions();
  const canGenerate = can('content:generate');
  const searchParams = useSearchParams();

  // Optional campaign context (when arriving from a campaign detail page).
  const campaignId = searchParams?.get('campaignId') ?? '';
  const campaignNameParam = searchParams?.get('campaignName') ?? '';
  const brandIdParam = searchParams?.get('brandId') ?? '';

  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [contentType, setContentType] = useState('google_ads');
  const [additionalContext, setAdditionalContext] = useState('');

  // AI provider selection ('auto' = platform default with automatic fallback).
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [provider, setProvider] = useState('auto');

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealDone, setRevealDone] = useState(false);

  const [campaignName, setCampaignName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/brands')
      .then((r: any) => r?.json?.())
      .then((d: any) => {
        const list = Array.isArray(d) ? d : [];
        setBrands(list);
        // Prefer the brand passed via query params (campaign context), else first.
        const preferred = brandIdParam && list.some((b: any) => b?.id === brandIdParam)
          ? brandIdParam
          : (list[0]?.id ?? '');
        if (preferred) setSelectedBrand(preferred);
      })
      .catch(() => {});

    // Load selectable AI providers (only enabled + configured ones appear).
    fetch('/api/providers')
      .then((r: any) => r?.json?.())
      .then((d: any) => {
        const list = Array.isArray(d?.providers) ? d.providers : [];
        setProviders(list);
      })
      .catch(() => {});
  }, []);

  // Pricing hint for the currently selected provider (default model).
  const selectedProvider = providers.find((p) => p.name === provider);
  const pricingHint = (() => {
    if (provider === 'auto') {
      return 'Automatically uses the platform default and falls back to other configured providers if it fails.';
    }
    const m = selectedProvider?.models?.find((x) => x.id === selectedProvider.defaultModel)
      ?? selectedProvider?.models?.[0];
    if (!m) return null;
    return `${m.label}: $${m.inputPer1M}/1M input · $${m.outputPer1M}/1M output tokens`;
  })();

  const handleGenerate = async () => {
    if (!selectedBrand) { toast.error('Please select a brand'); return; }
    setGenerating(true);
    setResult(null);
    setSaved(false);
    setRevealDone(false);
    setCampaignName('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrand,
          contentType,
          additionalContext,
          provider,
          ...(campaignId ? { campaignId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Generation failed');
      setResult(data as GenerationResponse);
      if (data?.mocked) {
        toast('Generated in mock mode (no OpenAI key configured)', { icon: '⚠️' });
      } else {
        toast.success('Content generated');
        fireConfetti('burst');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator?.clipboard?.writeText?.(result?.content ?? '').then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleSaveToCampaign = async () => {
    if (!result?.id) return;
    if (!campaignName.trim()) { toast.error('Enter a campaign name'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/generate/${result.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignName: campaignName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      setSaved(true);
      toast.success('Saved to campaign');
    } catch (err: any) {
      toast.error(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = CONTENT_TYPES.find((c) => c.value === contentType)?.label ?? contentType;

  // ---- Permission gate -----------------------------------------------------
  if (!canGenerate) {
    return (
      <>
        <DashboardHeader title="AI Content Generator" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Lock className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Insufficient permissions</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Your role does not allow generating content. Please contact an administrator
                if you need the Editor role or higher.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader title="AI Content Generator" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Content Generator</h2>
          <p className="text-muted-foreground">
            Generate on-brand marketing content powered by AI and your Context Vault.
          </p>
        </div>

        {/* ---- Campaign context banner ---- */}
        {campaignId && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Generating content for campaign
              {campaignNameParam ? <strong className="mx-1">{campaignNameParam}</strong> : ' '}
              — new content will be linked to it automatically.
            </span>
          </div>
        )}

        {/* ---- Input form ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />Create content
            </CardTitle>
            <CardDescription>
              Pick a brand and content type, add any extra context, then generate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Brand</Label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={selectedBrand}
                  onChange={(e: any) => setSelectedBrand(e.target?.value ?? '')}
                >
                  {brands.length === 0 && <option value="">No brands available</option>}
                  {brands.map((b: any) => (
                    <option key={b?.id ?? ''} value={b?.id ?? ''}>{b?.name ?? ''}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Content type</Label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={contentType}
                  onChange={(e: any) => setContentType(e.target?.value ?? 'google_ads')}
                >
                  {CONTENT_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>AI provider</Label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={provider}
                onChange={(e: any) => setProvider(e.target?.value ?? 'auto')}
              >
                <option value="auto">Auto (with fallback)</option>
                {providers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.label}{p.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
              {pricingHint && (
                <p className="text-xs text-muted-foreground">{pricingHint}</p>
              )}
              {providers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No providers configured yet — generation falls back to mock mode.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Additional context (optional)</Label>
              <Textarea
                value={additionalContext}
                onChange={(e: any) => setAdditionalContext(e.target?.value ?? '')}
                placeholder="Example: Promote our summer sale — 30% off all annual plans. Target busy founders. Emphasize ROI and limited-time urgency."
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <GradientButton
                onClick={handleGenerate}
                disabled={!selectedBrand}
                loading={generating}
                pulse={!generating && !!selectedBrand}
              >
                {generating ? (
                  'Generating…'
                ) : (
                  <>
                    <Sparkles className="mr-1 h-4 w-4" />Generate {typeLabel}
                  </>
                )}
              </GradientButton>
              {result && (
                <Button variant="outline" onClick={handleGenerate} disabled={generating}>
                  <RefreshCw className="mr-1 h-4 w-4" />Regenerate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ---- Result ---- */}
        {(generating || result) && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Generated content</CardTitle>
                {result && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className={copied ? 'border-emerald-300 text-emerald-600' : ''}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.span
                          key="copied"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="flex items-center"
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />Copied
                        </motion.span>
                      ) : (
                        <motion.span
                          key="copy"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="flex items-center"
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />Copy
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {generating && !result && (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <motion.div
                    className="h-14 w-14 rounded-full bg-[linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4)] shadow-[0_0_30px_rgba(139,92,246,0.5)]"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <span className="text-sm text-muted-foreground">Generating your {typeLabel}…</span>
                </div>
              )}

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  {result.mocked && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Generated in mock mode — no OpenAI API key is configured. Add
                        <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/50">OPENAI_API_KEY</code>
                        to produce live AI content.
                      </span>
                    </div>
                  )}

                  <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                    <Typewriter
                      text={result.content}
                      speed={4}
                      onDone={() => setRevealDone(true)}
                    />
                  </div>

                  {/* Token / cost metadata — revealed after the typewriter finishes */}
                  <motion.div
                    className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: revealDone ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" />{result.tokensUsed.toLocaleString()} tokens
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" />${Number(result.cost).toFixed(6)}
                    </span>
                    {result.provider && (
                      <span>Provider: {PROVIDER_LABELS[result.provider] ?? result.provider}</span>
                    )}
                    <span>Model: {result.model}</span>
                    {result.contextSnippetsUsed > 0 && (
                      <span>{result.contextSnippetsUsed} context snippet(s) used</span>
                    )}
                  </motion.div>

                  {/* Save to campaign — hidden when already linked to a campaign */}
                  {campaignId ? (
                    <div className="flex items-center gap-2 border-t pt-4 text-sm text-emerald-700 dark:text-emerald-300">
                      <Check className="h-4 w-4" />
                      <span>Linked to campaign{campaignNameParam ? ` “${campaignNameParam}”` : ''}.</span>
                    </div>
                  ) : (
                  <div className="space-y-2 border-t pt-4">
                    <Label>Save to a new campaign</Label>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={campaignName}
                        onChange={(e: any) => setCampaignName(e.target?.value ?? '')}
                        placeholder="Campaign name"
                        className="max-w-xs"
                        disabled={saved}
                      />
                      <Button
                        variant="outline"
                        onClick={handleSaveToCampaign}
                        disabled={saving || saved || !campaignName.trim()}
                      >
                        {saved
                          ? <><Check className="mr-1 h-4 w-4" />Saved</>
                          : saving
                            ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</>
                            : <><Save className="mr-1 h-4 w-4" />Save to campaign</>}
                      </Button>
                    </div>
                  </div>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default function CampaignGeneratorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <CampaignGeneratorInner />
    </Suspense>
  );
}
