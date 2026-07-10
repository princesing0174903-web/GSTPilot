// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT™ GLOBAL DATA INTELLIGENCE CLOUD™ — Privacy Engine
// "Learn From Every Business. Empower Every Business."
//
// This module is the privacy membrane of the Global Business Data Cloud™.
// Every metric that crosses the trust boundary from an organization into the
// global aggregate pool passes through here first:
//
//   1. hashFirmId()         — irreversible SHA-256 of the raw firm identifier
//   2. classifyRevenueBand()— coarse-grained bucket so no precise revenue leaks
//   3. addNoise()           — Laplace differential-privacy noise injection
//   4. anonymizeContribution() — assembles the privacy-safe contribution envelope
//   5. redactParams()       — strips PII / secrets before audit persistence
//
// PRIVACY CONTRACT: No function in this module ever returns or persists a raw
// firmId, email, phone, gstin, pan, or any credential. The hashed firmId is the
// only organization identifier that reaches the IntelligenceContribution table,
// and even that is never returned by any public aggregate API.
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import type { ContributionInput, RevenueBand } from './types';

// Default firm fallback — matches the convention used across Oracle Core.
const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// Keys that are scrubbed from any audit-logged param payload. Matched
// case-insensitively against the FULL key name (not substrings) so that
// legitimate fields like `category` or `displayName` are not accidentally
// redacted.
const SENSITIVE_KEYS = new Set([
  'firmid',
  'email',
  'phone',
  'gstin',
  'pan',
  'name',
  'token',
  'secret',
  'password',
]);

// ─── Firm Identity Hashing ───────────────────────────────────────────────────

/**
 * SHA-256 hex digest of the raw firmId. This is the ONLY form of the firm
 * identifier that is ever persisted to an intelligence aggregate table.
 * The hash is one-way — it cannot be reversed to recover the original firmId.
 */
export function hashFirmId(firmId: string): string {
  const source = firmId || FIRM_ID;
  return crypto.createHash('sha256').update(source, 'utf8').digest('hex');
}

// ─── Revenue Band Classification ──────────────────────────────────────────────

/**
 * Coarse-grained revenue bucket (monthly INR). Bucketing prevents precise
 * revenue figures from being recoverable even if a contribution leak occurred.
 *
 *   micro      — < ₹5L / month      (< 500,000)
 *   small      — < ₹50L / month     (< 5,000,000)
 *   medium     — < ₹5Cr / month     (< 50,000,000)
 *   large      — < ₹50Cr / month    (< 500,000,000)
 *   enterprise — >= ₹50Cr / month   (>= 500,000,000)
 */
export function classifyRevenueBand(monthlyRevenue: number): RevenueBand {
  if (!Number.isFinite(monthlyRevenue) || monthlyRevenue < 0) return 'micro';
  if (monthlyRevenue < 500_000) return 'micro';
  if (monthlyRevenue < 5_000_000) return 'small';
  if (monthlyRevenue < 50_000_000) return 'medium';
  if (monthlyRevenue < 500_000_000) return 'large';
  return 'enterprise';
}

// ─── Differential Privacy Noise ───────────────────────────────────────────────

/**
 * Sample from a Laplace(0, scale) distribution via the inverse CDF.
 *
 *   F^{-1}(u) = b * ln(2u)           for u < 0.5
 *             = -b * ln(2(1-u))      for u >= 0.5
 *
 * The result is clamped to ±5·scale so that a rare tail draw cannot
 * catastrophically distort a small aggregate.
 */
function laplaceSample(scale: number): number {
  if (!(scale > 0)) return 0;
  const u = Math.random() - 0.5; // [-0.5, 0.5)
  let noise: number;
  if (u < 0) {
    // 1 + 2u is in (0, 1] for u in [-0.5, 0)
    noise = scale * Math.log(1 + 2 * u);
  } else {
    // 1 - 2u is in (0, 1] for u in [0, 0.5)
    noise = -scale * Math.log(1 - 2 * u);
  }
  const cap = 5 * scale;
  if (noise > cap) return cap;
  if (noise < -cap) return -cap;
  return noise;
}

/**
 * Differential-privacy noise injection.
 *
 * The Laplace scale is derived from the value magnitude so that smaller values
 * get proportionally larger privacy budgets (preserving signal) while large
 * values get tighter budgets (protecting outliers):
 *
 *   |value| < 1000  →  scale = 2% · |value| / ε
 *   |value| >= 1000 →  scale = 1% · |value| / ε
 *
 * Smaller epsilon (ε) = more privacy = more noise. The default ε = 1.0 is the
 * standard DP calibration point. The returned value is guaranteed non-negative.
 */
export function addNoise(value: number, epsilon: number = 1.0): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  const magnitude = Math.abs(value);
  const pct = magnitude < 1000 ? 0.02 : 0.01;
  const eps = Math.max(epsilon, 1e-6);
  const scale = (pct * magnitude) / eps;
  const noisy = value + laplaceSample(scale);
  return noisy < 0 ? 0 : noisy;
}

// ─── Contribution Anonymization ───────────────────────────────────────────────

/**
 * Build the privacy-safe envelope for a single metric contribution.
 *
 * Returns:
 *   - anonymizedFirmHash  : SHA-256 of the firmId (stored in the firmId column
 *                           of IntelligenceContribution — NEVER the raw id)
 *   - contributionHash    : SHA-256 of (firmId + period + metricType), used as
 *                           the dedup key so a firm only contributes once per
 *                           metric per period
 *   - metricValue         : the DP-noised value ready for persistence
 *
 * This function is pure — it never touches the database.
 */
export function anonymizeContribution(
  input: ContributionInput,
  firmId: string,
): { anonymizedFirmHash: string; contributionHash: string; metricValue: number } {
  const effectiveFirmId = firmId || FIRM_ID;
  const anonymizedFirmHash = hashFirmId(effectiveFirmId);
  const contributionHash = crypto
    .createHash('sha256')
    .update(`${effectiveFirmId}|${input.period}|${input.metricType}`, 'utf8')
    .digest('hex');
  const metricValue = addNoise(input.metricValue, 1.0);
  return { anonymizedFirmHash, contributionHash, metricValue };
}

// ─── Param Redaction (Audit-Safe) ─────────────────────────────────────────────

/**
 * Deep-clone a params object, replacing every sensitive leaf value with the
 * literal string `[REDACTED]`. Used by the security audit layer so that query
 * params / request bodies can be persisted for forensics without leaking PII
 * or credentials.
 *
 * Sensitive keys (matched case-insensitively on the full key name):
 *   firmId, email, phone, gstin, pan, name, token, secret, password
 */
export function redactParams(params: Record<string, unknown>): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }
  return redactDeep({ ...params }) as Record<string, unknown>;
}

function redactDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactDeep(val);
      }
    }
    return out as unknown as T;
  }
  return value;
}
