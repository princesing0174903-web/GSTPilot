// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Edge Middleware
//
// Responsibilities:
//   1. Security headers (CSP, frame-ancestors, X-Frame-Options, etc.)
//   2. Host-aware frame policy — allow the sandbox preview gateway to embed
//      the app in an iframe, while denying framing everywhere else.
//   3. Light request logging (dev only).
//
// The preview gateway hosts look like:  preview-chat-{id}.space-z.ai
// We detect any *.space-z.ai host and emit a permissive frame policy so the
// right-hand Preview Panel can render the app. Production hosts get DENY.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';

// ─── Host detection ──────────────────────────────────────────────────────────

/**
 * True if the request host is the sandbox preview gateway. The gateway hostname
 * looks like `preview-chat-{chatId}.space-z.ai`. We match any *.space-z.ai host
 * so all preview variants are covered.
 */
function isPreviewGatewayHost(host: string | null): boolean {
  if (!host) return false;
  const lower = host.toLowerCase();
  if (lower.endsWith('.space-z.ai')) return true;
  // Also accept localhost / 127.0.0.1 dev origins (non-production).
  if (lower === 'localhost' || lower.startsWith('127.0.0.1') || lower.startsWith('0.0.0.0')) {
    return true;
  }
  return false;
}

function resolveHost(req: NextRequest): string | null {
  // The Caddy gateway forwards the original browser host via x-forwarded-host.
  const xfh = req.headers.get('x-forwarded-host');
  if (xfh) return xfh;
  return req.headers.get('host');
}

// ─── Security headers ─────────────────────────────────────────────────────────

function applySecurityHeaders(res: NextResponse, host: string | null): NextResponse {
  const isPreview = isPreviewGatewayHost(host);

  // ── Frame policy ──
  if (isPreview) {
    // Allow the preview gateway (and same-origin) to embed the app.
    res.headers.set('X-Frame-Options', 'ALLOWALL');
    res.headers.set(
      'Content-Security-Policy',
      "frame-ancestors 'self' https://*.space-z.ai https://space-z.ai;",
    );
  } else {
    // Production — deny all framing (clickjacking protection).
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Content-Security-Policy', "frame-ancestors 'none';");
  }

  // ── Standard hardening headers (applied to every response) ──
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS — only over HTTPS. Caddy terminates TLS at the gateway.
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return res;
}

// ─── Middleware entry ─────────────────────────────────────────────────────────

export function middleware(req: NextRequest) {
  const host = resolveHost(req);

  // Let the response flow through; we only attach headers.
  const res = NextResponse.next();
  return applySecurityHeaders(res, host);
}

export const config = {
  // Run on page/document routes ONLY. We deliberately EXCLUDE /api/* because:
  //   1. Security headers (CSP, X-Frame-Options) are pointless on JSON
  //      responses — browsers don't frame or execute API responses.
  //   2. The middleware adds 5-370ms of latency per request (dev.log shows
  //      `proxy.ts: 6-374ms` on every API call). With 5+ dashboard APIs
  //      firing in parallel on mount, that's 25-1850ms of event-loop time
  //      that serializes behind header assignment + NextResponse construction.
  //   3. API routes set their own headers via NextResponse where needed.
  // Static assets (_next/static, images, icons) are also excluded.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|api/).*)',
  ],
};
