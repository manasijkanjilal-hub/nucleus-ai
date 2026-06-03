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
  model: string;
  tokensUsed: number;
  cost: number;
  mocked: boolean;
  contextSnippetsUsed: number;
}

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

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [copied, setCopied] = useState(false);

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
  }, []);

  const handleGenerate = async () => {
    if (!selectedBrand) { toast.error('Please select a brand'); return; }
    setGenerating(true);
    setResult(null);
    setSaved(false);
    setCampaignName('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrand,
          contentType,
          additionalContext,
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
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
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
              <Button onClick={handleGenerate} disabled={generating || !selectedBrand}>
                {generating
                  ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Generating...</>
                  : <><Sparkles className="mr-1 h-4 w-4" />Generate {typeLabel}</>}
              </Button>
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
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {generating && !result && (
                <div className="flex items-center justify-center gap-2 py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Generating your {typeLabel}…</span>
                </div>
              )}

              {result && (
                <>
                  {result.mocked && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Generated in mock mode — no OpenAI API key is configured. Add
                        <code className="mx-1 rounded bg-amber-100 px-1">OPENAI_API_KEY</code>
                        to produce live AI content.
                      </span>
                    </div>
                  )}

                  <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                    {result.content}
                  </div>

                  {/* Token / cost metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" />{result.tokensUsed.toLocaleString()} tokens
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" />${Number(result.cost).toFixed(6)}
                    </span>
                    <span>Model: {result.model}</span>
                    {result.contextSnippetsUsed > 0 && (
                      <span>{result.contextSnippetsUsed} context snippet(s) used</span>
                    )}
                  </div>

                  {/* Save to campaign — hidden when already linked to a campaign */}
                  {campaignId ? (
                    <div className="flex items-center gap-2 border-t pt-4 text-sm text-emerald-700">
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
                </>
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
