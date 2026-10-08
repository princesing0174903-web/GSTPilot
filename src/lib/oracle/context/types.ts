// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Unified Financial Context: Type System
// ═══════════════════════════════════════════════════════════════════════════════
//
// THE single normalized context layer for every Oracle surface. Every Oracle
// component — the brain chat route, daily briefing, anomaly detector,
// forecaster, scenario engine, recommendations, copilot modes — MUST read from
// this unified context instead of independently fetching the same data.
//
// DESIGN PRINCIPLES:
//   1. REAL DATA ONLY. Every number is traceable to a Prisma row. If the DB
//      has no data, fields are zero/empty — never invented.
//   2. FRESHNESS FIRST. Every major section carries a `source` block with
//      `environment` (LIVE / SANDBOX / DEMO / STALE / UNAVAILABLE),
//      `lastUpdatedAt`, and `connectionState`. Oracle never presents stale
//      or sandbox numbers as live financial truth.
//   3. EVIDENCE-READY. Every metric carries an `evidence` ref pointing back
//      to the underlying record(s) so Oracle can cite "where did this come
//      from" and the UI can render a click-through source card.
//   4. ORG-SCOPED. Every query filters by organizationId. Zero cross-tenant
//      leakage.
//   5. CACHE-FRIENDLY. The builder caches per-org for 30s (same TTL as the
//      canonical Business Snapshot) so multiple Oracle surfaces hitting the
//      context in the same window pay one compute cost.
//   6. ONE CALL. `getUnifiedOracleContext(orgId)` returns everything Oracle
//      needs. Surfaces MUST NOT independently call getBusinessSnapshot,
//      query invoices, etc. — they read from this context.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Freshness & Environment ──────────────────────────────────────────────────

/**
 * The environment a data source lives in. Oracle uses this to label every
 * number it presents so users are never misled.
 *
 * - LIVE       : Production-grade real data (e.g. a connected Zoho Books with
 *                a valid OAuth token, a live bank connection).
 * - SANDBOX    : Test environment data (e.g. Setu sandbox bank transactions,
 *                GST demo profile). Usable for development but MUST be
 *                labelled "Sandbox" — never as live truth.
 * - DEMO       : Seeded demo data (local workspace, preview-mode demo org).
 *                Never claim as real financial exposure.
 * - STALE      : Was live once but the source hasn't synced within its
 *                freshness window. Oracle must say "last synced N days ago".
 * - UNAVAILABLE: Source is disconnected / errored / never configured.
 *                Oracle must say "X is not connected" and refuse to reason
 *                about X's numbers.
 */
export type DataEnvironment = 'LIVE' | 'SANDBOX' | 'DEMO' | 'STALE' | 'UNAVAILABLE';

/** The connection state of an integration (Google, Zoho, GST GSP, Banking). */
export type ConnectionState =
  | 'connected'      // token present + valid + last sync within window
  | 'expired'        // token present but expired / needs re-auth
  | 'disconnected'   // no token / user never connected
  | 'error'          // last sync attempt failed
  | 'sandbox';       // connected to sandbox environment (Setu sandbox, demo GST)

/** A freshness window — how long before data is considered stale. */
export interface FreshnessWindow {
  /** Max age in hours before the data is marked STALE. */
  maxAgeHours: number;
  /** Human label, e.g. "Bank transactions refresh every 24 hours". */
  label: string;
}

// ─── Source / Evidence ────────────────────────────────────────────────────────

/**
 * Provenance for a single data point or section. Every metric Oracle reports
 * carries one of these so the user can ask "where did this number come from?"
 * and get a precise, click-through answer.
 */
