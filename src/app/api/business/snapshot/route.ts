// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/business/snapshot
//
// The SINGLE source of truth for every dashboard metric in GSTPilot.
//
// Returns a UNIFIED Business Snapshot that merges TWO engines:
//   1. `rich` (src/lib/business/snapshot.ts) — reads BOTH native Prisma tables
//      AND Zoho-synced tables (ZohoInvoice, ZohoCustomer, ZohoBill, …). This is
//      the CANONICAL headline numbers source because it reflects the connected
//      ERP. Revenue, Cash, Receivables, Payables, GST, Customers, Invoices all
//      come from here.
//   2. `fin` (src/lib/financial-engine) — provides the nested structure
//      ({invoices, collections, gst, risks, runway, forecast}) that the
//      DashboardPage expects, plus health/risk/forecast calculators.
//
// MERGE STRATEGY (the fix for Revenue=₹0 when Zoho data exists):
//   • Headline numbers (revenue, expenses, profit, cash, receivables, payables,
//     GST, customers, invoices) come from `rich` — NEVER from `fin`, because
//     `fin` only reads native tables and returns 0 when data is in Zoho tables.
//   • The nested `invoices`, `collections`, `gst`, `risks`, `runway`,
//     `forecast` structures are rebuilt from `rich` values so the DashboardPage
//     shape is preserved.
//   • `hasLiveData` is TRUE if EITHER engine has data (so Zoho-only orgs show
//     real numbers, not "Unavailable").
//   • `perEntity`, `lastSyncAt`, `lastSyncStatus` come from `rich`.
//
// Tenant scoping: ?organizationId=X (or ?firmId=X for legacy callers).
// Cache: 30-second in-memory cache (server-side). ?forceRefresh=true bypasses.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getBusinessSnapshot as getFinSnapshot, emptySnapshot } from '@/lib/financial-engine';
import { getBusinessSnapshot as getRichSnapshot, type BusinessSnapshot as RichSnapshot } from '@/lib/business/snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    if (!tenantId) {
      // No tenant scope → return empty snapshot (not an error)
      return NextResponse.json(emptySnapshot());
    }

    // ── Fetch BOTH snapshots in parallel ──
    // `rich` is the canonical source for headline numbers (includes Zoho data).
    // `fin` provides the nested-structure calculators (health, risk, forecast).
    const [fin, richResult] = await Promise.all([
      getFinSnapshot(tenantId, { forceRefresh }).catch((err) => {
        console.error('[/api/business/snapshot] fin engine failed:', err);
        return emptySnapshot();
      }),
      getRichSnapshot(tenantId, { forceRefresh }).catch((err) => {
        console.error('[/api/business/snapshot] rich engine failed:', err);
        return null;
      }),
    ]);

    // If rich failed entirely, fall back to fin (graceful degradation)
    if (!richResult) {
      return NextResponse.json(fin, {
        headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' },
      });
    }

    const rich = richResult as RichSnapshot;

    // ── hasLiveData: TRUE if either engine has real data ──
    // This ensures Zoho-only orgs (no native invoices) still show numbers.
    const richHasData =
      rich.revenue > 0 ||
      rich.customerCount > 0 ||
      rich.invoiceCount > 0 ||
      rich.cash > 0 ||
      rich.receivables > 0 ||
      rich.payables > 0 ||
      rich.outputTax > 0 ||
      rich.perEntity.zohoInvoices > 0 ||
      rich.perEntity.zohoCustomers > 0;
    const hasLiveData = fin.hasLiveData || richHasData;

    // ── Build the unified snapshot ──
    // Headlines come from `rich` (native + Zoho). Nested structures are rebuilt
    // from rich values so the DashboardPage shape is preserved.
    const revenue = rich.revenue;
    const expenses = rich.expenses;
    const profit = rich.profit;
    const cash = rich.cash;
    const customers = rich.customerCount;
    const vendors = rich.vendorCount;
    const invoiceCount = rich.invoiceCount;
    const receivables = rich.receivables;
    const payables = rich.payables;
    const outputTax = rich.outputTax;
    const inputTax = rich.inputTax;
    const gstLiability = rich.gstLiability;
    const totalCollected = rich.totalCollected;
    const collectionRate = rich.collectionRate; // 0–1 scale from rich

    const unified = {
      // ── Top-line financials (from rich — includes Zoho) ──
      revenue,
      expenses,
      profit,
      cash,
      bankBalance: cash,

      // ── Invoice & collections (rebuilt from rich) ──
      invoices: {
        total: revenue,
        count: invoiceCount,
        paid: totalCollected,
        outstanding: receivables,
        overdue: rich.overdueReceivables,
        draftCount: fin.invoices.draftCount, // only fin tracks draft status
      },
      collections: {
        collectionRate: collectionRate * 100, // fin uses 0–100 scale
        totalCollected,
        totalOutstanding: receivables,
        averageDaysToPay: fin.collections.averageDaysToPay,
      },
      receivables,
      payables,

      // ── GST (from rich — includes Zoho tax) ──
      gst: {
        outputTax,
        inputTax,
        netLiability: gstLiability,
        itcAvailable: rich.itcAvailable,
      },
      itc: rich.itcAvailable,

      // ── Entities (from rich — includes Zoho customers) ──
      customers,
      vendors,

      // ── Health & risk (CANONICAL — from rich engine, with per-factor breakdown) ──
      // rich.healthScore / rich.riskScore are the canonical scores (see task
      // HEALTH-ENGINE). The legacy fin.risks.* fields are kept for backward
      // compatibility with the existing `risks` nested shape.
      healthScore: rich.healthScore,
      healthScoreLabel: rich.healthScoreLabel,
      healthScoreFactors: rich.healthScoreFactors,
      riskScore: rich.riskScore,
      riskScoreFactors: rich.riskScoreFactors,
      risks: {
        overallRisk: rich.riskScore,
        overdueExposure: fin.risks.overdueExposure,
        complianceRisk: fin.risks.complianceRisk,
        cashFlowRisk: fin.risks.cashFlowRisk,
        riskLevel: fin.risks.riskLevel,
      },

      // ── Health Score engine inputs (NEW — exposed for transparency) ──
      overdueInvoiceCount: rich.overdueInvoiceCount,
      avgDaysToPay: rich.avgDaysToPay,
      revenueThisMonth: rich.revenueThisMonth,
      revenueLastMonth: rich.revenueLastMonth,
      topCustomerShare: rich.topCustomerShare,
      overdueReceivables: rich.overdueReceivables,

      // ── Forecast & runway (from rich engine) ──
      forecast: {
        nextMonthRevenue: rich.forecast.nextMonthRevenue,
        nextMonthExpenses: rich.forecast.nextMonthExpenses,
        projectedCash: fin.forecast.projectedCash,
        confidence: rich.forecast.confidence * 100, // rich uses 0–1, fin uses 0–100
      },
      runway: {
        monthsRemaining: rich.runwayDays === Number.POSITIVE_INFINITY
          ? null
          : rich.runwayDays > 0
            ? rich.runwayDays / 30
            : null,
        monthlyBurnRate: fin.runway.monthlyBurnRate,
        isProfitable: profit > 0,
      },

      // ── Compliance (from rich — includes Zoho returns) ──
      notices: fin.notices,

      // ── Rich-only fields (perEntity Zoho counts, sync status) ──
      perEntity: rich.perEntity,
      lastSyncAt: rich.lastSyncAt,
      lastSyncStatus: rich.lastSyncStatus,

      // ── Rich-shape aliases (flat fields Oracle + ZohoFullSyncPanel use) ──
      customerCount: customers,
      vendorCount: vendors,
      invoiceCount,
      billCount: rich.billCount,
      expenseRecordCount: rich.expenseRecordCount,
      profitMargin: rich.profitMargin,
      outputTax,
      inputTax,
      gstLiability,
      gstCollected: rich.gstCollected,
      totalCollected,
      totalPaid: rich.totalPaid,
      netCashFlow: rich.netCashFlow,
      filedReturns: rich.filedReturns,
      pendingReturns: rich.pendingReturns,
      overdueReturns: rich.overdueReturns,
      riskScore: rich.riskScore,
      collectionRate, // 0–1 scale (rich native)
      workingCapital: rich.workingCapital,
      runwayDays: rich.runwayDays,
      organizationId: tenantId,
      generatedAt: rich.generatedAt,

      // forecast trend (rich uses 'up'|'down'|'flat')
      forecastTrend: rich.forecast.trend,

      // ── Metadata ──
      updatedAt: rich.generatedAt,
      hasLiveData,
    };

    return NextResponse.json(unified, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    // Log the detailed error internally, return a friendly message
    console.error('[/api/business/snapshot] Error computing business snapshot:', error);

    return NextResponse.json(
      {
        error: 'We could not load your business snapshot right now. Please try again.',
        code: 'SNAPSHOT_FAILED',
      },
      { status: 500 },
    );
  }
}
