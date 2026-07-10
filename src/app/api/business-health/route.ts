// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Real Data Activation · Business Health API
//
// GET /api/business-health → returns the computed Business Health Score breakdown
//                             (overall + 6 sub-scores + signals + components) along
//                             with the live compliance + bank summaries.
//
// All orchestration goes through /src/lib/connections/index.ts (no duplication).
// A BusinessHealthSnapshot row is persisted on every successful call so we
// accumulate a historical trend (Phase B2 requirement).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { loadOracleLiveData, saveHealthSnapshot } from '@/lib/connections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── GET /api/business-health ──────────────────────────────────────────────────
// Response shape (typed inline so the frontend can mirror it 1:1).
export async function GET() {
  try {
    const live = await loadOracleLiveData();

    const hasGstn = !!live.hasGstn;
    const hasBank = !!live.hasBank;
    const hasData = hasGstn || hasBank;

    const health = live.health;

    // Persist a snapshot row whenever we actually computed something, so the
    // historical trend table accumulates. We intentionally swallow snapshot
    // persistence errors — a failure to write history must NOT break the API
    // response (the UI still needs the live score to render).
    if (health) {
      try {
        await saveHealthSnapshot(health);
      } catch (snapshotErr) {
        console.error('saveHealthSnapshot failed (non-fatal):', snapshotErr);
      }
    }

    const scores = health
      ? {
          compliance: health.compliance,
          cashFlow: health.cashFlow,
          collection: health.collection,
          growth: health.growth,
          profitability: health.profitability,
          risk: health.risk,
        }
      : null;

    return NextResponse.json({
      hasData,
      hasGstn,
      hasBank,
      overall: health?.overall ?? null,
      scores,
      signals: health?.signals ?? null,
      components: health?.components ?? null,
      compliance: live.compliance,
      bank: live.bank,
    });
  } catch (error) {
    console.error('GET /api/business-health error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute business health' },
      { status: 500 },
    );
  }
}