export interface DataSourceRef {
  /** The system the data came from, e.g. "Zoho Books", "Prisma (Invoices)", "Setu Banking Sandbox". */
  system: string;
  /** Environment. Oracle uses this to label sandbox/demo/stale data. */
  environment: DataEnvironment;
  /** ISO timestamp of when the underlying data was last updated (NOT when Oracle fetched it). */
  lastUpdatedAt: string | null;
  /** Connection state if this is an integration source. */
  connectionState?: ConnectionState;
  /** Optional period the data covers, e.g. "FY 2024-25", "July 2026", "GSTR-2B July 2026". */
  period?: string;
  /** Optional deep-link to the relevant VEYRO view, e.g. "/dashboard?view=invoices". */
  deepLink?: string;
  /** Optional record count the metric was computed from. */
  recordCount?: number;
  /** Optional human note, e.g. "Sandbox data — not real bank transactions". */
  note?: string;
}

/**
 * A single piece of evidence backing a financial claim Oracle makes.
 * Multiple claims can share one Evidence (e.g. "revenue" and "top customer"
 * both come from the Invoice table).
 */
export interface Evidence {
  /** Stable id, e.g. "invoices-fy-2024", "banking-sandbox-setu", "gst-2b-jul-2026". */
  id: string;
  /** Short label shown in the source card, e.g. "Invoices (FY 2024-25)". */
  label: string;
  /** The source system + freshness. */
  source: DataSourceRef;
  /** The specific record(s) this evidence is based on, for click-through. */
  records?: Array<{
    kind: 'invoice' | 'customer' | 'payment' | 'expense' | 'bill' | 'bank-transaction' | 'gst-filing' | 'gstr2b-invoice' | 'notice' | 'bank-account';
    id: string;
    label: string;
    href?: string;
  }>;
  /** The raw numbers this evidence supports (for audit). */
  supports?: string[];
}

// ─── Business Profile ─────────────────────────────────────────────────────────

export interface BusinessProfileSection {
  organizationId: string;
  organizationName: string | null;
  industry: string | null;
  gstin: string | null;
  /** Indian financial year, e.g. "FY 2024-25". */
  accountingPeriod: string;
  source: DataSourceRef;
}

// ─── Revenue ──────────────────────────────────────────────────────────────────

