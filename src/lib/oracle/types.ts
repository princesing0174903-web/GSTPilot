// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — VEYRO AI Intelligence Engine™
// The AI Operating System for Business™
//
// Canonical type system for the VEYRO AI Intelligence Engine. Every collector,
// analyzer, ranker, and the briefing assembler speaks these types. Adding a
// new data source means: (1) define its dataset shape below, (2) implement a
// Collector that returns that shape, (3) register it in the engine. Analyzers
// then automatically gain access to the new source.
//
// Design principles:
//   • No demo data. Every field is populated from a real source or absent.
//   • Graceful emptiness. A disconnected source yields { connected: false }
//     with an empty dataset — never throws.
//   • Modular. Collectors and analyzers are plug-in interfaces registered in
//     arrays so dozens of future sources can be added without touching the
//     engine core.
// ═══════════════════════════════════════════════════════════════════════════════

// NOTE: Collector implementations read Prisma rows via `db.<model>.findMany()`
// and rely on the inferred row types directly — no Prisma `GetPayload` type
// re-exports are needed here. This keeps the type system loose-coupled: the
// engine never depends on Prisma's internal type machinery.

/**
 * Context passed to every collector. The engine resolves `organizationId`
 * from the user's stored Google Workspace token (if any) before invoking
 * collectors, so Google-API collectors can look up their credentials.
 *
 * Business-data collectors (invoices, gst, banking) read from the firm-wide
 * Prisma tables and use `organizationId` only for future multi-tenant
 * filtering — today the dev database is single-tenant and they return all
 * rows honestly.
 */
export interface CollectorContext {
  /** Firebase Auth uid of the requesting user. */
  userId: string;
  /** Resolved organization id (from GoogleWorkspaceToken lookup). May be null. */
  organizationId: string | null;
  /** User email if known (from token row). May be null. */
  userEmail: string | null;
}

// ─── Collector primitives ─────────────────────────────────────────────────────

/**
 * The uniform envelope every collector returns. `data` is always present
 * (possibly empty) so analyzers can destructure safely without null-checks.
 */
export interface CollectorResult<T> {
  /** Collector id, e.g. 'gmail', 'invoices'. */
  source: string;
  /** Whether the underlying service is connected / has data. */
  connected: boolean;
  /** Number of records read (0 if disconnected or empty). */
  recordCount: number;
  /** The payload. Never null — empty object/array when disconnected. */
  data: T;
  /** Optional human-readable error if the collector failed mid-flight. */
  error?: string;
  /** ISO timestamp of collection. */
  collectedAt: string;
}

/**
 * A plug-in collector. Implementations live in `collectors/*.ts` and register
 * themselves in the engine's collector registry.
 */
export interface Collector<T = unknown> {
  /** Unique stable id ('gmail' | 'calendar' | 'drive' | 'invoices' | 'gst' | 'banking' | ...). */
  id: string;
  /** Human label for the Sources panel. */
  label: string;
  /** Fetch the data. MUST NOT throw — catch everything and return an error envelope. */
  collect(ctx: CollectorContext): Promise<CollectorResult<T>>;
}

// ─── Per-source dataset shapes ────────────────────────────────────────────────

// Gmail ────────────────────────────────────────────────────────────────────────
export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string; // ISO
  snippet: string;
  labelIds: string[];
}

export interface GmailData {
  email: string | null;
  messagesTotal: number | null;
  recent: GmailMessageSummary[];
  /** Subjects classified into loose buckets (gst_notice, vendor_invoice, client_invoice, tax_communication, other). */
  buckets: Record<GmailBucket, number>;
}

export type GmailBucket =
  | 'gst_notice'
  | 'vendor_invoice'
  | 'client_invoice'
  | 'tax_communication'
  | 'other';

// Calendar ─────────────────────────────────────────────────────────────────────
export interface CalendarEventSummary {
  id: string;
  summary: string;
  start: string; // ISO
  end: string; // ISO
  attendees: string[];
  hangoutLink?: string;
  location?: string;
}

export interface CalendarData {
  upcoming: CalendarEventSummary[];
  /** ISO date of the next event. */
  nextEventAt: string | null;
  /** Load in the next 7 days (event count). */
  weekLoad: number;
  /** Conflicts detected (overlapping events) in the next 7 days. */
  conflicts: number;
}

// Drive ────────────────────────────────────────────────────────────────────────
export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string; // ISO
  webViewLink?: string;
}

