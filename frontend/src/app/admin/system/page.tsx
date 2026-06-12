'use client';

// =============================================================================
// Nucleus AI — Admin: System Settings
// =============================================================================
// Platform name, support email, maintenance mode, and feature flags.
// Persisted to the SystemSettings singleton via /api/admin/system.
// Inherits chrome from /admin/layout.tsx (AdminLayout). ADMIN+ only.
// =============================================================================

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Server, Loader2, Save, Flag } from 'lucide-react';

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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

interface SystemSettings {
  platformName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  featureFlags: Record<string, boolean>;
  updatedAt: string | null;
}

const FLAG_LABELS: Record<string, { label: string; description: string }> = {
  enableRegistration: {
    label: 'User Registration',
    description: 'Allow new users to sign up for accounts.',
  },
  enableAIGeneration: {
    label: 'AI Generation',
    description: 'Enable AI content generation features platform-wide.',
  },
  enableBilling: {
    label: 'Billing',
    description: 'Enable subscription and billing functionality.',
  },
};

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable form state
  const [platformName, setPlatformName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/system');
        if (!res.ok) throw new Error('Failed to load settings');
        const data: SystemSettings = await res.json();
        setSettings(data);
        setPlatformName(data.platformName);
        setSupportEmail(data.supportEmail);
        setMaintenanceMode(data.maintenanceMode);
        setFlags(data.featureFlags ?? {});
      } catch (err) {
        console.error(err);
        toast.error('Failed to load system settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformName,
          supportEmail,
          maintenanceMode,
          featureFlags: flags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setSettings(data);
      toast.success('System settings saved');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleFlag = (key: string, value: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Combine known flags with any extra ones present in the data.
  const flagKeys = Array.from(
    new Set([...Object.keys(FLAG_LABELS), ...Object.keys(flags)])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">System Settings</h1>
            <p className="text-sm text-muted-foreground">
              Platform configuration and feature flags.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* General settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic platform identity and contact.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="platformName">Platform Name</Label>
            <Input
              id="platformName"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="Nucleus AI"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supportEmail">Support Email</Label>
            <Input
              id="supportEmail"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@nucleus-ai.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Maintenance mode */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Mode</CardTitle>
          <CardDescription>
            When enabled, the platform displays a maintenance notice to non-admin
            users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Enable maintenance mode</p>
              <p className="text-sm text-muted-foreground">
                Restrict access while you perform updates.
              </p>
            </div>
            <Switch
              checked={maintenanceMode}
              onCheckedChange={(v: boolean) => setMaintenanceMode(v)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Feature flags */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            <CardTitle>Feature Flags</CardTitle>
          </div>
          <CardDescription>
            Toggle major platform capabilities on or off.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flagKeys.map((key, idx) => {
            const meta = FLAG_LABELS[key];
            return (
              <div key={key}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{meta?.label ?? key}</p>
                    <p className="text-sm text-muted-foreground">
                      {meta?.description ?? 'Custom feature flag.'}
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(flags[key])}
                    onCheckedChange={(v: boolean) => toggleFlag(key, v)}
                    disabled={saving}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {settings?.updatedAt && (
        <p className="text-xs text-muted-foreground">
          Last updated {new Date(settings.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
