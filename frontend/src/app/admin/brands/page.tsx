'use client';

// =============================================================================
// Nucleus AI — Admin: Brand Management
// =============================================================================
// Data table of brand profiles with search + pagination and full CRUD via a
// dialog form (all brand fields incl. industry, voice, colors, guidelines).
// =============================================================================

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface Brand {
  id: string;
  name: string;
  industry: string | null;
  targetAudience: string | null;
  brandVoice: string | null;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  brandColors: string[] | null;
  guidelines: string | null;
  user: { id: string; name: string | null; email: string } | null;
  _count: { campaigns: number; documents: number };
  createdAt: string;
}

const INDUSTRIES = [
  'Technology',
  'E-commerce',
  'Finance',
  'Healthcare',
  'Education',
  'Food & Beverage',
  'Fashion',
  'Travel',
  'Real Estate',
  'Entertainment',
  'Marketing',
  'Manufacturing',
  'Non-profit',
  'Other',
];

const selectClass =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface BrandFormState {
  name: string;
  industry: string;
  targetAudience: string;
  brandVoice: string;
  description: string;
  website: string;
  logoUrl: string;
  guidelines: string;
  brandColors: string[];
}

const emptyForm: BrandFormState = {
  name: '',
  industry: '',
  targetAudience: '',
  brandVoice: '',
  description: '',
  website: '',
  logoUrl: '',
  guidelines: '',
  brandColors: [],
};