export interface DriveData {
  recentFiles: DriveFileSummary[];
  /** Files modified in the last 7 days. */
  recentlyActive: number;
  /** Loose classification by mime type. */
  byType: Record<string, number>;
}

// Invoices ─────────────────────────────────────────────────────────────────────
export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  clientId: string;
  buyerName: string | null;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string; // unpaid | partial | paid | overdue
  status: string; // draft | final | cancelled
  riskLevel: string; // low | medium | high
  riskScore: number;
}

export interface PurchaseBillSummary {
  id: string;
  vendorName: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  status: string;
}

export interface ExpenseSummary {
  id: string;
  category: string;
  vendor: string | null;
  amount: number;
  gst: number;
  gstClaimable: boolean;
  date: string;
  status: string;
}

export interface PaymentSummary {
  id: string;
  partyName: string;
  partyType: string; // customer | vendor
  amount: number;
  paymentDate: string;
  paymentMode: string;
  status: string;
  invoiceId: string | null;
}

export interface InvoicesData {
  invoices: InvoiceSummary[];
  purchaseBills: PurchaseBillSummary[];
  expenses: ExpenseSummary[];
  payments: PaymentSummary[];
  /** Aggregate metrics (pre-computed for analyzers). */
  totals: {
    salesOutstanding: number;
    purchaseOutstanding: number;
    overdueAmount: number;
    expenseThisMonth: number;
    collectedThisMonth: number;
  };
}

// GST ──────────────────────────────────────────────────────────────────────────
export interface GstProfileSummary {
  gstin: string;
  legalName: string | null;
  tradeName: string | null;
  status: string | null;
  taxpayerType: string | null;
}

export interface GstReturnSummary {
  id: string;
  gstin: string;
  type: string; // GSTR-1 | GSTR-2B | GSTR-3B
  period: string; // YYYY-MM
  status: string; // not_started | prepared | filed | downloaded
  totalTaxableValue: number;
  totalTax: number;
  totalITC: number;
  invoiceCount: number;
  filedAt: string | null;
}

export interface GstrFilingSummary {
  id: string;
  clientId: string;
  returnType: string;
  period: string;
  status: string;
  filedDate: string | null;
  totalTax: number;
  criticalErrors: number;
  warnings: number;
}

export interface Gstr2BInvoiceSummary {
  id: string;
  gstin: string;
  period: string;
  supplierGSTIN: string;
  supplierName: string | null;
  invoiceNo: string;
  taxableValue: number;
  itcAvailable: number;
  itcEligible: boolean;
  matchStatus: string;
  mismatchReason: string | null;
}

export interface GstNoticeSummary {
  id: string;
  clientId: string;
  noticeType: string;
  noticeNumber: string | null;
  noticeDate: string | null;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  responseDate: string | null;
}

export interface GstData {
  profiles: GstProfileSummary[];
  returns: GstReturnSummary[];
  gstrFilings: GstrFilingSummary[];
  gstr2b: Gstr2BInvoiceSummary[];
  notices: GstNoticeSummary[];
  totals: {
    outputTaxLiability: number;
    itcAvailable: number;
    itcMismatched: number;
    openNotices: number;
    pendingReturns: number;
  };
}

// Banking ──────────────────────────────────────────────────────────────────────
export interface BankAccountSummary {
  id: string;
  bankName: string;
  accountMasked: string;
  accountType: string;
  balance: number;
  availableBalance: number;
  overdraftLimit: number;
  status: string;
  lastSyncAt: string | null;
}

export interface BankTransactionSummary {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: string; // credit | debit
  category: string | null;
  referenceNo: string | null;
  matched: boolean;
  balanceAfter: number | null;
}

export interface BankingData {
  accounts: BankAccountSummary[];
  transactions: BankTransactionSummary[];
  totals: {
    totalBalance: number;
    availableBalance: number;
    recentCredits: number;
    recentDebits: number;
    netFlow: number;
    unmatchedTransactions: number;
  };
}

// ─── Aggregated dataset ──────────────────────────────────────────────────────

/**
 * The collected dataset, keyed by collector id. Analyzers look up the
 * collectors they care about by id and cast to the concrete dataset shape.
 */
export type CollectedDataset = Record<string, CollectorResult<unknown>>;

/**
 * Type-safe accessor. Returns the typed dataset for a collector id, or null
 * if the collector didn't run / returned no data.
 */
export function getDataset<T>(dataset: CollectedDataset, source: string): T | null {
  const entry = dataset[source];
  if (!entry || !entry.connected) return null;
  return entry.data as T;
}

// ─── Signals (the atomic analysis unit) ───────────────────────────────────────

