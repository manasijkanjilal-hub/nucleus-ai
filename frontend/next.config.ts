import type { NextConfig } from "next";

// =============================================================================
// Security Headers
// =============================================================================
// Applied to every route. The Content-Security-Policy is intentionally
// permissive enough for Next.js (which injects inline runtime scripts/styles)
// while still blocking common XSS/clickjacking vectors.
// =============================================================================

const isDev = process.env.NODE_ENV !== "production";

// Allow the frontend to call the backend API (configurable via env).
const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js requires 'unsafe-inline' for its runtime; 'unsafe-eval' only in dev (HMR).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${isDev ? "ws: wss:" : ""}`.trim(),
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  // Prevent the site from being framed (clickjacking protection).
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from MIME-sniffing the content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control how much referrer information is sent.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful browser features the app does not use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Legacy XSS protection header (modern browsers rely on CSP).
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Content Security Policy.
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Enforce HTTPS for one year (only meaningful over TLS; harmless on localhost).
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Apply security headers to all routes.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
