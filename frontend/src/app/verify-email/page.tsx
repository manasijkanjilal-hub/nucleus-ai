'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Zap, CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';

type Status = 'verifying' | 'success' | 'error' | 'idle';

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'idle');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Your email has been verified.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed.');
        }
      } catch {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    })();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResending(true);
    setResendMsg('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json().catch(() => ({}));
      setResendMsg(data.message || 'If an unverified account exists, a link has been sent.');
    } catch {
      setResendMsg('Something went wrong. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Zap className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Email Verification</h1>
        </div>
        <Card>
          {status === 'verifying' && (
            <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Verifying your email…</p>
            </CardContent>
          )}

          {status === 'success' && (
            <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button render={<Link href="/login" />} className="w-full h-10">
                Continue to sign in
              </Button>
            </CardContent>
          )}

          {(status === 'error' || status === 'idle') && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                  {status === 'error' ? 'Verification failed' : 'Resend verification'}
                </CardTitle>
                <CardDescription>
                  {status === 'error'
                    ? message
                    : 'Enter your email to receive a new verification link.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResend} className="space-y-4">
                  {resendMsg && (
                    <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                      {resendMsg}
                    </div>
                  )}
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={resendEmail}
                      onChange={(e: any) => setResendEmail(e.target?.value ?? '')}
                      className="pl-10 h-10"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full h-10" disabled={resending}>
                    {resending ? 'Sending…' : 'Resend verification email'}
                  </Button>
                </form>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  <Link href="/login" className="font-medium text-foreground hover:underline">
                    Back to sign in
                  </Link>
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
