// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Centralized Error Tracking
//
// Captures errors + messages to Firestore `error_reports` collection with:
//   • Per-request breadcrumb buffer (via AsyncLocalStorage on Node, global
//     array in the browser) so the lead-up to every error is recorded.
//   • Stable fingerprinting (SHA-256 of name+message+top-stack-frame) so
//     similar errors are grouped for triage.
//   • Global unhandled-rejection / uncaught-exception / window.onerror
//     handlers, installed once at app startup via `installGlobalErrorHandlers()`.
//
// Resilience: captureError NEVER throws. If firebase-admin is unavailable
// (sandbox, missing creds) or Firestore rejects the write, the error is
// logged to console.error and the call returns. Error tracking must never
// crash the request that triggered it.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash, randomBytes } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Breadcrumb {
  /** ISO-8601 timestamp (UTC). */
  timestamp: string;
  message: string;
  /** Category — subsystem that emitted the breadcrumb (e.g. 'http', 'db'). */
  category: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Optional structured data. */
  data?: Record<string, unknown>;
}

export type ErrorType =
  | 'frontend'
  | 'backend'
  | 'cloud_function'
  | 'firestore'
  | 'storage'
  | 'ai'
  | 'unhandled';

export interface TrackedError {
  /** Firestore document ID (server-assigned). */
  id: string;
  /** ISO-8601 timestamp (UTC). */
  timestamp: string;
  type: ErrorType;
  message: string;
  /** Stack trace (string). */
  stack?: string;
  /** Firebase UID of the acting user, if known. */
  userId?: string;
  /** Organization ID the request is scoped to, if known. */
  orgId?: string;
  /** Request URL (window.location.href on client, request.url on server). */
  requestUrl?: string;
  /** Sanitized request body — caller MUST strip PII before passing. */
  requestBody?: Record<string, unknown>;
  /** Error code (e.g. Prisma error code 'P2003', Firestore 'permission-denied'). */
  code?: string;
  /** HTTP status code, if applicable. */
  statusCode?: number;
  /** Lead-up events captured via `addBreadcrumb()`. */
  breadcrumbs: Breadcrumb[];
  /** Stable hash for grouping similar errors. See `fingerprintError()`. */
  fingerprint: string;
  /** Severity. Defaults to 'error'. */
  level?: 'info' | 'warn' | 'error' | 'fatal';
  /** Tag set for the aggregator (e.g. {route: '/api/invoices'}). */
  tags?: Record<string, string>;
  /** Runtime context — server vs browser. */
  runtime?: 'node' | 'browser' | 'edge';
}

// ─── Breadcrumb buffer (AsyncLocalStorage on Node, global in browser) ─────────

interface RequestBreadcrumbState {
  breadcrumbs: Breadcrumb[];
}

const isBrowser = typeof window !== 'undefined';

// AsyncLocalStorage is Node-only; in the browser we fall back to a single
// global buffer (since the browser is single-threaded, this is safe enough
// for a per-page breadcrumb trail).
const browserBreadcrumbBuffer: RequestBreadcrumbState = { breadcrumbs: [] };

const asyncBreadcrumbStorage: AsyncLocalStorage<RequestBreadcrumbState> =
  isBrowser ? (null as unknown as AsyncLocalStorage<RequestBreadcrumbState>) : new AsyncLocalStorage<RequestBreadcrumbState>();

