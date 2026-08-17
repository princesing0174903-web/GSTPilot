// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Unified Financial Context: Builder
// ═══════════════════════════════════════════════════════════════════════════════
//
// THE single entry point. Every Oracle surface (brain route, daily briefing,
// anomaly detector, forecaster, scenario engine, copilot modes) calls
// `getUnifiedOracleContext(orgId)` and reads from the result. NO surface is
// allowed to independently query invoices, bank, GST, etc.
//
// This builder:
//   1. Calls the canonical `getBusinessSnapshot(orgId)` for headline numbers
//      (single source of truth — already org-scoped + 30s cached).
//   2. Runs additional org-scoped Prisma queries for the dimensions the
//      snapshot doesn't cover (customer concentration, supplier spend,
//      banking sandbox labelling, GST reconciliation, integrations).
//   3. Attaches a `DataSourceRef` + `Evidence` to every section so Oracle
//      can cite "where did this come from" for every number.
//   4. Resolves the environment (LIVE/SANDBOX/DEMO/STALE/UNAVAILABLE) for
//      every source based on connection state + age.
//   5. Caches the full context per-org for 30s (same TTL as the snapshot).
//
// SECURITY: Every query filters by organizationId. ZERO cross-tenant leakage.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';
import {
  type UnifiedOracleContext,
  type BusinessProfileSection,
  type RevenueSection,
  type ExpensesSection,
  type CashFlowSection,
  type CustomerSection,
  type SupplierSection,
  type GSTSection,
  type InvoicesSection,
  type BankingSection,
  type RiskSection,
  type RiskSignal,
  type IntegrationsSection,
  type IntegrationStatus,
  type Evidence,
  type DataSourceRef,
  type DataEnvironment,
  type ConnectionState,
  resolveEnvironment,
  FRESHNESS_WINDOWS,
} from './types';

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000; // 30s — same as canonical Business Snapshot
const cache = new Map<string, { ctx: UnifiedOracleContext; expiresAt: number }>();

export interface GetContextOptions {
  forceRefresh?: boolean;
}

/**
 * THE entry point. Returns the full unified Oracle context for an org.
 *
 * @param organizationId The org to scope all queries to.
 * @param opts.forceRefresh Bypass the cache (use sparingly — e.g. right after an action).
 */
export async function getUnifiedOracleContext(
  organizationId: string,
  opts: GetContextOptions = {},
): Promise<UnifiedOracleContext> {
  if (!organizationId) return emptyContext('');

  const cached = cache.get(organizationId);
  if (!opts.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.ctx;
  }

  const isDemoWorkspace = isLocalOrgId(organizationId);
  const ctx = await buildContext(organizationId, isDemoWorkspace);
  cache.set(organizationId, { ctx, expiresAt: Date.now() + CACHE_TTL_MS });
  return ctx;
}

/** Invalidate the cached context for an org (call after an action mutates data). */
export function invalidateUnifiedContext(organizationId: string): void {
  cache.delete(organizationId);
}

// ─── Build ────────────────────────────────────────────────────────────────────

