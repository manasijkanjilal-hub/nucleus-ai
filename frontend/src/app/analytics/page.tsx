'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { DollarSign, TrendingUp, Users, Target, BarChart3, Megaphone, Sparkles, Hash, Coins } from 'lucide-react';

const CONTENT_LABELS: Record<string, string> = {
  google_ads: 'Google Ads', facebook_ads: 'Facebook Ads', instagram_post: 'Instagram Post',
  linkedin_post: 'LinkedIn Post', blog_post: 'Blog Post', email_campaign: 'Email Campaign',
  landing_page: 'Landing Page', video_script: 'Video Script',
};

const RevenueChart = dynamic(() => import('@/components/dashboard/analytics-charts').then((m: any) => m.RevenueChart) as any, { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded" /> }) as any;
const SpendByChannelChart = dynamic(() => import('@/components/dashboard/analytics-charts').then((m: any) => m.SpendByChannelChart) as any, { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded" /> }) as any;
const TopCampaignsChart = dynamic(() => import('@/components/dashboard/analytics-charts').then((m: any) => m.TopCampaignsChart) as any, { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded" /> }) as any;

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/api/v1/attribution/dashboard`)
      .then((r: any) => r?.json?.())
      .then((d: any) => setDashboard(d ?? {}))
      .catch(() => setDashboard({}))
      .finally(() => setLoading(false));

    // Content & usage analytics (Prisma-backed, first-party API).
    fetch('/api/analytics')
      .then((r: any) => (r?.ok ? r.json() : null))
      .then((d: any) => setUsage(d ?? null))
      .catch(() => setUsage(null))
      .finally(() => setUsageLoading(false));
  }, []);

  const usageMetrics = [
    { label: 'Total Campaigns', value: usage?.totals?.campaigns, icon: Megaphone, color: 'bg-amber-50 text-amber-600', fmt: (v: any) => Number(v ?? 0).toLocaleString() },
    { label: 'Total Generations', value: usage?.totals?.generations, icon: Sparkles, color: 'bg-violet-50 text-violet-600', fmt: (v: any) => Number(v ?? 0).toLocaleString() },
    { label: 'Total Tokens Used', value: usage?.totals?.tokensUsed, icon: Hash, color: 'bg-blue-50 text-blue-600', fmt: (v: any) => Number(v ?? 0).toLocaleString() },
    { label: 'Total Cost', value: usage?.totals?.cost, icon: Coins, color: 'bg-emerald-50 text-emerald-600', fmt: (v: any) => `$${Number(v ?? 0).toFixed(4)}` },
  ];

  const fmtDate = (d: any) => { try { return new Date(d).toLocaleDateString(); } catch { return '—'; } };

  const metrics = [
    { label: 'Total Spend', value: dashboard?.total_spend, prefix: '$', icon: DollarSign, color: 'bg-red-50 text-red-600' },
    { label: 'Total Revenue', value: dashboard?.total_revenue, prefix: '$', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Overall ROAS', value: dashboard?.overall_roas, suffix: 'x', icon: Target, color: 'bg-blue-50 text-blue-600' },
    { label: 'Avg CAC', value: dashboard?.average_cac, prefix: '$', icon: Users, color: 'bg-violet-50 text-violet-600' },
  ];

  const formatVal = (val: any, prefix?: string, suffix?: string) => {
    if (val == null || val === undefined) return '—';
    const num = Number(val);
    if (isNaN(num)) return '—';
    const formatted = num >= 1000 ? `${(num / 1000)?.toFixed?.(1) ?? '0'}k` : num?.toFixed?.(2) ?? '0';
    return `${prefix ?? ''}${formatted}${suffix ?? ''}`;
  };

  return (
    <>
      <DashboardHeader title="Analytics" />
      <div className="flex-1 space-y-6 p-6">
        {/* ============ Content & Usage Analytics (first-party) ============ */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Usage Analytics</h2>
          <p className="text-muted-foreground">
            AI content generation usage across your campaigns and brands
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {usageMetrics.map((m, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 pt-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.color}`}>
                  <m.icon className="h-5 w-5" />
                </div>
                <div>
                  {usageLoading ? (
                    <div className="h-7 w-16 animate-pulse rounded bg-muted" />
                  ) : (
                    <p className="text-2xl font-bold">{m.fmt(m.value)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent generations */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Generations</CardTitle>
              <CardDescription>Latest AI content created</CardDescription>
            </CardHeader>
            <CardContent>
              {usageLoading ? (
                <div className="h-40 animate-pulse rounded bg-muted" />
              ) : (usage?.recentGenerations?.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No generations yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.recentGenerations.map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell><Badge variant="secondary">{CONTENT_LABELS[g.contentType] ?? g.contentType}</Badge></TableCell>
                        <TableCell className="text-sm">{g.brandName ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{Number(g.tokensUsed ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{fmtDate(g.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Top brands by usage */}
          <Card>
            <CardHeader>
              <CardTitle>Top Brands by Usage</CardTitle>
              <CardDescription>Brands ranked by number of generations</CardDescription>
            </CardHeader>
            <CardContent>
              {usageLoading ? (
                <div className="h-40 animate-pulse rounded bg-muted" />
              ) : (usage?.topBrands?.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No usage data yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-right">Generations</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.topBrands.map((b: any) => (
                      <TableRow key={b.brandId}>
                        <TableCell className="text-sm font-medium">{b.brandName}</TableCell>
                        <TableCell className="text-right text-sm">{Number(b.generations ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">{Number(b.tokensUsed ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">${Number(b.cost ?? 0).toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ================= Attribution Analytics (backend) ================= */}
        <div className="pt-2">
          <h2 className="text-2xl font-bold tracking-tight">Attribution Analytics</h2>
          <p className="text-muted-foreground">Track campaign performance, ROI metrics, and revenue attribution</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics?.map?.((m: any, i: number) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 pt-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${m?.color ?? ''}`}>
                  {m?.icon && <m.icon className="h-5 w-5" />}
                </div>
                <div>
                  {loading ? (
                    <div className="h-7 w-16 animate-pulse rounded bg-muted" />
                  ) : (
                    <p className="text-2xl font-bold">{formatVal(m?.value, m?.prefix, m?.suffix)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{m?.label ?? ''}</p>
                </div>
              </CardContent>
            </Card>
          )) ?? []}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Daily revenue over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <RevenueChart data={dashboard?.daily_revenue ?? []} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spend by Channel</CardTitle>
              <CardDescription>Ad spend distribution across channels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <SpendByChannelChart data={dashboard?.spend_by_channel ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Campaigns</CardTitle>
            <CardDescription>Campaigns ranked by ROAS (Return on Ad Spend)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <TopCampaignsChart data={dashboard?.top_campaigns ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
