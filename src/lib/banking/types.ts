// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Cloud™ — Type Definitions
// Phase 8 Step 2: Connect. Reconcile. Predict. Execute.
//
// Shared types for all 8 Banking Cloud modules. All engines are deterministic —
// no LLM in the engine layer. The Oracle consumes the formatted context block.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Supported Banks (Module 1) ────────────────────────────────────────────────

export const SUPPORTED_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'SBI',
  'Kotak Mahindra',
  'Yes Bank',
  'PNB',
  'Bank of Baroda',
] as const;

export type SupportedBank = (typeof SUPPORTED_BANKS)[number];

export const BANK_COLORS: Record<string, string> = {
  'HDFC Bank': '#004C8F',
  'ICICI Bank': '#F37D20',
  'Axis Bank': '#97144D',
  'SBI': '#1E4DA8',
  'Kotak Mahindra': '#ED1C24',
  'Yes Bank': '#00529B',
  'PNB': '#B8B8B8',
  'Bank of Baroda': '#F47B20',
};

// ─── Module 1: Bank Account Integration ────────────────────────────────────────

export type AccountStatus = 'active' | 'paused' | 'syncing' | 'error';
export type AccountType = 'current' | 'savings';

export interface BankAccountDTO {
  id: string;
  businessId: string;
  bankName: string;
  accountNumber: string;
  accountNumberMasked: string; // ****1234
  ifsc: string;
  accountType: AccountType;
  currentBalance: number;
  lastSyncAt: string | null;
  lastSyncAgo: string; // "5m ago"
  status: AccountStatus;
  aaConnected: boolean;
  aaConsentExpiry: string | null;
  transactionCount: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  createdAt: string;
}

export interface BankAccountListResult {
  accounts: BankAccountDTO[];
  totalBalance: number;
  totalAccounts: number;
  activeAccounts: number;
  syncedToday: number;
  hasLiveData: boolean;
}

// ─── Module 2: Bank Statement Engine ───────────────────────────────────────────

export type TransactionType = 'credit' | 'debit';
export type TransactionCategory =
  | 'sales'
  | 'expense'
  | 'gst'
  | 'salary'
  | 'vendor'
  | 'upi'
  | 'loan'
  | 'tax'
  | 'fee'
  | 'refund'
  | 'other'
  | 'uncategorized';

export type MatchType =
  | 'exact'
  | 'partial'
  | 'duplicate'
  | 'unknown_credit'
  | 'unknown_debit'
  | 'missing_payment';

export interface BankTransactionDTO {
  id: string;
  accountId: string;
  bankName: string;
  date: string;
  description: string;
  referenceNo: string | null;
  amount: number; // signed: + credit, - debit
  type: TransactionType;
  category: TransactionCategory;
  categoryLabel: string;
  balance: number;
  matched: boolean;
  matchedInvoiceId: string | null;
  matchType: MatchType | null;
  matchConfidence: number; // 0..1
  upiRef: string | null;
  source: 'statement' | 'upi' | 'aa' | 'manual';
  daysAgo: number;
}

export interface BankTransactionListResult {
  transactions: BankTransactionDTO[];
  total: number;
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  hasLiveData: boolean;
}

// ─── Module 3: UPI Cloud ───────────────────────────────────────────────────────

export type UPIDirection = 'incoming' | 'outgoing';
export type UPIStatus = 'success' | 'pending' | 'failed';

export interface UPITransactionDTO {
  id: string;
  upiId: string;
  reference: string | null;
  amount: number; // signed
  payerName: string | null;
  payerVpa: string | null;
  date: string;
  status: UPIStatus;
  direction: UPIDirection;
  matched: boolean;
  matchedBankTxnId: string | null;
  note: string | null;
  daysAgo: number;
}

export interface UPIListResult {
  transactions: UPITransactionDTO[];
  total: number;
  incomingCount: number;
  outgoingCount: number;
  incomingAmount: number;
  outgoingAmount: number;
  pendingCount: number;
  matchedCount: number;
  hasLiveData: boolean;
}

export interface UPIPaymentRequest {
  id: string;
  upiId: string;
  payerName: string;
  amount: number;
  note: string;
  reference: string;
  status: 'requested' | 'sent' | 'paid' | 'expired';
  createdAt: string;
  expiresAt: string;
}

// ─── Module 4: Account Aggregator Cloud ────────────────────────────────────────

export type AAConsentStatus = 'pending' | 'granted' | 'denied' | 'expired' | 'revoked';

export interface AAConsent {
  id: string;
  fiu: string; // Financial Information User
  fip: string; // Financial Information Provider (bank)
  status: AAConsentStatus;
  grantedAt: string | null;
  expiresAt: string;
  dataRange: { from: string; to: string };
  purpose: string;
}

export interface AAAccountLink {
  id: string;
  bankName: string;
  accountNumberMasked: string;
  linked: boolean;
  consentId: string | null;
  lastFetched: string | null;
  balance: number;
}

export interface AAState {
  consents: AAConsent[];
  linkedAccounts: AAAccountLink[];
  totalLinked: number;
  totalBalance: number;
  hasLiveData: boolean;
}

