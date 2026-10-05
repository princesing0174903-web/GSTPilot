// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/oracle/anomalies — Proactive Anomaly Detection
//
// Runs the statistical/business-rule anomaly detector over the unified context.
// Returns a list of detected anomalies with severity, evidence, and recommended
// action. The LLM NEVER invents anomalies — it only reasons about anomalies
// this endpoint has already flagged.
//
// Auth: requireAuth + requireOrgMembership.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getUnifiedOracleContext } from '@/lib/oracle/context/builder';
import { detectAnomalies } from '@/lib/oracle/intelligence/anomaly-detector';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId') ?? '';

  const orgResult = await requireOrgMembership(uid, orgId);
  if (orgResult instanceof NextResponse) return orgResult;

  try {
    const ctx = await getUnifiedOracleContext(orgId);
    const anomalies = await detectAnomalies(ctx);
    return NextResponse.json({
      ok: true,
      anomalies,
      count: anomalies.length,
      criticalCount: anomalies.filter(a => a.severity === 'critical').length,
      evidenceIndex: ctx.evidenceIndex,
    });
  } catch (err) {
    return friendlyApiError(err, 'We could not detect anomalies right now.');
  }
}
