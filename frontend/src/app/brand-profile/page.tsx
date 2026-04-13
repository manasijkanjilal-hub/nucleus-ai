'use client';
import { useEffect, useState } from 'react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface BrandProfile {
  id: string;
  name: string;
  industry: string | null;
  targetAudience: string | null;
  brandVoice: string | null;
  description: string | null;
}

export default function BrandProfilePage() {
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', targetAudience: '', brandVoice: '', description: '' });

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      const data = await res?.json?.().catch(() => []);
      setBrands(Array.isArray(data) ? data : []);
    } catch { setBrands([]); } finally { setLoading(false); }
  };

  useEffect(() => { fetchBrands(); }, []);

  const handleSave = async () => {
    if (!form?.name?.trim?.()) { toast.error('Brand name is required'); return; }
    try {
      const url = editing ? `/api/brands/${editing}` : '/api/brands';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res?.ok) throw new Error();
      toast.success(editing ? 'Brand updated' : 'Brand created');
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', industry: '', targetAudience: '', brandVoice: '', description: '' });
      fetchBrands();
    } catch { toast.error('Failed to save brand'); }
  };

  const handleEdit = (brand: BrandProfile) => {
    setEditing(brand?.id ?? null);
    setForm({
      name: brand?.name ?? '',
      industry: brand?.industry ?? '',
      targetAudience: brand?.targetAudience ?? '',
      brandVoice: brand?.brandVoice ?? '',
      description: brand?.description ?? '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brand profile?')) return;
    try {
      await fetch(`/api/brands/${id}`, { method: 'DELETE' });
      toast.success('Brand deleted');
      fetchBrands();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <>
      <DashboardHeader title="Brand Profile" />
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Brand Profiles</h2>
            <p className="text-muted-foreground">Manage your brand identity and voice for AI-generated content</p>
          </div>
          {!showForm && (
            <Button onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', industry: '', targetAudience: '', brandVoice: '', description: '' }); }}>
              <Plus className="mr-1 h-4 w-4" /> New Brand
            </Button>
          )}
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editing ? 'Edit Brand' : 'Create Brand Profile'}</CardTitle>
              <CardDescription>Define your brand identity for AI-powered content generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand Name *</Label>
                  <Input value={form?.name ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...(f ?? {}), name: e.target?.value ?? '' }))} placeholder="Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input value={form?.industry ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...(f ?? {}), industry: e.target?.value ?? '' }))} placeholder="Technology, SaaS" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Input value={form?.targetAudience ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...(f ?? {}), targetAudience: e.target?.value ?? '' }))} placeholder="B2B SaaS decision makers, 25-45" />
              </div>
              <div className="space-y-2">
                <Label>Brand Voice</Label>
                <Textarea value={form?.brandVoice ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...(f ?? {}), brandVoice: e.target?.value ?? '' }))} placeholder="Professional, innovative, approachable..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form?.description ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...(f ?? {}), description: e.target?.value ?? '' }))} placeholder="Brief description of your brand..." rows={3} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave}><Save className="mr-1 h-4 w-4" />{editing ? 'Update' : 'Create'}</Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}><X className="mr-1 h-4 w-4" />Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">{[1, 2].map((i: number) => <Card key={i}><CardContent className="h-32 animate-pulse bg-muted" /></Card>)}</div>
        ) : (brands ?? [])?.length === 0 && !showForm ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">No brand profiles yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first brand to get started</p>
              <Button onClick={() => setShowForm(true)}><Plus className="mr-1 h-4 w-4" /> Create Brand</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(brands ?? [])?.map?.((brand: BrandProfile) => (
              <Card key={brand?.id ?? ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />{brand?.name ?? 'Unnamed'}</CardTitle>
                      {brand?.industry && <CardDescription>{brand.industry}</CardDescription>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(brand)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(brand?.id ?? '')}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {brand?.targetAudience && <div><span className="text-muted-foreground">Audience:</span> {brand.targetAudience}</div>}
                  {brand?.brandVoice && <div><span className="text-muted-foreground">Voice:</span> {brand.brandVoice}</div>}
                  {brand?.description && <div className="text-muted-foreground">{brand.description}</div>}
                </CardContent>
              </Card>
            )) ?? []}
          </div>
        )}
      </div>
    </>
  );
}
