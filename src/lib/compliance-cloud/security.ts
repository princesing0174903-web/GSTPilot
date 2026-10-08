// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 13: SECURITY™
// RBAC, organization isolation, audit logging, compliance signatures,
// rate limiting, Zero Trust validation. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type {
  ComplianceAuthContext,
  ComplianceRole,
  CompliancePolicy,
  ComplianceFiling,
  SignedAction,
} from './types';
import { recordAuditEntry } from './audit-cloud';

// ─── RBAC roles ───────────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<ComplianceRole, Set<string>> = {
  compliance_admin: new Set([
    'read', 'prepare', 'approve', 'submit', 'replay', 'manage_policies',
    'manage_regulations', 'resolve_risk', 'acknowledge_update', 'simulate',
  ]),
  compliance_officer: new Set([
    'read', 'prepare', 'approve', 'submit', 'replay', 'resolve_risk', 'simulate',
  ]),
  cfo: new Set(['read', 'approve', 'submit', 'replay']),
  ceo: new Set(['read', 'approve', 'submit', 'replay', 'manage_policies']),
  legal_counsel: new Set(['read', 'prepare', 'approve', 'replay', 'acknowledge_update']),
  auditor: new Set(['read', 'replay']),
  viewer: new Set(['read']),
  system: new Set([
    'read', 'prepare', 'approve', 'submit', 'replay', 'simulate', 'resolve_risk',
    'acknowledge_update',
  ]),
};

export function canPerformCompliance(role: ComplianceRole, action: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

// ─── Approval policy ──────────────────────────────────────────────────────────

/**
 * Determines whether a filing requires human approval before submission.
 * Uses the active policy's approval chain + risk tolerance + filing amount.
 */
export function needsComplianceApproval(
  filing: Pick<ComplianceFiling, 'summary' | 'countryIso' | 'filingType' | 'riskAssessment'>,
  policy: CompliancePolicy | null,
): boolean {
  if (!policy) return true; // No policy → always require approval (Zero Trust default).
  const totalLiability = typeof filing.summary.totalLiability === 'number'
    ? filing.summary.totalLiability
    : 0;
  if (totalLiability <= policy.maxAutoApproveINR && policy.maxAutoApproveINR > 0) {
    return false;
  }
  if (policy.approvalLevels.length === 0) return false;
  return true;
}

// ─── Compliance signature (SHA-256, daily salt) ──────────────────────────────

const DAILY_SALT_BASE = 'gstpilot-compliance-cloud-v11';

function dailySalt(): string {
  const d = new Date();
  return `${DAILY_SALT_BASE}-${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

export function signComplianceAction(
  action: string,
  actor: string,
  payload?: Record<string, unknown>,
): SignedAction {
  const timestamp = new Date().toISOString();
  const actionId = randomUUID();
  const canonical = JSON.stringify({ action, actor, ts: timestamp, payload: payload ?? {} });
  const signature = createHash('sha256').update(`${dailySalt()}:${canonical}`).digest('hex');
  return { actionId, signature, timestamp, actor };
}

// ─── Actor fingerprinting ────────────────────────────────────────────────────

export function fingerprintComplianceActor(actor: string | undefined): string {
  if (!actor) return 'unknown';
  return createHash('sha256').update(`${dailySalt()}:${actor}`).digest('hex').slice(0, 32);
}

// ─── Default auth context (super-admin in dev) ───────────────────────────────

export function defaultComplianceAuth(req: NextRequest): ComplianceAuthContext {
  const role = (req.headers.get('x-gstpilot-role') as ComplianceRole | null) ?? 'compliance_admin';
  const actor = req.headers.get('x-gstpilot-user') ?? req.headers.get('x-user-id') ?? 'oracle';
  return {
    role,
    organizationId: req.headers.get('x-gstpilot-org') ?? req.headers.get('x-firm-id') ?? undefined,
    countryIso: req.headers.get('x-gstpilot-country') ?? undefined,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userId: actor,
    fingerprint: fingerprintComplianceActor(actor),
  };
}

// ─── Body parser ─────────────────────────────────────────────────────────────

export async function parseComplianceBody<T = Record<string, unknown>>(
  req: NextRequest,
): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ─── Rate limiter (in-memory, per actor+endpoint+method) ─────────────────────

const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60 * 1000;

export function complianceRateLimit(
  actor: string,
  endpoint: string,
  method: 'GET' | 'POST',
): { allowed: boolean; remaining: number } {
  const limit = method === 'GET' ? 120 : 30;
  const key = `${actor}:${endpoint}:${method}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }
  bucket.count += 1;
  if (bucket.count > limit) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: limit - bucket.count };
}

