// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Type Definitions
//
// The single source of truth for the banking data model. Every field maps 1:1 to
// a Firestore collection. All types are PURE (no Firebase imports) so they are
// safe to import from both client and server code.
//
// Provider pattern:
//   • IBankProvider (see provider.ts) — the contract every banking backend implements
//   • MockBankProvider — deterministic simulated responses (default)
//   • FutureAAProvider        — Account Aggregator (placeholder, throws NotImplementedError)
//   • FutureRazorpayXProvider — RazorpayX banking (placeholder)
//   • FutureSetuProvider      — Setu AA (placeholder)
//   • FuturePerfiosProvider   — Perfios statement fetcher (placeholder)
//   • FutureFinvuProvider     — Finvu Account Aggregator (placeholder)
//   • Switch to production later by changing ONE provider in registry.ts
//
// Multi-tenant: every document carries `organizationId`. Every query filters on
// it. Users can never access another organization's banking data.
//
// Security: connection tokens / account metadata are encrypted with AES-256-GCM
// (server-only key) before being stored in Firestore. The client reads the
// encrypted blob and passes it back to the server during sync operations — the
// client can NEVER decrypt it.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Provider Identifiers ─────────────────────────────────────────────────────

/**
 * The set of supported banking provider backends. Today only 'mock' is live;
 * the rest are placeholders that throw NotImplementedError until implemented.
 */
export type BankProviderName =
  | 'mock'
  | 'aa'           // Account Aggregator (Sahamati / RBI-regulated)
  | 'razorpayx'    // RazorpayX banking API
  | 'setu'         // Setu AA / banking APIs
  | 'perfios'      // Perfios statement fetcher
  | 'finvu';       // Finvu Account Aggregator

// ─── Connection Status ────────────────────────────────────────────────────────

/**
 * Lifecycle status of a bank connection.
 * Drives what UI affordances are available (connect / consent / sync / refresh).
 */
export type BankConnectionStatus =
  | 'disconnected'     // no connection exists
  | 'consent_pending'  // AA consent requested, awaiting user approval
  | 'connected'        // connection active — sync enabled
  | 'expired'          // consent / token expired — refresh or re-connect
  | 'error';           // last operation failed — see lastError

// ─── Bank Connection (bank_connections collection) ────────────────────────────

/**
 * The bank connection document — one per organization per provider+account.
 * Stored in Firestore `bank_connections/{connectionId}`.
 */
