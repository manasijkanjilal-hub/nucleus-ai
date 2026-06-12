'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Sparkles,
  ArrowUpRight,
  Settings,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ResourceUsage {
  used: number;
  limit: number;
  unlimited: boolean;
  percent: number;
}

interface UsageSummary {
  plan: string;
  status: string;
  generations: ResourceUsage;
  brands: ResourceUsage;
  documents: ResourceUsage;
  campaigns: ResourceUsage;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  invoiceUrl: string | null;
  createdAt: string;
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  TRIALING: 'bg-blue-50 text-blue-700',
  PAST_DUE: 'bg-red-50 text-red-700',
  CANCELED: 'bg-zinc-200 text-zinc-600',
  INCOMPLETE: 'bg-amber-50 text-amber-700',
};

function UsageBar({ label, usage }: { label: string; usage: ResourceUsage }) {
  const danger = !usage.unlimited && usage.percent >= 90;
  const warn = !usage.unlimited && usage.percent >= 75 && usage.percent < 90;
  const barColor = danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-indigo-600';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-zinc-500">
          {usage.unlimited ? (
            <span className="font-medium text-indigo-600">Unlimited</span>
          ) : (
            `${usage.used} / ${usage.limit}`
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${usage.unlimited ? 'bg-indigo-200' : barColor}`}
          style={{ width: usage.unlimited ? '100%' : `${usage.percent}%` }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [uRes, iRes] = await Promise.all([
        fetch('/api/billing/usage'),
        fetch('/api/billing/invoices'),
      ]);
      if (uRes.ok) setUsage(await uRes.json());
      if (iRes.ok) setInvoices((await iRes.json()).invoices ?? []);
    } catch {
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Surface checkout result from the redirect query.
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      toast.success('Subscription updated! It may take a moment to reflect.');
    }
  }, [load]);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Billing portal is unavailable');
      }
    } catch {
      toast.error('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  async function toggleCancel(reactivate: boolean) {
    setCancelLoading(true);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactivate }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Subscription updated');
        load();
      } else {
        toast.error(data.error || 'Failed to update subscription');
      }
    } catch {
      toast.error('Failed to update subscription');
    } finally {
      setCancelLoading(false);
    }
  }

  const isPaid = usage && usage.plan !== 'FREE';
  const planLabel = usage ? PLAN_LABELS[usage.plan] ?? usage.plan : '';

  return (
    <div className="space-y-6">
      <DashboardHeader title="Billing & Usage" />

      {loading ? (
        <div className="py-20 text-center text-zinc-400">Loading billing information…</div>
      ) : (
        <>
          {/* Current plan */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardDescription className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Current Plan
                </CardDescription>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  {planLabel}
                  {usage && (
                    <Badge className={STATUS_STYLES[usage.status] ?? 'bg-zinc-100 text-zinc-700'}>
                      {usage.status}
                    </Badge>
                  )}
                </CardTitle>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button render={<Link href="/billing/plans" />} variant="default">
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {isPaid ? 'Change Plan' : 'Upgrade'}
                </Button>
                {isPaid && (
                  <Button variant="outline" onClick={openPortal} disabled={portalLoading}>
                    <Settings className="mr-1.5 h-4 w-4" />
                    {portalLoading ? 'Opening…' : 'Manage Billing'}
                  </Button>
                )}
              </div>
            </CardHeader>
            {usage && (usage.currentPeriodEnd || usage.cancelAtPeriodEnd) && (
              <CardContent className="border-t pt-4">
                {usage.cancelAtPeriodEnd ? (
                  <div className="flex flex-col gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Your subscription is set to cancel
                      {usage.currentPeriodEnd
                        ? ` on ${new Date(usage.currentPeriodEnd).toLocaleDateString()}`
                        : ' at the end of the period'}
                      .
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleCancel(true)}
                      disabled={cancelLoading}
                    >
                      Keep Subscription
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm text-zinc-600">
                    <span>
                      {usage.currentPeriodEnd
                        ? `Renews on ${new Date(usage.currentPeriodEnd).toLocaleDateString()}`
                        : ''}
                    </span>
                    {isPaid && (
                      <button
                        className="text-red-600 hover:underline disabled:opacity-50"
                        onClick={() => toggleCancel(false)}
                        disabled={cancelLoading}
                      >
                        Cancel subscription
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Usage */}
          {usage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usage This Period</CardTitle>
                <CardDescription>
                  Your consumption against the {planLabel} plan limits.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <UsageBar label="AI Generations" usage={usage.generations} />
                <UsageBar label="Brand Profiles" usage={usage.brands} />
                <UsageBar label="Documents" usage={usage.documents} />
                <UsageBar label="Campaigns" usage={usage.campaigns} />
              </CardContent>
            </Card>
          )}

          {/* Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoice History</CardTitle>
              <CardDescription>Your past payments.</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">No invoices yet.</p>
              ) : (
                <div className="divide-y">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <div>
                          <p className="text-sm font-medium text-zinc-800">
                            {inv.currency} {inv.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(inv.paidAt ?? inv.createdAt).toLocaleDateString()} ·{' '}
                            {inv.status}
                          </p>
                        </div>
                      </div>
                      {inv.invoiceUrl && (
                        <a
                          href={inv.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-indigo-600 hover:underline"
                        >
                          View <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