export interface RevenueSection {
  /** Total invoiced revenue this FY. */
  invoicedRevenue: number;
  /** Revenue actually collected (payments received against invoices). */
  collectedRevenue: number;
  /** Outstanding receivables (unpaid invoice balances). */
  outstandingReceivables: number;
  /** Overdue receivables (past due date). */
  overdueReceivables: number;
  /** This month vs last month, with direction. */
  trend: {
    thisMonth: number;
    lastMonth: number;
    changePct: number | null; // null if last month was 0
    direction: 'up' | 'down' | 'flat';
  };
  /** Month-over-month series for the last 6 months (oldest first). */
  monthlySeries: Array<{ month: string; value: number }>;
  source: DataSourceRef;
  evidence: Evidence;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface ExpensesSection {
  /** Operating expenses this FY. */
  operatingExpenses: number;
  /** Supplier spend (purchase bills) this FY. */
  supplierSpend: number;
  /** Total expenses (operating + supplier). */
  total: number;
  /** Top expense categories by spend. */
  topCategories: Array<{ category: string; amount: number; pct: number }>;
  trend: {
    thisMonth: number;
    lastMonth: number;
    changePct: number | null;
    direction: 'up' | 'down' | 'flat';
  };
  source: DataSourceRef;
  evidence: Evidence;
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────

export interface CashFlowSection {
  /** Current cash position (bank balances or net payment flow fallback). */
  currentBalance: number;
  /** Opening cash at the start of the period. */
  openingBalance: number;
  /** Total inflows this period. */
  inflows: number;
  /** Total outflows this period. */
  outflows: number;
  /** Net cash flow (inflows - outflows). */
  net: number;
  /** Runway in months (cash / monthly burn). Infinity if no burn. */
  runwayMonths: number;
  /** Honest flag — true when cash was computed from payment flow, not real bank balances. */
  isEstimatedFromPaymentFlow: boolean;
  source: DataSourceRef;
  evidence: Evidence;
}

// ─── Customers ────────────────────────────────────────────────────────────────

export interface CustomerSection {
  totalCustomers: number;
  /** Top customers by revenue, with their share of total revenue. */
  topCustomers: Array<{
    id: string;
    name: string;
    revenue: number;
    share: number; // 0-1
    outstandingBalance: number;
    overdueBalance: number;
    avgDaysToPay: number;
  }>;
  /** Customer concentration — top customer's share of revenue. */
  concentrationTop1: number;
  /** Top 3 customers' combined share. */
  concentrationTop3: number;
  /** Customers with overdue balances. */
  overdueCustomerCount: number;
  source: DataSourceRef;
  evidence: Evidence;
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export interface SupplierSection {
  totalSuppliers: number;
  /** Top suppliers by spend. */
  topSuppliers: Array<{
    name: string;
    spend: number;
    outstandingBalance: number;
    overdueBalance: number;
    gstCompliant: boolean | null; // null = unknown
  }>;
  /** Total overdue payables. */
  overduePayables: number;
  source: DataSourceRef;
  evidence: Evidence;
}

// ─── GST ──────────────────────────────────────────────────────────────────────

export interface GSTSection {
  /** GST collected on sales (output tax). */
  outputTax: number;
  /** ITC — GST paid on purchases (input tax credit available). */
  inputTax: number;
  /** Net GST liability (output - input). */
  liability: number;
  /** Filed returns this FY. */
  filedReturns: number;
  /** Pending returns (not yet filed). */
  pendingReturns: number;
  /** Returns past due date. */
  overdueReturns: number;
  /** GSTR-2B reconciliation summary. */
  reconciliation: {
    matched: number;
    mismatched: number;
    missingInBooks: number;   // in 2B but not in books
    missingIn2B: number;      // in books but not in 2B
    itcAtRisk: number;        // ₹ value of ITC at risk from mismatches
  };
  /** Whether GSP is connected (live GSTR-2B data available). */
  gspConnected: boolean;
  source: DataSourceRef;
  evidence: Evidence;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface InvoicesSection {
  totalInvoices: number;
  outstanding: number;
  overdue: number;
  paid: number;
  /** Aging buckets for outstanding invoices. */
  aging: {
    current: number;      // not yet due
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days90plus: number;
  };
  /** Average days to pay (collection cycle). */
  avgDaysToPay: number;
  /** Collection rate (collected / invoiced). */
  collectionRate: number;
  source: DataSourceRef;
  evidence: Evidence;
}

// ─── Banking ──────────────────────────────────────────────────────────────────

export interface BankingSection {
  connected: boolean;
  /** Connected bank accounts. */
  accounts: Array<{
    id: string;
    maskedNumber: string;
    bankName: string;
    balance: number | null;
    environment: DataEnvironment;
  }>;
  /** Recent transactions (last 30 days), categorized. */
  recentTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number; // + for credit, - for debit
    category: string | null;
    reconciled: boolean;
  }>;
  /** Categorized transaction totals. */
  categorizedTotals: Array<{ category: string; inflow: number; outflow: number }>;
  /** True when the connection is a SANDBOX (Setu sandbox, mock). */
  isSandbox: boolean;
  source: DataSourceRef;
  evidence: Evidence;
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

export type RiskKind = 'cash' | 'gst' | 'receivable' | 'supplier' | 'concentration' | 'compliance' | 'anomaly';

export interface RiskSignal {
  kind: RiskKind;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
  /** ₹ impact if the risk materializes, if quantifiable. */
  estimatedImpact?: number;
  /** Evidence backing this risk. */
  evidence: Evidence;
  /** Recommended action. */
  recommendedAction?: string;
}

export interface RiskSection {
  /** Composite risk score 0-100 (higher = riskier). Same as snapshot.riskScore. */
  score: number;
  signals: RiskSignal[];
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export interface IntegrationStatus {
  provider: 'google' | 'zoho' | 'gst-gsp' | 'banking';
  label: string;
  connected: boolean;
  connectionState: ConnectionState;
  environment: DataEnvironment;
  lastSyncAt: string | null;
  /** Days since last sync. null if never synced. */
  daysSinceSync: number | null;
  /** Whether the integration is failing (last sync errored). */
  lastSyncFailed: boolean;
  /** Human-readable status message. */
  statusMessage: string;
}

export interface IntegrationsSection {
  integrations: IntegrationStatus[];
  /** Quick lookup. */
  byProvider: Record<string, IntegrationStatus>;
}

// ─── The Unified Context ──────────────────────────────────────────────────────

export interface UnifiedOracleContext {
  organizationId: string;
  generatedAt: string;
  /** Cache TTL in ms (30s by default). */
  cacheTtlMs: number;

  businessProfile: BusinessProfileSection;
  revenue: RevenueSection;
  expenses: ExpensesSection;
  cashFlow: CashFlowSection;
  customers: CustomerSection;
  suppliers: SupplierSection;
  gst: GSTSection;
  invoices: InvoicesSection;
  banking: BankingSection;
  risk: RiskSection;
  integrations: IntegrationsSection;

  /** ALL evidence collected, keyed by id — for the UI to render source cards. */
  evidenceIndex: Record<string, Evidence>;

  /** True if the workspace is a local/preview demo org. */
  isDemoWorkspace: boolean;

  /** Quick health snapshot (delegates to canonical getBusinessSnapshot). */
  health: {
    score: number;
    label: string;
    riskScore: number;
    factors: Array<{ key: string; label: string; contribution: number; detail: string }>;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Determine the effective environment for a source given its connection state + age. */
export function resolveEnvironment(
  connectionState: ConnectionState | undefined,
  lastUpdatedAt: string | null,
  window: FreshnessWindow,
  isDemoWorkspace: boolean,
): DataEnvironment {
  if (isDemoWorkspace) return 'DEMO';
  if (!connectionState || connectionState === 'disconnected') return 'UNAVAILABLE';
  if (connectionState === 'sandbox') return 'SANDBOX';
  if (connectionState === 'error' || connectionState === 'expired') return 'STALE';
  if (connectionState === 'connected') {
    if (!lastUpdatedAt) return 'STALE';
    const ageHours = (Date.now() - new Date(lastUpdatedAt).getTime()) / 3_600_000;
    if (ageHours > window.maxAgeHours) return 'STALE';
    return 'LIVE';
  }
  return 'UNAVAILABLE';
}

/** Format an environment as a user-facing badge label. */
export function environmentLabel(env: DataEnvironment): string {
  switch (env) {
    case 'LIVE': return 'Live';
    case 'SANDBOX': return 'Sandbox';
    case 'DEMO': return 'Demo';
    case 'STALE': return 'Stale';
    case 'UNAVAILABLE': return 'Unavailable';
  }
}

/** Format an environment as a Tailwind badge color class. */
export function environmentBadgeClass(env: DataEnvironment): string {
  switch (env) {
    case 'LIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'SANDBOX': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'DEMO': return 'bg-violet-100 text-violet-700 border-violet-200';
    case 'STALE': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'UNAVAILABLE': return 'bg-zinc-100 text-zinc-500 border-zinc-200';
  }
}

/** Human-readable "X ago" from an ISO timestamp. */
export function ago(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/** Standard freshness windows per source. */
export const FRESHNESS_WINDOWS: Record<string, FreshnessWindow> = {
  invoices: { maxAgeHours: 24, label: 'Invoices refresh on creation' },
  banking: { maxAgeHours: 24, label: 'Bank transactions refresh daily' },
  gst: { maxAgeHours: 24 * 7, label: 'GST data refreshes weekly' },
  gstr2b: { maxAgeHours: 24 * 30, label: 'GSTR-2B is published monthly' },
  zoho: { maxAgeHours: 4, label: 'Zoho Books syncs every 4 hours' },
  google: { maxAgeHours: 1, label: 'Google Workspace refreshes hourly' },
  expenses: { maxAgeHours: 24, label: 'Expenses refresh on creation' },
  payments: { maxAgeHours: 24, label: 'Payments refresh on creation' },
};
