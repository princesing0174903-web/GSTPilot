// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle Real Data Layer™
// ═══════════════════════════════════════════════════════════════════════════════
//
// Aggregates REAL data from all connected sources so Oracle can answer:
//   "How is my business doing?"  →  using REAL connected data
//   "How much cash do I have?"   →  from REAL bank transactions
//   "Any GST notice?"            →  from REAL Gmail sync
//   "Which clients ignore reminders?" → from REAL WhatsApp data
//
// No demo values. No mock values. Only real connected data.
// If a source is not connected, Oracle knows and says so honestly.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { computeCashPosition, categorizeTransaction } from '@/lib/connectors/bank';
import { identifyIgnoringClients } from '@/lib/connectors/whatsapp';
import type { Connection } from '@/lib/connectors/types';
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot';

export interface RealDataSnapshot {
  userId: string;
  /** Optional canonical Business Snapshot used as the SINGLE source of truth
   * for headline financial aggregates (cash, revenue, expenses, receivables,
   * payables, GST). When present, the connector-state fields below are
   * SECONDARY — they describe sync status and recent activity only, never the
   * canonical headline numbers. */
  businessSnapshot?: BusinessSnapshot;
  connections: Array<{
    type: string;
    label: string;
    status: string;
    lastSyncAt: string | null;
    recordCount: number;
  }>;
  cashPosition: {
    connected: boolean;
    /** Canonical cash position (from Business Snapshot). Takes precedence over
     * any bank-connector-derived balance. Null only when no orgId was passed. */
    totalBalance: number | null;
    /** Bank-connector-derived recent activity (NOT the canonical cash). */
    recentCredits: number;
    recentDebits: number;
    netFlow: number;
    /** Bank-connector-derived time-windowed collections (NOT canonical revenue). */
    todayCollections: number;
    weekCollections: number;
    recentCollections: Array<{ description: string; amount: number; date: string }>;
  };
  gstStatus: {
    connected: boolean;
    gstin: string | null;
    tradeName: string | null;
    filingStatus: string | null;
    itcPosition: number | null;
    recentNotices: Array<{ title: string; date: string }>;
  };
  emailInsights: {
    connected: boolean;
    email: string | null;
    totalSynced: number;
    gstNotices: number;
    vendorInvoices: number;
    clientInvoices: number;
    taxCommunications: number;
    recentNotices: Array<{ subject: string; from: string; date: string }>;
  };
  whatsappInsights: {
    connected: boolean;
    phoneNumber: string | null;
    totalMessages: number;
    remindersSent: number;
    clientsIgnoringReminders: Array<{
      contactName: string;
      remindersSent: number;
      daysSinceLastReminder: number;
    }>;
  };
  accountingSync: {
    connected: boolean;
    software: string | null;
    companyName: string | null;
    salesInvoices: number;
    purchaseBills: number;
    /** Canonical revenue (from Business Snapshot) — replaces the local
     * accounting-connector-derived totalSales to avoid duplicate/conflicting
     * headline numbers. Null when no orgId was passed. */
    totalSales: number | null;
    /** Canonical purchases payable (from Business Snapshot.payables) —
     * approximate proxy for totalPurchases since the snapshot does not break
     * out purchases separately from operating expenses. Null when no orgId. */
    totalPurchases: number | null;
  };
  dataQuality: {
    totalAlerts: number;
    critical: number;
    high: number;
    topAlerts: Array<{ title: string; severity: string; category: string }>;
  };
  connectedCount: number;
  hasAnyConnection: boolean;
}

/**
 * Build the real data snapshot for Oracle.
 *
 * Two concerns (AUDIT-DUP-1 fix):
 *   (1) CONNECTION-STATE — DataConnection, SyncedRecord, DataQualityAlert.
 *       User-scoped via `where: { userId }` (these tables have no firmId).
 *       Describes which sources are connected and their sync health.
 *   (2) FINANCIAL AGGREGATES — cash, revenue, expenses. Source these from
 *       `getBusinessSnapshot(organizationId)` when orgId is provided so the
 *       Oracle LLM sees ONE canonical number per metric, not two competing
 *       numbers (snapshot vs. connector-derived).
 *
 * Record-level detail (specific recent collections, notice subjects, ignoring
 * client names) is still sourced from SyncedRecord rows — legitimate detail
 * that the snapshot does not provide.
 */
