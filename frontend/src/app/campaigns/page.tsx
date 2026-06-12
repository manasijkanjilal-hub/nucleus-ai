'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/button-gradient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { usePermissions } from '@/hooks/usePermissions';
import { Megaphone, Plus, X, Save, Sparkles, ArrowUpRight } from 'lucide-react';
import { STATUS_TOKENS, staggerContainer, staggerItem } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  brandId: string;
  brandName: string | null;
  generationCount: number;
  updatedAt: string;
}

export default function CampaignsPage() {
  const { can } = usePermissions();
  const canCreate = can('campaign:create');

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', brandId: '', description: '' });

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json().catch(() => []);
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setBrands(list);
      setForm((f) => ({ ...f, brandId: f.brandId || (list[0]?.id ?? '') }));
    } catch {
      setBrands([]);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchBrands();
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Campaign name required'); return; }
    if (!form.brandId) { toast.error('Please select a brand'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          brandId: form.brandId,
          description: form.description.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create campaign');
      toast.success('Campaign created');
      setShowForm(false);
      setForm({ name: '', brandId: brands[0]?.id ?? '', description: '' });
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DashboardHeader title="Campaigns" />
      <div className="flex-1 space-y-6 bg-mesh p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
            <p className="text-muted-foreground">Organize generated content into campaigns</p>
          </div>
          {canCreate && !showForm && (
            <GradientButton onClick={() => setShowForm(true)} disabled={brands.length === 0}>
              <Plus className="mr-1 h-4 w-4" />New Campaign
            </GradientButton>
          )}
        </div>

        {canCreate && brands.length === 0 && !loading && (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Create a brand first before you can add campaigns.
            </CardContent>
          </Card>
        )}

        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="glass gradient-border">
              <CardHeader>
                <CardTitle>Create Campaign</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Campaign Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e: any) => setForm((f) => ({ ...f, name: e.target?.value ?? '' }))}
                      placeholder="Q3 Product Launch"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Brand *</Label>
                    <select
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      value={form.brandId}
                      onChange={(e: any) => setForm((f) => ({ ...f, brandId: e.target?.value ?? '' }))}
                    >
                      {brands.map((b: any) => (
                        <option key={b?.id ?? ''} value={b?.id ?? ''}>{b?.name ?? ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e: any) => setForm((f) => ({ ...f, description: e.target?.value ?? '' }))}
                    placeholder="What is this campaign about?"
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <GradientButton onClick={handleSave} disabled={saving} loading={saving}>
                    <Save className="mr-1 h-4 w-4" />{saving ? 'Creating…' : 'Create'}
                  </GradientButton>
                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    <X className="mr-1 h-4 w-4" />Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Megaphone}
                title="No campaigns yet"
                description={
                  canCreate
                    ? 'Create your first campaign to organize your AI-generated content.'
                    : 'No campaigns to display.'
                }
                action={
                  canCreate && brands.length > 0 ? (
                    <GradientButton onClick={() => setShowForm(true)}>
                      <Plus className="mr-1 h-4 w-4" />Create Campaign
                    </GradientButton>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {campaigns.map((c) => {
              const token = STATUS_TOKENS[c.status] ?? { label: c.status, className: '' };
              return (
                <motion.div key={c.id} variants={staggerItem} whileHover={{ y: -4 }}>
                  <Link href={`/campaigns/${c.id}`} className="group block h-full">
                    <Card className="h-full overflow-hidden transition-shadow duration-200 hover:shadow-[0_12px_32px_-8px_rgba(99,102,241,0.25)]">
                      <CardContent className="flex h-full flex-col gap-3 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-[0_8px_20px_-6px_rgba(139,92,246,0.5)]">
                            <Megaphone className="h-5 w-5" />
                          </div>
                          <Badge variant="secondary" className={cn('shrink-0', token.className)}>
                            {token.label}
                          </Badge>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold tracking-tight">
                            {c.name}
                          </p>
                          {c.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {c.description}
                            </p>
                          ) : (
                            c.brandName && (
                              <p className="mt-1 text-sm text-muted-foreground">{c.brandName}</p>
                            )
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5" />
                            {c.generationCount} generation{c.generationCount === 1 ? '' : 's'}
                          </span>
                          <span className="inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                            Open <ArrowUpRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </>
  );
}
