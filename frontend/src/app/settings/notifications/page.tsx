'use client';

// =============================================================================
// /settings/notifications — notification preferences.
// In-app notifications are always on; email delivery is toggleable.
// =============================================================================

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, Mail, Loader2 } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function NotificationPreferencesPage() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/notifications/preferences', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setEmailNotifications(Boolean(data.emailNotifications));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async (next: boolean) => {
    const prev = emailNotifications;
    setEmailNotifications(next);
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailNotifications: next }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success('Preferences saved');
    } catch {
      setEmailNotifications(prev);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DashboardHeader title="Notification Preferences" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notification Preferences</h2>
          <p className="text-muted-foreground">Control how Nucleus AI keeps you informed</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Email Notifications</CardTitle>
            <CardDescription>
              Receive emails for events like completed generations and usage limits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn off to stop receiving notification emails (account &amp; security emails are always sent).
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={handleToggle}
                  disabled={saving}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" />In-App Notifications</CardTitle>
            <CardDescription>Shown in the notification center. Always enabled.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4 opacity-80">
              <div className="space-y-0.5">
                <Label>In-app notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Always on so you never miss important account activity.
                </p>
              </div>
              <Switch checked disabled />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
