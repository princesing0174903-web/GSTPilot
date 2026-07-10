// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT™ GLOBAL DATA INTELLIGENCE CLOUD™ — Security & Performance Engine
// "Zero Trust. Every Query Audited. Every Anomaly Surfaced."
//
// This module enforces the security and observability posture of the entire
// intelligence cloud. Every API call that touches an intelligence endpoint is
// funneled through here for:
//
//   1. auditQuery()       — persists an IntelligenceQuery audit row (params
//                           redacted via the Privacy Engine first).
//   2. getSecurityStats() — rolls up the last 24h: total queries, rate-limited
//                           count, RBAC-enforced count, audit-logged count,
//                           anonymized contribution count, error count.
//   3. getRecentAudit()   — returns the last N audit rows (firmId/userId stripped).
//   4. rateLimitCheck()   — sliding 60s window: 120 requests/min per firm+endpoint.
//   5. requireApproval()  — deterministic RBAC policy for recommendation gating.
//
// PRIVACY CONTRACT: Audit entries never expose firmId or userId in their public
// shape. Rate-limit state is keyed on firmId internally but the boolean result
// reveals nothing about the firm identity.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { redactParams } from './anonymize';
import type {
  IntelligenceAuditEntry,
  IntelligenceQueryInput,
  IntelligenceSecurityStats,
} from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// Sliding-window rate limit: 120 requests / 60s per (firmId, endpoint).
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 120;

// High-risk recommendation categories always require at least CFO sign-off.
const HIGH_RISK_CATEGORIES = new Set(['expansion', 'pricing', 'banking']);

// ─── Audit Persistence ────────────────────────────────────────────────────────

/**
 * Persist an IntelligenceQuery audit row. The params object is deep-redacted
 * via the Privacy Engine BEFORE persistence so no PII or credential ever
 * reaches the audit table. NEVER throws — failures are logged and swallowed.
 */
export async function auditQuery(input: IntelligenceQueryInput): Promise<void> {
  try {
    let paramsJson: string | null = null;
    if (input.params && typeof input.params === 'object') {
      const redacted = redactParams(input.params);
      paramsJson = JSON.stringify(redacted);
    }

    await (db as any).intelligenceQuery.create({
      data: {
        firmId: FIRM_ID,
        endpoint: input.endpoint,
        method: input.method,
        statusCode: input.statusCode,
        durationMs: input.durationMs || 0,
        rbacRole: input.rbacRole ?? null,
        params: paramsJson,
        errorMessage: input.errorMessage ?? null,
      },
    });
  } catch (e) {
    console.warn('[intelligence/security] auditQuery failed:', e);
  }
}

// ─── Security Stats (last 24h) ────────────────────────────────────────────────

/**
 * Roll up security telemetry for the last 24 hours.
 *
 *   totalQueries            — count of IntelligenceQuery rows in the window
 *   rateLimited             — rows whose errorMessage matches /rate/i
 *   rbacEnforced            — rows whose rbacRole is non-null
 *   auditLogged             — equals totalQueries (every query is audit-logged)
 *   anonymizedContributions — count of IntelligenceContribution rows in the window
 *   errors                  — rows whose statusCode >= 400
 */
export async function getSecurityStats(): Promise<IntelligenceSecurityStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const empty: IntelligenceSecurityStats = {
    totalQueries: 0,
    rateLimited: 0,
    rbacEnforced: 0,
    auditLogged: 0,
    anonymizedContributions: 0,
    errors: 0,
  };

  try {
    const rows = await (db as any).intelligenceQuery.findMany({
      where: { createdAt: { gte: since } },
      select: { statusCode: true, rbacRole: true, errorMessage: true },
      take: 10000,
    });

    let rateLimited = 0;
    let rbacEnforced = 0;
    let errors = 0;

    for (const r of rows ?? []) {
      if (typeof r.statusCode === 'number' && r.statusCode >= 400) errors++;
      if (r.rbacRole) rbacEnforced++;
      if (r.errorMessage && /rate/i.test(String(r.errorMessage))) rateLimited++;
    }

    let anonymizedContributions = 0;
    try {
      anonymizedContributions = await (db as any).intelligenceContribution.count({
        where: { createdAt: { gte: since } },
      });
    } catch (e) {
      console.warn('[intelligence/security] contribution count failed:', e);
    }

    const total = rows?.length ?? 0;
    return {
      totalQueries: total,
      rateLimited,
      rbacEnforced,
      auditLogged: total,
      anonymizedContributions,
      errors,
    };
  } catch (e) {
    console.warn('[intelligence/security] getSecurityStats failed:', e);
    return empty;
  }
}

