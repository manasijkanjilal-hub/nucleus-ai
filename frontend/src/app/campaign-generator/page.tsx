'use client';
import { useState, useEffect, useRef } from 'react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CampaignGeneratorPage() {
  const [prompt, setPrompt] = useState('');
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/brands').then((r: any) => r?.json?.()).then((d: any) => setBrands(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!prompt?.trim?.()) { toast.error('Please enter a campaign brief'); return; }
    setGenerating(true);
    setResult('');
    try {
      const res = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, brandId: selectedBrand || undefined }),
      });
      if (!res?.ok) {
        const errData = await res?.json?.().catch(() => ({}));
        throw new Error(errData?.error || 'Generation failed');
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let partialRead = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() || '';
        for (const line of lines) {
          if (line?.startsWith?.('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed?.choices?.[0]?.delta?.content ?? '';
              if (content) {
                buffer += content;
                setResult(buffer);
              }
            } catch {}
          }
        }
      }
      if (!buffer) setResult('No content generated. Please try again with a more specific prompt.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Generation failed');
      setResult('');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator?.clipboard?.writeText?.(result ?? '').then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <>
      <DashboardHeader title="AI Campaign Generator" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Campaign Generator</h2>
          <p className="text-muted-foreground">Multi-agent AI system that plans, writes, and reviews marketing campaigns</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Campaign Brief</CardTitle>
            <CardDescription>Describe the campaign you want to create. The AI agents will plan, write, and review the content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(brands ?? [])?.length > 0 && (
              <div className="space-y-2">
                <Label>Brand</Label>
                <select
                  className="h-10 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm"
                  value={selectedBrand}
                  onChange={(e: any) => setSelectedBrand(e.target?.value ?? '')}
                >
                  <option value="">No brand selected</option>
                  {(brands ?? [])?.map?.((b: any) => <option key={b?.id ?? ''} value={b?.id ?? ''}>{b?.name ?? ''}</option>) ?? []}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Campaign Prompt</Label>
              <Textarea
                value={prompt}
                onChange={(e: any) => setPrompt(e.target?.value ?? '')}
                placeholder="Example: Create a Q3 email marketing campaign for our new AI-powered analytics product. Include 3 emails targeting CTOs and VPs of Engineering at mid-market SaaS companies. Focus on productivity gains and ROI."
                rows={5}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generating || !prompt?.trim?.()}>
                {generating ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Generating...</> : <><Sparkles className="mr-1 h-4 w-4" />Generate Campaign</>}
              </Button>
              {result && (
                <Button variant="outline" onClick={() => { setResult(''); setPrompt(''); }}>
                  <RefreshCw className="mr-1 h-4 w-4" />New Campaign
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {(generating || result) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Generated Campaign</CardTitle>
                {result && (
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent ref={resultRef}>
              {generating && !result && (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">AI agents are planning and writing your campaign...</span>
                </div>
              )}
              {result && (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                  {result}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
