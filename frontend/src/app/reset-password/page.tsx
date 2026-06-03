'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Zap, Lock, CheckCircle2, Loader2 } from 'lucide-react';

function ResetPasswordInner() {
  const params = useSearchParams();
  const token = params.get('token');
  const isInvite = params.get('invite') === '1';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        setTokenValid(!!data.valid);
      } catch {
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
      } else {
        setError(data.error || 'Password reset failed.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const title = isInvite ? 'Set your password' : 'Reset your password';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Zap className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <Card>
          {validating ? (
            <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Validating link…</p>
            </CardContent>
          ) : done ? (
            <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <p className="text-sm text-muted-foreground">
                Your password has been {isInvite ? 'set' : 'reset'}. You can now sign in.
              </p>
              <Button render={<Link href="/login" />} className="w-full h-10">
                Continue to sign in
              </Button>
            </CardContent>
          ) : !tokenValid ? (
            <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-destructive">
                This link is invalid or has expired. Please request a new one.
              </p>
              <Button render={<Link href="/forgot-password" />} className="w-full h-10">
                Request a new link
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>Choose a new password for your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Min 8 characters"
                        value={password}
                        onChange={(e: any) => setPassword(e.target?.value ?? '')}
                        className="pl-10 h-10"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm"
                        type="password"
                        placeholder="Re-enter password"
                        value={confirm}
                        onChange={(e: any) => setConfirm(e.target?.value ?? '')}
                        className="pl-10 h-10"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-10" disabled={loading}>
                    {loading ? 'Saving…' : isInvite ? 'Set password' : 'Reset password'}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
