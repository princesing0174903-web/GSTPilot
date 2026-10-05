// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Business Health API
//
// GET /api/business-health → returns the canonical Business Health Score and
//                             Risk Score (with per-factor breakdowns) from the
//                             Business Snapshot — the single source of truth.
//
// This route previously ran a SIXTH independent health engine
// (`connections/health-engine.ts:computeBusinessHealth`) with a different
// formula (6 sub-scores: compliance 22% + cashFlow 22% + collection 18% +
// growth 12% + profitability 14% + risk 12%) than the canonical 8-factor
// engine in `lib/business/snapshot.ts`. It now delegates to the canonical
// snapshot so `/api/business-health` and `/api/business-snapshot` always
// return the SAME health/risk scores for a given org.
//
// A `BusinessHealthSnapshot` row is still persisted on every successful call
// so the historical trend table continues to accumulate. The canonical
// health/risk scores + factor breakdowns are mapped into the legacy table
// schema (overall, complianceScore, cashFlowScore, etc.) for backward compat.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Helper: persist a BusinessHealthSnapshot row from the canonical snapshot ──
// The legacy table schema has 6 sub-score columns (complianceScore,
// cashFlowScore, collectionScore, growthScore, profitabilityScore, riskScore).
// We map the canonical 8-factor health score breakdown + risk score into those
// columns so historical trends remain queryable. Failures are non-fatal — a
// persistence error must NOT break the API response.
async function persistSnapshotRow(snapshot: Awaited<ReturnType<typeof getBusinessSnapshot>>) {
  const findFactorScore = (key: string) =>
    snapshot.healthScoreFactors.find((f) => f.key === key)?.score ?? 0;

  const complianceScore = findFactorScore('compliance_status');
  const cashFlowScore = findFactorScore('cash_balance');
  const collectionScore = findFactorScore('collection_rate');
  const growthScore = findFactorScore('revenue_trend');
  // Profitability is approximated from the outstanding_percentage + overdue_invoices
  // factors (lower outstanding/overdue = healthier profit cycle).
  const profitabilityScore = Math.round(
    (findFactorScore('outstanding_percentage') + findFactorScore('overdue_invoices')) / 2,
  );
  const riskScore = snapshot.riskScore;

  const period = new Date().toISOString().slice(0, 7);
  await db.businessHealthSnapshot.create({
    data: {
      overall: snapshot.healthScore,
      complianceScore,
      cashFlowScore,
      collectionScore,
      growthScore,
      profitabilityScore,
      riskScore,
      components: JSON.stringify({
        revenue: snapshot.revenue,
        expenses: snapshot.expenses,
        profit: snapshot.profit,
        cash: snapshot.cash,
        receivables: snapshot.receivables,
        payables: snapshot.payables,
        filedReturns: snapshot.filedReturns,
        pendingReturns: snapshot.pendingReturns,
        overdueReturns: snapshot.overdueReturns,
        revenueThisMonth: snapshot.revenueThisMonth,
        revenueLastMonth: snapshot.revenueLastMonth,
        workingCapital: snapshot.workingCapital,
        runwayDays: snapshot.runwayDays,
        collectionRate: snapshot.collectionRate,
      }),
      signals: JSON.stringify(snapshot.healthScoreFactors.map((f) => ({
        text: `${f.label}: ${f.detail}`,
        tone: f.score >= 75 ? 'positive' : f.score >= 50 ? 'neutral' : f.score >= 25 ? 'warning' : 'negative',
        score: f.score,
      }))),
      period,
    },
  });
}

