// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/oracle/forecast — Business Forecasting
//
// Forecasts future business metrics using REAL historical data. Always shows
// assumptions, data period, and confidence. NEVER fabricates a forecast —
// returns { sufficient: false, reason: "..." } when data is insufficient.
//
// Query params:
//   orgId    — required
//   kind     — cash_flow | revenue | receivables | gst_liability | itc_recovery | runway
//   horizon  — number of months to forecast (default 3)
//
// Auth: requireAuth + requireOrgMembership.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getUnifiedOracleContext } from '@/lib/oracle/context/builder';
import { forecast, type ForecastKind } from '@/lib/oracle/intelligence/forecaster';

export const runtime = 'nodejs';
export const revalidate = 0;

const VALID_KINDS: ForecastKind[] = ['cash_flow', 'revenue', 'receivables', 'gst_liability', 'itc_recovery', 'runway'];

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId') ?? '';
  const kindRaw = url.searchParams.get('kind') ?? 'cash_flow';
  const horizonRaw = parseInt(url.searchParams.get('horizon') ?? '3', 10);

  const orgResult = await requireOrgMembership(uid, orgId);
  if (orgResult instanceof NextResponse) return orgResult;

  if (!VALID_KINDS.includes(kindRaw as ForecastKind)) {
    return NextResponse.json(
      { error: `Invalid forecast kind. Valid: ${VALID_KINDS.join(', ')}`, code: 'INVALID_KIND' },
      { status: 400 }
    );
  }

  const horizon = isNaN(horizonRaw) || horizonRaw < 1 || horizonRaw > 12 ? 3 : horizonRaw;

  try {
    const ctx = await getUnifiedOracleContext(orgId);
    const result = await forecast(ctx, kindRaw as ForecastKind, horizon);
    return NextResponse.json({
      ok: true,
      forecast: result,
      evidenceIndex: ctx.evidenceIndex,
    });
  } catch (err) {
    return friendlyApiError(err, 'We could not generate the forecast right now.');
  }
}
