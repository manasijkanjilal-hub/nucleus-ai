'use client';
import { useEffect, useState } from 'react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Plus, Pencil, Trash2, X, Save, DollarSign, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  brand_id: string | null;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', status: 'draft', budget: '', start_date: '', end_date: '' });

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/v1/campaigns`);
      if (res?.ok) {
        const data = await res?.json?.().catch(() => []);
        setCampaigns(Array.isArray(data) ? data : (data?.campaigns ?? []));
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleSave = async () => {
    if (!form?.name?.trim?.()) { toast.error('Campaign name required'); return; }
    try {
      const body: any = {
        name: form.name,
        status: form.status || 'draft',
        budget: form.budget ? parseFloat(form.budget) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      const url = editingId ? `${BACKEND}/api/v1/campaigns/${editingId}` : `${BACKEND}/api/v1/campaigns`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res?.ok) throw new Error();
      toast.success(editingId ? 'Campaign updated' : 'Campaign created');
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', status: 'draft', budget: '', start_date: '', end_date: '' });
      fetchCampaigns();
    } catch { toast.error('Failed to save campaign'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await fetch(`${BACKEND}/api/v1/campaigns/${id}`, { method: 'DELETE' });
      toast.success('Campaign deleted');
      fetchCampaigns();
    } catch { toast.error('Failed to delete'); }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    draft: 'bg-zinc-100 text-zinc-700',
    paused: 'bg-amber-50 text-amber-700',
    completed: 'bg-blue-50 text-blue-700',
  };

  return (
    <>
      <DashboardHeader title="Campaigns" />
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
            <p className="text-muted-foreground">Manage and track your marketing campaigns</p>
          </div>
          {!showForm && (
            <Button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', status: 'draft', budget: '', start_date: '', end_date: '' }); }}>
              <Plus className="mr-1 h-4 w-4" />New Campaign
            </Button>
          )}
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? 'Edit Campaign' : 'Create Campaign'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Campaign Name *</Label>
                  <Input value={form?.name ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...(f ?? {}), name: e.target?.value ?? '' }))} placeholder="Q3 Product Launch" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form?.status ?? 'draft'} onChange={(e: any) => setForm((f: any) => ({ ...(f ?? {}), status: e.target?.value ?? 'draft' }))}>
                    <option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Budget ($)</Label>
                  <Input type="number" value={form?.budget ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...(f ?? {}), budget: e.target?.value ?? '' }))} placeholder="10000" />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={form?.start_date ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...(f ?? {}), start_date: e.target?.value ?? '' }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave}><Save className="mr-1 h-4 w-4" />{editingId ? 'Update' : 'Create'}</Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}><X className="mr-1 h-4 w-4" />Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i: number) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : (campaigns ?? [])?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Megaphone className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">No campaigns yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first campaign to get started</p>
              <Button onClick={() => setShowForm(true)}><Plus className="mr-1 h-4 w-4" />Create Campaign</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(campaigns ?? [])?.map?.((c: Campaign) => (
              <Card key={c?.id ?? ''}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <Megaphone className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c?.name ?? 'Unnamed'}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {c?.budget != null && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{Number(c.budget).toLocaleString()}</span>}
                      {c?.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{c.start_date?.slice?.(0, 10)}</span>}
                    </div>
                  </div>
                  <Badge variant="secondary" className={statusColors[c?.status ?? ''] ?? ''}>{c?.status ?? 'draft'}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => {
                      setEditingId(c?.id ?? null);
                      setForm({ name: c?.name ?? '', status: c?.status ?? 'draft', budget: c?.budget != null ? String(c.budget) : '', start_date: c?.start_date?.slice?.(0, 10) ?? '', end_date: c?.end_date?.slice?.(0, 10) ?? '' });
                      setShowForm(true);
                    }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c?.id ?? '')}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            )) ?? []}
          </div>
        )}
      </div>
    </>
  );
}