/**
 * Add a breadcrumb to the per-request buffer.
 *
 * Breadcrumbs are little "what just happened" events leading up to an error.
 * They're attached to the next captured error so the aggregator can show
 * what the user / system did in the seconds before the failure.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warn' | 'error' = 'info',
  data?: Record<string, unknown>,
): void {
  const crumb: Breadcrumb = {
    timestamp: new Date().toISOString(),
    message,
    category,
    level,
    data,
  };

  if (isBrowser) {
    browserBreadcrumbBuffer.breadcrumbs.push(crumb);
    // Cap at 50 to bound memory in long-lived browser sessions.
    if (browserBreadcrumbBuffer.breadcrumbs.length > 50) {
      browserBreadcrumbBuffer.breadcrumbs.shift();
    }
    return;
  }

  const store = asyncBreadcrumbStorage.getStore();
  if (store) {
    store.breadcrumbs.push(crumb);
    if (store.breadcrumbs.length > 50) store.breadcrumbs.shift();
  } else {
    // No request context — use the global fallback so breadcrumbs aren't lost
    // (e.g. when called from a Cloud Function entry point that didn't wrap
    // itself in `withRequestContext`).
    browserBreadcrumbBuffer.breadcrumbs.push(crumb);
    if (browserBreadcrumbBuffer.breadcrumbs.length > 50) {
      browserBreadcrumbBuffer.breadcrumbs.shift();
    }
  }
}

/**
 * Wrap an async function in a fresh breadcrumb context. All breadcrumbs
 * added inside `fn` are isolated to that call's error captures.
 *
 *   await withRequestContext(async () => {
 *     addBreadcrumb('user logged in', 'auth');
 *     await doWork();
 *   });
 */
export async function withRequestContext<T>(fn: () => Promise<T>): Promise<T> {
  if (isBrowser) {
    // Browser: clear the buffer at the start of the request.
    browserBreadcrumbBuffer.breadcrumbs = [];
    return fn();
  }
  const state: RequestBreadcrumbState = { breadcrumbs: [] };
  return asyncBreadcrumbStorage.run(state, fn);
}

/** Snapshot the current breadcrumbs (consumed by captureError). */
function consumeBreadcrumbs(): Breadcrumb[] {
  if (isBrowser) {
    const crumbs = browserBreadcrumbBuffer.breadcrumbs.slice();
    browserBreadcrumbBuffer.breadcrumbs = [];
    return crumbs;
  }
  const store = asyncBreadcrumbStorage.getStore();
  if (store) {
    const crumbs = store.breadcrumbs.slice();
    // Don't clear server-side per-request store — multiple captures per
    // request should all see the same trail.
    return crumbs;
  }
  return browserBreadcrumbBuffer.breadcrumbs.slice();
}

// ─── Fingerprinting ───────────────────────────────────────────────────────────

/**
 * Generate a stable fingerprint for an error so similar errors group together
 * in the aggregator.
 *
 * Hash inputs (in priority order):
 *   1. error.name
 *   2. error.message (with dynamic-looking ids/numbers stripped)
 *   3. The file+line of the first stack frame above node_modules /
 *      the application's own code.
 *
 * Returns a 16-char hex string. Two errors with the same fingerprint are
 * very likely the same bug.
 */
export function fingerprintError(err: unknown): string {
  let name = 'Error';
  let message = '';
  let stack = '';

  if (err instanceof Error) {
    name = err.name;
    message = err.message;
    stack = err.stack ?? '';
  } else if (typeof err === 'string') {
    message = err;
  } else if (err && typeof err === 'object') {
    const e = err as { name?: string; message?: string; stack?: string };
    name = e.name ?? 'Error';
    message = e.message ?? JSON.stringify(err);
    stack = e.stack ?? '';
  } else {
    message = String(err);
  }

  // Strip dynamic content from the message: numbers, hex IDs, UUIDs, MongoDB
  // ObjectIds, Firebase doc IDs. This makes "invoice 12345 not found" and
  // "invoice 67890 not found" collapse to the same fingerprint.
  const normalizedMsg = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/[0-9a-f]{24}/gi, '<objid>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\/[A-Za-z0-9_-]{10,}/g, '<path>');

  // Find the first stack frame that isn't inside node_modules or next/dist —
  // that's almost always the application code that triggered the error.
  let topFrame = '';
  if (stack) {
    const lines = stack.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('at ')) continue;
      if (trimmed.includes('node_modules')) continue;
      if (trimmed.includes('.next/')) continue;
      // Strip column numbers — they change with minor code edits.
      topFrame = trimmed.replace(/:\d+:\d+/g, ':<line>').slice(0, 200);
      break;
    }
    if (!topFrame && lines.length > 1) {
      topFrame = (lines[1] ?? '').trim().slice(0, 200);
    }
  }

  const hashInput = `${name}::${normalizedMsg}::${topFrame}`;
  return createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
}

