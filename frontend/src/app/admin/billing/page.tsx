'use client';

// =============================================================================
// Nucleus AI — Admin Billing
// =============================================================================
// Revenue overview (MRR / ARR / total) + searchable, filterable list of all
// subscriptions across the platform.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Users,
  CreditCard,
  Loader2,
  Search,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface PlanBreakdown {
  plan: string;
  name: string;
  activeCount: number;
}

interface Summary {
  mrr: number;
  arr: number;
  totalRevenue: number;
  activeSubscriptions: number;
  byPlan: PlanBreakdown[];
}

interface SubscriptionRow {
  id: string;
  user: { name: string | null; email: string; role: string | null };
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  generationsUsed: number;
  createdAt: string;
}

const PLAN_STYLES: Record<string, string> = {
  FREE: 'bg-zinc-100 text-zinc-700',
  STARTER: 'bg-blue-50 text-blue-700',
  PRO: 'bg-indigo-50 text-indigo-700',
  ENTERPRISE: 'bg-purple-50 text-purple-700',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  TRIALING: 'bg-blue-50 text-blue-700',
  PAST_DUE: 'bg-red-50 text-red-700',
  CANCELED: 'bg-zinc-200 text-zinc-600',
  INCOMPLETE: 'bg-amber-50 text-amber-700',
};

const PLAN_FILTERS = ['', 'FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
const STATUS_FILTERS = ['', 'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE'];

export default function AdminBillingPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (plan) params.set('plan', plan);
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      params.set('page', String(page));
      const res = await fetch(`/api/admin/billing?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setRows(data.subscriptions ?? []);
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [plan, status, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  function fmtCurrency(n: number) {
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing & Revenue</h1>
        <p className="text-sm text-muted-foreground">
          Monitor recurring revenue and manage subscriptions across the platform.
        </p>
      </div>

      {/* Revenue summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Monthly Recurring Revenue</CardDescription>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? fmtCurrency(summary.mrr) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Annual Run Rate</CardDescription>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? fmtCurrency(summary.arr) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Active Subscriptions</CardDescription>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeSubscriptions ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Revenue (paid)</CardDescription>
            <Users className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? fmtCurrency(summary.totalRevenue) : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan breakdown */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Subscriptions by Plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {summary.byPlan.map((b) => (
              <div
                key={b.plan}
                className="flex items-center gap-2 rounded-lg border px-4 py-2"
              >
                <Badge className={PLAN_STYLES[b.plan]}>{b.name}</Badge>
                <span className="text-lg font-semibold">{b.activeCount}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="pl-8"
              />
            </div>
            <select
              value={plan}
              onChange={(e) => {
                setPlan(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {PLAN_FILTERS.map((p) => (
                <option key={p} value={p}>
                  {p || 'All plans'}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s || 'All statuses'}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No subscriptions found.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Generations</TableHead>
                    <TableHead>Renews</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.user.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{s.user.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={PLAN_STYLES[s.plan]}>{s.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[s.status]}>{s.status}</Badge>
                        {s.cancelAtPeriodEnd && (
                          <span className="ml-1 text-xs text-amber-600">(canceling)</span>
                        )}
                      </TableCell>
                      <TableCell>{s.generationsUsed}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.currentPeriodEnd
                          ? new Date(s.currentPeriodEnd).toLocaleDateString()
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
