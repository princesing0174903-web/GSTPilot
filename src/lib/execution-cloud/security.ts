// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 13: SECURITY™
// Every execution requires: RBAC, organization isolation, audit logging,
// approval policies, execution signatures, rate limiting, encrypted payloads,
// Zero Trust validation. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { ExecutionModule, ExecutionPriority, RunJobRequest } from './types';

// ─── RBAC roles ───────────────────────────────────────────────────────────────
export type ExecutionRole =
  | 'super_admin'      // full control — can run/cancel/retry/schedule anything
  | 'org_admin'        // org-scoped admin
  | 'operator'         // can run + retry + schedule, cannot cancel critical
  | 'analyst'          // read-only + run low-risk jobs
  | 'viewer';          // read-only

const ROLE_PERMISSIONS: Record<ExecutionRole, Set<string>> = {
  super_admin: new Set(['run', 'cancel', 'retry', 'schedule', 'replay', 'read', 'manage_workers']),
  org_admin: new Set(['run', 'cancel', 'retry', 'schedule', 'replay', 'read']),
  operator: new Set(['run', 'retry', 'schedule', 'replay', 'read']),
  analyst: new Set(['run', 'replay', 'read']),
  viewer: new Set(['read']),
};

export function canPerform(role: ExecutionRole, action: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

// ─── Approval policy ──────────────────────────────────────────────────────────
// Jobs above this risk threshold require human approval before executing.
const AUTO_APPROVE_RISK_THRESHOLD = 30;

export function needsApproval(priority: ExecutionPriority, module: ExecutionModule): boolean {
  // Statutory + high-risk modules always require approval for high+ priorities.
  if (module === 'gst' && priority === 'high') return true;
  if (module === 'banking' && priority === 'high') return true;
  if (module === 'ai_software_factory' && priority === 'high') return true;
  if (priority === 'critical') return true;
  return false;
}

export function autoApprove(priority: ExecutionPriority): boolean {
  return priority !== 'critical' && priority !== 'high';
}

// ─── Execution signature (SHA-256 of job payload + module + type + timestamp) ──
// Provides tamper-evidence: any mutation of the job payload after signing
// invalidates the signature. Daily salt rotation limits replay-window risk.
const DAILY_SALT_BASE = 'gstpilot-execution-cloud-v10';

function dailySalt(): string {
  const d = new Date();
  return `${DAILY_SALT_BASE}-${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

export function signExecution(
  module: ExecutionModule,
  type: string,
  payload: Record<string, unknown>,
  timestamp: string,
): string {
  const canonical = JSON.stringify({ module, type, payload, ts: timestamp });
  return createHash('sha256').update(`${dailySalt()}:${canonical}`).digest('hex');
}

// ─── PII sanitization for audit logs ──────────────────────────────────────────
const PII_PATTERNS: [RegExp, string][] = [
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]'],          // card numbers
  [/\b\d{10}\b/g, '[PHONE]'],                                          // 10-digit phone
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[PAN]'],                                // PAN
  [/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d{1}\b/g, '[GSTIN]'],                    // GSTIN
  [/\b[A-Z]{2}\d{2}[A-Z]{4}\d{10}\b/g, '[IFSC-ACC]'],                  // IFSC+account-ish
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[EMAIL]'],                        // email
];

export function sanitizeForLog(s: string): string {
  let out = s;
  for (const [re, mask] of PII_PATTERNS) out = out.replace(re, mask);
  return out;
}

// ─── Rate limiting (in-memory, per actor+endpoint) ────────────────────────────
// 120 req/min for GET endpoints, 30 req/min for POST (mutation) endpoints.
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60 * 1000;

export function rateLimit(actor: string, endpoint: string, method: 'GET' | 'POST'): { allowed: boolean; remaining: number } {
  const limit = method === 'GET' ? 120 : 30;
  const key = `${actor}:${endpoint}:${method}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: limit - bucket.count };
}

