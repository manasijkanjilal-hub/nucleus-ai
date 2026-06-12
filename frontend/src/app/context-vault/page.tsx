'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Database,
  Upload,
  FileText,
  Search,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DocItem {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'TXT' | 'WEB';
  fileSize: number | null;
  mimeType: string | null;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  embeddingStatus: string;
  chunkCount: number;
  wordCount: number;
  errorMessage: string | null;
  createdAt: string;
  brand?: { id: string; name: string } | null;
  uploader?: { id: string; name: string | null; email: string } | null;
  metadata?: any;
}

interface SearchResult {
  documentId: string;
  documentName: string;
  documentType: string | null;
  brand: { id: string; name: string } | null;
  chunkIndex: number;
  text: string;
  score: number;
}

const ACCEPTED = '.pdf,.docx,.doc,.txt,.md';
const MAX_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatBytes(bytes: number | null): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: DocItem['processingStatus']) {
  switch (status) {
    case 'COMPLETED':
      return (
        <Badge variant="default" className="bg-green-600/15 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Badge>
      );
    case 'PROCESSING':
      return (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 animate-spin" /> Processing
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3" /> Pending
        </Badge>
      );
  }
}

/** Highlight query terms within a snippet. */
function highlight(text: string, query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (terms.length === 0) return text;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark key={i} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-500/30">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// ===========================================================================
// Page
// ===========================================================================
export default function ContextVaultPage() {
  const { can } = usePermissions();
  const canUpload = can('document:create');
  const canDelete = can('document:delete');
  const canUpdate = can('document:update');

  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('');

  // Upload state
  const [uploads, setUploads] = useState<
    { name: string; status: 'uploading' | 'done' | 'error'; error?: string }[]
  >([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Table filters
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Semantic search
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);

  // Dialogs
  const [detailDoc, setDetailDoc] = useState<DocItem | null>(null);
  const [detailChunks, setDetailChunks] = useState<
    { chunkIndex: number; text: string }[]
  >([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<DocItem | null>(null);
  const [busy, setBusy] = useState(false);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      if (filterText) params.set('q', filterText);
      const res = await fetch(`/api/documents?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, filterText]);

  const fetchBrands = useCallback(async () => {
    try {
      const res = await fetch('/api/brands');
      const data = await res.json().catch(() => []);
      setBrands(Array.isArray(data) ? data : data?.brands ?? []);
    } catch {
      setBrands([]);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  // Debounced re-fetch when filters change.
  useEffect(() => {
    const t = setTimeout(fetchDocuments, 300);
    return () => clearTimeout(t);
  }, [fetchDocuments]);

  // Poll while anything is processing.
  useEffect(() => {
    const anyProcessing = documents.some(
      (d) => d.processingStatus === 'PROCESSING' || d.processingStatus === 'PENDING'
    );
    if (!anyProcessing) return;
    const t = setInterval(fetchDocuments, 3000);
    return () => clearInterval(t);
  }, [documents, fetchDocuments]);

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------
  const validateClientSide = (file: File): string | null => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED.split(',').includes(ext)) return 'Unsupported file type';
    if (file.size > MAX_BYTES) return 'File exceeds 10MB limit';
    if (file.size === 0) return 'File is empty';
    return null;
  };

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!canUpload) {
        toast.error('You do not have permission to upload documents');
        return;
      }
      if (files.length === 0) return;

      // Client-side validation first.
      const valid: File[] = [];
      const initial: typeof uploads = [];
      for (const f of files) {
        const err = validateClientSide(f);
        if (err) {
          initial.push({ name: f.name, status: 'error', error: err });
        } else {
          valid.push(f);
          initial.push({ name: f.name, status: 'uploading' });
        }
      }
      setUploads(initial);

      if (valid.length === 0) {
        toast.error('No valid files to upload');
        return;
      }

      const form = new FormData();
      valid.forEach((f) => form.append('files', f));
      if (selectedBrand) form.append('brandId', selectedBrand);

      try {
        const res = await fetch('/api/documents', { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));

        if (res.status === 429) {
          toast.error(data?.error ?? 'Upload rate limit exceeded');
          setUploads((prev) =>
            prev.map((u) =>
              u.status === 'uploading' ? { ...u, status: 'error', error: 'Rate limited' } : u
            )
          );
          return;
        }

        const results: any[] = Array.isArray(data?.results) ? data.results : [];
        setUploads((prev) =>
          prev.map((u) => {
            if (u.status === 'error') return u;
            const r = results.find((x) => x.fileName === u.name);
            if (!r) return { ...u, status: 'error', error: 'No result' };
            return r.success
              ? { ...u, status: 'done' }
              : { ...u, status: 'error', error: r.error ?? 'Failed' };
          })
        );

        const ok = results.filter((r) => r.success).length;
        const failed = results.length - ok;
        if (ok > 0) toast.success(`${ok} document${ok > 1 ? 's' : ''} processed`);
        if (failed > 0) toast.error(`${failed} document${failed > 1 ? 's' : ''} failed`);

        fetchDocuments();
      } catch (err: any) {
        toast.error(err?.message ?? 'Upload failed');
        setUploads((prev) =>
          prev.map((u) =>
            u.status === 'uploading' ? { ...u, status: 'error', error: 'Network error' } : u
          )
        );
      }
    },
    [canUpload, selectedBrand, fetchDocuments]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) uploadFiles(files);
    },
    [uploadFiles]
  );

  // -------------------------------------------------------------------------
  // Semantic search
  // -------------------------------------------------------------------------
  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          brandId: selectedBrand || null,
          limit: 10,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Search failed');
        setSearchResults([]);
        return;
      }
      setSearchResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      toast.error('Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, selectedBrand]);

  // -------------------------------------------------------------------------
  // Per-document actions
  // -------------------------------------------------------------------------
  const openDetails = async (doc: DocItem) => {
    setDetailDoc(doc);
    setDetailChunks([]);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      const data = await res.json().catch(() => ({}));
      setDetailChunks(Array.isArray(data?.chunks) ? data.chunks : []);
    } catch {
      /* noop */
    } finally {
      setDetailLoading(false);
    }
  };

  const reprocess = async (doc: DocItem) => {
    toast.loading('Reprocessing…', { id: `rp-${doc.id}` });
    try {
      const res = await fetch(`/api/documents/${doc.id}/process`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        toast.success('Document reprocessed', { id: `rp-${doc.id}` });
      } else {
        toast.error(data?.result?.error ?? data?.error ?? 'Reprocess failed', {
          id: `rp-${doc.id}`,
        });
      }
      fetchDocuments();
    } catch {
      toast.error('Reprocess failed', { id: `rp-${doc.id}` });
    }
  };

  const confirmDelete = async () => {
    if (!deleteDoc) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${deleteDoc.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Document deleted');
        setDeleteDoc(null);
        fetchDocuments();
      } else {
        toast.error(data?.error ?? 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const hasDocs = documents.length > 0;

  return (
    <>
      <DashboardHeader title="Context Vault" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Context Vault</h2>
          <p className="text-muted-foreground">
            Upload documents to build a searchable knowledge base for AI-generated content.
          </p>
        </div>

        {/* Brand selector */}
        {brands.length > 0 && (
          <div className="flex flex-col gap-2 sm:max-w-xs">
            <Label htmlFor="brand-select">Brand context (optional)</Label>
            <select
              id="brand-select"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={selectedBrand}
              onChange={(e: any) => setSelectedBrand(e.target?.value ?? '')}
            >
              <option value="">All brands</option>
              {brands.map((b: any) => (
                <option key={b?.id} value={b?.id}>
                  {b?.name ?? 'Unnamed'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Upload */}
        {canUpload && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Upload Documents
              </CardTitle>
              <CardDescription>
                Drag &amp; drop or browse. PDF, DOCX, TXT, MD — up to 10MB each.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <motion.div
                role="button"
                tabIndex={0}
                animate={{ scale: dragOver ? 1.01 : 1 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {/* Animated gradient glow on drag */}
                <AnimatePresence>
                  {dragOver && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.12 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute inset-0 bg-primary-gradient"
                    />
                  )}
                </AnimatePresence>
                <motion.div
                  animate={dragOver ? { y: -4, scale: 1.1 } : { y: 0, scale: 1 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                    dragOver
                      ? 'bg-primary-gradient text-white shadow-[0_8px_24px_-6px_rgba(139,92,246,0.5)]'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                  }`}
                >
                  <Upload className="h-6 w-6" />
                </motion.div>
                <p className="mb-1 text-sm font-medium">
                  {dragOver ? 'Release to upload' : 'Drop files here or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports multiple files · PDF, DOCX, TXT, MD
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  multiple
                  className="hidden"
                  onChange={(e: any) => {
                    const files = Array.from<File>(e.target?.files ?? []);
                    if (files.length) uploadFiles(files);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                />
              </motion.div>

              {/* Upload progress list */}
              {uploads.length > 0 && (
                <div className="space-y-2">
                  {uploads.map((u, i) => (
                    <div
                      key={`${u.name}-${i}`}
                      className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                    >
                      {u.status === 'uploading' && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      )}
                      {u.status === 'done' && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      )}
                      {u.status === 'error' && (
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                      )}
                      <span className="flex-1 truncate">{u.name}</span>
                      {u.status === 'error' && (
                        <span className="text-xs text-destructive">{u.error}</span>
                      )}
                    </div>
                  ))}
                  {uploads.every((u) => u.status !== 'uploading') && (
                    <Button variant="ghost" size="sm" onClick={() => setUploads([])}>
                      <X className="mr-1 h-3 w-3" /> Clear
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Semantic search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" /> Semantic Search
            </CardTitle>
            <CardDescription>
              Find relevant passages across your documents using meaning, not just keywords.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. What is our brand tone of voice?"
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target?.value ?? '')}
                onKeyDown={(e: any) => {
                  if (e.key === 'Enter') runSearch();
                }}
              />
              <Button onClick={runSearch} disabled={searching || !searchQuery.trim()}>
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-1 hidden sm:inline">Search</span>
              </Button>
              {searchResults !== null && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>

            {searchResults !== null && (
              <div className="space-y-3">
                {searchResults.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No matching passages found.
                  </p>
                ) : (
                  searchResults.map((r, i) => (
                    <div
                      key={`${r.documentId}-${r.chunkIndex}-${i}`}
                      className="rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.documentName}
                        </span>
                        <Badge variant="outline">{(r.score * 100).toFixed(0)}% match</Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {highlight(r.text, searchQuery)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents table */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>{documents.length} document(s) in the vault</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by name…"
                  className="pl-8"
                  value={filterText}
                  onChange={(e: any) => setFilterText(e.target?.value ?? '')}
                />
              </div>
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={filterStatus}
                onChange={(e: any) => setFilterStatus(e.target?.value ?? '')}
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={filterType}
                onChange={(e: any) => setFilterType(e.target?.value ?? '')}
              >
                <option value="">All types</option>
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="TXT">TXT</option>
              </select>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !hasDocs ? (
              <EmptyState
                icon={Database}
                title="No documents yet"
                description={
                  canUpload
                    ? 'Upload your first document to get started.'
                    : 'Documents uploaded to the vault will appear here.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow
                        key={doc.id}
                        className="transition-colors hover:bg-muted/40"
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="max-w-[220px] truncate" title={doc.name}>
                              {doc.name}
                            </span>
                          </div>
                          {doc.brand?.name && (
                            <span className="ml-6 text-xs text-muted-foreground">
                              {doc.brand.name}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatBytes(doc.fileSize)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{statusBadge(doc.processingStatus)}</TableCell>
                        <TableCell className="text-right">
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
                              <DropdownMenuItem onClick={() => openDetails(doc)}>
                                <Eye className="mr-2 h-4 w-4" /> View details
                              </DropdownMenuItem>
                              {canUpdate && (
                                <DropdownMenuItem onClick={() => reprocess(doc)}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Reprocess
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeleteDoc(doc)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details dialog */}
      <Dialog open={!!detailDoc} onOpenChange={(o: boolean) => !o && setDetailDoc(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> {detailDoc?.name}
            </DialogTitle>
            <DialogDescription>Document details and extracted chunks</DialogDescription>
          </DialogHeader>

          {detailDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Meta label="Type" value={detailDoc.type} />
                <Meta label="Size" value={formatBytes(detailDoc.fileSize)} />
                <Meta label="Status" value={detailDoc.processingStatus} />
                <Meta label="Chunks" value={String(detailDoc.chunkCount)} />
                <Meta label="Words" value={String(detailDoc.wordCount)} />
                {detailDoc.metadata?.pageCount != null && (
                  <Meta label="Pages" value={String(detailDoc.metadata.pageCount)} />
                )}
                {detailDoc.brand?.name && (
                  <Meta label="Brand" value={detailDoc.brand.name} />
                )}
                {detailDoc.metadata?.embeddingModel && (
                  <Meta label="Model" value={String(detailDoc.metadata.embeddingModel)} />
                )}
              </div>

              {detailDoc.errorMessage && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {detailDoc.errorMessage}
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-medium">
                  Extracted chunks {detailChunks.length > 0 && `(${detailChunks.length})`}
                </p>
                {detailLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : detailChunks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No chunks available.</p>
                ) : (
                  <div className="space-y-2">
                    {detailChunks.map((c) => (
                      <div
                        key={c.chunkIndex}
                        className="rounded-md border bg-muted/30 p-3 text-sm"
                      >
                        <span className="mb-1 block text-xs font-medium text-muted-foreground">
                          Chunk #{c.chunkIndex + 1}
                        </span>
                        <p className="leading-relaxed text-muted-foreground">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(o: boolean) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{deleteDoc?.name}</strong>, its embeddings, and
              the stored file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
