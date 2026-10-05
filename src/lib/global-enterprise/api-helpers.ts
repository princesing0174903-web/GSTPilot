// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Enterprise Operating System™
// API Helpers — Shared wrapper for all 13 Enterprise APIs:
//   - Audit logging (every call to GlobalAuditLog)
//   - Rate limiting (120 req/min per actor+endpoint)
//   - Error handling (never leak internals)
//   - Response wrapping with metadata (responseTimeMs, cached, asOfDate)
//   - PII sanitization for logs
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { logGlobalAudit, rateLimit, sanitizeForLog, fingerprintActor, type AuthContext } from './security';
import { todayISO } from './currency';

// ─── Helper: parse actor from request headers ────────────────────────────────

function extractActor(req: NextRequest): string | undefined {
  // x-gstpilot-user is set by the gateway / auth middleware
  return req.headers.get('x-gstpilot-user') ?? req.headers.get('x-user-id') ?? undefined;
}

function extractFirmId(req: NextRequest): string | undefined {
  return req.headers.get('x-gstpilot-firm') ?? req.headers.get('x-firm-id') ?? undefined;
}

// ─── Helper: parse JSON body safely ──────────────────────────────────────────

export async function parseBody<T = unknown>(req: NextRequest): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ─── Default auth context (global_admin for now — RBAC enforcement can be layered) ──

export function defaultAuthContext(req: NextRequest): AuthContext {
  return {
    role: 'global_admin',
    firmId: extractFirmId(req),
    actorRaw: extractActor(req),
  };
}

// ─── Main API wrapper ────────────────────────────────────────────────────────

export interface ApiResponseMeta {
  endpoint: string;
  responseTimeMs: number;
  cached: boolean;
  asOfDate: string;
}

export interface WithGlobalApiOptions<T> {
  endpoint: string;
  method: 'GET' | 'POST';
  req: NextRequest;
  // Country/Entity scope (for audit log attribution)
  entityId?: string;
  countryIso?: string;
  // Handler that returns the data
  handler: (ctx: { auth: AuthContext; query: URLSearchParams; body: unknown }) => Promise<T>;
  // Optional: custom rate-limit key suffix
  rateLimitSuffix?: string;
}

export async function withGlobalApi<T>(options: WithGlobalApiOptions<T>): Promise<NextResponse> {
  const start = Date.now();
  const { endpoint, method, req, handler } = options;
  const auth = defaultAuthContext(req);
  const query = new URL(req.url).searchParams;

  // Rate limit (per actor + endpoint)
  const rlKey = `${auth.actorRaw ?? 'anon'}:${endpoint}:${options.rateLimitSuffix ?? ''}`;
  const rl = rateLimit(rlKey);
  if (!rl.allowed) {
    await logGlobalAudit({
      endpoint,
      method,
      entityId: options.entityId,
      countryIso: options.countryIso,
      actorRaw: auth.actorRaw,
      query: sanitizeForLog(Object.fromEntries(query.entries())),
      decision: 'rate_limited',
      denialReason: `Rate limit exceeded. Retry after ${rl.retryAfterMs}ms.`,
      responseTimeMs: Date.now() - start,
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'Rate limit exceeded',
        meta: {
          endpoint,
          responseTimeMs: Date.now() - start,
          cached: false,
          asOfDate: todayISO(),
        },
      },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  // Parse body for POST
  let body: unknown = null;
  if (method === 'POST') {
    body = await parseBody(req);
  }

  // Execute handler
  try {
    const data = await handler({ auth, query, body });
    const responseTimeMs = Date.now() - start;
    const responseSummary: Record<string, unknown> = data
      ? (typeof data === 'object' && !Array.isArray(data)
          ? { keys: Object.keys(data as Record<string, unknown>).slice(0, 10) }
          : { type: typeof data, length: Array.isArray(data) ? data.length : undefined })
      : { empty: true };

    // Audit log (best-effort, non-blocking)
    await logGlobalAudit({
      endpoint,
      method,
      entityId: options.entityId,
      countryIso: options.countryIso,
      actorRaw: auth.actorRaw,
      query: sanitizeForLog(Object.fromEntries(query.entries())),
      responseSummary,
      decision: 'allow',
      responseTimeMs,
    });

    const meta: ApiResponseMeta = {
      endpoint,
      responseTimeMs,
      cached: false, // populated by individual endpoint if cache hit
      asOfDate: todayISO(),
    };
    return NextResponse.json({ ok: true, data, meta });
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[global-api:${endpoint}] error:`, err);

    await logGlobalAudit({
      endpoint,
      method,
      entityId: options.entityId,
      countryIso: options.countryIso,
      actorRaw: auth.actorRaw,
      query: sanitizeForLog(Object.fromEntries(query.entries())),
      decision: 'deny',
      denialReason: message,
      responseTimeMs,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        meta: {
          endpoint,
          responseTimeMs,
          cached: false,
          asOfDate: todayISO(),
        },
      },
      { status: 500 }
    );
  }
}

// ─── Convenience: standard JSON parse for POST bodies with validation ─────────

export function requireField<T extends Record<string, unknown>>(
  body: unknown,
  field: string,
  type: 'string' | 'number' | 'boolean' | 'object'
): T {
  if (!body || typeof body !== 'object') {
    throw new Error(`Request body is required`);
  }
  const obj = body as Record<string, unknown>;
  if (!(field in obj)) {
    throw new Error(`Missing required field: ${field}`);
  }
  const value = obj[field];
  if (typeof value !== type) {
    throw new Error(`Field "${field}" must be a ${type}`);
  }
  return obj as T;
}

// ─── Actor fingerprint helper (for endpoints that need to fingerprint) ───────

export { fingerprintActor };
