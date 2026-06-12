'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles, Database, Megaphone, BarChart3, TrendingUp, DollarSign,
  ArrowRight, FileText, Building2,
} from 'lucide-react';
import { CountUp } from '@/components/ui/animated/CountUp';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function DashboardPage() {
  const { data: session } = useSession() || {};
  const [stats, setStats] = useState<any>({ brands: 0, documents: 0 });

  useEffect(() => {
    fetch('/api/brands').then((r: any) => r?.json?.()).then((d: any) => setStats((s: any) => ({ ...(s ?? {}), brands: (d ?? [])?.length ?? 0 }))).catch(() => {});
    fetch('/api/documents').then((r: any) => r?.json?.()).then((d: any) => setStats((s: any) => ({ ...(s ?? {}), documents: (d ?? [])?.length ?? 0 }))).catch(() => {});
  }, []);

  const metricCards = [
    { value: stats?.brands ?? 0, label: 'Brand Profiles', icon: Building2, tint: 'from-violet-500/15 to-purple-500/10', fg: 'text-violet-600' },
    { value: stats?.documents ?? 0, label: 'Documents Uploaded', icon: FileText, tint: 'from-blue-500/15 to-cyan-500/10', fg: 'text-blue-600' },
    { value: null, label: 'Active Campaigns', icon: TrendingUp, tint: 'from-emerald-500/15 to-teal-500/10', fg: 'text-emerald-600' },
    { value: null, label: 'Total Revenue', icon: DollarSign, tint: 'from-amber-500/15 to-orange-500/10', fg: 'text-amber-600' },
  ];

  const quickActions = [
    { title: 'Generate Campaign', description: 'Use AI agents to create marketing content', href: '/campaign-generator', icon: Sparkles, color: 'bg-violet-50 text-violet-600' },
    { title: 'Upload Materials', description: 'Add brand documents to the Context Vault', href: '/context-vault', icon: Database, color: 'bg-blue-50 text-blue-600' },
    { title: 'View Analytics', description: 'Track campaign performance and ROI', href: '/analytics', icon: BarChart3, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Manage Campaigns', description: 'View and edit existing campaigns', href: '/campaigns', icon: Megaphone, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <>
      <DashboardHeader title="Dashboard" />
      <div className="bg-mesh flex-1 space-y-6 p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back
            {session?.user?.name ? (
              <span className="text-gradient">, {session.user.name}</span>
            ) : ''}
          </h2>
          <p className="text-muted-foreground">Your marketing orchestration command center</p>
        </motion.div>

        {/* Stat cards — glassmorphism + count-up + stagger */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {metricCards.map((m) => {
            const Icon = m.icon;
            return (
              <motion.div key={m.label} variants={item} whileHover={{ y: -4 }}>
                <Card className="glass gradient-border overflow-hidden transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(99,102,241,0.25)]">
                  <CardContent className="flex items-center gap-3 pt-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${m.tint}`}>
                      <Icon className={`h-5 w-5 ${m.fg}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {m.value === null ? '—' : <CountUp value={m.value} />}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        <div>
          <h3 className="mb-3 text-lg font-semibold">Quick Actions</h3>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-2"
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.div key={action.href} variants={item} whileHover={{ y: -4 }}>
                  <Link href={action.href}>
                    <Card className="group cursor-pointer transition-all hover:shadow-[0_12px_32px_-8px_rgba(99,102,241,0.25)]">
                      <CardContent className="flex items-start gap-4 pt-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${action.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{action.title}</p>
                          <p className="text-sm text-muted-foreground">{action.description}</p>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-violet-600" />
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </>
  );
}
