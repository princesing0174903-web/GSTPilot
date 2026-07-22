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
 * Returns the active BankingService.
 *
 * Resolution order:
 *   1. If `BANKING_PROVIDER=setu` is set OR `BANKING_PROVIDER=auto` (default)
 *      AND Setu creds are present in env → SetuBankingProvider (live banking
 *      data via the Setu AA gateway).
 *   2. Otherwise → MockBankingProvider (in-memory seed data).
 *
 * If SetuBankingProvider fails to initialize (missing creds / SDK error),
 * the factory automatically falls back to MockBankingProvider so the app
 * never goes dark.
 *
 * The chosen provider is cached on `globalThis.__BANKING_SERVICE__` so the
 * same instance survives HMR + request cycles.
 */
export async function getBankingService(): Promise<BankingService> {
  // Singleton — the provider holds in-memory state across requests.
  const GLOBAL = globalThis as unknown as { __BANKING_SERVICE__?: BankingService };
  if (GLOBAL.__BANKING_SERVICE__) return GLOBAL.__BANKING_SERVICE__;

  const provider = (process.env.BANKING_PROVIDER ?? 'auto').toLowerCase();
  // Lazy import to avoid pulling setu types into mock-only code paths.
  const { isSetuConfigured } = await import('@/lib/setu');
  const useSetu = provider === 'setu' || (provider === 'auto' && isSetuConfigured());

  let svc: BankingService;
  if (useSetu) {
    try {
      const { SetuBankingProvider } = await import('./providers/setu-provider');
      svc = new SetuBankingProvider();
      console.log('[banking-service] Provider: SetuBankingProvider (production, live banking data)');
    } catch (err) {
      console.error(
        '[banking-service] SetuBankingProvider failed to initialize — falling back to Mock:',
        err instanceof Error ? err.message : err,
      );
      const { MockBankingProvider } = await import('./mock-provider');
      svc = new MockBankingProvider();
      console.warn('[banking-service] Provider: MockBankingProvider (fallback)');
    }
  } else {
    const { MockBankingProvider } = await import('./mock-provider');
    svc = new MockBankingProvider();
    console.log(
      '[banking-service] Provider: MockBankingProvider (BANKING_PROVIDER=mock or Setu not configured)',
    );
  }

  GLOBAL.__BANKING_SERVICE__ = svc;
  return svc;
}