function BrandsPageInner() {
  const { can } = usePermissions();
  const searchParams = useSearchParams();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [deleteBrand, setDeleteBrand] = useState<Brand | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setEditing(null);
      setFormOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/brands?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load brands');
      const data = await res.json();
      setBrands(data.brands);
      setTotalPages(data.pagination.totalPages || 1);
      setTotal(data.pagination.total || 0);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load brands');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (b: Brand) => {
    setEditing(b);
    setFormOpen(true);
  };

  const doDelete = async () => {
    if (!deleteBrand) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/brands/${deleteBrand.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success('Brand deleted');
      setDeleteBrand(null);
      fetchBrands();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete brand');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Brands</h2>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'brand' : 'brands'} total
          </p>
        </div>
        {can('brand:create') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Brand
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or industry…"
              className="pl-9"
              value={search}
              onChange={(e: any) => setSearch(e.target?.value ?? '')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Colors</TableHead>
                <TableHead>Campaigns</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : brands.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No brands found.
                  </TableCell>
                </TableRow>
              ) : (
                brands.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{b.name}</span>
                        {b.website && (
                          <span className="text-xs text-muted-foreground">
                            {b.website}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.industry ? (
                        <Badge variant="outline">{b.industry}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.user?.name ?? b.user?.email ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(b.brandColors ?? []).slice(0, 5).map((c, i) => (
                          <span
                            key={`${c}-${i}`}
                            className="h-4 w-4 rounded-full border"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                        {(!b.brandColors || b.brandColors.length === 0) && (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b._count.campaigns}
                    </TableCell>
                    <TableCell>
                      {(can('brand:update') || can('brand:delete')) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                              />
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {can('brand:update') && (
                              <DropdownMenuItem onClick={() => openEdit(b)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {can('brand:delete') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteBrand(b)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <BrandFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        brand={editing}
        onSuccess={fetchBrands}
      />

      <AlertDialog
        open={!!deleteBrand}
        onOpenChange={(o: boolean) => !o && setDeleteBrand(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete brand?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteBrand?.name}</strong> and
              its associated campaigns &amp; documents. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => doDelete()}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===========================================================================
// Brand create/edit form dialog
// ===========================================================================
function BrandFormDialog({
  open,
  onOpenChange,
  brand,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  brand: Brand | null;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<BrandFormState>(emptyForm);
  const [newColor, setNewColor] = useState('#2563eb');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      if (brand) {
        setForm({
          name: brand.name ?? '',
          industry: brand.industry ?? '',
          targetAudience: brand.targetAudience ?? '',
          brandVoice: brand.brandVoice ?? '',
          description: brand.description ?? '',
          website: brand.website ?? '',
          logoUrl: brand.logoUrl ?? '',
          guidelines: brand.guidelines ?? '',
          brandColors: brand.brandColors ?? [],
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, brand]);

  const set = <K extends keyof BrandFormState>(key: K, value: BrandFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addColor = () => {
    if (newColor && !form.brandColors.includes(newColor)) {
      set('brandColors', [...form.brandColors, newColor]);
    }
  };
  const removeColor = (c: string) =>
    set('brandColors', form.brandColors.filter((x) => x !== c));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Brand name is required';
    if (form.website && !/^https?:\/\/.+/.test(form.website))
      e.website = 'Must be a valid URL (http(s)://…)';
    if (form.logoUrl && !/^https?:\/\/.+/.test(form.logoUrl))
      e.logoUrl = 'Must be a valid URL (http(s)://…)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        industry: form.industry,
        targetAudience: form.targetAudience,
        brandVoice: form.brandVoice,
        description: form.description,
        website: form.website,
        logoUrl: form.logoUrl,
        guidelines: form.guidelines,
        brandColors: form.brandColors,
      };
      const res = await fetch(
        brand ? `/api/admin/brands/${brand.id}` : '/api/admin/brands',
        {
          method: brand ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success(brand ? 'Brand updated' : 'Brand created');
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{brand ? 'Edit Brand' : 'New Brand'}</DialogTitle>
          <DialogDescription>
            {brand
              ? 'Update brand profile details.'
              : 'Create a new brand profile.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="b-name">Name *</Label>
            <Input
              id="b-name"
              value={form.name}
              onChange={(e: any) => set('name', e.target?.value ?? '')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-industry">Industry</Label>
            <select
              id="b-industry"
              className={selectClass}
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
            >
              <option value="">Select industry…</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-website">Website</Label>
            <Input
              id="b-website"
              placeholder="https://example.com"
              value={form.website}
              onChange={(e: any) => set('website', e.target?.value ?? '')}
            />
            {errors.website && (
              <p className="text-xs text-destructive">{errors.website}</p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="b-logo">Logo URL</Label>
            <Input
              id="b-logo"
              placeholder="https://i.ytimg.com/vi/HLG0FYYeuws/maxresdefault.jpg"
              value={form.logoUrl}
              onChange={(e: any) => set('logoUrl', e.target?.value ?? '')}
            />
            {errors.logoUrl && (
              <p className="text-xs text-destructive">{errors.logoUrl}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-audience">Target Audience</Label>
            <Input
              id="b-audience"
              value={form.targetAudience}
              onChange={(e: any) => set('targetAudience', e.target?.value ?? '')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-voice">Brand Voice</Label>
            <Input
              id="b-voice"
              placeholder="e.g. Friendly, professional"
              value={form.brandVoice}
              onChange={(e: any) => set('brandVoice', e.target?.value ?? '')}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="b-desc">Description</Label>
            <textarea
              id="b-desc"
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="b-guidelines">Brand Guidelines</Label>
            <textarea
              id="b-guidelines"
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={form.guidelines}
              onChange={(e) => set('guidelines', e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Brand Colors</Label>
            <div className="flex flex-wrap items-center gap-2">
              {form.brandColors.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full border py-0.5 pl-1 pr-2 text-xs"
                >
                  <span
                    className="h-4 w-4 rounded-full border"
                    style={{ backgroundColor: c }}
                  />
                  {c}
                  <button
                    type="button"
                    onClick={() => removeColor(c)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
              />
              <Input
                value={newColor}
                onChange={(e: any) => setNewColor(e.target?.value ?? '')}
                className="w-32"
              />
              <Button type="button" variant="outline" size="sm" onClick={addColor}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : brand ? 'Save Changes' : 'Create Brand'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminBrandsPage() {
  return (
    <Suspense fallback={null}>
      <BrandsPageInner />
    </Suspense>
  );
}