// ─── GET /api/business-health ──────────────────────────────────────────────────
// Response shape (typed inline so the frontend can mirror it 1:1).
export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;
    const { searchParams } = new URL(request.url);
    const organizationId =
      searchParams.get('organizationId') ||
      searchParams.get('firmId') ||
      request.headers.get('x-gstpilot-orgid') ||
      '';

    const orgResult = await requireOrgMembership(uid, organizationId);
    if (orgResult instanceof NextResponse) return orgResult;

    // No org scope → empty state (never leak cross-tenant data)
    if (!organizationId) {
      return NextResponse.json({
        hasData: false,
        overall: null,
        healthScore: null,
        healthScoreLabel: null,
        healthScoreFactors: [],
        riskScore: null,
        riskScoreFactors: [],
      });
    }

    // ── Delegate to the canonical Business Snapshot ──
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const snapshot = await getBusinessSnapshot(organizationId, { forceRefresh });

    const hasData =
      snapshot.revenue > 0 ||
      snapshot.cash > 0 ||
      snapshot.invoiceCount > 0 ||
      snapshot.filedReturns > 0 ||
      snapshot.pendingReturns > 0;

    // Persist a snapshot row whenever we have real data, so the historical
    // trend table accumulates. Swallow persistence errors — a failure to write
    // history must NOT break the API response.
    if (hasData) {
      try {
        await persistSnapshotRow(snapshot);
      } catch (snapshotErr) {
        console.error('persistSnapshotRow failed (non-fatal):', snapshotErr);
      }
    }

    return NextResponse.json({
      hasData,
      // ── Canonical Health Score (replaces the legacy 6-component `overall`) ──
      overall: snapshot.healthScore,
      healthScore: snapshot.healthScore,
      healthScoreLabel: snapshot.healthScoreLabel,
      healthScoreFactors: snapshot.healthScoreFactors,
      // ── Canonical Risk Score ──
      riskScore: snapshot.riskScore,
      riskScoreFactors: snapshot.riskScoreFactors,
      // ── Backward-compat 6-component view (mapped from canonical factors) ──
      scores: {
        compliance: snapshot.healthScoreFactors.find((f) => f.key === 'compliance_status')?.score ?? 0,
        cashFlow: snapshot.healthScoreFactors.find((f) => f.key === 'cash_balance')?.score ?? 0,
        collection: snapshot.healthScoreFactors.find((f) => f.key === 'collection_rate')?.score ?? 0,
        growth: snapshot.healthScoreFactors.find((f) => f.key === 'revenue_trend')?.score ?? 0,
        profitability: Math.round(
          ((snapshot.healthScoreFactors.find((f) => f.key === 'outstanding_percentage')?.score ?? 0) +
            (snapshot.healthScoreFactors.find((f) => f.key === 'overdue_invoices')?.score ?? 0)) / 2,
        ),
        risk: snapshot.riskScore,
      },
      // ── Backward-compat signals (mapped from canonical factor details) ──
      signals: snapshot.healthScoreFactors.map((f) => ({
        text: `${f.label}: ${f.detail}`,
        tone:
          f.score >= 75 ? 'positive' :
          f.score >= 50 ? 'neutral' :
          f.score >= 25 ? 'warning' :
          'negative',
        score: f.score,
      })),
      // ── Backward-compat components (sourced from the canonical snapshot) ──
      components: {
        pendingReturns: snapshot.pendingReturns,
        overdueReturns: snapshot.overdueReturns,
        itcAvailable: snapshot.itcAvailable,
        cashAvailable: snapshot.cash,
        monthlyCollections: snapshot.revenueThisMonth,
        monthlyExpenses: Math.round(snapshot.expenses / 12),
        collectionChangePct:
          snapshot.revenueLastMonth > 0
            ? ((snapshot.revenueThisMonth - snapshot.revenueLastMonth) / snapshot.revenueLastMonth) * 100
            : 0,
        expenseChangePct: 0,
        activeNotices: 0,
        revenueGrowthPct:
          snapshot.revenueLastMonth > 0
            ? ((snapshot.revenueThisMonth - snapshot.revenueLastMonth) / snapshot.revenueLastMonth) * 100
            : 0,
      },
    });
  } catch (error) {
    console.error('GET /api/business-health error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute business health' },
      { status: 500 },
    );
  }
}
