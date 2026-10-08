// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Structured Logger
//
// A single, app-wide logger that:
//   • pretty-prints colored output in development (for terminal readability)
//   • emits newline-delimited JSON to stdout in production (for log
//     aggregation: Cloud Logging, Datadog, Loki, etc.)
//   • carries a per-call service tag so child loggers can be created for
//     subsystems (api, firestore, ai, billing, …)
//   • supports request-scoped context (userId / orgId / requestId) so every
//     log line emitted during a request can be correlated in the aggregator.
//
// Resilience: this module is intentionally side-effect free at import time.
// It never throws. All sinks (console) are guarded so a logging failure can
// never crash a request.
// ═══════════════════════════════════════════════════════════════════════════════

import { randomBytes } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  /** ISO-8601 timestamp string (UTC). */
  timestamp: string;
  level: LogLevel;
  message: string;
  /** Subsystem that emitted the entry (e.g. 'api', 'firestore', 'ai'). */
  service: string;
  /** Firebase UID of the acting user, if known. */
  userId?: string;
  /** Organization ID the request is scoped to, if known. */
  orgId?: string;
  /** Correlation ID for the request — see `generateRequestId()`. */
  requestId?: string;
  /** Duration of the operation, in milliseconds. */
  durationMs?: number;
  /** Arbitrary structured metadata. */
  metadata?: Record<string, unknown>;
  /** Normalized Error object (when the entry is the result of a caught error). */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ─── Environment detection ────────────────────────────────────────────────────

const IS_PROD =
  process.env.NODE_ENV === 'production' ||
  process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production';

const IS_BROWSER = typeof window !== 'undefined';

// ─── Request ID generation ────────────────────────────────────────────────────

/**
 * Generate a request-scoped correlation ID of the form `req_<nanoid>`.
 *
 * Uses `crypto.randomBytes` (universally available on Node; not used in the
 * browser branch) — falls back to a non-crypto RNG when running in the
 * browser so this module can be imported from client code without crashing.
 * The IDs are URL-safe and ~21 chars long.
 */