// ─── Firestore helper ─────────────────────────────────────────────────────────

const ERROR_COLLECTION = 'error_reports';

interface FirestoreLike {
  collection(path: string): {
    add(data: unknown): Promise<{ id: string }>;
  };
}

let adminDbCache: FirestoreLike | null = null;
let adminDbInitFailed = false;

async function getAdminDb(): Promise<FirestoreLike | null> {
  if (adminDbCache) return adminDbCache;
  if (adminDbInitFailed) return null;
  try {
    const adminModule = await import('@/lib/firebase-admin');
    const db = adminModule.adminDb();
    adminDbCache = db as unknown as FirestoreLike;
    return adminDbCache;
  } catch (err) {
    adminDbInitFailed = true;
     
    console.error('[observability/error-tracking] firebase-admin unavailable — errors will fall back to console:', err);
    return null;
  }
}

// ─── captureError ─────────────────────────────────────────────────────────────

/**
 * Capture an error to the centralized error-tracking system.
 *
 * Writes to Firestore `error_reports` collection (server-side via
 * firebase-admin). If firebase-admin is unavailable, falls back to
 * console.error.
 *
 * Includes breadcrumbs captured via `addBreadcrumb()` during the request.
 *
 * NEVER throws. On Firestore failure, logs to console.error and returns.
 */
export async function captureError(
  error: Error | unknown,
  context?: Partial<TrackedError>,
): Promise<void> {
  let name = 'Error';
  let message = '';
  let stack: string | undefined;

  if (error instanceof Error) {
    name = error.name;
    message = error.message;
    stack = error.stack;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    const e = error as { name?: string; message?: string; stack?: string };
    name = e.name ?? 'Error';
    message = e.message ?? JSON.stringify(error);
    stack = e.stack;
  } else {
    message = String(error);
  }

  const fingerprint = fingerprintError(error);
  const breadcrumbs = consumeBreadcrumbs();

  const tracked: TrackedError = {
    id: generateErrorId(),
    timestamp: new Date().toISOString(),
    type: context?.type ?? inferErrorType(error),
    message: context?.message ?? `${name}: ${message}`,
    stack: stack ?? context?.stack,
    userId: context?.userId,
    orgId: context?.orgId,
    requestUrl: context?.requestUrl ?? (isBrowser ? window.location.href : undefined),
    requestBody: context?.requestBody,
    code: context?.code,
    statusCode: context?.statusCode,
    breadcrumbs,
    fingerprint,
    level: context?.level ?? 'error',
    tags: context?.tags,
    runtime: isBrowser ? 'browser' : (process.env.NEXT_RUNTIME === 'edge' ? 'edge' : 'node'),
  };

  // Always emit to the structured logger too — so the error appears in
  // stdout/Cloud Logging even if Firestore write fails.
  try {
    // Late import to avoid circular dependency at module-load time.
    const { logger } = await import('./logger');
    logger.error(tracked.message, {
      fingerprint,
      type: tracked.type,
      code: tracked.code,
      statusCode: tracked.statusCode,
      userId: tracked.userId,
      orgId: tracked.orgId,
      stack: tracked.stack,
    });
  } catch {
    // ignore logger import errors
  }

  const db = await getAdminDb();
  if (!db) {
     
    console.error('[error-fallback]', JSON.stringify(tracked));
    return;
  }

  try {
    await db.collection(ERROR_COLLECTION).add(tracked);
  } catch (err) {
     
    console.error('[observability/error-tracking] write failed:', err);
  }
}

// ─── captureMessage ───────────────────────────────────────────────────────────

/**
 * Capture a non-error message (info / warn / error level) to the centralized
 * error-tracking system. Useful for capturing notable events that aren't
 * errors but should appear in the same triage view (e.g. "user hit rate
 * limit", "feature flag evaluated to false").
 */