export async function buildRealDataSnapshot(
  userId: string,
  organizationId?: string,
): Promise<RealDataSnapshot> {
  // ── 1. Fetch the canonical Business Snapshot (parallel with connector reads) ──
  // When orgId is provided, the snapshot's cash/revenue/expenses become the
  // authoritative headline numbers; connector-derived aggregates below are
  // demoted to "recent activity" context only.
  const snapshotP = organizationId
    ? getBusinessSnapshot(organizationId).catch(() => null)
    : Promise.resolve(null);

  // ── 2. Connection-state reads — already user-scoped (DataConnection,
  //    SyncedRecord, DataQualityAlert have a userId column but no firmId). ──
  const [connections, syncedRecords, qualityAlerts, snapshot] = await Promise.all([
    db.dataConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
    db.syncedRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
    db.dataQualityAlert.findMany({
      where: { userId, resolved: false },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
    snapshotP,
  ]);

  const connectedCount = connections.filter((c) => c.status === 'connected').length;

  // ── 3. Bank connection state (which bank connections exist, recent activity) ──
  const bankConnections = connections.filter((c) => c.type === 'bank' && c.status === 'connected');
  const bankRecords = syncedRecords.filter((r) => r.sourceType === 'bank_tx');
  const bankTxParsed = bankRecords.map((r) => {
    const data = r.rawData ? JSON.parse(r.rawData) : {};
    return {
      transactionId: r.externalId ?? r.id,
      date: r.date ?? '',
      description: r.title ?? '',
      amount: r.amount ?? 0,
      type: (data.type ?? (r.amount && r.amount > 0 ? 'credit' : 'debit')) as 'credit' | 'debit',
      balanceAfter: data.balanceAfter ?? 0,
      category: r.category ?? categorizeTransaction(r.title ?? ''),
    };
  });
  const cashPosition = computeCashPosition(bankTxParsed);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
  const todayCollections = cashPosition.credits
    .filter((t) => new Date(t.date) >= todayStart)
    .reduce((s, t) => s + t.amount, 0);
  const weekCollections = cashPosition.credits
    .filter((t) => new Date(t.date) >= weekStart)
    .reduce((s, t) => s + t.amount, 0);

  // ── 4. GST Status (from GSTN connections) ──
  const gstnConnections = connections.filter((c) => c.type === 'gstn' && c.status === 'connected');
  const gstnMeta = gstnConnections[0]?.metadata ? JSON.parse(gstnConnections[0].metadata) : {};
  const gstNoticeEmails = syncedRecords.filter(
    (r) => r.sourceType === 'email' && r.category === 'gst_notice',
  );

  // ── 5. Email Insights (from Gmail connections) ──
  const gmailConnections = connections.filter((c) => c.type === 'gmail' && c.status === 'connected');
  const gmailMeta = gmailConnections[0]?.metadata ? JSON.parse(gmailConnections[0].metadata) : {};
  const emailRecords = syncedRecords.filter((r) => r.sourceType === 'email');
  const emailCategoryCount = (cat: string) =>
    emailRecords.filter((r) => r.category === cat).length;

  // ── 6. WhatsApp Insights ──
  const waConnections = connections.filter((c) => c.type === 'whatsapp' && c.status === 'connected');
  const waMeta = waConnections[0]?.metadata ? JSON.parse(waConnections[0].metadata) : {};
  const waMessages = syncedRecords
    .filter((r) => r.sourceType === 'whatsapp_msg')
    .map((r) => {
      const data = r.rawData ? JSON.parse(r.rawData) : {};
      return {
        messageId: r.externalId ?? r.id,
        contactName: data.contactName ?? 'Unknown',
        contactPhone: data.contactPhone ?? '',
        direction: (data.direction ?? 'outbound') as 'outbound' | 'inbound',
        messageText: r.title ?? '',
        timestamp: r.date ?? new Date().toISOString(),
        type: data.type ?? 'general',
      };
    });
  const ignoringClients = identifyIgnoringClients(waMessages);

  // ── 7. Accounting Sync (connection-state + record counts only) ──
  // Headline revenue/expenses come from the snapshot — see `totalSales` /
  // `totalPurchases` overrides below.
  const accConnections = connections.filter(
    (c) => ['tally', 'zoho', 'quickbooks'].includes(c.type) && c.status === 'connected',
  );
  const accMeta = accConnections[0]?.metadata ? JSON.parse(accConnections[0].metadata) : {};
  const accInvoiceRecords = syncedRecords.filter((r) => r.sourceType === 'accounting_invoice');
  const salesInvoices = accInvoiceRecords.filter((r) => r.category === 'client_invoice');
  const purchaseInvoices = accInvoiceRecords.filter((r) => r.category === 'vendor_invoice');
  const connectorTotalSales = salesInvoices.reduce((s, r) => s + (r.amount ?? 0), 0);
  const connectorTotalPurchases = purchaseInvoices.reduce((s, r) => s + (r.amount ?? 0), 0);

  return {
    userId,
    businessSnapshot: snapshot ?? undefined,
    connections: connections.map((c) => ({
      type: c.type,
      label: c.label,
      status: c.status,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      recordCount: syncedRecords.filter((r) => r.connectionId === c.id).length,
    })),
    cashPosition: {
      connected: bankConnections.length > 0,
      // AUDIT-DUP-1 fix: canonical cash position comes from the Business
      // Snapshot. The bank-connector-derived balance is no longer the
      // headline number — only `recentCredits` / `recentDebits` / `netFlow`
      // remain as connector activity context.
      totalBalance: snapshot?.cash ?? (bankConnections.length > 0 ? cashPosition.currentBalance : null),
      recentCredits: cashPosition.totalCredits,
      recentDebits: cashPosition.totalDebits,
      netFlow: cashPosition.netFlow,
      todayCollections,
      weekCollections,
      recentCollections: cashPosition.collections.slice(0, 5).map((t) => ({
        description: t.description,
        amount: t.amount,
        date: t.date,
      })),
    },
    gstStatus: {
      connected: gstnConnections.length > 0,
      gstin: gstnMeta.gstin ?? null,
      tradeName: gstnMeta.tradeName ?? null,
      filingStatus: gstnMeta.registrationStatus ?? null,
      itcPosition: snapshot?.itcAvailable ?? null, // AUDIT-DUP-1: canonical ITC from snapshot
      recentNotices: gstNoticeEmails.slice(0, 3).map((r) => ({
        title: r.title ?? 'GST Notice',
        date: r.date ?? '',
      })),
    },
    emailInsights: {
      connected: gmailConnections.length > 0,
      email: gmailMeta.email ?? null,
      totalSynced: emailRecords.length,
      gstNotices: emailCategoryCount('gst_notice'),
      vendorInvoices: emailCategoryCount('vendor_invoice'),
      clientInvoices: emailCategoryCount('client_invoice'),
      taxCommunications: emailCategoryCount('tax_communication'),
      recentNotices: emailRecords
        .filter((r) => r.category === 'gst_notice')
        .slice(0, 3)
        .map((r) => {
          const data = r.rawData ? JSON.parse(r.rawData) : {};
          return { subject: r.title ?? '', from: data.from ?? '', date: r.date ?? '' };
        }),
    },
    whatsappInsights: {
      connected: waConnections.length > 0,
      phoneNumber: waMeta.phoneNumber ?? null,
      totalMessages: waMessages.length,
      remindersSent: waMessages.filter((m) => m.type === 'payment_reminder').length,
      clientsIgnoringReminders: ignoringClients.slice(0, 5).map((c) => ({
        contactName: c.contactName,
        remindersSent: c.remindersSent,
        daysSinceLastReminder: c.daysSinceLastReminder,
      })),
    },
    accountingSync: {
      connected: accConnections.length > 0,
      software: accMeta.software ?? accConnections[0]?.type ?? null,
      companyName: accMeta.companyName ?? null,
      salesInvoices: salesInvoices.length,
      purchaseBills: purchaseInvoices.length,
      // AUDIT-DUP-1 fix: canonical revenue/expenses from the Business Snapshot.
      // Falls back to connector-derived totals only when no orgId was passed
      // (backwards-compat for /api/oracle/real-data callers that don't send orgId).
      totalSales: snapshot?.revenue ?? connectorTotalSales,
      totalPurchases: snapshot?.payables ?? connectorTotalPurchases,
    },
    dataQuality: {
      totalAlerts: qualityAlerts.length,
      critical: qualityAlerts.filter((a) => a.severity === 'critical').length,
      high: qualityAlerts.filter((a) => a.severity === 'high').length,
      topAlerts: qualityAlerts.slice(0, 5).map((a) => ({
        title: a.title,
        severity: a.severity,
        category: a.category,
      })),
    },
    connectedCount,
    hasAnyConnection: connectedCount > 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC RECOMMENDATIONS (PT-1-b)
// ═══════════════════════════════════════════════════════════════════════════════
// generateDynamicRecommendations(organizationId, userId) reads REAL business
// state from the DB (Invoice, GSTRFiling, Notice, Issue, Payment, Expense,
// FilingEvent, ExecutiveReport) — all ORG-SCOPED via `client.firmId` — and
// returns 3-5 actionable, priority-ranked recommendations. Headline financial
// numbers (cash, revenue, expenses, outstanding) come from the Business
// Snapshot when organizationId is provided; record-level detail (overdue
// invoice numbers, pending filing periods, open notice subjects) comes from
// org-scoped Prisma reads. NEVER static / canned — if the DB is empty, it
// tells the user honestly to connect data sources.

export interface DynamicRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  action: string;
  rationale: string;
  metric?: string;
}

function inrShort(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export async function generateDynamicRecommendations(
  organizationId?: string,
  userId?: string,
): Promise<DynamicRecommendation[]> {
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 86400000);

  // ── AUDIT-DUP-1 fix ─────────────────────────────────────────────────────
  // (1) Fetch the canonical Business Snapshot for headline financial numbers
  //     (cash, revenue, expenses, outstanding). We never recompute these from
  //     raw Prisma rows when an orgId is provided.
  // (2) Org-scope EVERY record-level Prisma read below with
  //     `client: { firmId: organizationId }`. Previously these reads had NO
  //     where clause → cross-tenant data leak. Now they return only this
  //     org's invoices / expenses / payments / filings / notices / issues.
  // (3) For local- (guest/demo) orgs, all org-scoped reads return 0 rows
  //     because no Firm row matches → honest empty state.
  //
  // The record-level reads remain necessary because the snapshot does NOT
  // provide: overdue invoice numbers, pending filing periods, open notice
  // subjects, or upcoming filing event timestamps. These are legitimate
  // record-level details.
  const snapshotP = organizationId
    ? getBusinessSnapshot(organizationId).catch(() => null)
    : Promise.resolve(null);

  // Org filter — applied to every financial record read.
  const orgClientFilter = organizationId
    ? { client: { firmId: organizationId } }
    : {};
  // FilingEvent links to org via clientId → client.firmId.
  const filingEventOrgFilter = organizationId
    ? { client: { firmId: organizationId }, timestamp: { gte: today, lte: in30 } }
    : { timestamp: { gte: today, lte: in30 } };
  // ExecutiveReport has no firmId link — filter by generatedBy (userId) when
  // available, otherwise accept the small risk of cross-tenant report counts
  // (this only affects the "no recent report" recommendation, which is benign).
  const reportFilter = userId
    ? { generatedBy: userId, createdAt: { gte: new Date(today.getTime() - 7 * 86400000) } }
    : { createdAt: { gte: new Date(today.getTime() - 7 * 86400000) } };

  const [invoices, expenses, payments, filings, upcomingEvents, openNotices, openIssues, snapshot] =
    await Promise.all([
      db.invoice.findMany({ where: orgClientFilter, take: 500 }).catch(() => []),
      db.expense.findMany({ where: orgClientFilter, take: 500 }).catch(() => []),
      db.payment.findMany({ where: { ...orgClientFilter, status: 'completed' } }).catch(() => []),
      db.gSTRFiling.findMany({ where: orgClientFilter }).catch(() => []),
      db.filingEvent
        .findMany({ where: filingEventOrgFilter })
        .catch(() => []),
      db.notice.findMany({ where: { ...orgClientFilter, status: 'open' } }).catch(() => []),
      db.issue.findMany({ where: { ...orgClientFilter, status: 'open' } }).catch(() => []),
      snapshotP,
    ]);

  const recs: DynamicRecommendation[] = [];

  // Empty-DB guard — be honest, never static.
  // When we have a snapshot, use it as the source of truth for "has data".
  const hasSnapshotData = !!snapshot && (
    snapshot.revenue > 0 ||
    snapshot.expenses > 0 ||
    snapshot.invoiceCount > 0 ||
    snapshot.billCount > 0 ||
    snapshot.filedReturns > 0 ||
    snapshot.pendingReturns > 0
  );
  const isEmpty =
    !hasSnapshotData &&
    invoices.length === 0 &&
    expenses.length === 0 &&
    payments.length === 0 &&
    filings.length === 0 &&
    openNotices.length === 0 &&
    openIssues.length === 0;

  if (isEmpty) {
    return [
      {
        priority: 'medium',
        title: 'Connect your data sources to unlock Oracle',
        action: 'Open the Connections page and link GSTN, Bank, Gmail, or Tally',
        rationale:
          'No business data has been recorded yet. Oracle cannot generate actionable recommendations until at least one data source is connected or some invoices/returns are added.',
        metric: '0 invoices · 0 filings · 0 payments',
      },
    ];
  }

  // 1. Overdue receivables — highest priority (record-level detail from org-scoped invoices)
  const overdueInvoices = invoices.filter((inv) => {
    if (inv.balanceAmount <= 0) return false;
    if (inv.status === 'cancelled' || inv.status === 'draft') return false;
    if (inv.status === 'overdue' || inv.paymentStatus === 'overdue') return true;
    if (!inv.dueDate) return false;
    const due = new Date(inv.dueDate);
    return !isNaN(due.getTime()) && due.getTime() < today.getTime();
  });
  if (overdueInvoices.length > 0) {
    const totalOverdue = overdueInvoices.reduce((s, i) => s + i.balanceAmount, 0);
    const oldestDays = Math.max(
      ...overdueInvoices.map((i) =>
        i.dueDate && !isNaN(new Date(i.dueDate).getTime())
          ? daysBetween(today, new Date(i.dueDate))
          : 0,
      ),
    );
    recs.push({
      priority: 'high',
      title: `Recover ${inrShort(totalOverdue)} in overdue receivables`,
      action: `Run the Collections Agent to dispatch reminders to ${overdueInvoices.length} overdue account(s)`,
      rationale: `${overdueInvoices.length} invoice(s) are overdue by up to ${oldestDays} day(s). Every additional day delays cash flow and increases bad-debt risk. Auto-generated reminders typically recover 35-45% within 7 days.`,
      metric: `${overdueInvoices.length} invoices · ${inrShort(totalOverdue)}`,
    });
  }

  // 2. Pending / overdue GST filings — high priority (record-level detail from org-scoped filings)
  const pendingFilings = filings.filter(
    (f) => f.status !== 'filed' && f.status !== 'acknowledged',
  );
  const overdueFilings = pendingFilings.filter(
    (f) => f.status === 'overdue' || (f.period && new Date(f.period + '-20').getTime() < today.getTime()),
  );
  if (overdueFilings.length > 0) {
    const totalTax = overdueFilings.reduce((s, f) => s + f.totalTax, 0);
    recs.push({
      priority: 'high',
      title: `File ${overdueFilings.length} overdue GST return(s) immediately`,
      action: 'Run the Compliance Agent to create notices + filing tasks',
      rationale: `Late GST filings accrue ₹50/day (₹20/day for nil returns) under Section 47 of the CGST Act, plus 18% p.a. interest on unpaid tax. Total tax at stake: ${inrShort(
        totalTax,
      )}.`,
      metric: `${overdueFilings.length} overdue · ${inrShort(totalTax)} tax`,
    });
  } else if (pendingFilings.length > 0) {
    recs.push({
      priority: 'medium',
      title: `Prepare ${pendingFilings.length} pending GST return(s)`,
      action: 'Run the GST Agent to validate invoices and prepare filing JSON',
      rationale: `You have ${pendingFilings.length} GST return(s) in draft/pending state. The GST Agent can flag ITC mismatches and missing GSTINs before you file — preventing rejections and notices.`,
      metric: `${pendingFilings.length} pending`,
    });
  }

  // 3. Upcoming filing deadlines within 30 days (record-level detail)
  if (upcomingEvents.length > 0) {
    const nextDeadline = upcomingEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
    const daysLeft = daysBetween(nextDeadline.timestamp, today);
    recs.push({
      priority: daysLeft <= 3 ? 'high' : daysLeft <= 7 ? 'medium' : 'low',
      title: `${nextDeadline.eventType} due in ${daysLeft} day(s)`,
      action: 'Open the Returns page and prepare the filing',
      rationale: `Next filing deadline is on ${nextDeadline.timestamp.toLocaleDateString(
        'en-IN',
      )}. Preparing now avoids last-minute errors and late fees.`,
      metric: `${daysLeft} day(s) left`,
    });
  }

  // 4. Open GST notices — high priority (record-level detail from org-scoped notices)
  if (openNotices.length > 0) {
    recs.push({
      priority: 'high',
      title: `Respond to ${openNotices.length} open GST notice(s)`,
      action: 'Open the Notices page and review + reply before the response window closes',
      rationale:
        'Unresponded GST notices can escalate to scrutiny, demand, or penalty proceedings under Sections 73/74 of the CGST Act. Most notices allow 15-30 days to reply.',
      metric: `${openNotices.length} open`,
    });
  }

  // 5. Open issues / mismatches (record-level detail from org-scoped issues)
  if (openIssues.length > 0) {
    const criticalCount = openIssues.filter((i) => i.severity === 'critical' || i.severity === 'high').length;
    recs.push({
      priority: criticalCount > 0 ? 'high' : 'medium',
      title: `Resolve ${openIssues.length} open issue(s) (${criticalCount} critical/high)`,
      action: 'Run the GST Agent to refresh the issue list, then resolve each before the next filing',
      rationale:
        'Open issues include ITC mismatches, missing GSTINs, and tax math errors. Resolving them prevents filing rejections and ITC loss under Section 16 of the CGST Act.',
      metric: `${openIssues.length} open · ${criticalCount} critical`,
    });
  }

  // 6. Cash position recommendation
  // AUDIT-DUP-1 fix: source cash / revenue / expenses / outstanding from the
  // canonical Business Snapshot when available. Fall back to org-scoped local
  // computation only when no orgId was passed (backwards compat).
  const totalCollected = snapshot?.totalCollected ?? payments
    .filter((p) => p.partyType === 'customer')
    .reduce((s, p) => s + p.amount, 0);
  const totalPaidOut = snapshot?.totalPaid ?? payments
    .filter((p) => p.partyType === 'vendor')
    .reduce((s, p) => s + p.amount, 0);
  const totalExpenses = snapshot?.expenses ?? expenses.reduce((s, e) => s + e.amount, 0);
  const totalRevenue = snapshot?.revenue ?? invoices
    .filter((i) => i.status !== 'cancelled' && i.status !== 'draft')
    .reduce((s, i) => s + i.totalAmount, 0);
  const currentCash = snapshot?.cash ?? (totalCollected - totalPaidOut - totalExpenses);
  const outstanding = snapshot?.receivables ?? invoices.reduce((s, i) => s + i.balanceAmount, 0);

  if (currentCash < 0 || (totalRevenue > 0 && outstanding / totalRevenue > 0.4)) {
    recs.push({
      priority: 'high',
      title: `Cash position is tight — ${inrShort(currentCash)} on hand`,
      action: 'Run the Finance Agent to generate a 30-day cash forecast + collection plan',
      rationale: `Current cash is ${inrShort(
        currentCash,
      )} with ${inrShort(
        outstanding,
      )} in outstanding receivables. The Finance Agent can prioritise collections and forecast a runway.`,
      metric: `${inrShort(currentCash)} cash · ${inrShort(outstanding)} outstanding`,
    });
  } else if (totalRevenue > 0 || totalExpenses > 0) {
    recs.push({
      priority: 'low',
      title: 'Refresh your 30-day cash + revenue forecast',
      action: 'Run the Finance Agent to update AIPrediction rows for the next 30/90 days',
      rationale: `Current cash ${inrShort(currentCash)} is healthy. Refreshing the forecast keeps the dashboard, Oracle answers, and CFO brief grounded in latest data.`,
      metric: `${inrShort(currentCash)} cash · ${inrShort(totalRevenue)} revenue`,
    });
  }

  // 7. Generate executive snapshot if none in last 7 days
  // ExecutiveReport has no firmId — filter by generatedBy (userId) when available.
  const recentReports = await db.executiveReport
    .findMany({
      where: reportFilter,
      select: { id: true },
    })
    .catch(() => []);
  const hasInvoicesOrFilings = snapshot
    ? (snapshot.invoiceCount > 0 || snapshot.filedReturns > 0 || snapshot.pendingReturns > 0)
    : (invoices.length > 0 || filings.length > 0);
  if (recentReports.length === 0 && hasInvoicesOrFilings) {
    recs.push({
      priority: 'low',
      title: 'Generate this week\u2019s executive snapshot',
      action: 'Run the Reporting Agent to capture revenue, tax, collections, and compliance metrics',
      rationale:
        'No executive snapshot has been generated in the last 7 days. The Reporting Agent creates a real ExecutiveReport row with current metrics for board / investor updates.',
      metric: 'last report > 7 days ago',
    });
  }

  // Sort by priority (high → medium → low), cap at 5
  const order: Record<DynamicRecommendation['priority'], number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);

  // If we somehow have fewer than 3 and DB is non-empty, add a gentle nudge.
  if (recs.length < 3 && !isEmpty) {
    recs.push({
      priority: 'low',
      title: 'Run the full RMB Orchestrator today',
      action: 'Click "Run My Business Today" on the Run-My-Business page to dispatch all 5 agents',
      rationale:
        'A full orchestrator run dispatches Collections + Compliance + Finance + Reporting + GST agents in sequence, then writes a complete audit trail. Recommended at least once daily.',
      metric: '5 agents ready',
    });
  }

  return recs.slice(0, 5);
}

/**
 * Format dynamic recommendations as a context block for the Oracle system
 * prompt. Used by /api/oracle/chat to ground the LLM answer in real DB state.
 */
export async function formatDynamicRecommendationsBlock(
  organizationId?: string,
  userId?: string,
): Promise<string> {
  const recs = await generateDynamicRecommendations(organizationId, userId).catch(() => [] as DynamicRecommendation[]);
  if (recs.length === 0) {
    return `## DYNAMIC RECOMMENDATIONS (PT-1-b)
No actionable recommendations could be computed — Oracle engine returned no items. Tell the user honestly that the recommendation engine could not generate a list right now.`;
  }
  const lines: string[] = [
    `## DYNAMIC RECOMMENDATIONS (PT-1-b — generated from REAL DB state)`,
    `The following ${recs.length} recommendation(s) were computed from real Invoice / GSTRFiling / Notice / Issue / Payment / Expense data${organizationId ? ' (org-scoped, headline numbers from the Business Snapshot)' : ''}. When the user asks "What should I do?", "Any recommendations?", "Run my business", "advice", or any variant, surface these as your primary answer — cite the exact numbers and never fabricate alternatives.`,
    ``,
  ];
  recs.forEach((r, i) => {
    lines.push(`${i + 1}. [${r.priority.toUpperCase()}] ${r.title}`);
    lines.push(`   Action: ${r.action}`);
    lines.push(`   Why: ${r.rationale}`);
    if (r.metric) lines.push(`   Metric: ${r.metric}`);
  });
  lines.push(``);
  lines.push(`### RULES`);
  lines.push(`- These recommendations are dynamic — they were computed at ${new Date().toISOString()} from real DB rows. They are NOT static or canned.`);
  lines.push(`- When the user asks for recommendations, lead with the HIGH priority items, then MEDIUM, then LOW.`);
  lines.push(`- Cite the exact metric values (e.g. "${recs[0].metric ?? 'n/a'}") in your answer — never round or fabricate.`);
  lines.push(`- If the user wants to act on a recommendation, tell them which agent to run (Collections / Compliance / Finance / Reporting / GST) and what the agent will create.`);
  return lines.join('\n');
}

/**
 * Format the real data snapshot as a context block for the Oracle system prompt.
 * This is what Oracle reads to answer "How is my business doing?" with REAL data.
 */
export function formatRealDataContextBlock(snapshot: RealDataSnapshot): string {
  if (!snapshot.hasAnyConnection) {
    return `## REAL CONNECTED DATA (Phase 2 — Real Data Engine™)
NO data sources are connected yet. The user has not connected GSTN, Bank, Gmail, WhatsApp, or any accounting software.

When the user asks "How is my business doing?" or any data-dependent question:
1. Answer honestly: "I don't have any live data connections yet."
2. Recommend connecting sources: "Connect your GSTN, Bank, and Gmail so I can read your real business data. Visit the Connections page."
3. Do NOT fabricate numbers. Do NOT use demo values. Only speak to what is connected.

Once the user connects a source, this context block will populate with real data automatically.`;
  }

  // AUDIT-DUP-1 fix: When the Business Snapshot is attached, headline financial
  // numbers (cash, revenue, expenses, ITC) come from the snapshot — they are
  // already printed in the BUSINESS SNAPSHOT context block. The numbers below
  // describe connection state + recent activity only. We DO NOT re-print the
  // headline aggregates here to avoid the LLM citing two competing values.
  const hasSnapshot = !!snapshot.businessSnapshot;

  const lines: string[] = [
    `## REAL CONNECTED DATA (Phase 2 — Real Data Engine™)`,
    `The user has ${snapshot.connectedCount} active data connection(s).${hasSnapshot ? ' Headline financial numbers (cash, revenue, expenses, ITC) come from the BUSINESS SNAPSHOT block above — this block describes connection state + recent activity only.' : ' Use ONLY this real data when answering business questions.'} Never fabricate. If a question requires data from a source that is NOT connected, say so honestly.`,
    ``,
    `### Active Connections`,
    ...snapshot.connections.map(
      (c) => `- ${c.type.toUpperCase()}: ${c.label} — ${c.status} · ${c.recordCount} records · last sync: ${c.lastSyncAt ?? 'never'}`,
    ),
  ];

  // Cash Position
  if (snapshot.cashPosition.connected) {
    const cp = snapshot.cashPosition;
    if (hasSnapshot) {
      // Snapshot-aware mode: do NOT re-print the canonical cash balance.
      // Only show connector-derived recent activity.
      lines.push(
        ``,
        `### Bank Connector Activity (recent activity — canonical cash is in BUSINESS SNAPSHOT)`,
        `- Recent credits (inflow): ₹${cp.recentCredits.toLocaleString('en-IN')}`,
        `- Recent debits (outflow): ₹${cp.recentDebits.toLocaleString('en-IN')}`,
        `- Net flow: ₹${cp.netFlow.toLocaleString('en-IN')}`,
        `- Collections today: ₹${cp.todayCollections.toLocaleString('en-IN')}`,
        `- Collections this week: ₹${cp.weekCollections.toLocaleString('en-IN')}`,
      );
    } else {
      // Legacy mode (no orgId passed): keep the original output for backwards
      // compat with callers that don't send orgId (e.g. /api/oracle/real-data).
      lines.push(
        ``,
        `### Bank / Cash Position (REAL bank data)`,
        `- Current balance: ${cp.totalBalance !== null ? `₹${cp.totalBalance.toLocaleString('en-IN')}` : 'calculating'}`,
        `- Recent credits (inflow): ₹${cp.recentCredits.toLocaleString('en-IN')}`,
        `- Recent debits (outflow): ₹${cp.recentDebits.toLocaleString('en-IN')}`,
        `- Net flow: ₹${cp.netFlow.toLocaleString('en-IN')}`,
        `- Collections today: ₹${cp.todayCollections.toLocaleString('en-IN')}`,
        `- Collections this week: ₹${cp.weekCollections.toLocaleString('en-IN')}`,
      );
    }
    if (cp.recentCollections.length > 0) {
      lines.push(`- Recent collections:`);
      for (const c of cp.recentCollections) {
        lines.push(`  · ${c.description} — ₹${c.amount.toLocaleString('en-IN')} (${c.date})`);
      }
    }
  } else {
    lines.push(
      ``,
      `### Bank / Cash Position`,
      `NOT CONNECTED — No bank account is linked.${hasSnapshot ? ' Canonical cash position is still available in the BUSINESS SNAPSHOT block (derived from native payment flow).' : ''} When the user asks "How much cash do I have?", say: "I don't have your bank connected yet. Connect your bank account so I can read your real transactions and cash position."`,
    );
  }

  // GST Status
  if (snapshot.gstStatus.connected) {
    const gs = snapshot.gstStatus;
    lines.push(
      ``,
      `### GST Status (REAL GSTN data)`,
      `- GSTIN: ${gs.gstin}`,
      `- Trade Name: ${gs.tradeName ?? '—'}`,
      `- Registration Status: ${gs.filingStatus ?? '—'}`,
      hasSnapshot && gs.itcPosition !== null
        ? `- ITC Position: ₹${gs.itcPosition.toLocaleString('en-IN')} (canonical — from BUSINESS SNAPSHOT)`
        : ``,
    );
    if (gs.recentNotices.length > 0) {
      lines.push(`- Recent GST notices:`);
      for (const n of gs.recentNotices) {
        lines.push(`  · ${n.title} (${n.date})`);
      }
    }
  } else {
    lines.push(
      ``,
      `### GST Status`,
      `NOT CONNECTED — No GSTIN is linked. When the user asks about GST filing status or ITC, say: "I don't have your GSTIN connected. Connect your GSTN so I can read your real filing status, ITC position, and notices."`,
    );
  }

  // Email Insights
  if (snapshot.emailInsights.connected) {
    const em = snapshot.emailInsights;
    lines.push(
      ``,
      `### Gmail Insights (REAL email data)`,
      `- Email: ${em.email}`,
      `- Total emails synced: ${em.totalSynced}`,
      `- GST notices: ${em.gstNotices}`,
      `- Vendor invoices: ${em.vendorInvoices}`,
      `- Client invoices: ${em.clientInvoices}`,
      `- Tax communications: ${em.taxCommunications}`,
    );
    if (em.recentNotices.length > 0) {
      lines.push(`- Recent GST notice emails:`);
      for (const n of em.recentNotices) {
        lines.push(`  · "${n.subject}" from ${n.from} (${n.date})`);
      }
    }
  } else {
    lines.push(
      ``,
      `### Gmail`,
      `NOT CONNECTED — No Gmail is linked. When the user asks "Any GST notice?" or "Show GST emails", say: "I don't have your Gmail connected. Connect Gmail so I can read your GST notices, vendor invoices, and tax communications automatically."`,
    );
  }

  // WhatsApp Insights
  if (snapshot.whatsappInsights.connected) {
    const wa = snapshot.whatsappInsights;
    lines.push(
      ``,
      `### WhatsApp Insights (REAL WhatsApp data)`,
      `- Phone: ${wa.phoneNumber}`,
      `- Total messages tracked: ${wa.totalMessages}`,
      `- Payment reminders sent: ${wa.remindersSent}`,
    );
    if (wa.clientsIgnoringReminders.length > 0) {
      lines.push(`- Clients ignoring payment reminders:`);
      for (const c of wa.clientsIgnoringReminders) {
        lines.push(`  · ${c.contactName} — ${c.remindersSent} reminders sent, ${c.daysSinceLastReminder} days since last (no reply)`);
      }
    }
  } else {
    lines.push(
      ``,
      `### WhatsApp`,
      `NOT CONNECTED — No WhatsApp Business is linked. When the user asks "Which clients are ignoring payment reminders?", say: "I don't have your WhatsApp connected. Connect WhatsApp Business so I can track client communication and collections follow-ups."`,
    );
  }

  // Accounting Sync
  if (snapshot.accountingSync.connected) {
    const ac = snapshot.accountingSync;
    if (hasSnapshot) {
      // Snapshot-aware mode: print connector-state (synced record counts) but
      // NOT the headline sales/purchases totals (those come from the snapshot).
      lines.push(
        ``,
        `### Accounting Sync (REAL ${ac.software?.toUpperCase()} connector state)`,
        `- Software: ${ac.software}`,
        `- Company: ${ac.companyName ?? '—'}`,
        `- Sales invoices synced (connector records): ${ac.salesInvoices}`,
        `- Purchase bills synced (connector records): ${ac.purchaseBills}`,
        `- Canonical revenue & expenses: see BUSINESS SNAPSHOT block above`,
      );
    } else {
      lines.push(
        ``,
        `### Accounting Sync (REAL ${ac.software?.toUpperCase()} data)`,
        `- Software: ${ac.software}`,
        `- Company: ${ac.companyName ?? '—'}`,
        `- Sales invoices synced: ${ac.salesInvoices}`,
        `- Purchase bills synced: ${ac.purchaseBills}`,
        `- Total sales: ${ac.totalSales !== null ? `₹${ac.totalSales.toLocaleString('en-IN')}` : '—'}`,
        `- Total purchases: ${ac.totalPurchases !== null ? `₹${ac.totalPurchases.toLocaleString('en-IN')}` : '—'}`,
      );
    }
  } else {
    lines.push(
      ``,
      `### Accounting Software`,
      `NOT CONNECTED — No Tally, Zoho, or QuickBooks is linked. When the user asks about sales/purchases/ledger from their accounting software, say: "I don't have your accounting software connected. Connect Tally, Zoho Books, or QuickBooks so I can sync your real financial data."`,
    );
  }

  // Data Quality
  if (snapshot.dataQuality.totalAlerts > 0) {
    const dq = snapshot.dataQuality;
    lines.push(
      ``,
      `### Data Quality Alerts (REAL — auto-detected)`,
      `- Total alerts: ${dq.totalAlerts} (${dq.critical} critical, ${dq.high} high)`,
    );
    if (dq.topAlerts.length > 0) {
      lines.push(`- Top alerts:`);
      for (const a of dq.topAlerts) {
        lines.push(`  · [${a.severity.toUpperCase()}] ${a.title} (${a.category})`);
      }
    }
  }

  lines.push(
    ``,
    `### ORACLE REAL DATA RULES (CRITICAL)`,
    `- ${hasSnapshot ? 'Headline financial numbers (cash, revenue, expenses, ITC, receivables, payables, health/risk scores) come from the BUSINESS SNAPSHOT block — cite those verbatim. This block describes CONNECTION STATE and recent activity only.' : 'When answering "How is my business doing?", use ONLY the real numbers above. Round to lakhs/crores naturally.'}`,
    `- If a source is NOT connected, say so honestly and recommend connecting it. Never fabricate.`,
    `- When the user asks "Any GST notice?" and Gmail IS connected, cite the real notice emails above.`,
    `- When the user asks "Which clients are ignoring reminders?" and WhatsApp IS connected, cite the real client names above.`,
    `- Tagline: GSTPilot Oracle™ — Connected. Intelligent. Real.`,
  );

  return lines.join('\n');
}