export function generateRequestId(): string {
  // 12 random bytes → 24 hex chars. Plenty of collision resistance for a
  // per-request ID, and zero dependency on a third-party library.
  if (IS_BROWSER) {
    // Browser: use Web Crypto if available, else Math.random fallback.
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `req_${hex}`;
    }
    return `req_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  }
  return `req_${randomBytes(12).toString('hex')}`;
}

// ─── Pretty-print colors (dev only) ───────────────────────────────────────────

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // gray
  info:  '\x1b[36m',  // cyan
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
  fatal: '\x1b[35m',  // magenta
};

const SERVICE_COLOR = '\x1b[2m';  // dim
const META_COLOR    = '\x1b[90m'; // gray
const RESET         = '\x1b[0m';

// ─── Logger class ─────────────────────────────────────────────────────────────

export class Logger {
  /** Subsystem tag — appears in every emitted line. */
  readonly service: string;

  /** Default context merged into every entry. */
  private defaultCtx: Partial<Pick<LogEntry, 'userId' | 'orgId' | 'requestId'>> = {};

  constructor(service: string, defaultCtx?: Partial<Pick<LogEntry, 'userId' | 'orgId' | 'requestId'>>) {
    this.service = service;
    if (defaultCtx) this.defaultCtx = { ...defaultCtx };
  }

  /** Update the default context (e.g. after authenticating the request). */
  setContext(ctx: Partial<Pick<LogEntry, 'userId' | 'orgId' | 'requestId'>>): void {
    this.defaultCtx = { ...this.defaultCtx, ...ctx };
  }

  /** Clear the default context (call at end of request). */
  clearContext(): void {
    this.defaultCtx = {};
  }

  debug(message: string, metadata?: Record<string, unknown>): void { this.emit('debug', message, metadata); }
  info (message: string, metadata?: Record<string, unknown>): void { this.emit('info',  message, metadata); }
  warn (message: string, metadata?: Record<string, unknown>): void { this.emit('warn',  message, metadata); }
  error(message: string, metadata?: Record<string, unknown>): void { this.emit('error', message, metadata); }
  fatal(message: string, metadata?: Record<string, unknown>): void { this.emit('fatal', message, metadata); }

  /**
   * Emit a log entry for a caught error. The Error is normalized into
   * `entry.error` so the aggregator can index name/message/stack.
   */
  errorFromError(err: unknown, metadata?: Record<string, unknown>): void {
    const normalized = normalizeError(err);
    this.emit('error', normalized.message, { ...metadata, errorName: normalized.name });
  }

  // ─── Core emit ────────────────────────────────────────────────────────────

  private emit(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      ...this.defaultCtx,
    };
    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = metadata;
    }

    try {
      if (IS_PROD) {
        // Production: newline-delimited JSON to stdout. Cloud Logging / Datadog
        // / Loki / OpenTelemetry all ingest this format natively.
        process.stdout.write(JSON.stringify(entry) + '\n');
      } else {
        // Development: colored pretty-print for terminal readability.
        this.prettyPrint(entry);
      }
    } catch {
      // Logging must NEVER throw. Swallow any I/O error silently.
    }
  }

  private prettyPrint(entry: LogEntry): void {
    const ts = entry.timestamp.replace('T', ' ').replace(/\..*Z$/, '');
    const lvl = `${LEVEL_COLOR[entry.level]}${entry.level.toUpperCase().padEnd(5)}${RESET}`;
    const svc = `${SERVICE_COLOR}[${entry.service}]${RESET}`;
    const ctx: string[] = [];
    if (entry.requestId) ctx.push(`req=${entry.requestId}`);
    if (entry.userId)    ctx.push(`uid=${entry.userId}`);
    if (entry.orgId)     ctx.push(`org=${entry.orgId}`);
    if (entry.durationMs !== undefined) ctx.push(`${entry.durationMs}ms`);
    const ctxStr = ctx.length ? ` ${META_COLOR}${ctx.join(' ')}${RESET}` : '';

    let line = `${META_COLOR}${ts}${RESET} ${lvl} ${svc}${ctxStr} ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      try {
        line += ` ${META_COLOR}${JSON.stringify(entry.metadata)}${RESET}`;
      } catch {
        // ignore serialization errors
      }
    }
    if (entry.error) {
      line += `\n  ${META_COLOR}${entry.error.name}: ${entry.error.message}${RESET}`;
      if (entry.error.stack) {
        const firstFrame = entry.error.stack.split('\n').slice(0, 4).join('\n  ');
        line += `\n  ${META_COLOR}${firstFrame}${RESET}`;
      }
    }

    // Use console for browser compatibility; in Node console writes to
    // stdout/stderr based on level which is the desired behavior.
    if (entry.level === 'error' || entry.level === 'fatal') {
       
      console.error(line);
    } else if (entry.level === 'warn') {
       
      console.warn(line);
    } else {
       
      console.log(line);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (typeof err === 'string') {
    return { name: 'Error', message: err };
  }
  if (err && typeof err === 'object') {
    const e = err as { message?: string; name?: string; stack?: string };
    return {
      name: e.name ?? 'Error',
      message: e.message ?? JSON.stringify(err),
      stack: e.stack,
    };
  }
  return { name: 'Error', message: String(err) };
}

// ─── Request logging helper ───────────────────────────────────────────────────

/**
 * Emit a structured log line for an HTTP request.
 *
 * Typically called from API route handlers (or middleware) after the response
 * is sent. The shape is stable so the aggregator can derive latency p50/p95
 * per route + status code.
 */
export function logRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  userId?: string,
  orgId?: string,
): void {
  logger.info(`${method} ${path} → ${status}`, {
    http: { method, path, status, durationMs },
    userId,
    orgId,
  });
}

// ─── Singleton + child logger factory ─────────────────────────────────────────

/**
 * App-wide singleton logger. Service tag: 'app'.
 *
 * Use this for general logging. For subsystem-specific logging (firestore,
 * billing, ai, …) call `createLogger('firestore')` to get a child logger
 * whose every line carries the subsystem tag.
 */
export const logger = new Logger('app');

/**
 * Create a child logger with a fixed service tag.
 *
 *   const log = createLogger('billing');
 *   log.info('subscription renewed', { plan: 'pro' });
 *   // → [billing] subscription renewed {"plan":"pro"}
 *
 * The child inherits nothing from the parent — context is per-instance.
 * Use `child.setContext({ userId, orgId, requestId })` at the start of a
 * request to stamp every subsequent line.
 */
export function createLogger(service: string): Logger {
  return new Logger(service);
}
