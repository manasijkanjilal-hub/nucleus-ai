'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, Target, BarChart3 } from 'lucide-react';

const RevenueChart = dynamic(() => import('@/components/dashboard/analytics-charts').then((m: any) => m.RevenueChart) as any, { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded" /> }) as any;
const SpendByChannelChart = dynamic(() => import('@/components/dashboard/analytics-charts').then((m: any) => m.SpendByChannelChart) as any, { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded" /> }) as any;
const TopCampaignsChart = dynamic(() => import('@/components/dashboard/analytics-charts').then((m: any) => m.TopCampaignsChart) as any, { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded" /> }) as any;

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/api/v1/attribution/dashboard`)
      .then((r: any) => r?.json?.())
      .then((d: any) => setDashboard(d ?? {}))
      .catch(() => setDashboard({}))
      .finally(() => setLoading(false));
  }, []);

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
        <div>
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
