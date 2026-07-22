// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Setu SDK — Utilities (config loader, logger, helpers)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure helpers used across the SDK. Nothing here touches the network.
//
// Secrets policy: this module NEVER logs the OAuth token, client secret, or
// webhook secret. `maskString` is used everywhere a secret might surface.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SetuConfig } from './types';

// ─── Config loader ────────────────────────────────────────────────────────────

/**
 * Load Setu configuration from environment variables. Returns `null` if any
 * required variable is missing (with a single console.warn explaining which).
 *
 * Required:
 *   - SETU_CLIENT_ID
 *   - SETU_CLIENT_SECRET
 *   - SETU_PRODUCT_INSTANCE_ID
 *   - SETU_BASE_URL           (sandbox: https://fiu-sandbox.setu.co)
 *   - SETU_AUTH_URL           (sandbox: https://uat.setu.co/api/v2/auth/token)
 *
 * Optional:
 *   - SETU_WEBHOOK_SECRET     (HMAC verification; if absent webhooks are insecure)
 *   - SETU_TIMEOUT_MS         (default 15000)
 *   - SETU_MAX_RETRIES        (default 3)
 *   - SETU_LOG_LEVEL          (default 'info')
 */
export function loadSetuConfig(): SetuConfig | null {
  const clientId = process.env.SETU_CLIENT_ID?.trim();
  const clientSecret = process.env.SETU_CLIENT_SECRET?.trim();
  const productInstanceId = process.env.SETU_PRODUCT_INSTANCE_ID?.trim();
  const baseUrl = process.env.SETU_BASE_URL?.trim();
  const authUrl = process.env.SETU_AUTH_URL?.trim();

  const missing: string[] = [];
  if (!clientId) missing.push('SETU_CLIENT_ID');
  if (!clientSecret) missing.push('SETU_CLIENT_SECRET');
  if (!productInstanceId) missing.push('SETU_PRODUCT_INSTANCE_ID');
  if (!baseUrl) missing.push('SETU_BASE_URL');
  if (!authUrl) missing.push('SETU_AUTH_URL');

  if (missing.length > 0) {
    // Single warn per missing-config evaluation — keeps logs clean.
    console.warn(
      `[setu] Not configured — missing env vars: ${missing.join(', ')}. ` +
        `SetuBankingProvider will be unavailable; factory will fall back to MockBankingProvider.`,
    );
    return null;
  }

  const webhookSecret = process.env.SETU_WEBHOOK_SECRET?.trim() || undefined;
  if (!webhookSecret) {
    console.warn('[setu] SETU_WEBHOOK_SECRET is not set — incoming webhooks cannot be verified.');
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    productInstanceId: productInstanceId!,
    baseUrl: baseUrl!,
    authUrl: authUrl!,
    webhookSecret,
    timeoutMs: parsePositiveInt(process.env.SETU_TIMEOUT_MS, 15000),
    maxRetries: parsePositiveInt(process.env.SETU_MAX_RETRIES, 3),
    logLevel: parseLogLevel(process.env.SETU_LOG_LEVEL, 'info'),
  };
}

/** True iff `loadSetuConfig()` would return a non-null config. */
export function isSetuConfigured(): boolean {
  return loadSetuConfig() !== null;
}

/** Resolve the configured log level (defaults to 'info'). */
export function setuLogLevel(): 'error' | 'warn' | 'info' | 'debug' {
  return parseLogLevel(process.env.SETU_LOG_LEVEL, 'info');
}

// ─── String / number helpers ──────────────────────────────────────────────────

/**
 * Mask a string for safe logging. Shows `visibleFront` chars at the start and
 * `visibleBack` chars at the end, with `••••` in between. Short strings are
 * fully masked.
 *
 * @example maskString('sk_live_abcdef123456', 4, 4) → 'sk_l••••3456'
 */
export function maskString(s: string, visibleFront = 4, visibleBack = 4): string {
  if (!s) return '<empty>';
  if (s.length <= visibleFront + visibleBack) return '••••';
  return `${s.slice(0, visibleFront)}••••${s.slice(-visibleBack)}`;
}

/**
 * Parse a Setu amount string ("33834.65") into a number. Returns 0 on
 * unparseable input — never throws. Negative amounts are preserved.
 */
export function parseAmount(s: string | number | null | undefined): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  const trimmed = String(s).trim().replace(/,/g, '');
  if (!trimmed) return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce a Date or ISO string to an ISO 8601 string. */
export function toISO(date: Date | string): string {
  if (typeof date === 'string') return new Date(date).toISOString();
  return date.toISOString();
}

/** Promise-based sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter for retry pauses.
 *
 * `Math.min(10000, 500 * 2**attempt)` plus up to 250ms of random jitter.
 * Caps at 10s so a retry storm can't lock the event loop.
 */
export function backoffMs(attempt: number): number {
  const base = Math.min(10000, 500 * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

/** HTTP statuses that are worth retrying (transient failures). */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

// ─── Logger ───────────────────────────────────────────────────────────────────

const LEVEL_RANK: Record<'error' | 'warn' | 'info' | 'debug', number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Setu SDK logger. Prefixes every line with `[setu]` + ISO timestamp so logs
 * are greppable in the dev server output. Respects `SETU_LOG_LEVEL`.
 *
 * SECURITY: this logger NEVER receives raw secrets — callers must mask tokens
 * and credentials before logging. As a defensive measure, any string field
 * whose key contains `token`, `secret`, `password`, or `authorization` is
 * automatically masked.
 */
export const setuLogger = {
  info(msg: string, meta?: Record<string, unknown>): void {
    if (LEVEL_RANK[setuLogLevel()] >= LEVEL_RANK.info) {
      console.log(formatLine('INFO', msg, meta));
    }
  },
  warn(msg: string, meta?: Record<string, unknown>): void {
    if (LEVEL_RANK[setuLogLevel()] >= LEVEL_RANK.warn) {
      console.warn(formatLine('WARN', msg, meta));
    }
  },
  error(msg: string, meta?: Record<string, unknown>): void {
    if (LEVEL_RANK[setuLogLevel()] >= LEVEL_RANK.error) {
      console.error(formatLine('ERROR', msg, meta));
    }
  },
  debug(msg: string, meta?: Record<string, unknown>): void {
    if (LEVEL_RANK[setuLogLevel()] >= LEVEL_RANK.debug) {
      console.log(formatLine('DEBUG', msg, meta));
    }
  },
};

const SECRET_KEY_RE = /token|secret|password|authorization|clientsecret/i;

function formatLine(level: string, msg: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const base = `[setu] ${ts} ${level} ${msg}`;
  if (!meta) return base;
  // Defensive: mask any value whose key smells like a secret.
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_KEY_RE.test(k) && typeof v === 'string') {
      safe[k] = maskString(v);
    } else {
      safe[k] = v;
    }
  }
  return `${base} ${JSON.stringify(safe)}`;
}

// ─── Internal parsers ─────────────────────────────────────────────────────────

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseLogLevel(
  raw: string | undefined,
  fallback: 'error' | 'warn' | 'info' | 'debug',
): 'error' | 'warn' | 'info' | 'debug' {
  if (raw === 'error' || raw === 'warn' || raw === 'info' || raw === 'debug') return raw;
  return fallback;
}