export async function captureMessage(
  message: string,
  level: 'info' | 'warn' | 'error',
  context?: Partial<TrackedError>,
): Promise<void> {
  const fingerprint = createHash('sha256').update(`message::${level}::${message}`).digest('hex').slice(0, 16);
  const breadcrumbs = consumeBreadcrumbs();

  const tracked: TrackedError = {
    id: generateErrorId(),
    timestamp: new Date().toISOString(),
    type: context?.type ?? 'backend',
    message,
    userId: context?.userId,
    orgId: context?.orgId,
    requestUrl: context?.requestUrl ?? (isBrowser ? window.location.href : undefined),
    requestBody: context?.requestBody,
    code: context?.code,
    statusCode: context?.statusCode,
    breadcrumbs,
    fingerprint,
    level,
    tags: context?.tags,
    runtime: isBrowser ? 'browser' : (process.env.NEXT_RUNTIME === 'edge' ? 'edge' : 'node'),
  };

  try {
    const { logger } = await import('./logger');
    if (level === 'info') logger.info(message, { fingerprint });
    else if (level === 'warn') logger.warn(message, { fingerprint });
    else logger.error(message, { fingerprint });
  } catch {
    // ignore logger import errors
  }

  const db = await getAdminDb();
  if (!db) {
     
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log']('[msg-fallback]', JSON.stringify(tracked));
    return;
  }

  try {
    await db.collection(ERROR_COLLECTION).add(tracked);
  } catch (err) {
     
    console.error('[observability/error-tracking] message write failed:', err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateErrorId(): string {
  if (isBrowser) {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `err_${hex}`;
    }
    return `err_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  }
  return `err_${randomBytes(12).toString('hex')}`;
}

function inferErrorType(err: unknown): ErrorType {
  if (isBrowser) return 'frontend';
  if (err && typeof err === 'object') {
    const e = err as { code?: string; name?: string };
    const code = e.code ?? '';
    if (code.startsWith('firestore/') || code.startsWith('permission-denied') || code === 'unavailable') return 'firestore';
    if (code.startsWith('storage/')) return 'storage';
    if (code.startsWith('functions/') || e.name === 'HttpsError') return 'cloud_function';
    if (code.startsWith('ai/') || code.startsWith('openai/') || code.startsWith('anthropic/')) return 'ai';
  }
  return 'backend';
}

// ─── Global error handlers ────────────────────────────────────────────────────

let globalHandlersInstalled = false;

/**
 * Install global error handlers. Idempotent — safe to call multiple times.
 *
 * Server-side: hooks into `process.on('unhandledRejection')` and
 * `process.on('uncaughtException')`. Note that uncaughtException is fatal
 * by default in Node — we log + capture, then re-emit so the process still
 * crashes (per Node best practice) but the error is recorded.
 *
 * Client-side: hooks into `window.onerror` and
 * `window.addEventListener('unhandledrejection', ...)`.
 *
 * Should be called ONCE at app startup — typically from `initObservability()`
 * in `src/lib/observability/index.ts`.
 */
export function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  if (isBrowser) {
    // ── Browser: window.onerror + unhandledrejection ──
    window.addEventListener('error', (event) => {
      void captureError(event.error ?? event.message, {
        type: 'frontend',
        requestUrl: window.location.href,
        level: 'error',
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = (event as PromiseRejectionEvent).reason;
      void captureError(reason instanceof Error ? reason : new Error(String(reason)), {
        type: 'frontend',
        requestUrl: window.location.href,
        level: 'error',
      });
    });
    return;
  }

  // ── Node: process-level hooks ──
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    void captureError(err, { type: 'unhandled', level: 'error' });
  });

  process.on('uncaughtException', (err) => {
    // Capture synchronously-best-effort, then re-emit so Node's default
    // crash behavior is preserved. We don't want to swallow fatal errors.
    void captureError(err, { type: 'unhandled', level: 'fatal' });
    // Re-throw on next tick so the process exits as Node expects.
    // (Default Node behavior: print + exit non-zero.)
    // We intentionally don't `process.exit(1)` here — that would skip
    // pending Firestore writes. The re-emit gives the capture time to flush.
    setImmediate(() => { throw err; });
  });
}

/** Reset installation state. Test-only. */
export function _resetGlobalHandlerInstallStateForTests(): void {
  globalHandlersInstalled = false;
}
