// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Core™ — Security Engine
// Every AI call is RBAC-enforced, organization-isolated, audit-logged,
// prompt-logged, response-logged, token-encrypted, rate-limited, and
// approval-gated. No black boxes. No silent decisions.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// 32-byte key for AES-256-GCM. Pulled from env in production, defaults are
// only acceptable for local dev (the default string below is exactly 32 chars).
const ENCRYPTION_KEY =
  process.env.ORACLE_ENCRYPTION_KEY || 'gstpilot-oracle-default-key-32b!';

// ─── Request Body Sanitization ──────────────────────────────────────────────
// Any field whose name contains one of these substrings is redacted BEFORE the
// body is persisted to the audit log. This prevents passwords, API keys, and
// bearer tokens from leaking into long-term storage.

const SENSITIVE_FIELD_PATTERNS = [
  'password',
  'token',
  'secret',
  'apikey',
  'credential',
];

function sanitizeRequestBody(
  body: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return body;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const lowered = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELD_PATTERNS.some((p) =>
      lowered.includes(p),
    );
    if (isSensitive) {
      cleaned[key] = '***REDACTED***';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = sanitizeRequestBody(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ─── Audit Logging ──────────────────────────────────────────────────────────

export interface AuditLogInput {
  firmId?: string;
  userId?: string | null;
  action: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs?: number;
  requestBody?: Record<string, unknown> | null;
  responseHash?: string | null;
  rbacRole?: string | null;
  rateLimited?: boolean;
  errorMessage?: string | null;
}

/** Persist a single audit entry. Never throws — failures are logged to console. */
export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    const sanitized = sanitizeRequestBody(input.requestBody ?? null);
    await db.oracleAuditLog.create({
      data: {
        firmId: input.firmId || FIRM_ID,
        userId: input.userId ?? null,
        action: input.action,
        endpoint: input.endpoint,
        method: input.method,
        statusCode: input.statusCode,
        durationMs: input.durationMs ?? 0,
        requestBody: sanitized ? JSON.stringify(sanitized) : null,
        responseHash: input.responseHash ?? null,
        rbacRole: input.rbacRole ?? null,
        rateLimited: input.rateLimited ?? false,
        errorMessage: input.errorMessage ?? null,
      },
    });
  } catch (e) {
    console.warn('[Oracle Security] failed to persist audit log:', e);
  }
}

// ─── Security Stats ─────────────────────────────────────────────────────────

export interface SecurityStats {
  totalCalls: number;
  rateLimited: number;
  rbacEnforced: number;
  auditLogged: number;
  errors: number;
}

/** Aggregate security stats for the last 24 hours. */
export async function getSecurityStats(): Promise<SecurityStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const [totalCalls, rateLimited, rbacEnforced, errors] = await Promise.all([
      db.oracleAuditLog.count({ where: { createdAt: { gte: since } } }),
      db.oracleAuditLog.count({
        where: { createdAt: { gte: since }, rateLimited: true },
      }),
      db.oracleAuditLog.count({
        where: { createdAt: { gte: since }, rbacRole: { not: null } },
      }),
      db.oracleAuditLog.count({
        where: { createdAt: { gte: since }, statusCode: { gte: 400 } },
      }),
    ]);
    return {
      totalCalls,
      rateLimited,
      rbacEnforced,
      auditLogged: totalCalls,
      errors,
    };
  } catch (e) {
    console.warn('[Oracle Security] getSecurityStats failed:', e);
    return {
      totalCalls: 0,
      rateLimited: 0,
      rbacEnforced: 0,
      auditLogged: 0,
      errors: 0,
    };
  }
}

export interface AuditLogEntry {
  id: string;
  firmId: string;
  userId: string | null;
  action: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  requestBody: string | null;
  responseHash: string | null;
  rbacRole: string | null;
  rateLimited: boolean;
  errorMessage: string | null;
  createdAt: string;
}

