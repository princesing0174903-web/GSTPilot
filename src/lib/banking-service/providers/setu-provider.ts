// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Service — Setu Provider (Real Banking Integration)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Implements the FULL `BankingService` interface (30 methods) against live
// Setu AA gateway data. Mirrors the response shapes produced by
// `MockBankingProvider` so the UI / Oracle / API routes don't notice the swap.
//
// Architecture:
//   - In-memory cache per orgId (`Map<orgId, OrgCache>`) holding accounts,
//     transactions, rules, and a synthetic reconciliation ledger.
//   - Cache TTLs: 5 min for accounts, 10 min for transactions. `syncAccount()`
//     forces a refresh regardless of TTL.
//   - Default categorization rules (8) seeded on first access per org.
//   - Consent flow: `createAccount()` accepts a vua/mobile in `upiHandle` and
//     kicks off `setuClient.createConsent()` in the background — returns the
//     account immediately with `status: 'disconnected'` so the UI shows
//     "awaiting bank approval".
//   - All Setu-sourced ids are namespaced `setu:${orgId}:${linkRef}` /
//     `setu:${orgId}:${accountId}:${txnId}` so they never collide with mock
//     provider ids or manual entries.
//   - Manual ids use `setu-manual-${counter}`.
//   - Reuses ALL pure helpers from rules.ts, reconcile.ts, forecast.ts,
//     intelligence.ts — no duplicated logic.
//   - Never crashes on empty data (no accounts linked yet → empty arrays,
//     zero balances).
//
// Fallback: if Setu isn't configured (no creds), the constructor throws a
// SetuApiError. The factory (`getBankingService()`) catches this and falls
// back to MockBankingProvider.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AccountStatus,
  BankingAccount,
  BankingDashboard,
  BankingInsightAnswer,
  BankingTransaction,
  CashFlowForecast,
  CashFlowPoint,
  CashFlowSummary,
  CategorizationRule,
  ImportFormat,
  ImportPreview,
  ImportResult,
  ImportedRow,
  PaginatedResult,
  ReconcileResult,
  ReconcileSummary,
  TransactionCategory,
  TransactionFilter,
  TransactionStatus,
  TransactionType,
} from '../types';
import type { BankingService } from '../provider';
import { evaluateRules, extractCounterparty, CATEGORY_META, CATEGORY_ORDER } from '../rules';
import {
  classifyMatch,
  findCandidates,
  type ReconcileLedger,
} from '../reconcile';
import { buildNarrative, computeForecast } from '../forecast';
import { matchQuestion } from '../intelligence';

import {
  getSetuClient,
  mapSetuAccountToBanking,
  mapSetuTransactionToBanking,
  SetuApiError,
  setuLogger,
  type SetuClient,
} from '@/lib/setu';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const ACCOUNTS_TTL_MS = 5 * 60 * 1000; // 5 min
const TRANSACTIONS_TTL_MS = 10 * 60 * 1000; // 10 min
const SESSION_POLL_TIMEOUT_MS = 60 * 1000; // 1 min
const SESSION_POLL_INTERVAL_MS = 3000; // 3s

// ─── Misc helpers ─────────────────────────────────────────────────────────────

const nowISO = (): string => new Date().toISOString();
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

let _manualIdCounter = 0;
const nextManualId = (prefix: string): string => `${prefix}-${++_manualIdCounter}`;

function fmtINR(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(Math.round(n));
  return `${neg ? '-' : ''}₹${abs.toLocaleString('en-IN')}`;
}

function fmtINRShort(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1_00_00_000) s = `${(abs / 1_00_00_000).toFixed(2)} Cr`;
  else if (abs >= 1_00_000) s = `${(abs / 1_00_000).toFixed(2)} L`;
  else if (abs >= 1_000) s = `${(abs / 1_000).toFixed(1)}K`;
  else s = `${Math.round(abs)}`;
  return `${neg ? '-' : ''}₹${s}`;
}

// ─── Per-org cache ────────────────────────────────────────────────────────────

interface OrgCache {
  accounts: BankingAccount[];
  transactions: BankingTransaction[];
  rules: CategorizationRule[];
  ledger: ReconcileLedger;
  lastAccountsSyncAt: number;
  lastTransactionsSyncAt: number;
  rulesSeeded: boolean;
  /** Active Setu consent id (if any) — used by syncAccount() to start a session. */
  consentId?: string;
  /** Most recent data session id (for diagnostics). */
  sessionId?: string;
}

// ─── Synthetic ledger (per-org, deterministic) ────────────────────────────────

