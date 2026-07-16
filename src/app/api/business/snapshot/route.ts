// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/business/snapshot
//
// The SINGLE source of truth for every dashboard metric in GSTPilot.
//
// Returns a UNIFIED Business Snapshot that contains BOTH shapes:
//   1. The "financial-engine" shape (used by DashboardPage: invoices.count,
//      customers, gst.netLiability, etc.)
//   2. The "business/snapshot" shape (used by Oracle + ZohoFullSyncPanel:
//      customerCount, invoiceCount, perEntity.zohoCustomers, etc.)
//
// Every page (Home, Oracle, AI CFO, Run Business, Autonomous, Zoho Books) MUST
// read from this endpoint. No page should query the database directly.
//
// Tenant scoping: ?organizationId=X (or ?firmId=X for legacy callers).
// Cache: 30-second in-memory cache (server-side). ?forceRefresh=true bypasses.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getBusinessSnapshot as getFinSnapshot } from '@/lib/financial-engine';
import { getBusinessSnapshot as getRichSnapshot } from '@/lib/business/snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    if (!tenantId) {
      // No tenant scope → return empty snapshot (not an error)
      const empty = await getFinSnapshot(null);
      return NextResponse.json(empty);
    }

    // ── Fetch BOTH snapshots in parallel, then MERGE into one unified shape ──
    // The financial-engine snapshot provides the nested {invoices, collections,
    // gst, risks, runway, forecast} structure used by DashboardPage.
    // The business/snapshot provides perEntity.zoho* and lastSync* used by
    // Oracle + ZohoFullSyncPanel.
    const [fin, rich] = await Promise.all([
      getFinSnapshot(tenantId, { forceRefresh }),
      getRichSnapshot(tenantId, { forceRefresh }).catch((err) => {
        console.error('[/api/business/snapshot] rich engine failed:', err);
        return null;
      }),
    ]);

    // ── Merge: start from the financial-engine snapshot, then layer in the
    //    rich snapshot's perEntity, lastSyncAt, lastSyncStatus. We do NOT
    //    overwrite the headline numbers (revenue, cash, etc.) because the
    //    financial-engine snapshot is already the canonical calculation. ──
    const unified = {
      ...fin,
      // Rich-only fields (always present, defaulting to safe values when rich failed)
      perEntity: rich?.perEntity ?? {
        zohoCustomers: 0,
        zohoVendors: 0,
        zohoItems: 0,
        zohoInvoices: 0,
        zohoBills: 0,
        zohoPaymentsReceived: 0,
        zohoPaymentsMade: 0,
        zohoCreditNotes: 0,
        zohoExpenses: 0,
        zohoTaxes: 0,
        zohoJournals: 0,
        zohoBankAccounts: 0,
        zohoBankTransactions: 0,
      },
      lastSyncAt: rich?.lastSyncAt ?? null,
      lastSyncStatus: rich?.lastSyncStatus ?? 'never',
      // Rich-shape aliases (so Oracle's buildBusinessSnapshotContextBlock works
      // without rewriting it). These mirror the financial-engine values.
      customerCount: fin.customers,
      vendorCount: fin.vendors,
      invoiceCount: fin.invoices.count,
      billCount: 0,
      expenseRecordCount: 0,
      profitMargin: fin.revenue > 0 ? fin.profit / fin.revenue : 0,
      outputTax: fin.gst.outputTax,
      inputTax: fin.gst.inputTax,
      gstLiability: fin.gst.netLiability,
      gstCollected: fin.gst.outputTax,
      totalCollected: fin.collections.totalCollected,
      totalPaid: 0,
      netCashFlow: 0,
      filedReturns: 0,
      pendingReturns: 0,
      overdueReturns: 0,
      riskScore: fin.risks.overallRisk,
      collectionRate: fin.collections.collectionRate / 100, // 0–1 scale for Oracle
      workingCapital: fin.receivables - fin.payables,
      runwayDays: fin.runway.monthsRemaining !== null
        ? fin.runway.monthsRemaining * 30
        : Number.POSITIVE_INFINITY,
      organizationId: tenantId,
      generatedAt: fin.updatedAt,
      // forecast trend compatibility (rich uses 'up'|'down'|'flat')
      forecast: {
        ...fin.forecast,
        trend: fin.forecast.nextMonthRevenue > fin.revenue
          ? 'up' as const
          : fin.forecast.nextMonthRevenue < fin.revenue
            ? 'down' as const
            : 'flat' as const,
      },
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
