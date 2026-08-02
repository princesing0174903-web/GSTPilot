// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Prisma Type Definitions (TASK 12)
//
// The data model for the local-database banking module. Every field maps 1:1 to
// a Prisma model (BankAccount, BankTransaction, BankReconciliation,
// StatementImport, CashFlowSnapshot). All types are PURE (no Prisma imports) so
// they are safe to import from both client and server code.
//
// Provider Adapter Pattern:
//   • IBankProvider (src/lib/banking-provider/provider.ts) — the contract.
//   • MockBankProvider (default) — deterministic data, persisted to local DB.
//   • SetuProvider / RazorpayXProvider (future) — swap in via env var, zero
//     changes to this service, the API routes, or the UI.
//
// Multi-tenant: every record carries `organizationId`. Every query filters on it.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Account ──────────────────────────────────────────────────────────────────

export type BankAccountType =
  | 'current'
  | 'savings'
  | 'od'
  | 'cash_wallet'
  | 'upi_wallet'
  | 'credit_card';

export type BankAccountStatus = 'active' | 'paused' | 'syncing' | 'error' | 'disconnected';

export interface BankingAccount {
  id: string;
  organizationId: string;
  bankName: string;
  bankLogoUrl: string | null;
  accountNumber: string;
  accountMasked: string;
  accountType: BankAccountType;
  ifsc: string | null;
  branch: string | null;
  owner: string | null;
  balance: number;
  availableBalance: number;
  overdraftLimit: number;
  upiHandle: string | null;
  currency: string;
  provider: string;
  aaConsent: boolean;
  aaConsentExpiry: string | null;
  status: BankAccountStatus;
  lastSyncAt: string | null;
  lastSyncAgo: string;
  transactionCount: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  createdAt: string;
  updatedAt: string;
}

export interface BankingAccountListResult {
  accounts: BankingAccount[];
  totalBalance: number;
  availableBalance: number;
  totalAccounts: number;
  activeAccounts: number;
  syncedToday: number;
  hasLiveData: boolean;
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export type TransactionType = 'credit' | 'debit';

export type TransactionCategory =
  | 'sales'
  | 'purchase'
  | 'gst'
  | 'salary'
  | 'rent'
  | 'utilities'
  | 'loan'
  | 'interest'
  | 'transfer'
  | 'investment'
  | 'cash_withdrawal'
  | 'fee'
  | 'refund'
  | 'other';

export type TransactionStatus = 'posted' | 'pending' | 'reconciled' | 'disputed';
export type TransactionSource = 'statement' | 'api' | 'import' | 'manual';

export type ReconciliationMatchType =
  | 'exact'
  | 'partial'
  | 'duplicate'
  | 'overpayment'
  | 'underpayment'
  | 'missing'
  | 'suspicious';

export interface BankingTransaction {
  id: string;
  organizationId: string;
  accountId: string;
  bankName: string;
  accountMasked: string;
  date: string;
  valueDate: string | null;
  description: string;
  narration: string | null;
  amount: number;
  type: TransactionType;
  balance: number | null;
  category: TransactionCategory;
  counterparty: string | null;
  referenceNo: string | null;
  reference: string | null;
  upiRef: string | null;
  status: TransactionStatus;
  source: TransactionSource;
  matched: boolean;
  matchedInvoiceId: string | null;
  matchType: ReconciliationMatchType | null;
  matchConfidence: number;
  reconciledAt: string | null;
  reconciledBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankingTransactionListResult {
  transactions: BankingTransaction[];
  total: number;
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  hasLiveData: boolean;
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

export interface BankReconciliationRecord {
  id: string;
  organizationId: string;
  transactionId: string;
  invoiceId: string | null;
  paymentId: string | null;
  matchType: ReconciliationMatchType;
  confidence: number;
  expectedAmount: number | null;
  actualAmount: number | null;
  difference: number;
  status: 'pending' | 'approved' | 'rejected';
  matchedBy: string;
  matchedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationSummary {
  total: number;
  matched: number;
  partiallyMatched: number;
  unmatched: number;
  duplicate: number;
  overpayment: number;
  underpayment: number;
  missing: number;
  suspicious: number;
  reconciliationRate: number;
  totalMatchedAmount: number;
  totalUnmatchedAmount: number;
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────

export interface CashFlowPoint {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  closingBalance: number;
}

export interface CashFlowResult {
  daily: CashFlowPoint[];
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  avgDailyInflow: number;
  avgDailyOutflow: number;
  openingBalance: number;
  closingBalance: number;
  period: '7d' | '30d' | '90d' | '1y';
  hasLiveData: boolean;
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export interface BankingDashboardSummary {
  totalBalance: number;
  availableBalance: number;
  todaysCredits: number;
  todaysDebits: number;
  pendingReconciliation: number;
  connectedAccounts: number;
  cashFlow: { inflow: number; outflow: number; net: number };
  bankHealthScore: number;
  reconciliationRate: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  recentTransactions: BankingTransaction[];
  cashFlowTrend: CashFlowPoint[];
  hasLiveData: boolean;
}

// ─── Oracle AI Banking ────────────────────────────────────────────────────────

export interface BankingOracleInsights {
  cashFlowAnalysis: {
    health: 'excellent' | 'good' | 'fair' | 'poor';
    score: number;
    insight: string;
    avgDailyBurn: number;
    runwayDays: number;
  };
  largeWithdrawals: Array<{
    transactionId: string;
    date: string;
    amount: number;
    counterparty: string | null;
    description: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  duplicatePayments: Array<{
    amount: number;
    count: number;
    counterparty: string | null;
    dates: string[];
    totalExposure: number;
  }>;
  gstPaymentReadiness: {
    ready: boolean;
    nextDueDate: string | null;
    estimatedLiability: number;
    availableBalance: number;
    shortfall: number;
  };
  collectionEfficiency: {
    rate: number;
    avgCollectionDays: number;
    totalOutstanding: number;
    overdueAmount: number;
  };
  unmatchedTransactions: {
    count: number;
    totalAmount: number;
    byType: { credit: number; debit: number };
  };
  lateCollections: Array<{
    invoiceNumber: string;
    clientName: string;
    amount: number;
    daysOverdue: number;
  }>;
  fraudIndicators: Array<{
    type: string;
    severity: 'info' | 'warning' | 'critical';
    description: string;
    transactionId?: string;
  }>;
  nextMonthPrediction: {
    predictedBalance: number;
    confidence: number;
    expectedInflow: number;
    expectedOutflow: number;
    reasoning: string;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    impact: string;
  }>;
}

// ─── Statement Import ─────────────────────────────────────────────────────────

export interface StatementImportResult {
  importId: string;
  fileName: string;
  fileType: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  errors: Array<{ row: number; message: string }>;
  status: 'completed' | 'partial' | 'failed';
}

export interface ParsedStatementRow {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  reference?: string;
  balance?: number;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface BankingReport {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  openingBalance: number;
  closingBalance: number;
  topExpenses: Array<{ category: string; amount: number; count: number }>;
  topCustomers: Array<{ counterparty: string; amount: number; count: number }>;
  outstanding: { total: number; count: number };
  collectionRate: number;
  byCategory: Record<string, { inflow: number; outflow: number; count: number }>;
}

// ─── Provider Info ────────────────────────────────────────────────────────────

export interface ProviderInfo {
  name: string;
  provider: string;
  isLive: boolean;
  configured: boolean;
}
