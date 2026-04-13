'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Sparkles, Database, Megaphone, BarChart3, TrendingUp, DollarSign,
  Users, ArrowRight, FileText, Building2,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: session } = useSession() || {};
  const [stats, setStats] = useState<any>({ brands: 0, documents: 0 });

  useEffect(() => {
    fetch('/api/brands').then((r: any) => r?.json?.()).then((d: any) => setStats((s: any) => ({ ...(s ?? {}), brands: (d ?? [])?.length ?? 0 }))).catch(() => {});
    fetch('/api/documents').then((r: any) => r?.json?.()).then((d: any) => setStats((s: any) => ({ ...(s ?? {}), documents: (d ?? [])?.length ?? 0 }))).catch(() => {});
  }, []);

  const quickActions = [
    { title: 'Generate Campaign', description: 'Use AI agents to create marketing content', href: '/campaign-generator', icon: Sparkles, color: 'bg-violet-50 text-violet-600' },
    { title: 'Upload Materials', description: 'Add brand documents to the Context Vault', href: '/context-vault', icon: Database, color: 'bg-blue-50 text-blue-600' },
    { title: 'View Analytics', description: 'Track campaign performance and ROI', href: '/analytics', icon: BarChart3, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Manage Campaigns', description: 'View and edit existing campaigns', href: '/campaigns', icon: Megaphone, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <>
      <DashboardHeader title="Dashboard" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back{session?.user?.name ? `, ${session.user.name}` : ''}</h2>
          <p className="text-muted-foreground">Your marketing orchestration command center</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50"><Building2 className="h-5 w-5 text-violet-600" /></div>
              <div><p className="text-2xl font-bold">{stats?.brands ?? 0}</p><p className="text-xs text-muted-foreground">Brand Profiles</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50"><FileText className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-2xl font-bold">{stats?.documents ?? 0}</p><p className="text-xs text-muted-foreground">Documents Uploaded</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="text-2xl font-bold">—</p><p className="text-xs text-muted-foreground">Active Campaigns</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50"><DollarSign className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-2xl font-bold">—</p><p className="text-xs text-muted-foreground">Total Revenue</p></div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold">Quick Actions</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {quickActions?.map?.((action: any) => (
              <Link key={action?.href ?? ''} href={action?.href ?? '#'}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="flex items-start gap-4 pt-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action?.color ?? ''}`}>
                      {action?.icon && <action.icon className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{action?.title ?? ''}</p>
                      <p className="text-sm text-muted-foreground">{action?.description ?? ''}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 mt-1 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            )) ?? []}
          </div>
        </div>
      </div>
    </>
  );
}
