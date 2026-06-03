'use client';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import toast from 'react-hot-toast';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Monitor, LogOut, Loader2 } from 'lucide-react';

interface SessionInfo {
  current: { userAgent: string; ipAddress: string; lastLogin: string | null };
  accountCreated: string | null;
}

export default function PasswordSettingsPage() {
  // ---- Change password state ----
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  // ---- Sessions state ----
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/sessions');
        if (res.ok) setSessionInfo(await res.json());
      } catch {
        /* ignore */
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Password changed successfully.');
        setCurrent('');
        setNext('');
        setConfirm('');
      } else {
        toast.error(data.error || 'Failed to change password.');
      }
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutAll = async () => {
    setLoggingOutAll(true);
    try {
      const res = await fetch('/api/auth/sessions', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Signed out from all devices.');
        setTimeout(() => signOut({ callbackUrl: '/login' }), 800);
      } else {
        toast.error('Failed to sign out from all devices.');
      }
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setLoggingOutAll(false);
    }
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString() : '—';

  return (
    <>
      <DashboardHeader title="Security" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security</h2>
          <p className="text-muted-foreground">Change your password and manage active sessions</p>
        </div>

        {/* Change password */}
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Change Password</CardTitle>
            <CardDescription>Use a strong password you don&apos;t use elsewhere</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Current password</Label>
                <Input id="current" type="password" value={current}
                  onChange={(e: any) => setCurrent(e.target?.value ?? '')} className="max-w-md" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next">New password</Label>
                <Input id="next" type="password" value={next}
                  onChange={(e: any) => setNext(e.target?.value ?? '')} className="max-w-md" required minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" type="password" value={confirm}
                  onChange={(e: any) => setConfirm(e.target?.value ?? '')} className="max-w-md" required minLength={8} />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Monitor className="h-4 w-4" />Active Session</CardTitle>
            <CardDescription>Your current sign-in and session controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSessions ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="rounded-lg border p-4 space-y-1 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Monitor className="h-4 w-4 text-emerald-600" /> Current device
                </div>
                <p className="text-muted-foreground break-words">{sessionInfo?.current.userAgent}</p>
                <p className="text-muted-foreground">IP: {sessionInfo?.current.ipAddress}</p>
                <p className="text-muted-foreground">Last login: {fmt(sessionInfo?.current.lastLogin ?? null)}</p>
              </div>
            )}
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium text-sm">Sign out from all devices</p>
                  <p className="text-xs text-muted-foreground">
                    Invalidates every active session, including this one.
                  </p>
                </div>
                <Button variant="destructive" onClick={handleLogoutAll} disabled={loggingOutAll} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  {loggingOutAll ? 'Signing out…' : 'Sign out everywhere'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