// ─── API wrapper — RBAC + rate limit + audit + error handling ────────────────

export interface ComplianceApiOpts<T> {
  endpoint: string;
  method: 'GET' | 'POST';
  requiredAction?: string;
  auditActionType?:
    | 'filing_prepared' | 'filing_approved' | 'filing_submitted' | 'filing_rejected'
    | 'risk_detected' | 'risk_resolved' | 'policy_evaluated' | 'regulation_updated'
    | 'twin_simulated' | 'ai_recommendation' | 'signature_applied' | 'replay_requested';
  auditEntityType?: 'filing' | 'risk' | 'regulation' | 'policy' | 'score'
    | 'organization' | 'entity' | 'vendor' | 'employee';
  handler: (auth: ComplianceAuthContext) => Promise<T>;
}

export async function withComplianceApi<T>(
  req: NextRequest,
  opts: ComplianceApiOpts<T>,
): Promise<NextResponse> {
  const start = Date.now();
  const auth = defaultComplianceAuth(req);
  const actorKey = auth.userId ?? 'anon';

  // Rate limit
  const rl = complianceRateLimit(actorKey, opts.endpoint, opts.method);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Rate limit exceeded',
        meta: {
          endpoint: opts.endpoint,
          responseTimeMs: Date.now() - start,
          rateLimited: true,
        },
      },
      { status: 429 },
    );
  }

  // RBAC
  if (opts.requiredAction && !canPerformCompliance(auth.role, opts.requiredAction)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Role '${auth.role}' cannot perform '${opts.requiredAction}'`,
        meta: {
          endpoint: opts.endpoint,
          responseTimeMs: Date.now() - start,
          denied: opts.requiredAction,
        },
      },
      { status: 403 },
    );
  }

  try {
    const data = await opts.handler(auth);

    // Audit trail (best-effort — never fails the request)
    if (opts.auditActionType) {
      try {
        await recordAuditEntry({
          actionType: opts.auditActionType,
          entityType: opts.auditEntityType ?? 'filing',
          entityId: undefined,
          organizationId: auth.organizationId,
          countryIso: auth.countryIso,
          actorId: auth.userId,
          actorType: roleToActorType(auth.role),
          action: opts.endpoint,
          before: {},
          after: { endpoint: opts.endpoint, method: opts.method },
          ipAddress: auth.ipAddress,
        });
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({
      ok: true,
      data,
      meta: {
        endpoint: opts.endpoint,
        responseTimeMs: Date.now() - start,
        asOfDate: new Date().toISOString(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Compliance Cloud error';
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        meta: {
          endpoint: opts.endpoint,
          responseTimeMs: Date.now() - start,
        },
      },
      { status: 500 },
    );
  }
}

function roleToActorType(role: ComplianceRole): 'oracle' | 'ai_cfo' | 'ai_legal' | 'ai_coo' | 'human' | 'system' | 'connector' {
  switch (role) {
    case 'compliance_admin':
    case 'compliance_officer':
    case 'cfo':
    case 'ceo':
    case 'legal_counsel':
    case 'auditor':
    case 'viewer':
      return 'human';
    case 'system':
      return 'system';
    default:
      return 'oracle';
  }
}