// ─── Module 5: Cash Flow Engine ────────────────────────────────────────────────

export type CashRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CashFlowDay {
  date: string;
  label: string; // "Mon 12"
  cashIn: number;
  cashOut: number;
  net: number;
  projectedBalance: number;
  runway: number;
  riskLevel: CashRiskLevel;
  sources: { label: string; amount: number; type: 'in' | 'out' }[];
}

export interface CashFlowForecast {
  sevenDay: number;
  thirtyDay: number;
  ninetyDay: number;
  cashGap: number; // projected shortfall (negative)
  cashGapDate: string | null;
  runwayDays: number;
  dailyBurn: number;
  monthlyBurn: number;
  confidencePct: number;
}

export interface CashFlowMetrics {
  currentCash: number;
  cashIn7Days: number;
  cashOut7Days: number;
  net7Days: number;
  cashIn30Days: number;
  cashOut30Days: number;
  net30Days: number;
  dailyBurn: number;
  monthlyBurn: number;
  runwayDays: number;
  riskLevel: CashRiskLevel;
  collectionForecast: number; // expected collections next 30d
  paymentForecast: number; // expected payments next 30d
  upcomingGST: number;
}

export interface CashFlowState {
  metrics: CashFlowMetrics;
  forecast: CashFlowForecast;
  daily: CashFlowDay[]; // 30-day daily projection
  riskTriggers: string[]; // narrative triggers
  hasLiveData: boolean;
}

// ─── Module 6: Auto Reconciliation Engine ──────────────────────────────────────

export interface ReconcileMatch {
  id: string;
  bankTxnId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  customerName: string | null;
  bankAmount: number;
  invoiceAmount: number;
  matchType: MatchType;
  confidence: number;
  date: string;
  description: string;
  reason: string;
}

export interface ReconcileException {
  id: string;
  type: MatchType;
  bankTxnId: string;
  description: string;
  amount: number;
  date: string;
  suggestedAction: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ReconcileSummary {
  totalTransactions: number;
  matched: number;
  unmatched: number;
  matchedAmount: number;
  unmatchedAmount: number;
  matchedPct: number;
  pendingCollections: number;
  riskLevel: 'low' | 'medium' | 'high';
  byMatchType: Record<MatchType, number>;
}

export interface ReconcileState {
  summary: ReconcileSummary;
  matches: ReconcileMatch[];
  exceptions: ReconcileException[];
  hasLiveData: boolean;
}

// ─── Module 7: Collection Recovery Cloud ───────────────────────────────────────

export type CollectionStage = 'detect' | 'remind' | 'escalate' | 'recover' | 'report';
export type CollectionStatus =
  | 'overdue'
  | 'reminded'
  | 'escalated'
  | 'recovered'
  | 'written_off';

export interface CollectionRecord {
  id: string;
  invoiceId: string | null;
  customerName: string;
  customerGstin: string | null;
  amount: number;
  dueDate: string | null;
  daysOverdue: number;
  status: CollectionStatus;
  stage: CollectionStage;
  lastReminder: string | null;
  lastReminderAgo: string;
  reminderCount: number;
  channel: string | null;
  recoveredAmount: number;
  riskScore: number; // 0..100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  nextAction: string;
}

export interface CollectionSummary {
  totalOverdue: number;
  overdueCount: number;
  remindedCount: number;
  escalatedCount: number;
  recoveredThisWeek: number;
  recoveredCount: number;
  recoveryRate: number;
  avgDaysOverdue: number;
  totalAtRisk: number;
}

export interface CollectionState {
  summary: CollectionSummary;
  records: CollectionRecord[];
  workflow: { stage: CollectionStage; label: string; count: number; amount: number }[];
  hasLiveData: boolean;
}

// ─── Module 8: Payment Intelligence ────────────────────────────────────────────

export type PaymentTrend = 'improving' | 'stable' | 'declining';

export interface ClientPaymentProfile {
  customerName: string;
  customerGstin: string | null;
  totalInvoiced: number;
  totalCollected: number;
  outstanding: number;
  avgDelayDays: number;
  onTimeRate: number; // 0..100
  riskScore: number; // 0..100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  trend: PaymentTrend;
  delayProbability: number; // 0..1
  collectionProbability: number; // 0..1
  expectedCollection: number; // outstanding * collectionProbability
  lastPaymentDate: string | null;
  invoiceCount: number;
}

export interface PaymentIntelligenceState {
  riskyClients: ClientPaymentProfile[];
  expectedCollections30d: number;
  avgDelayProbability: number;
  totalAtRisk: number;
  trend: PaymentTrend;
  topLatePayers: ClientPaymentProfile[];
  hasLiveData: boolean;
}

// ─── Aggregated Banking State (Oracle context) ─────────────────────────────────

export interface BankingState {
  accounts: BankAccountListResult;
  transactions: BankTransactionListResult;
  upi: UPIListResult;
  aa: AAState;
  cashFlow: CashFlowState;
  reconcile: ReconcileState;
  collections: CollectionState;
  intelligence: PaymentIntelligenceState;
  hasLiveData: boolean;
}
