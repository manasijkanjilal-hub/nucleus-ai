'use client';
import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ArrowLeft, Megaphone, Sparkles, Hash, Coins, FileText, Loader2, Copy, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CampaignDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  brandId: string;
  brandName: string | null;
  brandIndustry: string | null;
  createdByName: string | null;
  generationCount: number;
  totalTokens: number;
  totalCost: number;
  createdAt: string;
}

interface Generation {
  id: string;
  contentType: string;
  content: string;
  model: string;
  tokensUsed: number;
  cost: number;
  createdBy: string | null;
  createdAt: string;
}

// Status workflow order — buttons advance/transition the campaign.
const STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAUSED: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-blue-50 text-blue-700',
  ARCHIVED: 'bg-zinc-200 text-zinc-500',
};

const CONTENT_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  facebook_ads: 'Facebook Ads',
  instagram_post: 'Instagram Post',
  linkedin_post: 'LinkedIn Post',
  blog_post: 'Blog Post',
  email_campaign: 'Email Campaign',
  landing_page: 'Landing Page Copy',
  video_script: 'Video Script',
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { can } = usePermissions();
  const canUpdate = can('campaign:update');
  const canGenerate = can('content:generate');

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (res.status === 404 || res.status === 403) { setNotFound(true); return; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { setNotFound(true); return; }
      setCampaign(data);
    } catch {
      setNotFound(true);
    }
  };

  const fetchContent = async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}/content`);
      const data = await res.json().catch(() => []);
      setGenerations(Array.isArray(data) ? data : []);
    } catch {
      setGenerations([]);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchCampaign(), fetchContent()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const changeStatus = async (status: string) => {
    if (!campaign || status === campaign.status) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update status');
      setCampaign((c) => (c ? { ...c, status } : c));
      toast.success(`Status changed to ${status}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const copyContent = (g: Generation) => {
    navigator?.clipboard?.writeText?.(g.content ?? '').then(() => {
      setCopiedId(g.id);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleString(); } catch { return d; }
  };

  if (loading) {
    return (
      <>
        <DashboardHeader title="Campaign" />
        <div className="flex-1 space-y-4 p-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      </>
    );
  }

  if (notFound || !campaign) {
    return (
      <>
        <DashboardHeader title="Campaign" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Megaphone className="mb-3 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">Campaign not found</p>
              <p className="mb-4 text-sm text-muted-foreground">
                It may have been removed or you don’t have access to it.
              </p>
              <Button render={<Link href="/campaigns" />} variant="outline">
                <ArrowLeft className="mr-1 h-4 w-4" />Back to campaigns
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const generateHref =
    `/campaign-generator?campaignId=${encodeURIComponent(campaign.id)}` +
    `&brandId=${encodeURIComponent(campaign.brandId)}` +
    `&campaignName=${encodeURIComponent(campaign.name)}`;

  return (
    <>
      <DashboardHeader title="Campaign" />
      <div className="flex-1 space-y-6 p-6">
        {/* Back link */}
        <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to campaigns
        </Link>

        {/* Header / details */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">{campaign.name}</h2>
              <Badge variant="secondary" className={STATUS_STYLES[campaign.status] ?? ''}>{campaign.status}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {campaign.brandName && <span>{campaign.brandName}</span>}
              {campaign.brandIndustry && <span>· {campaign.brandIndustry}</span>}
              {campaign.createdByName && <span>· by {campaign.createdByName}</span>}
            </div>
            {campaign.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{campaign.description}</p>
            )}
          </div>
          {canGenerate && (
            <Button render={<Link href={generateHref} />}>
              <Sparkles className="mr-1 h-4 w-4" />Generate Content
            </Button>
          )}
        </div>

        {/* Metric strip */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><FileText className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold">{campaign.generationCount}</p><p className="text-xs text-muted-foreground">Generations</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Hash className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold">{campaign.totalTokens.toLocaleString()}</p><p className="text-xs text-muted-foreground">Tokens used</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Coins className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold">${campaign.totalCost.toFixed(4)}</p><p className="text-xs text-muted-foreground">Est. cost</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Status controls */}
        {canUpdate && (
          <Card>
            <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === campaign.status ? 'default' : 'outline'}
                  disabled={updatingStatus || s === campaign.status}
                  onClick={() => changeStatus(s)}
                >
                  {updatingStatus && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  {s}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Generated content list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated content ({generations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {generations.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Sparkles className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No content generated for this campaign yet.</p>
                {canGenerate && (
                  <Button className="mt-3" size="sm" render={<Link href={generateHref} />}>
                    <Sparkles className="mr-1 h-4 w-4" />Generate Content
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {generations.map((g) => {
                  const isOpen = expanded === g.id;
                  return (
                    <div key={g.id} className="rounded-lg border">
                      <div className="flex items-center gap-3 p-3">
                        <Badge variant="secondary">{CONTENT_LABELS[g.contentType] ?? g.contentType}</Badge>
                        <div className="flex-1 min-w-0 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{g.tokensUsed.toLocaleString()}</span>
                          <span className="mx-2 inline-flex items-center gap-1"><Coins className="h-3 w-3" />${Number(g.cost).toFixed(6)}</span>
                          <span>{fmtDate(g.createdAt)}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => copyContent(g)}>
                          {copiedId === g.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setExpanded(isOpen ? null : g.id)}>
                          {isOpen ? 'Hide' : 'View'}
                        </Button>
                      </div>
                      {isOpen && (
                        <div className="whitespace-pre-wrap border-t bg-muted/40 p-3 text-sm leading-relaxed">
                          {g.content}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
