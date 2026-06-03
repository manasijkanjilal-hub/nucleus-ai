'use client';

// =============================================================================
// Nucleus AI — Admin Dashboard
// =============================================================================
// Overview of platform metrics: user / brand / campaign / document counts,
// signup trend + role distribution charts, recent activity feed, quick actions.
// =============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  Megaphone,
  FileText,
  UserPlus,
  Plus,
  Activity,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Stats {
  users: {
    total: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
  };
  brands: { total: number };
  campaigns: { total: number; byStatus: Record<string, number>; active: number };
  documents: { total: number };
  signupTrend: { date: string; users: number }[];
  recentActivity: {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    actor: string;
    createdAt: string;
  }[];
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: '#7c3aed',
  ADMIN: '#2563eb',
  EDITOR: '#0d9488',
  VIEWER: '#64748b',
};

function MetricCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load stats');
        }
        const data = (await res.json()) as Stats;
        if (active) setStats(data);
      } catch (e: any) {
        if (active) setError(e?.message ?? 'Failed to load stats');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">{error ?? 'No data available'}</p>
        </CardContent>
      </Card>
    );
  }

  const roleData = Object.entries(stats.users.byRole).map(([role, count]) => ({
    role,
    count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Platform overview and key metrics.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={stats.users.total}
          icon={Users}
          hint={`${stats.users.byStatus.ACTIVE ?? 0} active · ${
            stats.users.byStatus.SUSPENDED ?? 0
          } suspended`}
        />
        <MetricCard
          title="Brands"
          value={stats.brands.total}
          icon={Building2}
        />
        <MetricCard
          title="Campaigns"
          value={stats.campaigns.total}
          icon={Megaphone}
          hint={`${stats.campaigns.active} active`}
        />
        <MetricCard
          title="Documents"
          value={stats.documents.total}
          icon={FileText}
        />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button render={<Link href="/admin/users?action=invite" />}>
            <UserPlus className="h-4 w-4" />
            Invite User
          </Button>
          <Button variant="outline" render={<Link href="/admin/users?action=create" />}>
            <Plus className="h-4 w-4" />
            Create User
          </Button>
          <Button variant="outline" render={<Link href="/admin/brands?action=create" />}>
            <Building2 className="h-4 w-4" />
            New Brand
          </Button>
          <Button variant="ghost" render={<Link href="/admin/users" />}>
            <Users className="h-4 w-4" />
            Manage Users
          </Button>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Signups (7 days)</CardTitle>
            <CardDescription>Daily user registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.signupTrend} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#signupGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users by Role</CardTitle>
            <CardDescription>Role distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={roleData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="role" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {roleData.map((entry) => (
                    <Cell
                      key={entry.role}
                      fill={ROLE_COLORS[entry.role] ?? '#64748b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>Latest audit log entries</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No recent activity.
            </p>
          ) : (
            <ul className="divide-y">
              {stats.recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {item.action}{' '}
                        <span className="font-normal text-muted-foreground">
                          on {item.entity}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        by {item.actor}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.entity}</Badge>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
