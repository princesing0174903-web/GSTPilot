// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — In-Memory Rate Limiter (per-process)
//
// A lightweight sliding-window rate limiter for Next.js API routes. Designed for
// single-instance sandboxes / preview environments. For multi-instance prod, swap
// the `BucketStore` interface for a Redis-backed implementation.
//
// USAGE:
//   import { rateLimit, type RateLimitRule } from '@/lib/rate-limit';
//
//   const rule: RateLimitRule = { windowMs: 60_000, max: 20 };
//   const result = rateLimit(req, rule, 'oracle-chat');
//   if (result.denied) {
//     return NextResponse.json(
//       { error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' },
//       { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } },
//     );
//   }
//
// KEYS: by default the key is the client IP (from x-forwarded-for or
// x-real-ip). Pass an explicit `key` (e.g. uid) to scope per-user.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export interface RateLimitRule {
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed within the window. */
  max: number;
}

export interface RateLimitResult {
  /** True when the request should be rejected (429). */
  denied: boolean;
  /** Requests remaining in the current window (≥0). */
  remaining: number;
  /** Seconds until the oldest request in the window expires — Retry-After. */
  retryAfterSec: number;
  /** The resolved key (useful for logging). */
  key: string;
}

// ─── Bucket store (in-memory, per-process) ──────────────────────────────────

interface Bucket {
  /** Timestamps (ms) of requests within the window. */
  hits: number[];
}

interface BucketStore {
  get(key: string): Bucket | undefined;
  set(key: string, bucket: Bucket): void;
  delete(key: string): void;
  keys(): IterableIterator<string>;
}

const store: BucketStore = new Map<string, Bucket>();

// Periodic cleanup — drop expired buckets so the Map doesn't grow unbounded.
// Runs every 5 minutes; lazy cleanup also happens on each request.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number, rule: RateLimitRule): void {
  for (const k of Array.from(store.keys())) {
    const b = store.get(k);
    if (!b) continue;
    b.hits = b.hits.filter((t) => t > now - rule.windowMs);
    if (b.hits.length === 0) store.delete(k);
  }
}

// ─── Key resolution ──────────────────────────────────────────────────────────

/**
 * Resolve a rate-limit key from the request. Prefers the verified Firebase uid
 * (when supplied by the caller — usually after `requireAuth`), then falls back
 * to the client IP. The IP is taken from `x-forwarded-for` (first hop) or
 * `x-real-ip`; if neither is present, falls back to a synthetic key based on
 * the `x-gstpilot-actor` header so demo / preview traffic is still rate-limited
 * per actor.
 */
export function resolveRateLimitKey(
  req: NextRequest | Request,
  uid?: string,
  scope?: string,
): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-gstpilot-actor')?.slice(0, 64) ||
    'unknown';
  const u = uid || ip;
  return scope ? `${scope}:${u}` : u;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check a request against a rate-limit rule. Records a hit on every call
 * (including the one that overflows — so the bucket stays accurate).
 */
export function rateLimit(
  req: NextRequest | Request,
  rule: RateLimitRule,
  scope: string,
  uid?: string,
): RateLimitResult {
  const now = Date.now();

  // Lazy + periodic cleanup.
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    cleanup(now, rule);
  }

  const key = resolveRateLimitKey(req, uid, scope);
  const bucket = store.get(key);
  if (!bucket) {
    store.set(key, { hits: [now] });
    return {
      denied: false,
      remaining: rule.max - 1,
      retryAfterSec: Math.ceil(rule.windowMs / 1000),
      key,
    };
  }

  // Drop expired hits.
  bucket.hits = bucket.hits.filter((t) => t > now - rule.windowMs);

  if (bucket.hits.length >= rule.max) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000));
    return {
      denied: true,
      remaining: 0,
      retryAfterSec,
      key,
    };
  }

  bucket.hits.push(now);
  return {
    denied: false,
    remaining: rule.max - bucket.hits.length,
    retryAfterSec: Math.ceil(rule.windowMs / 1000),
    key,
  };
}

/**
 * Convenience: rate-limit presets used across the app. Centralised so a single
 * edit adjusts every endpoint.
 */
export const RATE_LIMIT_PRESETS = {
  /** Auth-sensitive endpoints (login, signup, OTP). 10 req / minute. */
  auth: { windowMs: 60_000, max: 10 } satisfies RateLimitRule,
  /** OTP verify — very tight: 5 req / minute per user/IP. */
  otp: { windowMs: 60_000, max: 5 } satisfies RateLimitRule,
  /** VEYRO AI endpoints (chat, ask, recommend). 20 req / minute per user. */
  oracle: { windowMs: 60_000, max: 20 } satisfies RateLimitRule,
  /** Admin / provisioning mutations. 20 req / minute. */
  admin: { windowMs: 60_000, max: 20 } satisfies RateLimitRule,
  /** Default write endpoints. 60 req / minute. */
  write: { windowMs: 60_000, max: 60 } satisfies RateLimitRule,
} as const;

/**
 * Build a 429 NextResponse with the right headers + friendly message.
 * Use when `rateLimit()` returns `{ denied: true }`.
 */
export function rateLimitedResponse(retryAfterSec: number, message = 'Too many requests. Please slow down.') {
  return NextResponse.json(
    { error: message, code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': 'max',
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}
