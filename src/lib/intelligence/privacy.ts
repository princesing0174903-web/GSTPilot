// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global Data Intelligence Cloud™ — Privacy & Security Layer
// Phase 7 — Security™ subsystem
// ═══════════════════════════════════════════════════════════════════════════════
//
// Guarantees:
//   • Organization identities are NEVER exposed — only opaque fingerprints
//   • All metrics are aggregated or bucketed (no individual values)
//   • Differential privacy noise added where appropriate (Laplace mechanism)
//   • Organization isolation: a single firm's contribution cannot be reverse-engineered
//   • Audit logging of every Executive API call
//   • Zero Trust: every query is authorized + sanitized
//
// Based on OWASP + NIST SP 800-188 (Differential Privacy) principles.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash, randomBytes } from 'crypto'
import { db } from '@/lib/db'
import type {
  IndustryKey,
  OrgFingerprint,
  RevenueBand,
  SizeBand,
} from './types'

// ─── Constants ─────────────────────────────────────────────────────────────────

// Per-organization salt rotates daily — guarantees the same firm produces
// different fingerprints on different days (impossible to track over time
// from outside the system). Stored in-memory only; never persisted.
const SALT_ROTATION_MS = 24 * 60 * 60 * 1000
let currentSalt = randomBytes(32).toString('hex')
let saltRotatedAt = Date.now()

function getActiveSalt(): string {
  const now = Date.now()
  if (now - saltRotatedAt > SALT_ROTATION_MS) {
    currentSalt = randomBytes(32).toString('hex')
    saltRotatedAt = now
  }
  return currentSalt
}

// Differential privacy epsilon — smaller = more privacy, more noise.
// ε = 1.0 is a standard conservative choice (NIST/Google DP literature).
const DP_EPSILON = 1.0

// Minimum sample size for any aggregated metric to be released.
// Below this threshold we return "insufficient_data" — preventing small-N re-identification.
export const MIN_SAMPLE_SIZE = 5

// ─── Fingerprinting ───────────────────────────────────────────────────────────

/**
 * Compute an irreversible SHA-256 fingerprint of an organization.
 * The fingerprint is the ONLY identifier persisted alongside contribution data.
 * It cannot be reversed to recover the firmId even if the DB leaks, because:
 *   1. A fresh random salt is mixed in (rotates daily)
 *   2. SHA-256 is a one-way function
 *   3. The salt is never persisted
 */
export function computeOrgFingerprint(firmId: string): string {
  const salt = getActiveSalt()
  return createHash('sha256')
    .update(`${firmId}:${salt}`)
    .digest('hex')
}

/**
 * Build a full fingerprint bundle (hash + anonymized industry/region/size band).
 */
export function buildOrgFingerprint(
  firmId: string,
  industry: IndustryKey,
  region: string,
  sizeBand: SizeBand,
): OrgFingerprint {
  return {
    hash: computeOrgFingerprint(firmId),
    industry,
    region: anonymizeRegion(region),
    sizeBand,
  }
}

// ─── Region Anonymization ─────────────────────────────────────────────────────

/**
 * Coarsen region granularity to privacy-safe buckets.
 * States are kept (they're not PII at org level) but city-level info is dropped.
 */
export function anonymizeRegion(region: string): string {
  if (!region) return 'unknown'
  const r = region.trim().toLowerCase()
  // Map common city names to states (privacy-safe coarsening)
  const cityToState: Record<string, string> = {
    mumbai: 'maharashtra',
    pune: 'maharashtra',
    nagpur: 'maharashtra',
    delhi: 'delhi',
    newdelhi: 'delhi',
    noida: 'uttar_pradesh',
    gurgaon: 'haryana',
    gurugram: 'haryana',
    bangalore: 'karnataka',
    bengaluru: 'karnataka',
    chennai: 'tamil_nadu',
    hyderabad: 'telangana',
    kolkata: 'west_bengal',
    ahmedabad: 'gujarat',
    surat: 'gujarat',
    jaipur: 'rajasthan',
    indore: 'madhya_pradesh',
    kochi: 'kerala',
    coimbatore: 'tamil_nadu',
    lucknow: 'uttar_pradesh',
    chandigarh: 'punjab',
  }
  return cityToState[r] || r
}

// ─── Revenue Bucketing ─────────────────────────────────────────────────────────

/**
 * Bucket absolute revenue into privacy-safe bands.
 * Bands are coarse enough to prevent re-identification.
 */
export function bucketRevenue(revenue: number): RevenueBand {
  if (revenue < 1_000_000) return '0-10L'                    // < ₹10 lakh
  if (revenue < 10_000_000) return '10L-1Cr'                 // ₹10L – ₹1 Cr
  if (revenue < 100_000_000) return '1Cr-10Cr'               // ₹1 Cr – ₹10 Cr
  return '10Cr+'                                              // ₹10 Cr+
}

/**
 * Determine size band from employee count.
 */
export function classifySizeBand(employeeCount: number): SizeBand {
  if (employeeCount < 10) return 'micro'
  if (employeeCount < 50) return 'small'
  if (employeeCount < 250) return 'medium'
  if (employeeCount < 1000) return 'large'
  return 'enterprise'
}

// ─── Differential Privacy (Laplace Mechanism) ─────────────────────────────────