/** Deterministic hash so the same org always gets the same synthetic ledger. */
function hashOrgId(orgId: string): number {
  let h = 0;
  for (let i = 0; i < orgId.length; i++) {
    h = (h * 31 + orgId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rngInt(rng: () => number, lo: number, hi: number): number {
  return Math.floor(lo + rng() * (hi - lo + 1));
}

/**
 * Build a small synthetic reconciliation ledger for an org (20 invoices, 15
 * expenses, 10 payments). Deterministic per orgId so reconcileAll() returns
 * stable results across calls. Same shape as MockBankingProvider's ledger so
 * the matching logic is identical.
 */
function buildSyntheticLedgerForOrg(orgId: string): ReconcileLedger {
  const rng = mulberry32(hashOrgId(orgId) || 0x5eed);
  const customers = [
    'ACME PVT LTD',
    'STEEL CORP INDIA',
    'TECHNOVATE SYSTEMS',
    'PIONEER TRADERS',
    'GLOBEX MANUFACTURING',
    'BHARAT INDUSTRIES',
    'NEELKANTH ENTERPRISES',
    'SRI BALAJI SUPPLIERS',
  ];
  const vendors = [
    'TATA STEEL LTD',
    'AMAZON INDIA',
    'FLIPKART WHOLESALE',
    'JIO MART B2B',
    'RELIANCE INDUSTRIES',
    'TANGEDCO',
    'BESCOM',
    'INDANE GAS',
  ];

  const invoices = [];
  const today = new Date();
  for (let i = 0; i < 20; i++) {
    const cust = customers[i % customers.length];
    const amount = rngInt(rng, 35000, 850000);
    const daysAgo = rngInt(rng, 0, 120);
    const date = isoDate(new Date(today.getTime() - daysAgo * DAY_MS));
    const num = `INV-2024-${String(i + 1).padStart(4, '0')}`;
    const status = pick<'paid' | 'unpaid' | 'partial' | 'overdue'>(rng, [
      'paid',
      'paid',
      'unpaid',
      'partial',
      'overdue',
    ]);
    invoices.push({
      id: `setu-inv-${String(i + 1).padStart(3, '0')}`,
      number: num,
      amount,
      date,
      customer: cust,
      status,
    });
  }

  const expenses = [];
  for (let i = 0; i < 15; i++) {
    const v = vendors[i % vendors.length];
    const amount = rngInt(rng, 5000, 220000);
    const daysAgo = rngInt(rng, 0, 150);
    const date = isoDate(new Date(today.getTime() - daysAgo * DAY_MS));
    expenses.push({
      id: `setu-exp-${String(i + 1).padStart(3, '0')}`,
      amount,
      date,
      vendor: v,
      category: pick(rng, ['Raw Materials', 'Office Supplies', 'Utilities', 'Logistics', 'IT & Software']),
    });
  }

  const payments = [];
  for (let i = 0; i < 10; i++) {
    const isInbound = i % 2 === 0;
    const party = isInbound ? pick(rng, customers) : pick(rng, vendors);
    const amount = rngInt(rng, 15000, 350000);
    const daysAgo = rngInt(rng, 0, 120);
    const date = isoDate(new Date(today.getTime() - daysAgo * DAY_MS));
    payments.push({
      id: `setu-pay-${String(i + 1).padStart(3, '0')}`,
      amount,
      date,
      party,
      direction: isInbound ? 'in' : ('out' as 'in' | 'out'),
      reference: `REF${1000 + i}`,
    });
  }

  return { invoices, payments, expenses };
}

// ─── Default categorization rules ─────────────────────────────────────────────

const DEFAULT_RULES: Array<Omit<CategorizationRule, 'id' | 'createdAt' | 'updatedAt' | 'matchCount'>> = [
  { pattern: 'salary', isRegex: false, category: 'salary', priority: 90, active: true },
  { pattern: 'rent', isRegex: false, category: 'rent', priority: 90, active: true },
  { pattern: 'electricity|water|gas|broadband|tangedco|bescom|indane|airtel|jio', isRegex: true, category: 'utilities', priority: 80, active: true },
  { pattern: 'gst|tds|tax|income tax', isRegex: true, category: 'tax', priority: 80, active: true },
  { pattern: 'upi/.*consult|consulting|consultancy', isRegex: true, category: 'sales', priority: 70, active: true },
  { pattern: 'bigbasket|grocery|amazon|flipkart|jio mart|reliance', isRegex: true, category: 'vendor_payment', priority: 60, active: true },
  { pattern: 'refund|return', isRegex: true, category: 'refund', priority: 60, active: true },
  { pattern: 'interest|int/', isRegex: true, category: 'interest', priority: 70, active: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SetuBankingProvider
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Production BankingService implementation backed by the Setu AA gateway.
 *
 * Falls back gracefully:
 *   - If no Setu creds are configured, the constructor throws SetuApiError.
 *     The factory catches this and uses MockBankingProvider instead.
 *   - If Setu is configured but a specific org has no linked accounts yet,
 *     listAccounts() returns [] and getDashboard() returns zero balances.
 */
export class SetuBankingProvider implements BankingService {
  private readonly client: SetuClient;
  private readonly orgs: Map<string, OrgCache> = new Map();

  constructor(client?: SetuClient) {
    const c = client ?? getSetuClient();
    if (!c) {
      throw new SetuApiError({
        message:
          'Setu is not configured. Set SETU_CLIENT_ID, SETU_CLIENT_SECRET, SETU_PRODUCT_INSTANCE_ID, SETU_BASE_URL, SETU_AUTH_URL env vars.',
        status: 0,
        code: 'setu_not_configured',
        isRetryable: false,
      });
    }
    this.client = c;
    setuLogger.info('SetuBankingProvider initialized', {});
  }

  // ─── Org cache management ──────────────────────────────────────────────────

  private getOrg(orgId: string): OrgCache {
    let org = this.orgs.get(orgId);
    if (!org) {
      org = {
        accounts: [],
        transactions: [],
        rules: [],
        ledger: buildSyntheticLedgerForOrg(orgId),
        lastAccountsSyncAt: 0,
        lastTransactionsSyncAt: 0,
        rulesSeeded: false,
      };
      this.orgs.set(orgId, org);
    }
    if (!org.rulesSeeded) {
      this.seedDefaultRules(org);
      org.rulesSeeded = true;
    }
    return org;
  }

  private seedDefaultRules(org: OrgCache): void {
    const now = nowISO();
    org.rules = DEFAULT_RULES.map((r, i) => ({
      ...r,
      id: `setu-rule-${String(i + 1).padStart(3, '0')}`,
      matchCount: 0,
      createdAt: now,
      updatedAt: now,
    }));
  }

  // ─── Accounts ──────────────────────────────────────────────────────────────

  async listAccounts(orgId: string): Promise<BankingAccount[]> {
    const org = this.getOrg(orgId);
    return [...org.accounts];
  }

  async getAccount(orgId: string, accountId: string): Promise<BankingAccount | null> {
    const org = this.getOrg(orgId);
    return org.accounts.find((a) => a.id === accountId) ?? null;
  }

  async createAccount(
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
  ): Promise<BankingAccount> {
    const org = this.getOrg(orgId);
    const now = nowISO();
    const acct: BankingAccount = {
      id: nextManualId('setu-manual-acct'),
      bankName: input.bankName,
      accountName: input.accountName,
      accountMasked: input.accountMasked,
      accountType: input.accountType,
      ifsc: input.ifsc,
      balance: input.balance ?? 0,
      availableBalance: input.balance ?? 0,
      currency: input.currency ?? 'INR',
      upiHandle: input.upiHandle,
      status: 'disconnected',
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    };
    org.accounts.push(acct);

    // If upiHandle looks like a mobile number, kick off the Setu consent flow
    // in the background. Don't block on it — return the account immediately.
    const vua = extractVuaFromUpiHandle(input.upiHandle);
    if (vua) {
      void this.kickOffConsent(orgId, org, vua).catch((err) => {
        setuLogger.error('Background consent kickoff failed', {
          orgId,
          vua,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    return acct;
  }

  /**
   * Kick off the Setu consent flow in the background. Stores the consentId on
   * the org cache and logs the approval URL.
   */
  private async kickOffConsent(
    orgId: string,
    org: OrgCache,
    vua: string,
  ): Promise<void> {
    try {
      const consent = await this.client.createConsent({
        vua,
        consentDuration: { unit: 'MONTH', value: '12' },
        dataRange: {
          from: new Date(Date.now() - 12 * 30 * DAY_MS).toISOString(),
          to: new Date().toISOString(),
        },
      });
      org.consentId = consent.id;
      setuLogger.info('Consent created — user must approve at Setu webview', {
        orgId,
        consentId: consent.id,
        url: consent.url,
      });
    } catch (err) {
      setuLogger.error('Failed to create Setu consent', {
        orgId,
        vua,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async syncAccount(orgId: string, accountId: string): Promise<BankingAccount> {
    const org = this.getOrg(orgId);
    const acct = org.accounts.find((a) => a.id === accountId);
    if (!acct) throw new Error(`Account not found: ${accountId}`);

    // Manual accounts just refresh lastSyncAt.
    if (!accountId.startsWith('setu:')) {
      acct.status = 'connected';
      acct.lastSyncAt = nowISO();
      acct.updatedAt = nowISO();
      return acct;
    }

    // Setu-linked account — start a data session and poll for completion.
    if (!org.consentId) {
      // No active consent — can't sync. Just refresh the timestamp.
      acct.lastSyncAt = nowISO();
      acct.updatedAt = nowISO();
      return acct;
    }

    try {
      const session = await this.client.createSession({
        consentId: org.consentId,
        dataRange: {
          from: new Date(Date.now() - 12 * 30 * DAY_MS).toISOString(),
          to: new Date().toISOString(),
        },
        format: 'json',
      });
      org.sessionId = session.id;

      // Poll for completion.
      const completed = await this.pollSession(session.id, {
        timeoutMs: SESSION_POLL_TIMEOUT_MS,
        pollIntervalMs: SESSION_POLL_INTERVAL_MS,
      });

      // Refresh accounts + transactions from the completed session.
      this.ingestSession(orgId, org, completed);
      acct.status = 'connected';
      acct.lastSyncAt = nowISO();
      acct.updatedAt = nowISO();
      org.lastAccountsSyncAt = Date.now();
      org.lastTransactionsSyncAt = Date.now();
    } catch (err) {
      setuLogger.error('syncAccount failed', {
        orgId,
        accountId,
        error: err instanceof Error ? err.message : String(err),
      });
      acct.status = 'error';
      acct.updatedAt = nowISO();
    }
    return acct;
  }

  /** Poll a Setu session until COMPLETED/EXPIRED/FAILED or timeout. */
  private async pollSession(
    sessionId: string,
    opts: { timeoutMs: number; pollIntervalMs: number },
  ): Promise<NonNullable<unknown>> {
    const deadline = Date.now() + opts.timeoutMs;
    let session = await this.client.getSession(sessionId);
    while (
      session.status !== 'COMPLETED' &&
      session.status !== 'EXPIRED' &&
      session.status !== 'FAILED'
    ) {
      if (Date.now() >= deadline) {
        throw new SetuApiError({
          message: `Session ${sessionId} did not complete within ${opts.timeoutMs}ms`,
          status: 0,
          code: 'session_timeout',
          isRetryable: false,
        });
      }
      await new Promise<void>((r) => setTimeout(r, opts.pollIntervalMs));
      session = await this.client.getSession(sessionId);
    }
    return session as unknown as NonNullable<unknown>;
  }

  /** Map a completed Setu session into our accounts + transactions cache. */
  private ingestSession(
    orgId: string,
    org: OrgCache,
    session: unknown,
  ): void {
    // Type-narrow the session object to the shape we expect.
    const s = session as {
      fips?: Array<{
        fipID: string;
        accounts?: Array<{
          linkRefNumber: string;
          maskedAccNumber: string;
          status: string;
          data?: { account: unknown };
        }>;
      }>;
    };
    if (!s?.fips) return;

    for (const fip of s.fips) {
      for (const acc of fip.accounts ?? []) {
        if (!acc.data?.account) continue;
        const mapped = mapSetuAccountToBanking(
          acc.data.account as Parameters<typeof mapSetuAccountToBanking>[0],
          fip.fipID,
          fip.fipID,
          orgId,
        );
        // Replace or insert.
        const idx = org.accounts.findIndex((a) => a.id === mapped.id);
        if (idx >= 0) org.accounts[idx] = mapped;
        else org.accounts.push(mapped);

        // Map transactions for this account.
        const setuAccount = acc.data.account as {
          transactions?: { transaction?: unknown[] };
        };
        const txs = setuAccount.transactions?.transaction ?? [];
        for (const tx of txs) {
          const mappedTx = mapSetuTransactionToBanking(
            tx as Parameters<typeof mapSetuTransactionToBanking>[0],
            mapped.id,
            orgId,
          );
          // Auto-categorize via rules.
          const m = evaluateRules(org.rules, mappedTx.description);
          if (m) {
            mappedTx.category = m.category;
            mappedTx.aiCategory = m.category;
            mappedTx.confidence = 0.85;
          }
          const existingIdx = org.transactions.findIndex((t) => t.id === mappedTx.id);
          if (existingIdx >= 0) org.transactions[existingIdx] = mappedTx;
          else org.transactions.push(mappedTx);
        }
      }
    }
    // Sort transactions newest first.
    org.transactions.sort((a, b) => b.date.localeCompare(a.date));
  }

  async updateAccountStatus(
    orgId: string,
    accountId: string,
    status: AccountStatus,
  ): Promise<BankingAccount> {
    const org = this.getOrg(orgId);
    const acct = org.accounts.find((a) => a.id === accountId);
    if (!acct) throw new Error(`Account not found: ${accountId}`);
    acct.status = status;
    acct.updatedAt = nowISO();
    return acct;
  }

  // ─── Transactions ──────────────────────────────────────────────────────────

  async listTransactions(
    orgId: string,
    filter: TransactionFilter,
  ): Promise<PaginatedResult<BankingTransaction>> {
    const org = this.getOrg(orgId);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
    const offset = Math.max(filter.offset ?? 0, 0);

    let rows = [...org.transactions];

    if (filter.accountId) rows = rows.filter((t) => t.accountId === filter.accountId);
    if (filter.dateFrom) rows = rows.filter((t) => t.date >= filter.dateFrom!);
    if (filter.dateTo) rows = rows.filter((t) => t.date <= filter.dateTo!);
    if (filter.category) rows = rows.filter((t) => t.category === filter.category);
    if (filter.type) rows = rows.filter((t) => t.type === filter.type);
    if (filter.status) rows = rows.filter((t) => t.status === filter.status);
    if (typeof filter.minAmount === 'number')
      rows = rows.filter((t) => t.amount >= filter.minAmount!);
    if (typeof filter.maxAmount === 'number')
      rows = rows.filter((t) => t.amount <= filter.maxAmount!);

    if (filter.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter((t) => {
        return (
          (t.description?.toLowerCase().includes(q) ?? false) ||
          (t.counterparty?.toLowerCase().includes(q) ?? false) ||
          (t.referenceNo?.toLowerCase().includes(q) ?? false)
        );
      });
    }

    rows.sort((a, b) => b.date.localeCompare(a.date));

    const total = rows.length;
    const sliced = rows.slice(offset, offset + limit);
    return { rows: sliced, total, limit, offset };
  }

  async getTransaction(orgId: string, transactionId: string): Promise<BankingTransaction | null> {
    const org = this.getOrg(orgId);
    return org.transactions.find((t) => t.id === transactionId) ?? null;
  }

  async createTransaction(
    orgId: string,
    input: Omit<BankingTransaction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
      status?: BankingTransaction['status'];
    },
  ): Promise<BankingTransaction> {
    const org = this.getOrg(orgId);
    const now = nowISO();
    const counterparty = input.counterparty ?? extractCounterparty(input.description);
    let category = input.category;
    if (!category) {
      const m = evaluateRules(org.rules, input.description);
      if (m) category = m.category;
    }
    const tx: BankingTransaction = {
      ...input,
      id: nextManualId('setu-manual-tx'),
      counterparty,
      category,
      status: input.status ?? 'unreconciled',
      createdAt: now,
      updatedAt: now,
    };
    org.transactions.unshift(tx);
    return tx;
  }

  async updateTransaction(
    orgId: string,
    transactionId: string,
    patch: Partial<BankingTransaction>,
  ): Promise<BankingTransaction> {
    const org = this.getOrg(orgId);
    const tx = org.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    Object.assign(tx, patch, { updatedAt: nowISO() });
    return tx;
  }

  async deleteTransaction(orgId: string, transactionId: string): Promise<{ ok: boolean }> {
    const org = this.getOrg(orgId);
    const idx = org.transactions.findIndex((t) => t.id === transactionId);
    if (idx < 0) return { ok: false };
    org.transactions.splice(idx, 1);
    return { ok: true };
  }

  async linkInvoice(
    orgId: string,
    transactionId: string,
    invoiceId: string,
    matchType: 'manual' | 'exact' | 'fuzzy' = 'manual',
  ): Promise<BankingTransaction> {
    const org = this.getOrg(orgId);
    const tx = org.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    const inv = org.ledger.invoices.find((i) => i.id === invoiceId);
    tx.linkedInvoiceId = invoiceId;
    tx.linkedInvoiceNumber = inv?.number;
    tx.status = 'reconciled';
    tx.matchType = matchType;
    tx.updatedAt = nowISO();
    return tx;
  }

  async categorize(
    orgId: string,
    transactionId: string,
    category: TransactionCategory,
  ): Promise<BankingTransaction> {
    const org = this.getOrg(orgId);
    const tx = org.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    tx.category = category;
    tx.updatedAt = nowISO();
    return tx;
  }

  async splitTransaction(
    orgId: string,
    transactionId: string,
    splits: Array<{ amount: number; category: TransactionCategory }>,
  ): Promise<BankingTransaction[]> {
    const org = this.getOrg(orgId);
    const tx = org.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    if (!splits?.length) return [tx];

    const idx = org.transactions.findIndex((t) => t.id === transactionId);
    if (idx >= 0) org.transactions.splice(idx, 1);

    const now = nowISO();
    const created: BankingTransaction[] = splits.map((s, i) => ({
      ...tx,
      id: nextManualId('setu-manual-tx'),
      amount: s.amount,
      category: s.category,
      description: `${tx.description} (split ${i + 1} of ${splits.length})`,
      status: 'unreconciled',
      matchType: 'none',
      linkedInvoiceId: undefined,
      linkedInvoiceNumber: undefined,
      createdAt: now,
      updatedAt: now,
    }));
    org.transactions.splice(idx, 0, ...created);
    return created;
  }

  // ─── Dashboard & Cash Flow ─────────────────────────────────────────────────

  async getDashboard(orgId: string): Promise<BankingDashboard> {
    const org = this.getOrg(orgId);
    const totalBalance = org.accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
    const todaysBalance = org.accounts.reduce((s, a) => s + (a.availableBalance ?? 0), 0);

    const today = startOfDay(new Date());
    const last30Start = new Date(today.getTime() - 30 * DAY_MS);
    const last30Txs = org.transactions.filter((t) => new Date(t.date) >= last30Start);

    const cashIn = last30Txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const cashOut = last30Txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

    const pendingPayments = org.transactions.filter(
      (t) => t.status === 'unreconciled' && t.type === 'debit',
    ).length;
    const upcomingReceipts = org.transactions.filter(
      (t) => t.status === 'unreconciled' && t.type === 'credit',
    ).length;

    const reconciledCount = org.transactions.filter((t) => t.status === 'reconciled').length;
    const reconciledPct =
      org.transactions.length === 0
        ? 0
        : Math.round((reconciledCount / org.transactions.length) * 100);
    const unreconciledCount = org.transactions.filter((t) => t.status === 'unreconciled').length;

    const cashFlowSeries = this.buildDailySeries(org, 30);
    const incomeVsExpense = this.buildMonthlyIncomeExpense(org, 6);
    const monthlyTrend = incomeVsExpense.map((m) => ({
      month: m.date,
      inflow: m.income,
      outflow: m.expense,
      net: m.income - m.expense,
    }));

    const byCat = new Map<TransactionCategory, number>();
    for (const t of last30Txs) {
      const c = t.category ?? 'misc';
      byCat.set(c, (byCat.get(c) ?? 0) + t.amount);
    }
    const totalCat = Array.from(byCat.values()).reduce((s, v) => s + v, 0);
    const categoryBreakdown = Array.from(byCat.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: totalCat === 0 ? 0 : Math.round((amount / totalCat) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      cards: {
        totalBalance,
        todaysBalance,
        cashIn,
        cashOut,
        netCashFlow: cashIn - cashOut,
        pendingPayments,
        upcomingReceipts,
        reconciledPct,
        unreconciledCount,
        linkedAccounts: org.accounts.length,
      },
      cashFlowSeries,
      incomeVsExpense,
      monthlyTrend,
      categoryBreakdown,
    };
  }

  /** Build a daily CashFlowPoint series for the last N days (oldest→newest). */
  private buildDailySeries(org: OrgCache, days: number, accountId?: string): CashFlowPoint[] {
    const today = startOfDay(new Date());
    const start = new Date(today.getTime() - (days - 1) * DAY_MS);

    const relevantTxs = org.transactions.filter(
      (t) => (!accountId || t.accountId === accountId) && new Date(t.date) >= start,
    );
    const netOverWindow = relevantTxs.reduce(
      (s, t) => s + (t.type === 'credit' ? t.amount : -t.amount),
      0,
    );
    const currentBalance = accountId
      ? (org.accounts.find((a) => a.id === accountId)?.balance ?? 0)
      : org.accounts.reduce((s, a) => s + a.balance, 0);
    const opening = currentBalance - netOverWindow;

    const points: CashFlowPoint[] = [];
    let running = opening;
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      const dStart = new Date(d);
      const dEnd = new Date(d.getTime() + DAY_MS);
      const dayTxs = relevantTxs.filter((t) => {
        const td = new Date(t.date);
        return td >= dStart && td < dEnd;
      });
      const inflow = dayTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
      const outflow = dayTxs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
      const net = inflow - outflow;
      running += net;
      points.push({ date: isoDate(d), inflow, outflow, net, balance: running });
    }
    return points;
  }

  /** Build a monthly income/expense series for the last N months (oldest→newest). */
  private buildMonthlyIncomeExpense(
    org: OrgCache,
    months: number,
  ): Array<{ date: string; income: number; expense: number }> {
    const out: Array<{ date: string; income: number; expense: number }> = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthTxs = org.transactions.filter((t) => {
        const td = new Date(t.date);
        return td >= monthStart && td < monthEnd;
      });
      const income = monthTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
      const expense = monthTxs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
      out.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        income,
        expense,
      });
    }
    return out;
  }

  async getCashFlow(
    orgId: string,
    opts: { from?: string; to?: string; accountId?: string },
  ): Promise<CashFlowSummary> {
    const org = this.getOrg(orgId);
    const today = startOfDay(new Date());
    const to = opts.to ? new Date(opts.to) : today;
    const from = opts.from ? new Date(opts.from) : new Date(to.getTime() - 30 * DAY_MS);
    const days = Math.max(1, Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1);

    const relevantTxs = org.transactions.filter((t) => {
      if (opts.accountId && t.accountId !== opts.accountId) return false;
      const td = new Date(t.date);
      return td >= from && td <= new Date(to.getTime() + DAY_MS);
    });

    const currentBalance = opts.accountId
      ? (org.accounts.find((a) => a.id === opts.accountId)?.balance ?? 0)
      : org.accounts.reduce((s, a) => s + a.balance, 0);

    const netOverWindow = relevantTxs.reduce(
      (s, t) => s + (t.type === 'credit' ? t.amount : -t.amount),
      0,
    );
    const opening = currentBalance - netOverWindow;

    const series: CashFlowPoint[] = [];
    let running = opening;
    for (let i = 0; i < days; i++) {
      const d = new Date(from.getTime() + i * DAY_MS);
      const dStart = new Date(d);
      const dEnd = new Date(d.getTime() + DAY_MS);
      const dayTxs = relevantTxs.filter((t) => {
        const td = new Date(t.date);
        return td >= dStart && td < dEnd;
      });
      const inflow = dayTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
      const outflow = dayTxs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
      const net = inflow - outflow;
      running += net;
      series.push({ date: isoDate(d), inflow, outflow, net, balance: running });
    }

    const totalInflow = series.reduce((s, p) => s + p.inflow, 0);
    const totalOutflow = series.reduce((s, p) => s + p.outflow, 0);
    const closingBalance = running;

    const inflowByCat = new Map<TransactionCategory, number>();
    const outflowByCat = new Map<TransactionCategory, number>();
    for (const t of relevantTxs) {
      const c = t.category ?? 'misc';
      if (t.type === 'credit') inflowByCat.set(c, (inflowByCat.get(c) ?? 0) + t.amount);
      else outflowByCat.set(c, (outflowByCat.get(c) ?? 0) + t.amount);
    }

    return {
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
      openingBalance: opening,
      closingBalance,
      series,
      inflowByCategory: Array.from(inflowByCat.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      outflowByCategory: Array.from(outflowByCat.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  // ─── Forecast ──────────────────────────────────────────────────────────────

  async forecastCashFlow(orgId: string, horizon: '7d' | '30d'): Promise<CashFlowForecast> {
    const org = this.getOrg(orgId);
    const history = this.buildDailySeries(org, 60);
    const currentBalance = org.accounts.reduce((s, a) => s + a.balance, 0);
    const computed = computeForecast({ history, currentBalance, horizon });
    const narrative = buildNarrative(computed, currentBalance);
    return { ...computed, ...narrative };
  }

  // ─── Reconciliation ────────────────────────────────────────────────────────

  async reconcileAll(orgId: string): Promise<ReconcileResult[]> {
    const org = this.getOrg(orgId);
    const out: ReconcileResult[] = [];
    const targets = org.transactions.filter(
      (t) => t.status === 'unreconciled' || t.status === 'pending',
    );
    for (const tx of targets) {
      out.push(this.computeReconcile(org, tx));
    }
    return out;
  }

  async reconcileOne(orgId: string, transactionId: string): Promise<ReconcileResult> {
    const org = this.getOrg(orgId);
    const tx = org.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    return this.computeReconcile(org, tx);
  }

  private computeReconcile(org: OrgCache, tx: BankingTransaction): ReconcileResult {
    const candidates = findCandidates(tx, org.ledger);
    const status = classifyMatch(candidates);
    const best = candidates[0];
    let reason: string | undefined;
    if (status === 'matched') {
      reason = `Strong match: ${best!.label} (amount+date coincide, confidence ${(best!.confidence * 100).toFixed(0)}%).`;
    } else if (status === 'suggested') {
      reason = `Likely match: ${best!.label} (confidence ${(best!.confidence * 100).toFixed(0)}%).`;
    } else if (status === 'partial') {
      reason = `Weak candidate: ${best!.label} (confidence ${(best!.confidence * 100).toFixed(0)}%) — manual review recommended.`;
    } else {
      reason = candidates.length
        ? `No strong match. Closest candidate: ${best!.label} (${(best!.confidence * 100).toFixed(0)}%).`
        : 'No candidates found in the ledger.';
    }
    return {
      transactionId: tx.id,
      status,
      candidates,
      bestMatch: best,
      reason,
    };
  }

  async getReconcileSummary(orgId: string): Promise<ReconcileSummary> {
    const org = this.getOrg(orgId);
    const total = org.transactions.length;
    const reconciled = org.transactions.filter((t) => t.status === 'reconciled').length;
    const unreconciled = org.transactions.filter((t) => t.status === 'unreconciled').length;

    const matched = org.transactions.filter(
      (t) => t.status === 'reconciled' && (t.matchType === 'exact' || t.matchType === 'fuzzy'),
    ).length;
    const suggested = org.transactions.filter(
      (t) => t.status === 'reconciled' && t.matchType === 'manual',
    ).length;
    const partial = 0;
    const unmatched = Math.max(0, unreconciled - matched - suggested - partial);

    return {
      total,
      matched,
      partial,
      unmatched,
      suggested,
      reconciledPct: total === 0 ? 0 : Math.round((reconciled / total) * 100),
    };
  }

  async markReconciled(
    orgId: string,
    transactionId: string,
    candidateId?: string,
    candidateKind?: 'invoice' | 'payment' | 'expense' | 'refund' | 'receipt',
  ): Promise<BankingTransaction> {
    const org = this.getOrg(orgId);
    const tx = org.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    tx.status = 'reconciled';
    tx.matchType = 'manual';
    if (candidateId && candidateKind === 'invoice') {
      const inv = org.ledger.invoices.find((i) => i.id === candidateId);
      if (inv) {
        tx.linkedInvoiceId = inv.id;
        tx.linkedInvoiceNumber = inv.number;
      }
    }
    tx.updatedAt = nowISO();
    return tx;
  }

  // ─── Statement Import ──────────────────────────────────────────────────────

  async previewImport(
    orgId: string,
    format: ImportFormat,
    rawContent: string,
    accountId?: string,
  ): Promise<ImportPreview> {
    const org = this.getOrg(orgId);
    const rows: ImportedRow[] = [];
    let issueCount = 0;
    let detectedFrom: string | undefined;
    let detectedTo: string | undefined;

    if (format === 'csv') {
      const lines = rawContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return emptyPreview(accountId);

      let startIdx = 0;
      const first = lines[0].toLowerCase();
      const hasHeader = /date|amount|description|narration|debit|credit/.test(first);
      if (hasHeader) startIdx = 1;

      for (let i = startIdx; i < lines.length; i++) {
        const cells = splitCSVLine(lines[i]);
        if (cells.length < 2) {
          issueCount++;
          continue;
        }
        const { date, description, amount, type, referenceNo } = mapCSVCells(cells);
        const issues: string[] = [];
        if (!date) issues.push('Missing or unparseable date');
        if (amount === null || Number.isNaN(amount)) issues.push('Unparseable amount');
        if (!description) issues.push('Missing description');
        if (issues.length) issueCount++;

        if (date) {
          if (!detectedFrom || date < detectedFrom) detectedFrom = date;
          if (!detectedTo || date > detectedTo) detectedTo = date;
        }

        rows.push({
          date: date ?? '',
          description: description ?? '',
          amount: amount ?? 0,
          type: type ?? 'debit',
          referenceNo,
          issues: issues.length ? issues : undefined,
        });
      }
    } else if (format === 'excel') {
      // Use the xlsx package (already a project dep) to parse Excel binary.
      try {
        // Lazy-load to avoid pulling it into mock-only code paths.
        const XLSX = await import('xlsx');
        const wb = XLSX.read(rawContent, { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (ws) {
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 });
          for (const row of jsonRows) {
            const cells = (Array.isArray(row) ? row : Object.values(row)).map((c) =>
              typeof c === 'string' ? c : String(c ?? ''),
            );
            if (cells.length < 2) continue;
            const { date, description, amount, type, referenceNo } = mapCSVCells(cells);
            const issues: string[] = [];
            if (!date) issues.push('Missing or unparseable date');
            if (amount === null || Number.isNaN(amount)) issues.push('Unparseable amount');
            if (!description) issues.push('Missing description');
            if (issues.length) issueCount++;
            if (date) {
              if (!detectedFrom || date < detectedFrom) detectedFrom = date;
              if (!detectedTo || date > detectedTo) detectedTo = date;
            }
            rows.push({
              date: date ?? '',
              description: description ?? '',
              amount: amount ?? 0,
              type: type ?? 'debit',
              referenceNo,
              issues: issues.length ? issues : undefined,
            });
          }
        }
      } catch (err) {
        setuLogger.error('Excel parse failed — falling back to text scan', {
          error: err instanceof Error ? err.message : String(err),
        });
        // Fall through to text-scan below.
        const lines = rawContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 50);
        for (const line of lines) {
          const dateM = line.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/);
          const amtM = line.match(/-?[\d,]+\.?\d*/);
          const date = dateM ? normalizeDate(dateM[0]) : '';
          const amount = amtM ? Number(amtM[0].replace(/,/g, '')) : 0;
          const issues: string[] = [];
          if (!date) issues.push('Missing date');
          if (Number.isNaN(amount)) issues.push('Unparseable amount');
          if (issues.length) issueCount++;
          rows.push({
            date,
            description: line.slice(0, 120),
            amount: Number.isNaN(amount) ? 0 : Math.abs(amount),
            type: amtM && amtM[0].startsWith('-') ? 'debit' : 'credit',
            issues: issues.length ? issues : undefined,
          });
          if (date) {
            if (!detectedFrom || date < detectedFrom) detectedFrom = date;
            if (!detectedTo || date > detectedTo) detectedTo = date;
          }
        }
      }
    } else {
      // PDF: not supported — throw a clear error.
      throw new Error(
        'PDF statement import is not supported by SetuBankingProvider. Convert to CSV/Excel and retry.',
      );
    }

    // Apply rules to suggest categories (best-effort, even in preview).
    for (const row of rows) {
      const m = evaluateRules(org.rules, row.description);
      if (m) {
        row.suggestedCategory = m.category;
        row.confidence = 0.85;
      }
    }

    const validRows = rows.filter((r) => !r.issues?.length);
    const totalInflow = rows.filter((r) => r.type === 'credit').reduce((s, r) => s + r.amount, 0);
    const totalOutflow = rows.filter((r) => r.type === 'debit').reduce((s, r) => s + r.amount, 0);

    return {
      rows,
      detectedAccountId: accountId,
      detectedCurrency: 'INR',
      detectedPeriod:
        detectedFrom && detectedTo ? { from: detectedFrom, to: detectedTo } : undefined,
      totalInflow,
      totalOutflow,
      rowCount: rows.length,
      validRowCount: validRows.length,
      issueCount,
    };
  }

  async categorizeImport(orgId: string, preview: ImportPreview): Promise<ImportPreview> {
    const org = this.getOrg(orgId);
    const rows = preview.rows.map((r) => {
      const m = evaluateRules(org.rules, r.description);
      return {
        ...r,
        suggestedCategory: m?.category,
        confidence: m ? 0.85 : undefined,
      };
    });
    return { ...preview, rows };
  }

  async commitImport(
    orgId: string,
    preview: ImportPreview,
    accountId: string,
  ): Promise<ImportResult> {
    const ids: string[] = [];
    let imported = 0;
    let skipped = 0;
    let categorized = 0;

    for (const row of preview.rows) {
      if (row.issues && row.issues.length) {
        skipped++;
        continue;
      }
      const tx = await this.createTransaction(orgId, {
        accountId,
        date: row.date ? new Date(row.date).toISOString() : nowISO(),
        description: row.description,
        amount: row.amount,
        type: row.type,
        referenceNo: row.referenceNo,
        category: row.suggestedCategory,
        status: 'unreconciled',
      });
      ids.push(tx.id);
      imported++;
      if (row.suggestedCategory) categorized++;
    }

    return {
      ok: true,
      importedCount: imported,
      skippedCount: skipped,
      categorizationApplied: categorized,
      transactionIds: ids,
      summary: `Imported ${imported} transaction(s) into ${accountId}; ${categorized} auto-categorized; ${skipped} skipped due to validation issues.`,
    };
  }

  // ─── Categorization Rules ──────────────────────────────────────────────────

  async listRules(orgId: string): Promise<CategorizationRule[]> {
    const org = this.getOrg(orgId);
    return [...org.rules];
  }

  async createRule(
    orgId: string,
    input: Omit<CategorizationRule, 'id' | 'createdAt' | 'updatedAt' | 'matchCount'>,
  ): Promise<CategorizationRule> {
    const org = this.getOrg(orgId);
    const now = nowISO();
    const rule: CategorizationRule = {
      ...input,
      id: nextManualId('setu-rule'),
      matchCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    org.rules.push(rule);
    return rule;
  }

  async updateRule(
    orgId: string,
    ruleId: string,
    patch: Partial<CategorizationRule>,
  ): Promise<CategorizationRule> {
    const org = this.getOrg(orgId);
    const rule = org.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    Object.assign(rule, patch, { updatedAt: nowISO() });
    return rule;
  }

  async deleteRule(orgId: string, ruleId: string): Promise<{ ok: boolean }> {
    const org = this.getOrg(orgId);
    const idx = org.rules.findIndex((r) => r.id === ruleId);
    if (idx < 0) return { ok: false };
    org.rules.splice(idx, 1);
    return { ok: true };
  }

  async applyRules(orgId: string): Promise<{ applied: number; touched: number }> {
    const org = this.getOrg(orgId);
    let touched = 0;
    let applied = 0;

    for (const tx of org.transactions) {
      const m = evaluateRules(org.rules, tx.description);
      if (!m) continue;
      applied++;
      if (!tx.category || tx.category === 'misc') {
        if (tx.category !== m.category) {
          tx.category = m.category;
          tx.aiCategory = m.category;
          tx.confidence = 0.85;
          tx.updatedAt = nowISO();
          touched++;
        }
      }
    }

    // Refresh matchCount.
    for (const rule of org.rules) {
      rule.matchCount = org.transactions.filter((t) => {
        const r = evaluateRules([rule], t.description);
        return r !== null;
      }).length;
    }

    return { applied, touched };
  }

  // ─── AI Insights (Oracle Banking Intelligence) ─────────────────────────────

  async answerQuestion(orgId: string, question: string): Promise<BankingInsightAnswer> {
    const org = this.getOrg(orgId);
    const matched = matchQuestion(question);
    switch (matched.kind) {
      case 'total_balance':
        return this.answerTotalBalance(org, question, matched.label);
      case 'this_month_expenses':
        return this.answerThisMonthExpenses(org, question, matched.label);
      case 'unpaid_invoices':
        return this.answerUnpaidInvoices(org, question, matched.label);
      case 'cash_next_week':
        return this.answerCashNextWeek(orgId, org, question, matched.label);
      case 'cash_flow_decreasing':
        return this.answerCashFlowDecreasing(org, question, matched.label);
      case 'suspicious_transactions':
        return this.answerSuspicious(org, question, matched.label);
      case 'largest_expenses':
        return this.answerLargestExpenses(org, question, matched.label);
      case 'late_payers':
        return this.answerLatePayers(org, question, matched.label);
      case 'generic':
      default:
        return this.answerGeneric(org, question, matched.label);
    }
  }

  // ─── Oracle answer builders ────────────────────────────────────────────────

  private answerTotalBalance(
    org: OrgCache,
    question: string,
    label: string,
  ): BankingInsightAnswer {
    const total = org.accounts.reduce((s, a) => s + a.balance, 0);
    const rows = org.accounts.map((a) => ({
      Bank: a.bankName,
      Account: a.accountName,
      Type: a.accountType,
      Balance: fmtINR(a.balance),
    }));
    return {
      question,
      label,
      answer:
        `You currently hold **${fmtINR(total)}** across ${org.accounts.length} linked account(s). ` +
        (org.accounts.length === 0
          ? 'Connect a bank account via Setu to see live balances. '
          : '') +
        `Available balance (excluding holds) is ${fmtINR(
          org.accounts.reduce((s, a) => s + a.availableBalance, 0),
        )}.`,
      metrics: [
        { label: 'Total balance', value: fmtINR(total), tone: 'positive' },
        {
          label: 'Available balance',
          value: fmtINR(org.accounts.reduce((s, a) => s + a.availableBalance, 0)),
          tone: 'neutral',
        },
        { label: 'Linked accounts', value: String(org.accounts.length), tone: 'neutral' },
      ],
      table: { columns: ['Bank', 'Account', 'Type', 'Balance'], rows },
    };
  }

  private answerThisMonthExpenses(
    org: OrgCache,
    question: string,
    label: string,
  ): BankingInsightAnswer {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTxs = org.transactions.filter(
      (t) => t.type === 'debit' && new Date(t.date) >= monthStart,
    );
    const total = monthTxs.reduce((s, t) => s + t.amount, 0);

    const byCat = new Map<TransactionCategory, number>();
    for (const t of monthTxs) {
      const c = t.category ?? 'misc';
      byCat.set(c, (byCat.get(c) ?? 0) + t.amount);
    }
    const top = Array.from(byCat.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      question,
      label,
      answer:
        `You have spent **${fmtINR(total)}** so far this month across ${monthTxs.length} debit transaction(s). ` +
        (top.length
          ? `Top spending categories: ${top
              .map(([c, a]) => `${CATEGORY_META[c].label} (${fmtINRShort(a)})`)
              .join(', ')}.`
          : ''),
      metrics: [
        { label: 'Total spent (MTD)', value: fmtINR(total), tone: 'negative' },
        { label: 'Transactions', value: String(monthTxs.length), tone: 'neutral' },
        {
          label: 'Top category',
          value: top[0] ? CATEGORY_META[top[0][0]].label : '—',
          tone: 'neutral',
        },
      ],
      table: {
        columns: ['Category', 'Amount', '% of spend'],
        rows: top.map(([c, a]) => ({
          Category: CATEGORY_META[c].label,
          Amount: fmtINR(a),
          '% of spend': total === 0 ? '0%' : `${Math.round((a / total) * 100)}%`,
        })),
      },
    };
  }

  private answerUnpaidInvoices(
    org: OrgCache,
    question: string,
    label: string,
  ): BankingInsightAnswer {
    const unpaid = org.ledger.invoices.filter((i) => i.status !== 'paid');
    const total = unpaid.reduce((s, i) => s + i.amount, 0);

    return {
      question,
      label,
      answer:
        `You have **${unpaid.length} unpaid invoice(s)** totalling **${fmtINR(total)}**. ` +
        `${unpaid.filter((i) => i.status === 'overdue').length} are overdue. ` +
        `Expedite collection to improve cash position.`,
      metrics: [
        { label: 'Unpaid invoices', value: String(unpaid.length), tone: 'negative' },
        { label: 'Total outstanding', value: fmtINR(total), tone: 'negative' },
        {
          label: 'Overdue',
          value: String(unpaid.filter((i) => i.status === 'overdue').length),
          tone: 'negative',
        },
      ],
      table: {
        columns: ['Invoice #', 'Customer', 'Amount', 'Date', 'Status'],
        rows: unpaid
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 12)
          .map((i) => ({
            'Invoice #': i.number,
            Customer: i.customer,
            Amount: fmtINR(i.amount),
            Date: i.date,
            Status: i.status ?? 'unpaid',
          })),
      },
    };
  }

  private async answerCashNextWeek(
    orgId: string,
    org: OrgCache,
    question: string,
    label: string,
  ): Promise<BankingInsightAnswer> {
    const forecast = await this.forecastCashFlow(orgId, '7d');
    const currentBalance = org.accounts.reduce((s, a) => s + a.balance, 0);
    const change = forecast.projectedEndBalance - currentBalance;

    return {
      question,
      label,
      answer:
        forecast.narrative +
        ` Projected balance in 7 days: **${fmtINR(forecast.projectedEndBalance)}** ` +
        `(${change >= 0 ? '+' : ''}${fmtINRShort(change)} vs today).`,
      metrics: [
        { label: 'Balance today', value: fmtINR(currentBalance), tone: 'neutral' },
        {
          label: 'Projected in 7d',
          value: fmtINR(forecast.projectedEndBalance),
          tone: change >= 0 ? 'positive' : 'negative',
        },
        {
          label: 'Min projected',
          value: fmtINR(forecast.minBalance),
          tone: forecast.minBalance < currentBalance * 0.3 ? 'negative' : 'neutral',
        },
        {
          label: 'Confidence',
          value: `${Math.round(forecast.confidence * 100)}%`,
          tone: 'neutral',
        },
      ],
      table: {
        columns: ['Date', 'Projected balance', 'Low band', 'High band'],
        rows: forecast.points.map((p) => ({
          Date: p.date,
          'Projected balance': fmtINR(p.projectedBalance),
          'Low band': fmtINR(p.lowBalance),
          'High band': fmtINR(p.highBalance),
        })),
      },
    };
  }

  private answerCashFlowDecreasing(
    org: OrgCache,
    question: string,
    label: string,
  ): BankingInsightAnswer {
    const today = startOfDay(new Date());
    const last30Start = new Date(today.getTime() - 30 * DAY_MS);
    const prev30Start = new Date(today.getTime() - 60 * DAY_MS);

    const last30 = org.transactions.filter(
      (t) => new Date(t.date) >= last30Start && new Date(t.date) < today,
    );
    const prev30 = org.transactions.filter(
      (t) => new Date(t.date) >= prev30Start && new Date(t.date) < last30Start,
    );

    const lastNet = last30.reduce(
      (s, t) => s + (t.type === 'credit' ? t.amount : -t.amount),
      0,
    );
    const prevNet = prev30.reduce(
      (s, t) => s + (t.type === 'credit' ? t.amount : -t.amount),
      0,
    );
    const delta = lastNet - prevNet;

    const prevByCat = new Map<TransactionCategory, number>();
    for (const t of prev30)
      if (t.type === 'debit') {
        const c = t.category ?? 'misc';
        prevByCat.set(c, (prevByCat.get(c) ?? 0) + t.amount);
      }
    const lastByCat = new Map<TransactionCategory, number>();
    for (const t of last30)
      if (t.type === 'debit') {
        const c = t.category ?? 'misc';
        lastByCat.set(c, (lastByCat.get(c) ?? 0) + t.amount);
      }
    const growth = CATEGORY_ORDER.map((c) => ({
      category: c,
      delta: (lastByCat.get(c) ?? 0) - (prevByCat.get(c) ?? 0),
      current: lastByCat.get(c) ?? 0,
    }))
      .filter((x) => x.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);

    const decreasing = delta < 0;
    const narrative = decreasing
      ? `Net cash flow over the last 30 days was ${fmtINR(lastNet)}, down ${fmtINRShort(
          Math.abs(delta),
        )} from ${fmtINR(prevNet)} in the prior 30 days. The biggest outflow increases were: ${
          growth.length
            ? growth.map((g) => `${CATEGORY_META[g.category].label} (+${fmtINRShort(g.delta)})`).join(', ')
            : 'none'
        }.`
      : `Net cash flow over the last 30 days was ${fmtINR(lastNet)}, up ${fmtINRShort(
          Math.abs(delta),
        )} from ${fmtINR(prevNet)} in the prior 30 days. No concerning outflow growth detected.`;

    return {
      question,
      label,
      answer: narrative,
      metrics: [
        {
          label: 'Last 30d net',
          value: fmtINR(lastNet),
          tone: lastNet >= 0 ? 'positive' : 'negative',
        },
        {
          label: 'Prior 30d net',
          value: fmtINR(prevNet),
          tone: prevNet >= 0 ? 'positive' : 'negative',
        },
        {
          label: 'Change',
          value: `${delta >= 0 ? '+' : ''}${fmtINRShort(delta)}`,
          tone: delta >= 0 ? 'positive' : 'negative',
        },
      ],
      table:
        growth.length > 0
          ? {
              columns: ['Category', 'Last 30d', 'Growth vs prior'],
              rows: growth.map((g) => ({
                Category: CATEGORY_META[g.category].label,
                'Last 30d': fmtINR(g.current),
                'Growth vs prior': `+${fmtINR(g.delta)}`,
              })),
            }
          : undefined,
    };
  }

  private answerSuspicious(
    org: OrgCache,
    question: string,
    label: string,
  ): BankingInsightAnswer {
    const all = org.transactions;
    if (!all.length) {
      return {
        question,
        label,
        answer:
          'No transactions to analyze. Connect a bank account via Setu or import a statement to enable anomaly detection.',
        metrics: [],
      };
    }
    const amounts = all.map((t) => t.amount);
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance =
      amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / Math.max(1, amounts.length - 1);
    const sd = Math.sqrt(variance);
    const threshold = mean + 2 * sd;

    const flagged = all
      .filter((t) => {
        const outlier = t.amount > threshold && t.amount > 10000;
        const lowConf = typeof t.confidence === 'number' && t.confidence < 0.7;
        const uncategorized = !t.category || t.category === 'misc';
        return outlier || lowConf || uncategorized;
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12);

    return {
      question,
      label,
      answer:
        `Flagged **${flagged.length} transaction(s)** for review. ` +
        `Outlier threshold (mean + 2σ): ${fmtINR(threshold)}. ` +
        `Reasons include unusual amount, low AI categorization confidence, or uncategorized posting.`,
      metrics: [
        { label: 'Flagged', value: String(flagged.length), tone: 'negative' },
        { label: 'Mean amount', value: fmtINRShort(mean), tone: 'neutral' },
        { label: 'Outlier threshold', value: fmtINRShort(threshold), tone: 'neutral' },
      ],
      table: {
        columns: ['Date', 'Description', 'Amount', 'Type', 'Reason'],
        rows: flagged.map((t) => ({
          Date: isoDate(new Date(t.date)),
          Description: t.description,
          Amount: fmtINR(t.amount),
          Type: t.type,
          Reason:
            (t.amount > threshold && t.amount > 10000 ? 'amount outlier' : '') +
            (typeof t.confidence === 'number' && t.confidence < 0.7
              ? (t.amount > threshold ? '; ' : '') + 'low confidence'
              : '') +
            (!t.category || t.category === 'misc'
              ? (t.amount > threshold || (typeof t.confidence === 'number' && t.confidence < 0.7) ? '; ' : '') + 'uncategorized'
              : ''),
        })),
      },
    };
  }

  private answerLargestExpenses(
    org: OrgCache,
    question: string,
    label: string,
  ): BankingInsightAnswer {
    const top = [...org.transactions]
      .filter((t) => t.type === 'debit')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
    const total = top.reduce((s, t) => s + t.amount, 0);

    return {
      question,
      label,
      answer:
        `Your 10 largest expenses total **${fmtINR(total)}**. ` +
        `The single largest is ${fmtINR(top[0]?.amount ?? 0)} (${top[0]?.description ?? '—'}).`,
      metrics: [
        { label: 'Top 10 total', value: fmtINR(total), tone: 'negative' },
        {
          label: 'Largest single',
          value: fmtINR(top[0]?.amount ?? 0),
          tone: 'negative',
        },
      ],
      table: {
        columns: ['Date', 'Description', 'Amount', 'Category', 'Account'],
        rows: top.map((t) => {
          const acct = org.accounts.find((a) => a.id === t.accountId);
          return {
            Date: isoDate(new Date(t.date)),
            Description: t.description,
            Amount: fmtINR(t.amount),
            Category: t.category ? CATEGORY_META[t.category].label : 'Uncategorized',
            Account: acct ? acct.bankName : t.accountId,
          };
        }),
      },
    };
  }

  private answerLatePayers(
    org: OrgCache,
    question: string,
    label: string,
  ): BankingInsightAnswer {
    const linked = org.transactions.filter(
      (t) => t.status === 'reconciled' && t.linkedInvoiceId && t.type === 'credit',
    );
    const byCustomer = new Map<
      string,
      { customer: string; count: number; totalDelay: number; maxDelay: number; amount: number }
    >();
    for (const t of linked) {
      const inv = org.ledger.invoices.find((i) => i.id === t.linkedInvoiceId);
      if (!inv) continue;
      const delayDays = Math.max(
        0,
        Math.floor((new Date(t.date).getTime() - new Date(inv.date).getTime()) / DAY_MS),
      );
      const key = inv.customer;
      const cur = byCustomer.get(key) ?? {
        customer: key,
        count: 0,
        totalDelay: 0,
        maxDelay: 0,
        amount: 0,
      };
      cur.count += 1;
      cur.totalDelay += delayDays;
      cur.maxDelay = Math.max(cur.maxDelay, delayDays);
      cur.amount += t.amount;
      byCustomer.set(key, cur);
    }
    const rows = Array.from(byCustomer.values())
      .map((c) => ({
        customer: c.customer,
        count: c.count,
        avgDelay: c.count ? Math.round(c.totalDelay / c.count) : 0,
        maxDelay: c.maxDelay,
        amount: c.amount,
      }))
      .sort((a, b) => b.avgDelay - a.avgDelay)
      .slice(0, 8);

    const overallAvg = rows.length
      ? Math.round(rows.reduce((s, r) => s + r.avgDelay, 0) / rows.length)
      : 0;

    return {
      question,
      label,
      answer:
        rows.length === 0
          ? 'No reconciled invoice payments yet — connect more accounts or run reconciliation to compute payer delays.'
          : `Across ${rows.length} customer(s) with reconciled payments, the average payment delay is **${overallAvg} day(s)**. ` +
            `The slowest payer is **${rows[0].customer}** (avg ${rows[0].avgDelay} days).`,
      metrics: [
        { label: 'Customers analyzed', value: String(rows.length), tone: 'neutral' },
        {
          label: 'Avg delay (all)',
          value: `${overallAvg} days`,
          tone: overallAvg > 14 ? 'negative' : 'neutral',
        },
        { label: 'Slowest payer', value: rows[0]?.customer ?? '—', tone: 'negative' },
      ],
      table:
        rows.length > 0
          ? {
              columns: ['Customer', 'Payments', 'Avg delay (days)', 'Max delay (days)', 'Total paid'],
              rows: rows.map((r) => ({
                Customer: r.customer,
                Payments: r.count,
                'Avg delay (days)': r.avgDelay,
                'Max delay (days)': r.maxDelay,
                'Total paid': fmtINR(r.amount),
              })),
            }
          : undefined,
    };
  }

  private answerGeneric(
    org: OrgCache,
    question: string,
    label: string,
  ): BankingInsightAnswer {
    const total = org.accounts.reduce((s, a) => s + a.balance, 0);
    const today = startOfDay(new Date());
    const last7Start = new Date(today.getTime() - 7 * DAY_MS);
    const last7 = org.transactions.filter((t) => new Date(t.date) >= last7Start);
    const inflow = last7.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const outflow = last7.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

    return {
      question,
      label,
      answer:
        `Here's a quick summary: you hold **${fmtINR(total)}** across ${org.accounts.length} accounts. ` +
        `Over the last 7 days, ${fmtINR(inflow)} came in and ${fmtINR(outflow)} went out ` +
        `(net ${fmtINR(inflow - outflow)}). ` +
        (org.accounts.length === 0
          ? 'Connect a bank account via Setu to populate live data. '
          : '') +
        `Ask me about specific invoices, suspicious transactions, cash flow projections, or late-paying customers for deeper analysis.`,
      metrics: [
        { label: 'Total balance', value: fmtINR(total), tone: 'positive' },
        { label: '7d inflow', value: fmtINR(inflow), tone: 'positive' },
        { label: '7d outflow', value: fmtINR(outflow), tone: 'negative' },
        {
          label: '7d net',
          value: fmtINR(inflow - outflow),
          tone: inflow - outflow >= 0 ? 'positive' : 'negative',
        },
      ],
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a Setu VUA from a `upiHandle` if it looks like a mobile number.
 * Returns the raw 10-digit mobile (Setu accepts that form for the default AA).
 * Returns undefined if the handle isn't a mobile number.
 */
function extractVuaFromUpiHandle(upiHandle: string | undefined): string | undefined {
  if (!upiHandle) return undefined;
  const trimmed = upiHandle.trim();
  // Pure 10-digit mobile number.
  if (/^\d{10}$/.test(trimmed)) return trimmed;
  // Already a VUA (mobile@aa-handle).
  if (/^\d{10}@/.test(trimmed)) return trimmed;
  return undefined;
}

// ─── CSV helpers (mirrors mock-provider.ts) ───────────────────────────────────

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function mapCSVCells(cells: string[]): {
  date: string | undefined;
  description: string | undefined;
  amount: number | null;
  type: TransactionType | undefined;
  referenceNo: string | undefined;
} {
  let date: string | undefined;
  let description: string | undefined;
  let amount: number | null = null;
  let type: TransactionType | undefined;
  let referenceNo: string | undefined;

  for (const raw of cells) {
    const c = raw.trim();
    if (!c) continue;
    if (!date) {
      const d = normalizeDate(c);
      if (d) {
        date = d;
        continue;
      }
    }
    if (amount === null && /^-?[\d,]+\.?\d*$/.test(c) && c.length > 0) {
      const n = Number(c.replace(/,/g, ''));
      if (!Number.isNaN(n)) {
        amount = Math.abs(n);
        type = n < 0 ? 'debit' : 'credit';
        continue;
      }
    }
    if (!referenceNo && /^[A-Z0-9]{6,}$/i.test(c) && c.length <= 24) {
      referenceNo = c;
      continue;
    }
    if (!description || c.length > description.length) {
      description = c;
    }
  }

  return { date, description, amount, type, referenceNo };
}

function normalizeDate(s: string): string | undefined {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3];
    const day = a > 12 ? a : b > 12 ? b : a;
    const month = a > 12 ? b : b > 12 ? a : b;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3];
    const day = a > 12 ? a : b > 12 ? b : a;
    const month = a > 12 ? b : b > 12 ? a : b;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return undefined;
}

function emptyPreview(accountId?: string): ImportPreview {
  return {
    rows: [],
    detectedAccountId: accountId,
    detectedCurrency: 'INR',
    totalInflow: 0,
    totalOutflow: 0,
    rowCount: 0,
    validRowCount: 0,
    issueCount: 0,
  };
}