// ─── Recent Audit Trail ───────────────────────────────────────────────────────

/**
 * Return the last N IntelligenceQuery rows (newest first), mapped to the public
 * IntelligenceAuditEntry shape — firmId and userId are stripped.
 */
export async function getRecentAudit(limit: number = 50): Promise<IntelligenceAuditEntry[]> {
  try {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const rows = await (db as any).intelligenceQuery.findMany({
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });

    return (rows ?? []).map((r: Record<string, unknown>) => {
      const createdAt = r.createdAt;
      return {
        id: String(r.id ?? ''),
        endpoint: String(r.endpoint ?? ''),
        method: String(r.method ?? ''),
        statusCode: Number(r.statusCode ?? 0),
        durationMs: Number(r.durationMs ?? 0),
        rbacRole: r.rbacRole ? String(r.rbacRole) : null,
        errorMessage: r.errorMessage ? String(r.errorMessage) : null,
        createdAt:
          createdAt instanceof Date
            ? createdAt.toISOString()
            : String(createdAt ?? new Date().toISOString()),
      } satisfies IntelligenceAuditEntry;
    });
  } catch (e) {
    console.warn('[intelligence/security] getRecentAudit failed:', e);
    return [];
  }
}

// ─── Sliding-Window Rate Limiting ─────────────────────────────────────────────

/**
 * Sliding-window rate limit: at most 120 requests per 60 seconds per
 * (firmId, endpoint) pair. The window is evaluated by counting IntelligenceQuery
 * rows created in the last 60s for this firm+endpoint.
 *
 * @returns { allowed: boolean; remaining: number }
 *   allowed   — true if the request is under the limit
 *   remaining — number of requests left in the current window (>= 0)
 *
 * NEVER throws — on any error, returns { allowed: true, remaining: 120 } so
 * the security layer never becomes an availability bottleneck.
 */
export async function rateLimitCheck(
  firmId: string,
  endpoint: string,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const count = await (db as any).intelligenceQuery.count({
      where: { firmId, endpoint, createdAt: { gte: since } },
    });
    const used = Number(count) || 0;
    const remaining = Math.max(0, RATE_LIMIT_MAX - used);
    return { allowed: used < RATE_LIMIT_MAX, remaining };
  } catch (e) {
    console.warn('[intelligence/security] rateLimitCheck failed:', e);
    return { allowed: true, remaining: RATE_LIMIT_MAX };
  }
}

// ─── Recommendation Approval Policy ───────────────────────────────────────────

/**
 * Deterministic RBAC approval policy for AI-generated recommendations.
 *
 * Policy:
 *   confidence < 70  → CEO sign-off required
 *   confidence < 80  → CFO sign-off required
 *   confidence >= 80 → manager-level (auto-approved for non-high-risk)
 *
 * High-risk categories ('expansion', 'pricing', 'banking') always require at
 * least CFO sign-off, overriding the manager auto-approve path.
 *
 * @returns { required: boolean; role: 'manager' | 'cfo' | 'ceo' }
 *   required — true if a human sign-off is needed before execution
 *   role     — the minimum role that may approve (always set, even when
 *              required=false, to indicate the owning role)
 */
export function requireApproval(
  category: string,
  confidence: number,
): { required: boolean; role: 'manager' | 'cfo' | 'ceo' } {
  const isHighRisk = HIGH_RISK_CATEGORIES.has(category);
  const safeConfidence = Number.isFinite(confidence) ? confidence : 0;

  let role: 'manager' | 'cfo' | 'ceo';
  let required: boolean;

  if (safeConfidence < 70) {
    role = 'ceo';
    required = true;
  } else if (safeConfidence < 80) {
    role = 'cfo';
    required = true;
  } else {
    role = 'manager';
    // High-confidence, non-high-risk recommendations are auto-approved at the
    // manager level — no formal human sign-off needed.
    required = false;
  }

  // High-risk override: manager auto-approve is bumped to CFO sign-off.
  if (isHighRisk && role === 'manager') {
    role = 'cfo';
    required = true;
  }

  return { required, role };
}