/** Last N audit entries, newest first. */
export async function getRecentAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  try {
    const rows = await db.oracleAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
    return rows.map((r) => ({
      id: r.id,
      firmId: r.firmId,
      userId: r.userId,
      action: r.action,
      endpoint: r.endpoint,
      method: r.method,
      statusCode: r.statusCode,
      durationMs: r.durationMs,
      requestBody: r.requestBody,
      responseHash: r.responseHash,
      rbacRole: r.rbacRole,
      rateLimited: r.rateLimited,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (e) {
    console.warn('[Oracle Security] getRecentAuditLog failed:', e);
    return [];
  }
}

// ─── Sliding-Window Rate Limiter ────────────────────────────────────────────
// In-memory. One window per identifier. Old timestamps (>1 minute) are pruned
// on every check to prevent memory growth. Default: 60 calls per minute.

const rateLimitBuckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimitCheck(
  identifier: string,
  maxPerMinute = 60,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - 60 * 1000;

  const existing = rateLimitBuckets.get(identifier) ?? [];
  const fresh = existing.filter((ts) => ts > windowStart);

  if (fresh.length >= maxPerMinute) {
    // Oldest timestamp in the window determines the reset time.
    const oldest = fresh[0] ?? now;
    const resetAt = oldest + 60 * 1000;
    rateLimitBuckets.set(identifier, fresh);
    return { allowed: false, remaining: 0, resetAt };
  }

  fresh.push(now);
  rateLimitBuckets.set(identifier, fresh);

  // Opportunistic cleanup of OTHER stale buckets (lightweight, capped).
  if (rateLimitBuckets.size > 5000) {
    for (const [key, tsList] of rateLimitBuckets.entries()) {
      const pruned = tsList.filter((ts) => ts > windowStart);
      if (pruned.length === 0) {
        rateLimitBuckets.delete(key);
      } else if (pruned.length !== tsList.length) {
        rateLimitBuckets.set(key, pruned);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxPerMinute - fresh.length),
    resetAt: now + 60 * 1000,
  };
}

/** Test helper — clears the in-memory rate limit state. */
export function __resetRateLimiterForTests(): void {
  rateLimitBuckets.clear();
}

// ─── Approval Policy ────────────────────────────────────────────────────────

export interface ApprovalDecision {
  required: boolean;
  reason: string;
}

const LEGAL_COMPLIANCE_KEYWORDS = [
  'legal',
  'compliance',
  'lawsuit',
  'litigation',
  'gst notice',
  'income tax notice',
  'regulatory',
  'penalty',
  'audit',
  'statutory',
  'court',
];

/** Decide whether a reasoning outcome requires explicit human approval. */
export async function requireApproval(
  reasoningId: string,
  amount?: number,
): Promise<ApprovalDecision> {
  // 1. High-value threshold.
  if (amount !== undefined && amount > 100000) {
    return {
      required: true,
      reason: 'High-value action requires CEO approval',
    };
  }

  // 2. Load the reasoning record to inspect confidence + content.
  let reasoning: {
    businessReasoning: string;
    complianceReasoning: string;
    legalReasoning: string;
    riskReasoning: string;
    finalAnswer: string;
    confidence: number;
  } | null = null;
  try {
    reasoning = (await db.oracleReasoning.findUnique({
      where: { id: reasoningId },
      select: {
        businessReasoning: true,
        complianceReasoning: true,
        legalReasoning: true,
        riskReasoning: true,
        finalAnswer: true,
        confidence: true,
      },
    })) as unknown as {
      businessReasoning: string;
      complianceReasoning: string;
      legalReasoning: string;
      riskReasoning: string;
      finalAnswer: string;
      confidence: number;
    } | null;
  } catch (e) {
    console.warn(
      '[Oracle Security] requireApproval could not load reasoning:',
      e,
    );
  }

  if (reasoning) {
    // 3. Legal/compliance content.
    const haystack = [
      reasoning.businessReasoning,
      reasoning.complianceReasoning,
      reasoning.legalReasoning,
      reasoning.riskReasoning,
      reasoning.finalAnswer,
    ]
      .join(' ')
      .toLowerCase();
    if (LEGAL_COMPLIANCE_KEYWORDS.some((kw) => haystack.includes(kw))) {
      return {
        required: true,
        reason: 'Legal/compliance matter requires counsel approval',
      };
    }

    // 4. Low-confidence recommendation.
    if (reasoning.confidence < 60) {
      return {
        required: true,
        reason: 'Low-confidence AI recommendation requires human approval',
      };
    }
  }

  return { required: false, reason: 'No approval required' };
}

// ─── Response Integrity Hash ────────────────────────────────────────────────

/** SHA-256 hex digest of a response payload — used for audit + tamper detection. */
export function hashResponse(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

// ─── Token Encryption (Secrets Manager pattern) ────────────────────────────
// AES-256-GCM. Output format: base64(iv[12] || ciphertext || authTag[16]).
// The IV is freshly randomized on every encrypt call — never reuse.

function getKeyBuffer(): Buffer {
  const raw = Buffer.from(ENCRYPTION_KEY, 'utf8');
  if (raw.length !== 32) {
    throw new Error(
      `ORACLE_ENCRYPTION_KEY must be exactly 32 bytes (got ${raw.length}).`,
    );
  }
  return raw;
}

export function encryptToken(token: string): string {
  const key = getKeyBuffer();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

export function decryptToken(encrypted: string): string {
  const key = getKeyBuffer();
  const blob = Buffer.from(encrypted, 'base64');
  if (blob.length < 12 + 16) {
    throw new Error('Encrypted payload too short — corrupt or truncated.');
  }
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(blob.length - 16);
  const ciphertext = blob.subarray(12, blob.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