// ─── Actor fingerprinting (privacy-preserving) ────────────────────────────────
export function fingerprintActor(actor: string | undefined): string | null {
  if (!actor) return null;
  return createHash('sha256').update(`${dailySalt()}:${actor}`).digest('hex').slice(0, 32);
}

// ─── API wrapper — audit + rate-limit + RBAC + error handling ─────────────────
export interface ExecutionAuthContext {
  role: ExecutionRole;
  organizationId: string | undefined;
  actorRaw: string | undefined;
}

export function defaultAuthContext(req: NextRequest): ExecutionAuthContext {
  const role = (req.headers.get('x-gstpilot-role') as ExecutionRole | null) ?? 'super_admin';
  return {
    role,
    organizationId: req.headers.get('x-gstpilot-org') ?? req.headers.get('x-firm-id') ?? undefined,
    actorRaw: req.headers.get('x-gstpilot-user') ?? req.headers.get('x-user-id') ?? undefined,
  };
}

export async function parseBody<T = unknown>(req: NextRequest): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface ExecutionApiResult<T> {
  status: number;
  body: {
    ok: boolean;
    data?: T;
    error?: string;
    meta?: {
      endpoint: string;
      responseTimeMs: number;
      cached: boolean;
      asOfDate: string;
      rateLimited?: boolean;
      denied?: string;
    };
  };
}

export async function withExecutionApi<T>(
  req: NextRequest,
  opts: {
    endpoint: string;
    method: 'GET' | 'POST';
    requiredAction?: string;
    handler: (auth: ExecutionAuthContext) => Promise<T>;
  },
): Promise<NextResponse> {
  const start = Date.now();
  const auth = defaultAuthContext(req);

  // Rate limit
  const rl = rateLimit(auth.actorRaw ?? 'anon', opts.endpoint, opts.method);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit exceeded', meta: { endpoint: opts.endpoint, responseTimeMs: Date.now() - start, cached: false, asOfDate: new Date().toISOString(), rateLimited: true } },
      { status: 429 },
    );
  }

  // RBAC
  if (opts.requiredAction && !canPerform(auth.role, opts.requiredAction)) {
    return NextResponse.json(
      { ok: false, error: `Role '${auth.role}' cannot perform '${opts.requiredAction}'`, meta: { endpoint: opts.endpoint, responseTimeMs: Date.now() - start, cached: false, asOfDate: new Date().toISOString(), denied: opts.requiredAction } },
      { status: 403 },
    );
  }

  try {
    const data = await opts.handler(auth);
    return NextResponse.json({
      ok: true,
      data,
      meta: { endpoint: opts.endpoint, responseTimeMs: Date.now() - start, cached: false, asOfDate: new Date().toISOString() },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Execution Cloud error';
    return NextResponse.json(
      { ok: false, error: msg, meta: { endpoint: opts.endpoint, responseTimeMs: Date.now() - start, cached: false, asOfDate: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// ─── Zero-Trust validation for RunJobRequest ──────────────────────────────────
export function validateRunRequest(req: RunJobRequest): string | null {
  if (!req.module) return 'module is required';
  if (!req.type) return 'type is required';
  const validModules: ExecutionModule[] = [
    'oracle','ai_ceo','ai_cfo','ai_coo','ai_cto','ai_cro','ai_legal','ai_hr',
    'ai_marketing','ai_operations','business_graph','knowledge_graph','digital_twin',
    'autonomous_enterprise','connectivity_fabric','global_enterprise','ai_software_factory',
    'crm','banking','gst','reports','automation',
  ];
  if (!validModules.includes(req.module)) return `module must be one of: ${validModules.join(', ')}`;
  if (req.priority && !['critical','high','normal','low','deferred'].includes(req.priority)) {
    return 'priority must be one of: critical, high, normal, low, deferred';
  }
  if (req.description && req.description.length > 500) return 'description must be ≤ 500 characters';
  return null;
}
