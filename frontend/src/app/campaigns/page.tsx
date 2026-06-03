'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { Megaphone, Plus, X, Save, Sparkles, ChevronRight } from 'lucide-react';
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

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAUSED: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-blue-50 text-blue-700',
  ARCHIVED: 'bg-zinc-200 text-zinc-500',
};

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
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
            <p className="text-muted-foreground">Organize generated content into campaigns</p>
          </div>
          {canCreate && !showForm && (
            <Button onClick={() => setShowForm(true)} disabled={brands.length === 0}>
              <Plus className="mr-1 h-4 w-4" />New Campaign
            </Button>
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
          <Card>
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
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-1 h-4 w-4" />{saving ? 'Creating…' : 'Create'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  <X className="mr-1 h-4 w-4" />Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Megaphone className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">No campaigns yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                {canCreate ? 'Create your first campaign to get started' : 'No campaigns to display'}
              </p>
              {canCreate && brands.length > 0 && (
                <Button onClick={() => setShowForm(true)}><Plus className="mr-1 h-4 w-4" />Create Campaign</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                      <Megaphone className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {c.brandName && <span>{c.brandName}</span>}
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />{c.generationCount} generation{c.generationCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className={STATUS_STYLES[c.status] ?? ''}>{c.status}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
