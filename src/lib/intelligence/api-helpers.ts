// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Executive APIs — Shared Helpers
// ═══════════════════════════════════════════════════════════════════════════════
//
// Common helpers for all 12 Executive API endpoints:
//   • Audit logging (Security™ / Zero Trust)
//   • Rate limiting
//   • Response wrapping
//   • Error handling
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { auditLog, checkRateLimit, computeOrgFingerprint, sanitizeQuery } from './privacy'

/**
 * Wrap an Executive API handler with audit logging + rate limiting.
 */
export async function withIntelligenceApi<T>(
  req: NextRequest,
  endpoint: string,
  handler: (params: { orgFingerprint: string | null; query: URLSearchParams }) => Promise<T>,
): Promise<NextResponse> {
  const startedAt = Date.now()
  const url = new URL(req.url)
  const query = url.searchParams

  // Extract firm identifier (no PII logged)
  const firmId = query.get('firmId') || url.searchParams.get('firmId') || 'anonymous'
  const orgFingerprint = firmId !== 'anonymous' ? computeOrgFingerprint(firmId) : null

  // Rate limit check (per fingerprint)
  const rateLimitKey = orgFingerprint || 'anonymous'
  if (!checkRateLimit(rateLimitKey)) {
    await auditLog({
      endpoint,
      method: req.method,
      orgFingerprint,
      query: sanitizeQuery(Object.fromEntries(query.entries())),
      decision: 'rate_limited',
      denialReason: 'Rate limit exceeded (60 req/min)',
      responseTimeMs: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in a minute.' },
      { status: 429 },
    )
  }

  try {
    const result = await handler({ orgFingerprint, query })

    // Audit log (success)
    await auditLog({
      endpoint,
      method: req.method,
      orgFingerprint,
      query: sanitizeQuery(Object.fromEntries(query.entries())),
      responseSummary: { ok: true, keys: Object.keys(result as object).slice(0, 10) },
      decision: 'allow',
      responseTimeMs: Date.now() - startedAt,
    })

    return NextResponse.json(result)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    // Audit log (failure)
    await auditLog({
      endpoint,
      method: req.method,
      orgFingerprint,
      query: sanitizeQuery(Object.fromEntries(query.entries())),
      responseSummary: { ok: false, error: errorMessage.slice(0, 200) },
      decision: 'deny',
      denialReason: errorMessage.slice(0, 200),
      responseTimeMs: Date.now() - startedAt,
    })

    console.error(`[intelligence/${endpoint}] error:`, err)
    return NextResponse.json(
      { error: 'Internal intelligence error', message: errorMessage },
      { status: 500 },
    )
  }
}

/**
 * Parse a JSON body safely.
 */
export async function parseBody<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}
