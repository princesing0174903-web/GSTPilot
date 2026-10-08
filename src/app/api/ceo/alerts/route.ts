// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — EXECUTIVE ALERTS API
// GET /api/ceo/alerts
//
// Returns the Executive Alert System™ feed — cash shortage warnings, compliance
// risks, fraud signals, revenue drops, profit declines, customer churn, vendor
// risk, payroll issues, GST issues, bank anomalies, collections problems.
//
// Returns { alerts, activeCount, criticalCount, tagline }.
//
// Tagline: VEYRO AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getCachedCEODashboard } from '@/lib/ceo/orchestrator';
import { CEO_TAGLINE } from '@/lib/ceo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const dashboard = await getCachedCEODashboard('ceo');

    return NextResponse.json(
      {
        alerts: dashboard.alerts,
        activeCount: dashboard.activeAlertCount,
        criticalCount: dashboard.criticalAlertCount,
        tagline: CEO_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
          'X-CEO-Active-Alerts': String(dashboard.activeAlertCount),
          'X-CEO-Critical-Alerts': String(dashboard.criticalAlertCount),
        },
      },
    );
  } catch (error) {
    console.error('[CEO-Alerts] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute Executive Alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: CEO_TAGLINE,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
        },
      },
    );
  }
}