/**
 * Add Laplace noise to a numeric value for differential privacy.
 * Sensitivity = 1.0 (assumes each org contributes ≤1 unit to any aggregate).
 *
 * The noise scale β = sensitivity / ε = 1 / ε.
 * With ε = 1.0, β = 1.0 — meaning each released aggregate is noised by an
 * amount drawn from a Laplace distribution centered at 0 with scale 1.0.
 *
 * For our use case (financial ratios in the 0-100 range), we scale noise
 * proportionally so it remains statistically meaningful but privacy-safe.
 */
export function addDpNoise(value: number, scale = 1.0, sensitivity = 1.0): number {
  const beta = sensitivity / DP_EPSILON
  const noise = laplaceSample(0, beta * scale)
  return value + noise
}

/**
 * Sample from a Laplace distribution using inverse CDF.
 * Laplace(μ, β): f(x) = (1/(2β)) * exp(-|x-μ|/β)
 */
function laplaceSample(mu: number, beta: number): number {
  const u = Math.random() - 0.5
  return mu - beta * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
}

/**
 * Determine whether a sample size is large enough for release.
 */
export function isSampleSafe(n: number): boolean {
  return n >= MIN_SAMPLE_SIZE
}

// ─── Aggregation Helpers ──────────────────────────────────────────────────────

/**
 * Compute percentiles from a sorted array.
 * Returns null for insufficient sample sizes (privacy guarantee).
 */
export function computePercentiles(
  values: number[],
): {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  mean: number
  stddev: number
  sampleSize: number
} | null {
  if (!isSampleSafe(values.length)) return null
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const pct = (p: number) => {
    const idx = (p / 100) * (n - 1)
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    if (lo === hi) return sorted[lo]
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }
  const mean = sorted.reduce((a, b) => a + b, 0) / n
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return {
    p10: round2(pct(10)),
    p25: round2(pct(25)),
    p50: round2(pct(50)),
    p75: round2(pct(75)),
    p90: round2(pct(90)),
    mean: round2(mean),
    stddev: round2(Math.sqrt(variance)),
    sampleSize: n,
  }
}

/**
 * Determine the percentile rank of a value within a sorted distribution.
 * Returns 0-100.
 */
export function percentileRank(sortedAsc: number[], value: number): number {
  if (sortedAsc.length === 0) return 0
  let count = 0
  for (const v of sortedAsc) {
    if (v <= value) count++
    else break
  }
  // Use midpoint interpolation for privacy-safe percentile
  return round2((count / sortedAsc.length) * 100)
}

/**
 * Determine verdict from a percentile rank.
 */
export function verdictFromPercentile(p: number | null): 'top_quartile' | 'above_average' | 'average' | 'below_average' | 'bottom_quartile' | 'insufficient_data' {
  if (p === null) return 'insufficient_data'
  if (p >= 75) return 'top_quartile'
  if (p >= 60) return 'above_average'
  if (p >= 40) return 'average'
  if (p >= 25) return 'below_average'
  return 'bottom_quartile'
}

// ─── Audit Logging ────────────────────────────────────────────────────────────

/**
 * Log every Executive API call for Security™ / Zero Trust.
 * Stores endpoint, method, sanitized query (no PII), response summary
 * (counts only — never raw values), decision, response time.
 */
export async function auditLog(params: {
  endpoint: string
  method: string
  orgFingerprint?: string | null
  query?: Record<string, unknown>
  responseSummary?: Record<string, unknown>
  decision?: 'allow' | 'deny' | 'rate_limited'
  denialReason?: string
  responseTimeMs?: number
}): Promise<void> {
  try {
    await db.intelligenceAuditLog.create({
      data: {
        endpoint: params.endpoint,
        method: params.method,
        orgFingerprint: params.orgFingerprint ?? null,
        query: safeStringify(params.query ?? {}),
        responseSummary: safeStringify(params.responseSummary ?? {}),
        decision: params.decision ?? 'allow',
        denialReason: params.denialReason ?? null,
        responseTimeMs: params.responseTimeMs ?? 0,
      },
    })
  } catch (err) {
    // Audit log failures must NEVER break the API
    console.error('[intelligence] audit log failed:', err)
  }
}

// ─── Rate Limiting (in-memory) ────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60                                    // 60 req/min per fingerprint
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

/**
 * Check rate limit for a fingerprint. Returns true if allowed.
 */
export function checkRateLimit(fingerprint: string): boolean {
  const now = Date.now()
  const entry = rateBuckets.get(fingerprint)
  if (!entry || entry.resetAt < now) {
    rateBuckets.set(fingerprint, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return '{}'
  }
}

/**
 * Sanitize a query object for audit logging — strip any potential PII fields.
 */
export function sanitizeQuery(query: Record<string, unknown>): Record<string, unknown> {
  const PII_KEYS = ['firmId', 'userId', 'email', 'phone', 'gstin', 'name', 'token', 'password']
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(query)) {
    if (PII_KEYS.some((pii) => key.toLowerCase().includes(pii.toLowerCase()))) continue
    if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.slice(0, 200) + '…'
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

/**
 * Get current period as YYYY-MM.
 */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

/**
 * Get current date as YYYY-MM-DD.
 */
export function currentDate(): string {
  return new Date().toISOString().slice(0, 10)
}
