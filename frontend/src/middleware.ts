import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, getClientIp, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Rate-limit policy for sensitive auth endpoints (matched on POST only).
 *  - Login / signup: 5 requests / minute
 *  - Password reset / verification resend: 3 requests / hour
 */
function authRateLimitPolicy(pathname: string): { scope: string; limit: number; windowMs: number } | null {
  // NextAuth credential login posts to /api/auth/callback/credentials
  if (pathname.startsWith('/api/auth/callback/credentials')) {
    return { scope: 'login', ...RATE_LIMITS.AUTH };
  }
  if (pathname === '/api/signup') {
    return { scope: 'signup', ...RATE_LIMITS.AUTH };
  }
  if (pathname === '/api/auth/forgot-password') {
    return { scope: 'forgot-password', ...RATE_LIMITS.PASSWORD_RESET };
  }
  if (pathname === '/api/auth/reset-password') {
    return { scope: 'reset-password', ...RATE_LIMITS.PASSWORD_RESET };
  }
  if (pathname === '/api/auth/resend-verification') {
    return { scope: 'resend-verification', ...RATE_LIMITS.PASSWORD_RESET };
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---- Rate limiting for sensitive auth endpoints (POST only) ----
  if (request.method === 'POST') {
    const policy = authRateLimitPolicy(pathname);
    if (policy) {
      const ip = getClientIp(request);
      const result = rateLimit({
        key: `${policy.scope}:${ip}`,
        limit: policy.limit,
        windowMs: policy.windowMs,
      });
      if (!result.success) {
        return NextResponse.json(
          { error: 'Too many requests. Please slow down and try again later.' },
          { status: 429, headers: rateLimitHeaders(result) }
        );
      }
    }
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Public routes
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // Public auth pages — always accessible (verification / password reset
  // links must work even while signed out).
  const publicAuthPages = ['/verify-email', '/forgot-password', '/reset-password'];
  if (publicAuthPages.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Auth pages - redirect to dashboard if logged in
  if (pathname === '/login' || pathname === '/signup') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Root - redirect based on auth
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Protected routes
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