export type SignalKind = 'problem' | 'opportunity' | 'info';

export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low';

export type SignalCategory =
  | 'cashflow'
  | 'compliance'
  | 'receivables'
  | 'payables'
  | 'productivity'
  | 'deadline'
  | 'itc'
  | 'notice'
  | 'banking'
  | 'growth';

export interface SignalEvidence {
  /** The collector id that produced the evidence. */
  source: string;
  /** Human-readable reference, e.g. "Invoice INV-001" or "GSTR-3B 2024-08". */
  reference: string;
  /** Optional deep link. */
  link?: string;
}

export interface Signal {
  /** Stable id (deterministic — same problem → same id across runs). */
  id: string;
  kind: SignalKind;
  category: SignalCategory;
  severity: SignalSeverity;
  title: string;
  description: string;
  /** What should be done about it. */
  recommendation: string;
  /** INR monetary impact if known (0 if not applicable). */
  monetaryValue: number;
  /** ISO date when the underlying issue is due / expires (if time-sensitive). */
  dueDate: string | null;
  /** 0–1 confidence in the detection. */
  confidence: number;
  /** Which collector records back this signal. */
  evidence: SignalEvidence[];
  /** Which analyzer produced it. */
  analyzer: string;
  /** Optional key-value tags for downstream filtering. */
  tags?: Record<string, string | number>;
}

export interface AnalyzerResult {
  /** Analyzer id, e.g. 'cashflow', 'compliance'. */
  analyzer: string;
  /** Signals emitted. */
  signals: Signal[];
  /** Numeric metrics this analyzer computed (for the briefing metrics panel). */
  metrics: Record<string, number>;
}

/**
 * A plug-in analyzer. Implementations live in `analyzers/*.ts`.
 *
 * `analyze` may be async (some analyzers need an extra DB round-trip, e.g.
 * the deadlines analyzer reads the ComplianceDeadline table). The engine
 * awaits every analyzer uniformly.
 */
export interface Analyzer {
  id: string;
  label: string;
  analyze(dataset: CollectedDataset): AnalyzerResult | Promise<AnalyzerResult>;
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

export interface RankedSignal extends Signal {
  /** 1-based rank (1 = most important). */
  rank: number;
  /** 0–100 importance score. */
  score: number;
  /** Breakdown of the score by factor. */
  scoreBreakdown: {
    severity: number;
    monetary: number;
    urgency: number;
    confidence: number;
    category: number;
  };
}

// ─── Final briefing ───────────────────────────────────────────────────────────

export interface BriefingMetric {
  key: string;
  label: string;
  value: number;
  /** Display unit: 'inr' | 'count' | 'percent' | 'days'. */
  unit: 'inr' | 'count' | 'percent' | 'days';
  /** Optional delta vs previous period (-1..1). */
  trend?: number;
}

export interface BriefingAction {
  /** Signal id this action addresses. */
  signalId: string;
  title: string;
  /** One-line rationale. */
  why: string;
  /** Suggested next step. */
  step: string;
  /** Deep link into the app if applicable. */
  link?: string;
  /** Estimated INR impact if actioned. */
  impact: number;
}

export interface BriefingSourceStatus {
  source: string;
  label: string;
  connected: boolean;
  recordCount: number;
  error?: string;
}

export interface OracleBriefing {
  /** ISO timestamp of generation. */
  generatedAt: string;
  /** User id the briefing was built for. */
  userId: string;
  /** One-line headline — the single most important thing to know. */
  headline: string;
  /** 2–4 sentence executive summary. */
  summary: string;
  /** Overall business health score (0–100). */
  healthScore: number;
  /** Top metrics for the metrics panel. */
  metrics: BriefingMetric[];
  /** All signals, ranked by importance (most important first). */
  signals: RankedSignal[];
  /** Concrete next actions derived from the top signals. */
  topActions: BriefingAction[];
  /** Per-source connection status (for the Sources panel). */
  sources: BriefingSourceStatus[];
  /** How many collectors contributed data. */
  coverage: {
    connected: number;
    disconnected: number;
    total: number;
  };
  /** Engine version for schema evolution tracking. */
  version: string;
}

// ─── Prisma row types ─────────────────────────────────────────────────────────
//
// Intentionally NOT re-exported here. Each collector imports `db` from
// `@/lib/db` and lets TypeScript infer the row type from `findMany`. This
// avoids coupling the engine's public type surface to Prisma's internal
// `GetPayload` machinery and keeps the lint surface clean.
