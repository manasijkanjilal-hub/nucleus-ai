'use client';
import { useEffect, useState, useCallback } from 'react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Database, Upload, FileText, File, Check, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContextVaultPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fetchData = async () => {
    try {
      const [docsRes, brandsRes] = await Promise.all([fetch('/api/documents'), fetch('/api/brands')]);
      const docs = await docsRes?.json?.().catch(() => []);
      const br = await brandsRes?.json?.().catch(() => []);
      setDocuments(Array.isArray(docs) ? docs : []);
      setBrands(Array.isArray(br) ? br : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const uploadFile = async (file: globalThis.File) => {
    setUploading(true);
    try {
      // Get presigned URL
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file?.name ?? 'file', contentType: file?.type ?? 'application/octet-stream', isPublic: false }),
      });
      if (!presignedRes?.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, cloud_storage_path } = await presignedRes.json();

      // Upload to S3 - check signed headers
      const headers: Record<string, string> = { 'Content-Type': file?.type ?? 'application/octet-stream' };
      if (uploadUrl?.includes?.('content-disposition')) {
        headers['Content-Disposition'] = 'attachment';
      }
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers, body: file });
      if (!uploadRes?.ok) throw new Error('Upload failed');

      // Record in DB
      await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudStoragePath: cloud_storage_path,
          isPublic: false,
          fileName: file?.name ?? 'file',
          fileType: file?.type ?? 'unknown',
          brandId: selectedBrand || null,
        }),
      });

      toast.success(`Uploaded: ${file?.name ?? 'file'}`);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleTextIngest = async () => {
    if (!textContent?.trim?.()) { toast.error('Please enter text content'); return; }
    setUploading(true);
    try {
      await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudStoragePath: null,
          isPublic: false,
          fileName: `text-${Date.now()}.txt`,
          fileType: 'text/plain',
          brandId: selectedBrand || null,
        }),
      });
      toast.success('Text content added to vault');
      setTextContent('');
      fetchData();
    } catch { toast.error('Failed to ingest text'); } finally { setUploading(false); }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files?.[0]) uploadFile(files[0]);
  }, [selectedBrand]);

  return (
    <>
      <DashboardHeader title="Context Vault" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Context Vault</h2>
          <p className="text-muted-foreground">Upload brand materials and documents to enhance AI-generated content</p>
        </div>

        {(brands ?? [])?.length > 0 && (
          <div className="space-y-2">
            <Label>Associate with Brand</Label>
            <select
              className="h-10 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm"
              value={selectedBrand}
              onChange={(e: any) => setSelectedBrand(e.target?.value ?? '')}
            >
              <option value="">No brand selected</option>
              {(brands ?? [])?.map?.((b: any) => <option key={b?.id ?? ''} value={b?.id ?? ''}>{b?.name ?? 'Unnamed'}</option>) ?? []}
            </select>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" />File Upload</CardTitle>
              <CardDescription>Drag and drop or click to upload PDF, DOC, TXT files</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}`}
                onDragOver={(e: any) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <File className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">Drag files here or click to browse</p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.md"
                      className="hidden"
                      id="file-upload"
                      onChange={(e: any) => { const f = e.target?.files?.[0]; if (f) uploadFile(f); }}
                    />
                    <Button variant="outline" size="sm" onClick={() => document?.getElementById?.('file-upload')?.click?.()}>
                      Browse Files
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Text Input</CardTitle>
              <CardDescription>Paste brand guidelines, messaging frameworks, or other text content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={textContent}
                onChange={(e: any) => setTextContent(e.target?.value ?? '')}
                placeholder="Paste your brand guidelines, tone of voice documentation, or any text content here..."
                rows={6}
              />
              <Button onClick={handleTextIngest} disabled={uploading || !textContent?.trim?.()}>
                <Database className="mr-1 h-4 w-4" /> Add to Vault
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>{(documents ?? [])?.length ?? 0} documents in vault</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i: number) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>
            ) : (documents ?? [])?.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <Database className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(documents ?? [])?.map?.((doc: any) => (
                  <div key={doc?.id ?? ''} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc?.fileName ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{doc?.fileType ?? ''} • {doc?.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}</p>
                    </div>
                    <Badge variant="secondary">{doc?.status ?? 'uploaded'}</Badge>
                  </div>
                )) ?? []}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
