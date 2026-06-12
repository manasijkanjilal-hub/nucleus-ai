'use client';

// =============================================================================
// /admin/ai-providers — manage AI providers (OpenAI, Gemini, Claude)
// -----------------------------------------------------------------------------
// List every provider with its status, models + pricing and usage stats.
// Admins can: configure an API key, enable/disable, set the platform default,
// and run a connection test. API keys are write-only (never returned).
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Bot, Loader2, CheckCircle2, XCircle, KeyRound, Star, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface ModelInfo {
  id: string;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
}
interface ProviderRow {
  name: string;
  label: string;
  models: ModelInfo[];
  defaultModel: string;
  configured: boolean;
  keySource: 'db' | 'env' | 'none';
  enabled: boolean;
  isDefault: boolean;
  stats: {
    generations: number;
    tokensUsed: number;
    cost: number;
    successRate: number | null;
  };
}

export default function AdminAIProvidersPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  // API-key dialog state.
  const [keyDialogFor, setKeyDialogFor] = useState<ProviderRow | null>(null);
  const [keyValue, setKeyValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai-providers');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load providers');
      setProviders(Array.isArray(data?.providers) ? data.providers : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchProvider = async (
    name: string,
    patch: { apiKey?: string; enabled?: boolean; isDefault?: boolean },
  ) => {
    setBusy(name);
    try {
      const res = await fetch('/api/admin/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: name, ...patch }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      await load();
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleToggle = async (p: ProviderRow, enabled: boolean) => {
    const ok = await patchProvider(p.name, { enabled });
    if (ok) toast.success(`${p.label} ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleSetDefault = async (p: ProviderRow) => {
    const ok = await patchProvider(p.name, { isDefault: true });
    if (ok) toast.success(`${p.label} is now the default provider`);
  };

  const handleSaveKey = async () => {
    if (!keyDialogFor) return;
    setSavingKey(true);
    try {
      const res = await fetch('/api/admin/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: keyDialogFor.name, apiKey: keyValue.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save key');
      toast.success(keyValue.trim() ? 'API key saved' : 'API key cleared');
      setKeyDialogFor(null);
      setKeyValue('');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleTest = async (p: ProviderRow) => {
    setTesting(p.name);
    try {
      const res = await fetch('/api/admin/ai-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        if (data.mocked) {
          toast(`${p.label}: mock mode (no key) — ${data.latencyMs}ms`, { icon: '⚠️' });
        } else {
          toast.success(`${p.label} OK — ${data.model} · ${data.latencyMs}ms`);
        }
      } else {
        toast.error(`${p.label} test failed: ${data?.error || 'unknown error'}`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Connection test failed');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bot className="h-6 w-6" /> AI Providers
        </h1>
        <p className="text-muted-foreground">
          Configure the AI providers used for content generation. Keys can also be set
          via environment variables; values saved here override them.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading providers…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {providers.map((p) => (
            <Card key={p.name} className={p.enabled ? '' : 'opacity-70'}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {p.label}
                      {p.isDefault && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" /> Default
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {p.configured ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Configured{p.keySource === 'env' ? ' (env)' : p.keySource === 'db' ? ' (saved)' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" /> Not configured
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={p.enabled}
                    onCheckedChange={(v: boolean) => handleToggle(p, v)}
                    disabled={busy === p.name}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Models + pricing */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Models &amp; pricing (USD / 1M tokens)</p>
                  <div className="space-y-1">
                    {p.models.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          {m.label}
                          {m.id === p.defaultModel && (
                            <span className="text-xs text-muted-foreground">(default)</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ${m.inputPer1M} in · ${m.outputPer1M} out
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Usage stats */}
                <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
                  <div>
                    <div className="text-lg font-semibold">{p.stats.generations.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Generations</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">${p.stats.cost.toFixed(4)}</div>
                    <div className="text-xs text-muted-foreground">Total cost</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {p.stats.successRate == null ? '—' : `${p.stats.successRate}%`}
                    </div>
                    <div className="text-xs text-muted-foreground">Success</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setKeyDialogFor(p); setKeyValue(''); }}
                  >
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> Configure key
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(p)}
                    disabled={testing === p.name}
                  >
                    {testing === p.name
                      ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      : <Zap className="mr-1 h-3.5 w-3.5" />}
                    Test
                  </Button>
                  {!p.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(p)}
                      disabled={busy === p.name || !p.enabled || !p.configured}
                    >
                      <Star className="mr-1 h-3.5 w-3.5" /> Set default
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* API key dialog */}
      <Dialog
        open={keyDialogFor != null}
        onOpenChange={(open: boolean) => { if (!open) { setKeyDialogFor(null); setKeyValue(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {keyDialogFor?.label} API key</DialogTitle>
            <DialogDescription>
              The key is stored securely and never shown again. Leave empty and save to
              clear a stored key and revert to the environment variable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>API key</Label>
            <Input
              type="password"
              value={keyValue}
              onChange={(e: any) => setKeyValue(e.target?.value ?? '')}
              placeholder="Paste API key (leave blank to clear)"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setKeyDialogFor(null); setKeyValue(''); }}
              disabled={savingKey}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveKey} disabled={savingKey}>
              {savingKey ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