async function buildContext(
  organizationId: string,
  isDemoWorkspace: boolean,
): Promise<UnifiedOracleContext> {
  const generatedAt = new Date().toISOString();

  // The canonical Business Snapshot is the SINGLE source of truth for headline
  // financials. We delegate to it (and inherit its 30s cache + org-scoping).
  const snapshot = await getBusinessSnapshot(organizationId).catch(() => null);

  // Run the additional queries in parallel — all org-scoped.
  const [
    businessProfile,
    integrations,
    banking,
    customerDetail,
    supplierDetail,
    gstDetail,
    invoiceAging,
    monthlyRevenue,
  ] = await Promise.all([
    buildBusinessProfile(organizationId, isDemoWorkspace),
    buildIntegrations(organizationId, isDemoWorkspace),
    buildBanking(organizationId, isDemoWorkspace),
    buildCustomerDetail(organizationId),
    buildSupplierDetail(organizationId),
    buildGSTDetail(organizationId, isDemoWorkspace),
    buildInvoiceAging(organizationId),
    buildMonthlyRevenue(organizationId),
  ]);

  // ─── Assemble sections (using snapshot numbers where available) ─────────────
  const evidenceIndex: Record<string, Evidence> = {};

  const invoicesEvidence: Evidence = {
    id: 'invoices-fy',
    label: 'Invoices (current FY)',
    source: {
      system: 'Prisma · Invoice',
      environment: resolveEnv(isDemoWorkspace, 'connected', snapshot?.lastSyncAt ?? null, 'invoices'),
      lastUpdatedAt: snapshot?.lastSyncAt ?? null,
      period: businessProfile.accountingPeriod,
      deepLink: '/dashboard?view=invoices',
      recordCount: snapshot?.invoiceCount ?? 0,
    },
    supports: ['revenue', 'receivables', 'invoice aging', 'collection rate'],
  };
  evidenceIndex[invoicesEvidence.id] = invoicesEvidence;

  const paymentsEvidence: Evidence = {
    id: 'payments-fy',
    label: 'Payments (current FY)',
    source: {
      system: 'Prisma · Payment',
      environment: resolveEnv(isDemoWorkspace, 'connected', snapshot?.lastSyncAt ?? null, 'payments'),
      lastUpdatedAt: snapshot?.lastSyncAt ?? null,
      period: businessProfile.accountingPeriod,
      deepLink: '/dashboard?view=payments',
      recordCount: 0,
    },
    supports: ['collected revenue', 'cash flow'],
  };
  evidenceIndex[paymentsEvidence.id] = paymentsEvidence;

  const expensesEvidence: Evidence = {
    id: 'expenses-fy',
    label: 'Expenses & Bills (current FY)',
    source: {
      system: 'Prisma · Expense + PurchaseBill',
      environment: resolveEnv(isDemoWorkspace, 'connected', snapshot?.lastSyncAt ?? null, 'expenses'),
      lastUpdatedAt: snapshot?.lastSyncAt ?? null,
      period: businessProfile.accountingPeriod,
      deepLink: '/dashboard?view=expenses',
      recordCount: (snapshot?.expenseRecordCount ?? 0) + (snapshot?.billCount ?? 0),
    },
    supports: ['operating expenses', 'supplier spend', 'payables'],
  };
  evidenceIndex[expensesEvidence.id] = expensesEvidence;

  const gstEvidence: Evidence = {
    id: 'gst-fy',
    label: 'GST Filings & GSTR-2B',
    source: gstDetail.source,
    supports: ['output tax', 'input tax (ITC)', 'GST liability', 'reconciliation'],
  };
  evidenceIndex[gstEvidence.id] = gstEvidence;

  const bankingEvidence: Evidence = {
    id: 'banking',
    label: banking.isSandbox ? 'Banking (Sandbox)' : 'Banking',
    source: banking.source,
    supports: ['cash balance', 'transactions', 'categorized totals'],
  };
  evidenceIndex[bankingEvidence.id] = bankingEvidence;

  // ─── Revenue ───────────────────────────────────────────────────────────────
  const revenue: RevenueSection = {
    invoicedRevenue: snapshot?.revenue ?? 0,
    collectedRevenue: snapshot?.totalCollected ?? 0,
    outstandingReceivables: snapshot?.receivables ?? 0,
    overdueReceivables: snapshot?.overdueReceivables ?? 0,
    trend: {
      thisMonth: snapshot?.revenueThisMonth ?? 0,
      lastMonth: snapshot?.revenueLastMonth ?? 0,
      changePct: snapshot && snapshot.revenueLastMonth > 0
        ? ((snapshot.revenueThisMonth - snapshot.revenueLastMonth) / snapshot.revenueLastMonth) * 100
        : null,
      direction: snapshot
        ? snapshot.revenueThisMonth > snapshot.revenueLastMonth ? 'up'
          : snapshot.revenueThisMonth < snapshot.revenueLastMonth ? 'down' : 'flat'
        : 'flat',
    },
    monthlySeries: monthlyRevenue,
    source: invoicesEvidence.source,
    evidence: invoicesEvidence,
  };

  // ─── Expenses ──────────────────────────────────────────────────────────────
  const expenses: ExpensesSection = {
    operatingExpenses: (snapshot?.expenses ?? 0) - (snapshot?.inputTax ?? 0) > 0
      ? (snapshot?.expenses ?? 0) - (snapshot?.inputTax ?? 0)
      : (snapshot?.expenses ?? 0),
    supplierSpend: snapshot?.inputTax ?? 0, // proxy — purchase bills carry GST
    total: snapshot?.expenses ?? 0,
    topCategories: [], // populated below if available
    trend: {
      thisMonth: 0,
      lastMonth: 0,
      changePct: null,
      direction: 'flat',
    },
    source: expensesEvidence.source,
    evidence: expensesEvidence,
  };

  // ─── Cash Flow ─────────────────────────────────────────────────────────────
  const cashFlow: CashFlowSection = {
    currentBalance: snapshot?.cash ?? 0,
    openingBalance: Math.max(0, (snapshot?.cash ?? 0) - (snapshot?.netCashFlow ?? 0)),
    inflows: snapshot?.totalCollected ?? 0,
    outflows: snapshot?.totalPaid ?? 0,
    net: snapshot?.netCashFlow ?? 0,
    runwayMonths: isFinite(snapshot?.runwayDays ?? 0)
      ? (snapshot?.runwayDays ?? 0) / 30
      : Infinity,
    isEstimatedFromPaymentFlow: !banking.connected,
    source: banking.connected ? bankingEvidence.source : paymentsEvidence.source,
    evidence: banking.connected ? bankingEvidence : paymentsEvidence,
  };

  // ─── Invoices ──────────────────────────────────────────────────────────────
  const invoices: InvoicesSection = {
    totalInvoices: snapshot?.invoiceCount ?? 0,
    outstanding: snapshot?.receivables ?? 0,
    overdue: snapshot?.overdueReceivables ?? 0,
    paid: (snapshot?.invoiceCount ?? 0) > 0
      ? (snapshot?.invoiceCount ?? 0) - Math.ceil((snapshot?.receivables ?? 0) > 0 ? 1 : 0)
      : 0,
    aging: invoiceAging,
    avgDaysToPay: snapshot?.avgDaysToPay ?? 0,
    collectionRate: snapshot?.collectionRate ?? 0,
    source: invoicesEvidence.source,
    evidence: invoicesEvidence,
  };

  // ─── GST ───────────────────────────────────────────────────────────────────
  const gst: GSTSection = {
    outputTax: snapshot?.outputTax ?? 0,
    inputTax: snapshot?.inputTax ?? 0,
    liability: snapshot?.gstLiability ?? 0,
    filedReturns: snapshot?.filedReturns ?? 0,
    pendingReturns: snapshot?.pendingReturns ?? 0,
    overdueReturns: snapshot?.overdueReturns ?? 0,
    reconciliation: gstDetail.reconciliation,
    gspConnected: gstDetail.gspConnected,
    source: gstDetail.source,
    evidence: gstEvidence,
  };

  // ─── Risk signals ──────────────────────────────────────────────────────────
  const riskSignals: RiskSignal[] = [];

  // Cash risk
  if ((snapshot?.cash ?? 0) < (snapshot?.overdueReceivables ?? 0) * 0.5 && (snapshot?.cash ?? 0) > 0) {
    riskSignals.push({
      kind: 'cash',
      severity: 'high',
      title: 'Cash position below 50% of overdue receivables',
      detail: `Cash ₹${(snapshot?.cash ?? 0).toLocaleString('en-IN')} vs overdue receivables ₹${(snapshot?.overdueReceivables ?? 0).toLocaleString('en-IN')}. Collections urgency is high.`,
      estimatedImpact: snapshot?.overdueReceivables,
      evidence: cashFlow.evidence,
      recommendedAction: 'Prioritise collections on top 3 overdue customers.',
    });
  }
  if ((snapshot?.cash ?? 0) <= 0 && (snapshot?.expenses ?? 0) > 0) {
    riskSignals.push({
      kind: 'cash',
      severity: 'critical',
      title: 'No cash buffer detected',
      detail: 'Cash position is zero or negative. Operating expenses cannot be met from current cash.',
      evidence: cashFlow.evidence,
      recommendedAction: 'Arrange a working capital facility or accelerate collections immediately.',
    });
  }

  // Receivable risk
  if ((snapshot?.overdueReceivables ?? 0) > 0) {
    const overdueShare = (snapshot?.receivables ?? 0) > 0
      ? (snapshot.overdueReceivables / snapshot.receivables)
      : 0;
    riskSignals.push({
      kind: 'receivable',
      severity: overdueShare > 0.5 ? 'high' : overdueShare > 0.25 ? 'medium' : 'low',
      title: `${snapshot?.overdueInvoiceCount ?? 0} invoices overdue (₹${(snapshot?.overdueReceivables ?? 0).toLocaleString('en-IN')})`,
      detail: `${(overdueShare * 100).toFixed(0)}% of your outstanding receivables are past their due date.`,
      estimatedImpact: snapshot?.overdueReceivables,
      evidence: invoicesEvidence,
      recommendedAction: 'Send reminders to overdue customers — prioritise the top 3 by balance.',
    });
  }

  // Concentration risk
  if (customerDetail.concentrationTop1 > 0.35) {
    riskSignals.push({
      kind: 'concentration',
      severity: customerDetail.concentrationTop1 > 0.5 ? 'high' : 'medium',
      title: `Top customer is ${(customerDetail.concentrationTop1 * 100).toFixed(0)}% of revenue`,
      detail: 'Revenue concentration in a single customer creates dependency risk. A 30-day payment delay from this customer would materially impact cash flow.',
      estimatedImpact: (snapshot?.revenue ?? 0) * customerDetail.concentrationTop1 * 0.1,
      evidence: customerDetail.evidence,
      recommendedAction: 'Diversify the customer base or negotiate shorter payment terms with the top customer.',
    });
  }

  // GST compliance risk
  if ((snapshot?.overdueReturns ?? 0) > 0) {
    riskSignals.push({
      kind: 'gst',
      severity: 'high',
      title: `${snapshot?.overdueReturns} GST return(s) past due date`,
      detail: 'Overdue GST returns attract late fees and interest. File immediately.',
      estimatedImpact: (snapshot?.overdueReturns ?? 0) * 200, // ₹200/day late fee proxy
      evidence: gstEvidence,
      recommendedAction: 'File the overdue returns now. Oracle can prepare the working paper.',
    });
  }
  if (gstDetail.reconciliation.itcAtRisk > 0) {
    riskSignals.push({
      kind: 'gst',
      severity: gstDetail.reconciliation.itcAtRisk > 50000 ? 'high' : 'medium',
      title: `₹${gstDetail.reconciliation.itcAtRisk.toLocaleString('en-IN')} ITC at risk from GSTR-2B mismatches`,
      detail: `${gstDetail.reconciliation.mismatched + gstDetail.reconciliation.missingIn2B} supplier invoices have reconciliation mismatches. ITC on these may be denied.`,
      estimatedImpact: gstDetail.reconciliation.itcAtRisk,
      evidence: gstEvidence,
      recommendedAction: 'Review the GST reconciliation report and follow up with suppliers.',
    });
  }

  // Banking sandbox labelling
  if (banking.isSandbox) {
    riskSignals.push({
      kind: 'anomaly',
      severity: 'low',
      title: 'Banking connection is in SANDBOX mode',
      detail: 'Bank data shown is from the Setu sandbox (or mock provider). It is NOT live banking data — do not treat these balances and transactions as real financial exposure.',
      evidence: bankingEvidence,
      recommendedAction: 'Connect a live bank account via Setu Account Aggregator when ready.',
    });
  }

  // Stale data risk
  for (const integ of integrations.integrations) {
    if (integ.environment === 'STALE' && integ.connected) {
      riskSignals.push({
        kind: 'anomaly',
        severity: 'medium',
        title: `${integ.label} data is stale`,
        detail: `Last synced ${integ.daysSinceSync ?? '?'} days ago. Conclusions based on this data may not reflect current state.`,
        evidence: {
          id: `integration-${integ.provider}`,
          label: integ.label,
          source: {
            system: integ.label,
            environment: integ.environment,
            lastUpdatedAt: integ.lastSyncAt,
            connectionState: integ.connectionState,
          },
        },
        recommendedAction: `Reconnect ${integ.label} to refresh data.`,
      });
    }
  }

  const risk: RiskSection = {
    score: snapshot?.riskScore ?? 0,
    signals: riskSignals.sort((a, b) => {
      const order = { critical: 4, high: 3, medium: 2, low: 1 };
      return order[b.severity] - order[a.severity];
    }),
  };

  return {
    organizationId,
    generatedAt,
    cacheTtlMs: CACHE_TTL_MS,
    businessProfile,
    revenue,
    expenses,
    cashFlow,
    customers: customerDetail,
    suppliers: supplierDetail,
    gst,
    invoices,
    banking,
    risk,
    integrations,
    evidenceIndex,
    isDemoWorkspace,
    health: {
      score: snapshot?.healthScore ?? 0,
      label: snapshot?.healthScoreLabel ?? 'Critical',
      riskScore: snapshot?.riskScore ?? 0,
      factors: (snapshot?.healthScoreFactors ?? []).map(f => ({
        key: f.key,
        label: f.label,
        contribution: f.contribution,
        detail: f.detail,
      })),
    },
  };
}

