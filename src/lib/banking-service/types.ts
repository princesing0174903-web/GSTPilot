// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Service — Domain Types (Provider-Agnostic Contract)
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is the SINGLE source of truth for the Banking module's data shapes.
// Both the UI and Oracle consume these types. The Banking Service interface
// (provider.ts) operates on these types.
//
// Architecture:
//   UI (Banking pages) ──→ BankingService (interface) ──→ MockBankingProvider (now)
//   Oracle Actions ──────→ BankingService (same)        ──→ SetuBankingProvider (future)
//   Oracle Workflows ────→ BankingService (same)
//
// To switch from Mock → Setu later: implement SetuBankingProvider against the
// SAME BankingService interface, then change ONE line in getBankingService().
// No UI, Oracle action, or workflow changes required.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Bank Accounts ────────────────────────────────────────────────────────────

export type AccountType = 'savings' | 'current' | 'overdraft' | 'credit_card';
export type AccountStatus = 'connected' | 'disconnected' | 'syncing' | 'error';

export interface BankingAccount {
  id: string;
  bankName: string;
  /** Display name e.g. "HDFC Current — Acme Pvt Ltd" */
  accountName: string;
  /** Masked account number e.g. "••••4821" */
  accountMasked: string;
  accountType: AccountType;
  ifsc?: string;
  /** Current ledger balance */
  balance: number;
  /** Available balance (ledger - holds) */
  availableBalance: number;
  currency: string; // ISO 4217, e.g. "INR"
  overdraftLimit?: number;
  upiHandle?: string;
  status: AccountStatus;
  lastSyncAt?: string; // ISO
  createdAt: string;
  updatedAt: string;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TransactionType = 'credit' | 'debit';
export type TransactionStatus =
  | 'reconciled'
  | 'unreconciled'
  | 'pending'
  | 'ignored';

/** Canonical banking transaction category (drives breakdown charts). */
export type TransactionCategory =
  | 'sales'
  | 'payment_received'
  | 'vendor_payment'
  | 'salary'
  | 'rent'
  | 'utilities'
  | 'tax'
  | 'fees'
  | 'refund'
  | 'transfer'
  | 'interest'
  | 'misc';

export interface BankingTransaction {
  id: string;
  accountId: string;
  date: string; // ISO
  description: string;
  /** Counterparty extracted from description (vendor / customer / bank) */
  counterparty?: string;
  amount: number; // always positive; `type` indicates direction
  type: TransactionType;
  category?: TransactionCategory;
  /** AI-suggested category (may differ from manual `category`) */
  aiCategory?: TransactionCategory;
  /** 0–1 confidence the AI category is correct */
  confidence?: number;
  referenceNo?: string;
  upiRef?: string;
  balanceAfter?: number;
  status: TransactionStatus;
  /** Linked invoice id (when matched to a sale) */
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
  /** Linked payment / expense id when reconciled */
  linkedPaymentId?: string;
  linkedExpenseId?: string;
  matchType?: 'exact' | 'fuzzy' | 'manual' | 'none';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

export type ReconcileMatchStatus =
  | 'matched'
  | 'partial'
  | 'unmatched'
  | 'suggested';

export interface ReconcileCandidate {
  /** The candidate entity type */
  kind: 'invoice' | 'payment' | 'expense' | 'refund' | 'receipt';
  id: string;
  label: string; // e.g. "INV-2024-0142 — Acme Pvt Ltd"
  amount: number;
  date: string;
  /** 0–1 how well this candidate matches the transaction */
  confidence: number;
}

export interface ReconcileResult {
  transactionId: string;
  status: ReconcileMatchStatus;
  candidates: ReconcileCandidate[];
  /** The best candidate (when status is matched/suggested) */
  bestMatch?: ReconcileCandidate;
  reason?: string;
}

export interface ReconcileSummary {
  total: number;
  matched: number;
  partial: number;
  unmatched: number;
  suggested: number;
  reconciledPct: number;
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────

export interface CashFlowPoint {
  date: string; // ISO date (YYYY-MM-DD)
  inflow: number;
  outflow: number;
  net: number;
  balance: number;
}

export interface CashFlowSummary {
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  openingBalance: number;
  closingBalance: number;
  /** Daily series for the requested period */
  series: CashFlowPoint[];
  /** Top inflow categories with totals */
  inflowByCategory: Array<{ category: TransactionCategory; amount: number }>;
  outflowByCategory: Array<{ category: TransactionCategory; amount: number }>;
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export interface ForecastPoint {
  date: string; // ISO date
  projectedInflow: number;
  projectedOutflow: number;
  projectedBalance: number;
  /** Lower bound (pessimistic) */
  lowBalance: number;
  /** Upper bound (optimistic) */
  highBalance: number;
}

export interface CashFlowForecast {
  horizon: '7d' | '30d';
  points: ForecastPoint[];
  /** Projected balance at end of horizon */
  projectedEndBalance: number;
  /** Days until balance hits zero (Infinity if never) */
  runwayDays: number;
  /** Lowest projected balance in the horizon (may be negative) */
  minBalance: number;
  /** Date of the lowest balance */
  minBalanceDate?: string;
  /** Confidence 0–1 based on data volume + volatility */
  confidence: number;
  /** Human-readable narrative */
  narrative: string;
  /** Key risk factors identified */
  risks: string[];
  /** Recommended actions */
  recommendations: string[];
}

// ─── Categorization Rules ─────────────────────────────────────────────────────

export interface CategorizationRule {
  id: string;
  /** Substring / regex pattern matched against description (case-insensitive) */
  pattern: string;
  isRegex: boolean;
  category: TransactionCategory;
  /** Optional counterparty override */
  counterparty?: string;
  priority: number; // higher = checked first
  active: boolean;
  /** How many transactions matched this rule (computed) */
  matchCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface BankingDashboard {
  cards: {
    totalBalance: number;
    todaysBalance: number;
    cashIn: number; // last 30d inflow
    cashOut: number; // last 30d outflow
    netCashFlow: number;
    pendingPayments: number;
    upcomingReceipts: number;
    reconciledPct: number;
    unreconciledCount: number;
    linkedAccounts: number;
  };
  cashFlowSeries: CashFlowPoint[]; // last 30d
  incomeVsExpense: Array<{ date: string; income: number; expense: number }>; // last 6 months
  monthlyTrend: Array<{ month: string; inflow: number; outflow: number; net: number }>; // last 6 months
  categoryBreakdown: Array<{ category: TransactionCategory; amount: number; pct: number }>; // last 30d
}

// ─── Statement Import ─────────────────────────────────────────────────────────

export type ImportFormat = 'csv' | 'excel' | 'pdf';
export type ImportStage = 'uploaded' | 'preview' | 'categorizing' | 'imported' | 'failed';

export interface ImportedRow {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  referenceNo?: string;
  /** AI-suggested category after categorization pass */
  suggestedCategory?: TransactionCategory;
  confidence?: number;
  /** Validation issues (empty = valid) */
  issues?: string[];
}

export interface ImportPreview {
  rows: ImportedRow[];
  detectedAccountId?: string;
  detectedCurrency: string;
  detectedPeriod?: { from: string; to: string };
  totalInflow: number;
  totalOutflow: number;
  rowCount: number;
  validRowCount: number;
  issueCount: number;
}

export interface ImportResult {
  ok: boolean;
  importedCount: number;
  skippedCount: number;
  categorizationApplied: number;
  transactionIds: string[];
  summary: string;
}

// ─── AI Insights (Oracle Banking Intelligence) ────────────────────────────────

export interface BankingInsightAnswer {
  /** The question that was asked */
  question: string;
  /** Short label e.g. "Total cash position" */
  label: string;
  /** Markdown narrative answer */
  answer: string;
  /** Key figures surfaced */
  metrics?: Array<{ label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }>;
  /** Optional supporting table */
  table?: {
    columns: string[];
    rows: Array<Record<string, string | number>>;
  };
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface TransactionFilter {
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: TransactionCategory;
  type?: TransactionType;
  status?: TransactionStatus;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  /** Pagination */
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}
