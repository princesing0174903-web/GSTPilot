// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Service — Provider Interface
// ═══════════════════════════════════════════════════════════════════════════════
//
// The provider-agnostic contract. Today this is implemented by
// MockBankingProvider (in-memory seed data). When Setu (or any account
// aggregator / banking API) is connected, a SetuBankingProvider will implement
// this SAME interface — no caller (UI, API route, Oracle action, workflow)
// needs to change.
//
// All methods are async (even the mock ones) so the signature matches a real
// network-backed provider. All methods accept an `orgId` for tenant scoping
// (the mock provider ignores it; Setu will use it to scope consents/accounts).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BankingAccount,
  BankingTransaction,
  BankingDashboard,
  CashFlowSummary,
  CashFlowForecast,
  CategorizationRule,
  ReconcileResult,
  ReconcileSummary,
  TransactionFilter,
  PaginatedResult,
  TransactionCategory,
  ImportPreview,
  ImportResult,
  ImportedRow,
  ImportFormat,
  BankingInsightAnswer,
  TransactionType,
  AccountStatus,
} from './types';

export interface BankingService {
  // ── Accounts ──
  listAccounts(orgId: string): Promise<BankingAccount[]>;
  getAccount(orgId: string, accountId: string): Promise<BankingAccount | null>;
  createAccount(
    orgId: string,
    input: {
      bankName: string;
      accountName: string;
      accountMasked: string;
      accountType: BankingAccount['accountType'];
      ifsc?: string;
      currency?: string;
      balance?: number;
      upiHandle?: string;
    },
  ): Promise<BankingAccount>;
  syncAccount(orgId: string, accountId: string): Promise<BankingAccount>;
  updateAccountStatus(orgId: string, accountId: string, status: AccountStatus): Promise<BankingAccount>;

  // ── Transactions ──
  listTransactions(orgId: string, filter: TransactionFilter): Promise<PaginatedResult<BankingTransaction>>;
  getTransaction(orgId: string, transactionId: string): Promise<BankingTransaction | null>;
  createTransaction(
    orgId: string,
    input: Omit<BankingTransaction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
      status?: BankingTransaction['status'];
    },
  ): Promise<BankingTransaction>;
  updateTransaction(
    orgId: string,
    transactionId: string,
    patch: Partial<BankingTransaction>,
  ): Promise<BankingTransaction>;
  deleteTransaction(orgId: string, transactionId: string): Promise<{ ok: boolean }>;
  linkInvoice(
    orgId: string,
    transactionId: string,
    invoiceId: string,
    matchType?: 'manual' | 'exact' | 'fuzzy',
  ): Promise<BankingTransaction>;
  categorize(
    orgId: string,
    transactionId: string,
    category: TransactionCategory,
  ): Promise<BankingTransaction>;
  /** Split one transaction into two categories. Returns the two resulting rows. */
  splitTransaction(
    orgId: string,
    transactionId: string,
    splits: Array<{ amount: number; category: TransactionCategory }>,
  ): Promise<BankingTransaction[]>;

  // ── Dashboard & Cash Flow ──
  getDashboard(orgId: string): Promise<BankingDashboard>;
  getCashFlow(
    orgId: string,
    opts: { from?: string; to?: string; accountId?: string },
  ): Promise<CashFlowSummary>;

  // ── Forecast ──
  forecastCashFlow(orgId: string, horizon: '7d' | '30d'): Promise<CashFlowForecast>;

  // ── Reconciliation ──
  reconcileAll(orgId: string): Promise<ReconcileResult[]>;
  reconcileOne(orgId: string, transactionId: string): Promise<ReconcileResult>;
  getReconcileSummary(orgId: string): Promise<ReconcileSummary>;
  markReconciled(
    orgId: string,
    transactionId: string,
    candidateId?: string,
    candidateKind?: 'invoice' | 'payment' | 'expense' | 'refund' | 'receipt',
  ): Promise<BankingTransaction>;

  // ── Statement Import ──
  /** Parse raw uploaded content into a preview (no DB write). */
  previewImport(
    orgId: string,
    format: ImportFormat,
    rawContent: string,
    accountId?: string,
  ): Promise<ImportPreview>;
  /** Run AI categorization over a preview's rows (mutates suggestedCategory). */
  categorizeImport(orgId: string, preview: ImportPreview): Promise<ImportPreview>;
  /** Persist the preview rows as transactions. */
  commitImport(
    orgId: string,
    preview: ImportPreview,
    accountId: string,
  ): Promise<ImportResult>;

  // ── Categorization Rules ──
  listRules(orgId: string): Promise<CategorizationRule[]>;
  createRule(
    orgId: string,
    input: Omit<CategorizationRule, 'id' | 'createdAt' | 'updatedAt' | 'matchCount'>,
  ): Promise<CategorizationRule>;
  updateRule(
    orgId: string,
    ruleId: string,
    patch: Partial<CategorizationRule>,
  ): Promise<CategorizationRule>;
  deleteRule(orgId: string, ruleId: string): Promise<{ ok: boolean }>;
  /** Re-evaluate all rules against all transactions (batch). Returns count touched. */
  applyRules(orgId: string): Promise<{ applied: number; touched: number }>;

  // ── AI Insights (Oracle Banking Intelligence) ──
  /** Answer one of the canonical banking questions. */
  answerQuestion(orgId: string, question: string): Promise<BankingInsightAnswer>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns the active BankingService. Today: MockBankingProvider.
 * Future: when `BANKING_PROVIDER=setu` is set and SetuBankingProvider is
 * implemented, returns that — no caller changes.
 *
 * This indirection is the ONLY place that knows which provider is live.
 */
export async function getBankingService(): Promise<BankingService> {
  const { MockBankingProvider } = await import('./mock-provider');
  // Singleton — the mock provider holds in-memory state across requests.
  if (!globalThis.__BANKING_SERVICE__) {
    (globalThis as any).__BANKING_SERVICE__ = new MockBankingProvider();
  }
  return (globalThis as any).__BANKING_SERVICE__ as BankingService;
}