// ─── Section Builders ─────────────────────────────────────────────────────────

function currentFYLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const fyStartYear = now.getMonth() < 3 ? year - 1 : year;
  return `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
}

function resolveEnv(
  isDemo: boolean,
  state: ConnectionState,
  lastUpdatedAt: string | null,
  windowKey: string,
): DataEnvironment {
  return resolveEnvironment(state, lastUpdatedAt, FRESHNESS_WINDOWS[windowKey] ?? { maxAgeHours: 24, label: '' }, isDemo);
}

async function buildBusinessProfile(orgId: string, isDemo: boolean): Promise<BusinessProfileSection> {
  let orgName: string | null = null;
  let industry: string | null = null;
  let gstin: string | null = null;
  try {
    const firm = await db.firm.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, industry: true, gstin: true },
    }).catch(() => null);
    if (firm) {
      orgName = firm.name;
      industry = firm.industry;
      gstin = firm.gstin;
    }
  } catch {}
  return {
    organizationId: orgId,
    organizationName: orgName,
    industry,
    gstin,
    accountingPeriod: currentFYLabel(),
    source: {
      system: 'Prisma · Firm',
      environment: isDemo ? 'DEMO' : 'LIVE',
      lastUpdatedAt: new Date().toISOString(),
    },
  };
}

async function buildIntegrations(orgId: string, isDemo: boolean): Promise<IntegrationsSection> {
  const list: IntegrationStatus[] = [];

  // Google Workspace
  try {
    const g = await db.googleWorkspaceToken.findFirst({
      where: { organizationId: orgId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, updatedAt: true },
    }).catch(() => null);
    const connected = !!g;
    const lastSync = g?.updatedAt ?? g?.createdAt ?? null;
    const daysSince = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 86_400_000) : null;
    const env = resolveEnvironment(connected ? 'connected' : 'disconnected', lastSync, FRESHNESS_WINDOWS.google, isDemo);
    list.push({
      provider: 'google',
      label: 'Google Workspace',
      connected,
      connectionState: connected ? 'connected' : 'disconnected',
      environment: env,
      lastSyncAt: lastSync,
      daysSinceSync: daysSince,
      lastSyncFailed: false,
      statusMessage: connected
        ? `Connected${daysSince !== null ? ` · last sync ${daysSince}d ago` : ''}`
        : 'Not connected — Google Mail/Calendar/Drive data is unavailable.',
    });
  } catch {}

  // Zoho Books
  try {
    const z = await db.zohoBooksToken.findFirst({
      where: { organizationId: orgId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, updatedAt: true, expiresAt: true },
    }).catch(() => null);
    const connected = !!z;
    const expired = z?.expiresAt ? new Date(z.expiresAt).getTime() < Date.now() : false;
    const lastSync = z?.updatedAt ?? z?.createdAt ?? null;
    const daysSince = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 86_400_000) : null;
    const state: ConnectionState = !connected ? 'disconnected' : expired ? 'expired' : 'connected';
    const env = resolveEnvironment(state, lastSync, FRESHNESS_WINDOWS.zoho, isDemo);
    list.push({
      provider: 'zoho',
      label: 'Zoho Books',
      connected: connected && !expired,
      connectionState: state,
      environment: env,
      lastSyncAt: lastSync,
      daysSinceSync: daysSince,
      lastSyncFailed: false,
      statusMessage: !connected ? 'Not connected — Zoho Books accounting data is unavailable.'
        : expired ? 'Token expired — reconnect Zoho Books to refresh accounting data.'
        : `Connected${daysSince !== null ? ` · last sync ${daysSince}d ago` : ''}`,
    });
  } catch {}

  // GST GSP
  let gspConnected = false;
  try {
    const profile = await db.gSTProfile.findFirst({
      where: { organizationId: orgId },
      select: { id: true, gstin: true, updatedAt: true },
    }).catch(() => null);
    gspConnected = !!profile;
    const lastSync = profile?.updatedAt ?? null;
    const daysSince = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 86_400_000) : null;
    const env = resolveEnvironment(gspConnected ? 'connected' : 'disconnected', lastSync, FRESHNESS_WINDOWS.gst, isDemo);
    list.push({
      provider: 'gst-gsp',
      label: 'GST GSP',
      connected: gspConnected,
      connectionState: gspConnected ? 'connected' : 'disconnected',
      environment: env,
      lastSyncAt: lastSync,
      daysSinceSync: daysSince,
      lastSyncFailed: false,
      statusMessage: gspConnected
        ? `Connected${daysSince !== null ? ` · last sync ${daysSince}d ago` : ''}`
        : 'Not connected — live GSTR-2B data is unavailable.',
    });
  } catch {}

  // Banking
  try {
    const bankConn = await db.bankConnection.findFirst({
      where: { organizationId: orgId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, provider: true, status: true, createdAt: true, updatedAt: true },
    }).catch(() => null);
    const bankProviderEnv = process.env.BANK_PROVIDER ?? 'mock';
    const isSandbox = bankProviderEnv === 'setu' ? true : bankProviderEnv === 'mock' ? true : false;
    const connected = !!bankConn;
    const lastSync = bankConn?.updatedAt ?? bankConn?.createdAt ?? null;
    const daysSince = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 86_400_000) : null;
    const state: ConnectionState = !connected ? 'disconnected' : isSandbox ? 'sandbox' : 'connected';
    const env = resolveEnvironment(state, lastSync, FRESHNESS_WINDOWS.banking, isDemo);
    list.push({
      provider: 'banking',
      label: 'Banking',
      connected,
      connectionState: state,
      environment: env,
      lastSyncAt: lastSync,
      daysSinceSync: daysSince,
      lastSyncFailed: false,
      statusMessage: !connected ? 'Not connected — bank balances and transactions are unavailable.'
        : isSandbox ? `Sandbox connected${daysSince !== null ? ` · last sync ${daysSince}d ago` : ''} — test data, not live banking.`
        : `Connected${daysSince !== null ? ` · last sync ${daysSince}d ago` : ''}`,
    });
  } catch {}

  const byProvider: Record<string, IntegrationStatus> = {};
  for (const i of list) byProvider[i.provider] = i;

  return { integrations: list, byProvider };
}

async function buildBanking(orgId: string, isDemo: boolean): Promise<BankingSection> {
  const bankProviderEnv = process.env.BANK_PROVIDER ?? 'mock';
  const isSandbox = bankProviderEnv !== 'live';

  try {
    const conn = await db.bankConnection.findFirst({
      where: { organizationId: orgId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, provider: true },
    }).catch(() => null);

    if (!conn) {
      return emptyBanking(isSandbox, isDemo);
    }

    const accounts = await db.bankAccount.findMany({
      where: { organizationId: orgId },
      take: 10,
      select: { id: true, maskedAccountNumber: true, bankName: true, balance: true, ifsc: true },
    }).catch(() => []);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const txns = await db.bankTransaction.findMany({
      where: { organizationId: orgId, transactionDate: { gte: thirtyDaysAgo } },
      orderBy: { transactionDate: 'desc' },
      take: 50,
      select: { id: true, transactionDate: true, description: true, amount: true, category: true, reconciled: true },
    }).catch(() => []);

    const categorizedMap = new Map<string, { inflow: number; outflow: number }>();
    for (const t of txns) {
      const cat = t.category ?? 'Uncategorized';
      const entry = categorizedMap.get(cat) ?? { inflow: 0, outflow: 0 };
      if (t.amount >= 0) entry.inflow += t.amount;
      else entry.outflow += Math.abs(t.amount);
      categorizedMap.set(cat, entry);
    }

    const env: DataEnvironment = isSandbox ? (isDemo ? 'DEMO' : 'SANDBOX') : 'LIVE';
    return {
      connected: true,
      accounts: accounts.map(a => ({
        id: a.id,
        maskedNumber: a.maskedAccountNumber ?? '****',
        bankName: a.bankName ?? 'Bank',
        balance: a.balance,
        environment: env,
      })),
      recentTransactions: txns.map(t => ({
        id: t.id,
        date: t.transactionDate.toISOString(),
        description: t.description ?? '',
        amount: t.amount,
        category: t.category,
        reconciled: t.reconciled,
      })),
      categorizedTotals: Array.from(categorizedMap.entries()).map(([category, v]) => ({ category, ...v })),
      isSandbox,
      source: {
        system: isSandbox ? 'Setu Banking Sandbox' : 'Banking (Live)',
        environment: env,
        lastUpdatedAt: new Date().toISOString(),
        connectionState: isSandbox ? 'sandbox' : 'connected',
        note: isSandbox ? 'Sandbox data — not real bank transactions' : undefined,
        deepLink: '/dashboard?view=banking',
        recordCount: txns.length,
      },
      evidence: {
        id: 'banking',
        label: isSandbox ? 'Banking (Sandbox)' : 'Banking',
        source: {
          system: isSandbox ? 'Setu Banking Sandbox' : 'Banking (Live)',
          environment: env,
          lastUpdatedAt: new Date().toISOString(),
          connectionState: isSandbox ? 'sandbox' : 'connected',
          note: isSandbox ? 'Sandbox data — not real bank transactions' : undefined,
          deepLink: '/dashboard?view=banking',
          recordCount: txns.length,
        },
        records: accounts.slice(0, 5).map(a => ({
          kind: 'bank-account' as const,
          id: a.id,
          label: `${a.bankName ?? 'Bank'} ${a.maskedAccountNumber ?? '****'}`,
        })),
        supports: ['cash balance', 'transactions', 'categorized totals'],
      },
    };
  } catch {
    return emptyBanking(isSandbox, isDemo);
  }
}

function emptyBanking(isSandbox: boolean, isDemo: boolean): BankingSection {
  const env: DataEnvironment = isDemo ? 'DEMO' : 'UNAVAILABLE';
  return {
    connected: false,
    accounts: [],
    recentTransactions: [],
    categorizedTotals: [],
    isSandbox,
    source: {
      system: 'Banking',
      environment: env,
      lastUpdatedAt: null,
      connectionState: 'disconnected',
      note: 'Banking not connected',
    },
    evidence: {
      id: 'banking',
      label: 'Banking',
      source: {
        system: 'Banking',
        environment: env,
        lastUpdatedAt: null,
        connectionState: 'disconnected',
        note: 'Banking not connected',
      },
      supports: [],
    },
  };
}

async function buildCustomerDetail(orgId: string): Promise<CustomerSection> {
  try {
    const clients = await db.client.findMany({
      where: { firmId: orgId },
      select: { id: true, tradeName: true },
    }).catch(() => []);
    const totalCustomers = clients.length;

    // Top customers by revenue (sum of invoices per client)
    const topRaw = await db.invoice.groupBy({
      by: ['clientId'],
      where: { client: { firmId: orgId }, clientId: { not: null } },
      _sum: { totalAmount: true, balanceAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 10,
    }).catch(() => []);

    const clientMap = new Map(clients.map(c => [c.id, c.tradeName]));
    const totalRevenue = topRaw.reduce((s, r) => s + (r._sum.totalAmount ?? 0), 0);

    const topCustomers = topRaw.slice(0, 5).map(r => {
      const name = clientMap.get(r.clientId ?? '') ?? 'Unknown';
      const revenue = r._sum.totalAmount ?? 0;
      const outstanding = r._sum.balanceAmount ?? 0;
      return {
        id: r.clientId ?? '',
        name,
        revenue,
        share: totalRevenue > 0 ? revenue / totalRevenue : 0,
        outstandingBalance: outstanding,
        overdueBalance: 0, // computed in aging
        avgDaysToPay: 0,
      };
    });

    const concentrationTop1 = topCustomers[0]?.share ?? 0;
    const concentrationTop3 = topCustomers.slice(0, 3).reduce((s, c) => s + c.share, 0);

    const overdueClientCount = await db.invoice.count({
      where: {
        client: { firmId: orgId },
        balanceAmount: { gt: 0 },
        dueDate: { lt: new Date() },
      },
    }).catch(() => 0);

    return {
      totalCustomers,
      topCustomers,
      concentrationTop1,
      concentrationTop3,
      overdueCustomerCount: overdueClientCount,
      source: {
        system: 'Prisma · Client + Invoice',
        environment: 'LIVE',
        lastUpdatedAt: new Date().toISOString(),
        deepLink: '/dashboard?view=customers',
        recordCount: totalCustomers,
      },
      evidence: {
        id: 'customers',
        label: 'Customers',
        source: {
          system: 'Prisma · Client + Invoice',
          environment: 'LIVE',
          lastUpdatedAt: new Date().toISOString(),
          deepLink: '/dashboard?view=customers',
          recordCount: totalCustomers,
        },
        records: topCustomers.slice(0, 3).map(c => ({
          kind: 'customer' as const,
          id: c.id,
          label: c.name,
          href: `/dashboard?view=customers&id=${c.id}`,
        })),
        supports: ['customer count', 'concentration', 'top customers'],
      },
    };
  } catch {
    return emptyCustomer();
  }
}

function emptyCustomer(): CustomerSection {
  return {
    totalCustomers: 0,
    topCustomers: [],
    concentrationTop1: 0,
    concentrationTop3: 0,
    overdueCustomerCount: 0,
    source: { system: 'Prisma · Client', environment: 'UNAVAILABLE', lastUpdatedAt: null },
    evidence: { id: 'customers', label: 'Customers', source: { system: 'Prisma · Client', environment: 'UNAVAILABLE', lastUpdatedAt: null }, supports: [] },
  };
}

async function buildSupplierDetail(orgId: string): Promise<SupplierSection> {
  try {
    const bills = await db.purchaseBill.findMany({
      where: { client: { firmId: orgId } },
      select: { vendorName: true, totalAmount: true, balanceAmount: true, dueDate: true, gstin: true },
    }).catch(() => []);

    const byVendor = new Map<string, { spend: number; outstanding: number; overdue: number; gstin: string | null }>();
    for (const b of bills) {
      const name = b.vendorName ?? 'Unknown';
      const entry = byVendor.get(name) ?? { spend: 0, outstanding: 0, overdue: 0, gstin: b.gstin };
      entry.spend += b.totalAmount ?? 0;
      entry.outstanding += b.balanceAmount ?? 0;
      if (b.balanceAmount && b.balanceAmount > 0 && b.dueDate && new Date(b.dueDate) < new Date()) {
        entry.overdue += b.balanceAmount;
      }
      if (!entry.gstin) entry.gstin = b.gstin;
      byVendor.set(name, entry);
    }

    const topSuppliers = Array.from(byVendor.entries())
      .map(([name, v]) => ({
        name,
        spend: v.spend,
        outstandingBalance: v.outstanding,
        overdueBalance: v.overdue,
        gstCompliant: v.gstin ? /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{Z}[A-Z\d]{1}$/.test(v.gstin) : null,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    const totalOverduePayables = topSuppliers.reduce((s, v) => s + v.overdueBalance, 0);

    return {
      totalSuppliers: byVendor.size,
      topSuppliers,
      overduePayables: totalOverduePayables,
      source: {
        system: 'Prisma · PurchaseBill',
        environment: 'LIVE',
        lastUpdatedAt: new Date().toISOString(),
        deepLink: '/dashboard?view=bills',
        recordCount: bills.length,
      },
      evidence: {
        id: 'suppliers',
        label: 'Suppliers (Purchase Bills)',
        source: {
          system: 'Prisma · PurchaseBill',
          environment: 'LIVE',
          lastUpdatedAt: new Date().toISOString(),
          deepLink: '/dashboard?view=bills',
          recordCount: bills.length,
        },
        supports: ['supplier spend', 'payables', 'overdue payables'],
      },
    };
  } catch {
    return {
      totalSuppliers: 0,
      topSuppliers: [],
      overduePayables: 0,
      source: { system: 'Prisma · PurchaseBill', environment: 'UNAVAILABLE', lastUpdatedAt: null },
      evidence: { id: 'suppliers', label: 'Suppliers', source: { system: 'Prisma · PurchaseBill', environment: 'UNAVAILABLE', lastUpdatedAt: null }, supports: [] },
    };
  }
}

async function buildGSTDetail(orgId: string, isDemo: boolean): Promise<{ reconciliation: GSTSection['reconciliation']; gspConnected: boolean; source: DataSourceRef }> {
  let gspConnected = false;
  try {
    const profile = await db.gSTProfile.findFirst({
      where: { organizationId: orgId },
      select: { id: true, updatedAt: true },
    }).catch(() => null);
    gspConnected = !!profile;
  } catch {}

  let matched = 0, mismatched = 0, missingInBooks = 0, missingIn2B = 0, itcAtRisk = 0;
  try {
    const reconRows = await db.gSTR2BInvoice.findMany({
      where: { organizationId: orgId },
      select: { matchStatus: true, taxableValue: true, igst: true, cgst: true, sgst: true },
      take: 5000,
    }).catch(() => []);
    for (const r of reconRows) {
      const tax = (r.igst ?? 0) + (r.cgst ?? 0) + (r.sgst ?? 0);
      if (r.matchStatus === 'matched') matched++;
      else if (r.matchStatus === 'mismatched') { mismatched++; itcAtRisk += tax; }
      else if (r.matchStatus === 'missing_in_books') { missingInBooks++; itcAtRisk += tax; }
      else if (r.matchStatus === 'missing_in_2b') { missingIn2B++; itcAtRisk += tax; }
    }
  } catch {}

  const env: DataEnvironment = isDemo ? 'DEMO' : gspConnected ? 'LIVE' : 'UNAVAILABLE';
  return {
    reconciliation: { matched, mismatched, missingInBooks, missingIn2B, itcAtRisk },
    gspConnected,
    source: {
      system: gspConnected ? 'GST GSP · GSTR-2B' : 'GST (not connected)',
      environment: env,
      lastUpdatedAt: new Date().toISOString(),
      connectionState: gspConnected ? 'connected' : 'disconnected',
      deepLink: '/dashboard?view=gst-reconciliation',
      note: !gspConnected ? 'GSP not connected — reconciliation data may be incomplete' : undefined,
    },
  };
}

async function buildInvoiceAging(orgId: string): Promise<InvoicesSection['aging']> {
  try {
    const now = new Date();
    const invoices = await db.invoice.findMany({
      where: { client: { firmId: orgId }, balanceAmount: { gt: 0 } },
      select: { dueDate: true, balanceAmount: true },
      take: 5000,
    }).catch(() => []);

    let current = 0, days1to30 = 0, days31to60 = 0, days61to90 = 0, days90plus = 0;
    for (const inv of invoices) {
      if (!inv.dueDate || new Date(inv.dueDate) >= now) {
        current += inv.balanceAmount ?? 0;
        continue;
      }
      const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000);
      if (days <= 30) days1to30 += inv.balanceAmount ?? 0;
      else if (days <= 60) days31to60 += inv.balanceAmount ?? 0;
      else if (days <= 90) days61to90 += inv.balanceAmount ?? 0;
      else days90plus += inv.balanceAmount ?? 0;
    }
    return { current, days1to30, days31to60, days61to90, days90plus };
  } catch {
    return { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 };
  }
}

async function buildMonthlyRevenue(orgId: string): Promise<Array<{ month: string; value: number }>> {
  try {
    const now = new Date();
    const months: Array<{ month: string; value: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d;
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const agg = await db.invoice.aggregate({
        where: {
          client: { firmId: orgId },
          invoiceDate: { gte: start, lt: end },
        },
        _sum: { totalAmount: true },
      }).catch(() => ({ _sum: { totalAmount: 0 } }));
      const label = d.toLocaleString('en-IN', { month: 'short' });
      months.push({ month: label, value: agg._sum?.totalAmount ?? 0 });
    }
    return months;
  } catch {
    return [];
  }
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function emptyContext(orgId: string): UnifiedOracleContext {
  const now = new Date().toISOString();
  const emptySource: DataSourceRef = { system: 'Prisma', environment: 'UNAVAILABLE', lastUpdatedAt: null };
  return {
    organizationId: orgId,
    generatedAt: now,
    cacheTtlMs: CACHE_TTL_MS,
    businessProfile: {
      organizationId: orgId,
      organizationName: null,
      industry: null,
      gstin: null,
      accountingPeriod: currentFYLabel(),
      source: emptySource,
    },
    revenue: {
      invoicedRevenue: 0, collectedRevenue: 0, outstandingReceivables: 0, overdueReceivables: 0,
      trend: { thisMonth: 0, lastMonth: 0, changePct: null, direction: 'flat' },
      monthlySeries: [],
      source: emptySource,
      evidence: { id: 'invoices-fy', label: 'Invoices', source: emptySource, supports: [] },
    },
    expenses: {
      operatingExpenses: 0, supplierSpend: 0, total: 0, topCategories: [],
      trend: { thisMonth: 0, lastMonth: 0, changePct: null, direction: 'flat' },
      source: emptySource,
      evidence: { id: 'expenses-fy', label: 'Expenses', source: emptySource, supports: [] },
    },
    cashFlow: {
      currentBalance: 0, openingBalance: 0, inflows: 0, outflows: 0, net: 0,
      runwayMonths: Infinity, isEstimatedFromPaymentFlow: true,
      source: emptySource,
      evidence: { id: 'cash-flow', label: 'Cash Flow', source: emptySource, supports: [] },
    },
    customers: {
      totalCustomers: 0, topCustomers: [], concentrationTop1: 0, concentrationTop3: 0, overdueCustomerCount: 0,
      source: emptySource,
      evidence: { id: 'customers', label: 'Customers', source: emptySource, supports: [] },
    },
    suppliers: {
      totalSuppliers: 0, topSuppliers: [], overduePayables: 0,
      source: emptySource,
      evidence: { id: 'suppliers', label: 'Suppliers', source: emptySource, supports: [] },
    },
    gst: {
      outputTax: 0, inputTax: 0, liability: 0, filedReturns: 0, pendingReturns: 0, overdueReturns: 0,
      reconciliation: { matched: 0, mismatched: 0, missingInBooks: 0, missingIn2B: 0, itcAtRisk: 0 },
      gspConnected: false,
      source: emptySource,
      evidence: { id: 'gst', label: 'GST', source: emptySource, supports: [] },
    },
    invoices: {
      totalInvoices: 0, outstanding: 0, overdue: 0, paid: 0,
      aging: { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 },
      avgDaysToPay: 0, collectionRate: 0,
      source: emptySource,
      evidence: { id: 'invoices', label: 'Invoices', source: emptySource, supports: [] },
    },
    banking: emptyBanking(false, true),
    risk: { score: 0, signals: [] },
    integrations: { integrations: [], byProvider: {} },
    evidenceIndex: {},
    isDemoWorkspace: true,
    health: { score: 0, label: 'Critical', riskScore: 0, factors: [] },
  };
}
