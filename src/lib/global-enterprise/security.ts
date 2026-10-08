// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Global Enterprise Operating System™
// Security™ — Zero-trust isolation, RBAC, audit logging, approval workflows.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { GlobalAuditLog } from '@prisma/client';

// ─── SHA-256 actor fingerprinting (privacy-safe) ─────────────────────────────

const DAILY_SALT_BASE = 'gstpilot-global-enterprise-v8';

function dailySalt(date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `${DAILY_SALT_BASE}:${day}`;
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function fingerprintActor(actor: string | undefined | null): Promise<string | null> {
  if (!actor) return null;
  return sha256(`${dailySalt()}:${actor}`);
}

// ─── Zero-trust RBAC ─────────────────────────────────────────────────────────

export type GlobalRole =
  | 'global_admin'      // sees every entity, every country
  | 'regional_admin'    // sees one region (e.g. APAC, EMEA)
  | 'country_admin'     // sees one country
  | 'entity_admin'      // sees one entity
  | 'analyst'           // read-only across allowed scope
  | 'viewer';           // read-only dashboards

export interface AuthContext {
  firmId?: string;
  role: GlobalRole;
  allowedCountries?: string[];      // for country_admin / regional_admin
  allowedEntities?: string[];       // for entity_admin
  actorRaw?: string;
}

export async function authorizeScope(
  ctx: AuthContext,
  requestedEntityId?: string,
  requestedCountryIso?: string
): Promise<{ allowed: boolean; reason?: string; scopedFirmId?: string }> {
  if (ctx.role === 'global_admin') return { allowed: true };
  if (requestedEntityId && ctx.allowedEntities && !ctx.allowedEntities.includes(requestedEntityId)) {
    return { allowed: false, reason: 'Entity outside allowed scope (zero-trust denied)' };
  }
  if (requestedCountryIso && ctx.allowedCountries && !ctx.allowedCountries.includes(requestedCountryIso.toUpperCase())) {
    return { allowed: false, reason: 'Country outside regional RBAC scope (zero-trust denied)' };
  }
  return { allowed: true, scopedFirmId: ctx.firmId };
}

// ─── Audit logging ───────────────────────────────────────────────────────────

export interface AuditParams {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  entityId?: string;
  countryIso?: string;
  actorRaw?: string;
  query?: Record<string, unknown>;
  responseSummary?: Record<string, unknown>;
  decision?: 'allow' | 'deny' | 'rate_limited';
  denialReason?: string;
  responseTimeMs?: number;
}

export async function logGlobalAudit(params: AuditParams): Promise<void> {
  try {
    const actorFingerprint = await fingerprintActor(params.actorRaw);
    await db.globalAuditLog.create({
      data: {
        endpoint: params.endpoint,
        method: params.method,
        entityId: params.entityId ?? null,
        countryIso: params.countryIso ?? null,
        actorFingerprint,
        query: JSON.stringify(params.query ?? {}),
        responseSummary: JSON.stringify(params.responseSummary ?? {}),
        decision: params.decision ?? 'allow',
        denialReason: params.denialReason ?? null,
        responseTimeMs: params.responseTimeMs ?? 0,
      },
    });
  } catch (err) {
    // audit logging is best-effort — never break the API call
    console.error('[global-enterprise:security] audit log failed:', err);
  }
}

export async function getRecentAuditLogs(limit = 50): Promise<GlobalAuditLog[]> {
  return db.globalAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });
}

// ─── Rate limiting (in-memory token bucket per actor+endpoint) ───────────────

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const RATE_BUCKETS = new Map<string, RateBucket>();
const MAX_TOKENS = 120;           // 120 requests
const REFILL_INTERVAL_MS = 60_000; // per minute

export function rateLimit(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key);
  if (!bucket) {
    RATE_BUCKETS.set(key, { tokens: MAX_TOKENS - 1, lastRefill: now });
    return { allowed: true, remaining: MAX_TOKENS - 1, retryAfterMs: 0 };
  }
  const elapsed = now - bucket.lastRefill;
  const refilled = Math.min(MAX_TOKENS, bucket.tokens + (elapsed / REFILL_INTERVAL_MS) * MAX_TOKENS);
  if (refilled < 1) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: REFILL_INTERVAL_MS - elapsed,
    };
  }
  const newTokens = refilled - 1;
  RATE_BUCKETS.set(key, { tokens: newTokens, lastRefill: now });
  return { allowed: true, remaining: Math.floor(newTokens), retryAfterMs: 0 };
}

// ─── PII sanitization for query/response logging ─────────────────────────────

const PII_PATTERNS = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // card numbers
  /\b[A-Z]{2}\d{5}[A-Z]\b/g,                     // PAN
  /\b\d{15}\b/g,                                  // GSTIN
  /\bIBAN[A-Z0-9\s]+\b/gi,                       // IBAN
];

export function sanitizeForLog(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  try {
    let json = JSON.stringify(input);
    for (const re of PII_PATTERNS) json = json.replace(re, '[REDACTED]');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Approval workflow ───────────────────────────────────────────────────────

export type ApprovalKind = 'entity_create' | 'entity_close' | 'cross_border_sim' | 'consolidation_override' | 'tax_threshold_change';

export function requiresApproval(kind: ApprovalKind, magnitude: number): boolean {
  switch (kind) {
    case 'entity_create': return true;             // always
    case 'entity_close': return true;              // always
    case 'cross_border_sim': return false;         // read-only simulation
    case 'consolidation_override': return magnitude > 1_000_000; // > ₹10L override
    case 'tax_threshold_change': return true;
    default: return false;
  }
}