export interface BankConnection {
  id: string;
  /** Tenant scope — NEVER null. Every query filters on this. */
  organizationId: string;
  /** Which provider backend services this connection. */
  provider: BankProviderName;
  /** Name of the account holder (as registered with the bank). */
  accountHolder: string;
  /** Display name of the bank (e.g. 'HDFC Bank', 'ICICI Bank'). */
  bankName: string;
  /** Masked account number — last 4 digits visible, rest X'd out. */
  accountNumberMasked: string;
  /** IFSC code (Indian Financial System Code). */
  ifsc: string;
  /** Account type (savings / current / credit / loan). */
  accountType: 'savings' | 'current' | 'credit' | 'loan' | 'unknown';
  /** Current connection status — drives the connect/sync UI. */
  status: BankConnectionStatus;
  /** ISO timestamp of the last successful sync. */
  lastSync: string | null;
  /** ISO timestamp when the current consent / token expires. */
  consentExpiry: string | null;
  /**
   * AES-256-GCM encrypted connection blob (tokens + account metadata).
   * Stored in Firestore — org members can READ this field (rules allow it) but
   * they CANNOT decrypt it without the server-only master key.
   * The client passes this back to the server during sync operations.
   */
  encryptedConnection: string | null;
  /** Last known account snapshot (balances, as-of date). */
  lastSnapshot: BankAccountSnapshot | null;
  /** Human-readable last error message (NOT the raw provider error). */
  lastError: string | null;
  /** User who created the connection. */
  createdBy: { uid: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

// ─── Bank Account (snapshot, denormalized on connection) ──────────────────────

/**
 * A snapshot of the account's current balances. Fetched during sync and
 * stored on the connection document (NOT a separate collection — accounts are
 * lightweight and read-through).
 */
export interface BankAccountSnapshot {
  /** Available balance (withdrawable). */
  availableBalance: number;
  /** Current / ledger balance (includes uncleared). */
  currentBalance: number;
  /** Currency code (ISO 4217). */
  currency: string;
  /** ISO timestamp the balance was observed. */
  asOf: string;
  /** Overdraft limit (if applicable, 0 otherwise). */
  overdraftLimit: number;
}

// ─── Bank Transactions (bank_transactions collection) ────────────────────────

/**
 * Transaction type — direction of money flow from the account holder's perspective.
 */
export type BankTransactionType = 'credit' | 'debit';

/**
 * Auto-categorization buckets. The categorization engine assigns one of these
 * to every transaction based on description / amount / counterparty patterns.
 */
export type TransactionCategory =
  | 'sales'            // customer payment received
  | 'purchase'         // payment to a vendor / supplier
  | 'gst'              // GST payment / refund
  | 'salary'           // salary paid to employees
  | 'rent'             // office / equipment rent
  | 'utilities'        // electricity, internet, phone, water
  | 'loan'             // loan EMI / principal repayment
  | 'interest'         // interest received or paid
  | 'transfer'         // internal / inter-account transfer
  | 'investment'       // mutual funds, FD, equity
  | 'cash_withdrawal'  // ATM / cash withdrawal
  | 'other';           // uncategorized

/**
 * Reconciliation status — how well the bank transaction matches an invoice / payment.
 */
export type ReconciliationStatus =
  | 'matched'            // exact match found (amount + counterparty)
  | 'partially_matched'  // amount differs slightly OR counterparty fuzzy match
  | 'unmatched';         // no corresponding invoice / payment found

/**
 * A single bank transaction row.
 * Stored in Firestore `bank_transactions/{transactionId}`.
 */
export interface BankTransaction {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** The connection this transaction belongs to. */
  connectionId: string;
  /** The masked account number this transaction hit. */
  accountId: string;
  /** ISO date the transaction posted (YYYY-MM-DD). */
  date: string;
  /** Bank-provided description / narration. */
  description: string;
  /** Transaction amount (always positive — see `type` for direction). */
  amount: number;
  /** Direction: credit (money in) or debit (money out). */
  type: BankTransactionType;
  /** Running balance after this transaction (if known). */
  balance: number | null;
  /** Auto-assigned category. */
  category: TransactionCategory;
  /** Counterparty name (extracted from description, if available). */
  counterparty: string | null;
  /** UTR / reference number (if available). */
  referenceNumber: string | null;
  /** The invoice this transaction was matched to (null if unmatched). */
  invoiceId: string | null;
  /** Reconciliation status. */
  reconciled: ReconciliationStatus;
  /** Confidence score 0..1 for the reconciliation match (1 = exact). */
  matchConfidence: number;
  /** ISO timestamp the transaction was synced. */
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Bank Sync Jobs (bank_sync_jobs collection) ───────────────────────────────

export type BankSyncType = 'accounts' | 'transactions' | 'balances' | 'full';
export type BankSyncTrigger = 'manual' | 'automatic' | 'background' | 'retry' | 'incremental';
export type BankSyncStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * A sync job record — tracks every banking sync operation for observability + retries.
 * Stored in Firestore `bank_sync_jobs/{jobId}`.
 */
export interface BankSyncJob {
  id: string;
  organizationId: string;
  connectionId: string;
  type: BankSyncType;
  trigger: BankSyncTrigger;
  status: BankSyncStatus;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  maxRetries: number;
  error: string | null;
  /** Summary of what was synced (null until job completes). */
  result: {
    accountsSynced?: number;
    transactionsSynced?: number;
    balancesSynced?: boolean;
    from?: string; // incremental sync start date
    to?: string;   // incremental sync end date
  } | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Service Input / Result Types ─────────────────────────────────────────────

export interface ConnectBankInput {
  organizationId: string;
  provider: BankProviderName;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  accountType: BankConnection['accountType'];
  /** AA / provider-specific consent handle (for AA flow). */
  consentHandle?: string;
  createdBy: { uid: string; name: string; email: string };
}

/** Result of initiating a bank connection. */
export interface ConnectBankResult {
  /** Provider connection id — used to correlate the consent flow. */
  connectionRef: string;
  /** Masked contact (email/phone) the consent OTP was sent to (if AA flow). */
  consentSentTo: string | null;
  /** Masked account number (last 4 digits). */
  accountNumberMasked: string;
  /** Initial account snapshot (balances known at connect time). */
  accountSnapshot: BankAccountSnapshot | null;
  message: string;
}

/** Result of completing a bank connection (post-consent). */
export interface CompleteConnectionResult {
  /** AES-256-GCM encrypted connection blob — safe to store in Firestore. */
  encryptedConnection: string;
  /** ISO timestamp when the consent / token expires. */
  consentExpiry: string;
  /** Initial account snapshot. */
  accountSnapshot: BankAccountSnapshot;
}

/** Result of a sync operation. */
export interface BankSyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
}

/** Result of a session / consent refresh. */
export interface RefreshConnectionResult {
  encryptedConnection: string;
  consentExpiry: string;
}

/** Result of fetching accounts (balances). */
export interface FetchAccountsResult {
  snapshot: BankAccountSnapshot;
}

/** Result of fetching transactions. */
export interface FetchTransactionsResult {
  transactions: BankTransaction[];
}

// ─── Aggregated Banking Stats (for dashboard) ─────────────────────────────────

/**
 * Aggregated banking state for the dashboard — computed from real-time
 * Firestore data. This is what `useBanking()` returns as `summary`.
 */
export interface BankingSummary {
  /** Σ currentBalance across all connected accounts (live cash position). */
  totalBalance: number;
  /** Σ availableBalance across all connected accounts. */
  availableBalance: number;
  /** Number of connected bank accounts. */
  connectedAccounts: number;
  /** Σ of credit transactions in the period. */
  incomingPayments: number;
  /** Σ of debit transactions in the period. */
  outgoingPayments: number;
  /** Count of credit transactions in the period. */
  incomingCount: number;
  /** Count of debit transactions in the period. */
  outgoingCount: number;
  /** Count of transactions awaiting reconciliation. */
  pendingReconciliation: number;
  /** Count of matched transactions. */
  matchedCount: number;
  /** Count of partially-matched transactions. */
  partiallyMatchedCount: number;
  /** Total credit volume grouped by category. */
  inflowByCategory: Record<TransactionCategory, number>;
  /** Total debit volume grouped by category. */
  outflowByCategory: Record<TransactionCategory, number>;
  /** Most recent 10 transactions (for the dashboard feed). */
  recentTransactions: BankTransaction[];
}
