// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Core Prisma Service (TASK 12)
//
// The persistence + query layer for the banking module. SERVER-ONLY.
//
// Architecture:
//   ┌─────────────────────────────────────────────────────────────┐
//   │  API Routes (/api/banking/*)                                │
//   ├─────────────────────────────────────────────────────────────┤
//   │  This Service (src/lib/banking-prisma/service.ts)           │
//   │  • Reads/writes the local Prisma DB                         │
//   │  • Calls IBankProvider for live data fetch (MockProvider)   │
//   │  • Runs the reconciliation engine                           │
//   │  • Computes cash flow, oracle insights, reports             │
//   ├─────────────────────────────────────────────────────────────┤
//   │  Prisma (SQLite)  ←  BankAccount, BankTransaction,          │
//   │                       BankReconciliation, StatementImport,  │
//   │                       CashFlowSnapshot                      │
//   └─────────────────────────────────────────────────────────────┘
//
// Provider Swap (future): change BANK_PROVIDER env var → registry returns
// SetuProvider/RazorpayXProvider → this service calls the new provider's
// fetchAccounts/fetchTransactions → same DB schema, same API, same UI.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { categorizeTransaction, extractCounterparty } from '@/lib/banking/categorize';
import type {
  BankingAccount,
  BankingAccountListResult,
  BankingTransaction,
  BankingTransactionListResult,
  BankingDashboardSummary,
  BankAccountType,
  BankAccountStatus,
  TransactionType,
  TransactionCategory,
  TransactionStatus,
  TransactionSource,
  ProviderInfo,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskAccountNumber(acct: string): string {
  if (!acct) return '****0000';
  const cleaned = acct.replace(/\s+/g, '');
  if (cleaned.length < 4) return '****' + cleaned;
  return 'XXXX XXXX ' + cleaned.slice(-4);
}

function timeAgo(d: Date | null): string {
  if (!d) return 'never';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isToday(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

// ─── Account DTO ──────────────────────────────────────────────────────────────

type AccountRow = {
  id: string;
  organizationId: string;
  bankName: string;
  bankLogoUrl: string | null;
  accountNumber: string;
  accountMasked: string;
  accountType: string;
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
  aaConsentExpiry: Date | null;
  status: string;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  transactions: Array<{ amount: number; date: Date; type: string }>;
  // Optional — present when the query uses `_count` instead of loading all
  // transactions (see `listAccounts`). When present, `transactionCount` is
  // taken from `_count.transactions` (the true total) instead of
  // `transactions.length` (which would only reflect the filtered subset).
  _count?: { transactions: number };
};

function toAccountDTO(row: AccountRow): BankingAccount {
  const monthStart = startOfMonth();
  // When `_count` is present, the `transactions` array is already filtered to
  // the current month (see `listAccounts`), so no need to re-filter here.
  // Otherwise (getAccount / createAccount), `transactions` is the full list —
  // filter it as before for backward compatibility.
  const monthTxns = row._count
    ? row.transactions
    : row.transactions.filter((t) => new Date(t.date) >= monthStart);
  const monthlyInflow = monthTxns
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthlyOutflow = monthTxns
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    id: row.id,
    organizationId: row.organizationId,
    bankName: row.bankName,
    bankLogoUrl: row.bankLogoUrl,
    accountNumber: row.accountNumber,
    accountMasked: row.accountMasked || maskAccountNumber(row.accountNumber),
    accountType: (row.accountType as BankAccountType) || 'current',
    ifsc: row.ifsc,
    branch: row.branch,
    owner: row.owner,
    balance: row.balance,
    availableBalance: row.availableBalance,
    overdraftLimit: row.overdraftLimit,
    upiHandle: row.upiHandle,
    currency: row.currency || 'INR',
    provider: row.provider || 'mock',
    aaConsent: row.aaConsent,
    aaConsentExpiry: row.aaConsentExpiry ? row.aaConsentExpiry.toISOString() : null,
    status: (row.status as BankAccountStatus) || 'active',
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    lastSyncAgo: timeAgo(row.lastSyncAt),
    transactionCount: row._count?.transactions ?? row.transactions.length,
    monthlyInflow,
    monthlyOutflow,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Transaction DTO ──────────────────────────────────────────────────────────

type TxnRow = {
  id: string;
  organizationId: string;
  accountId: string;
  account: { bankName: string; accountMasked: string } | null;
  date: Date;
  valueDate: Date | null;
  description: string;
  narration: string | null;
  amount: number;
  type: string;
  balance: number | null;
  category: string | null;
  counterparty: string | null;
  referenceNo: string | null;
  reference: string | null;
  upiRef: string | null;
  status: string;
  source: string;
  matched: boolean;
  matchedInvoiceId: string | null;
  matchType: string | null;
  matchConfidence: number | null;
  reconciledAt: Date | null;
  reconciledBy: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toTransactionDTO(row: TxnRow): BankingTransaction {
  return {
    id: row.id,
    organizationId: row.organizationId,
    accountId: row.accountId,
    bankName: row.account?.bankName ?? 'Unknown Bank',
    accountMasked: row.account?.accountMasked ?? '****',
    date: row.date.toISOString(),
    valueDate: row.valueDate ? row.valueDate.toISOString() : null,
    description: row.description,
    narration: row.narration,
    amount: Math.abs(row.amount),
    type: (row.type as TransactionType) || 'debit',
    balance: row.balance,
    category: (row.category as TransactionCategory) || 'other',
    counterparty: row.counterparty,
    referenceNo: row.referenceNo,
    reference: row.reference,
    upiRef: row.upiRef,
    status: (row.status as TransactionStatus) || 'posted',
    source: (row.source as TransactionSource) || 'statement',
    matched: row.matched,
    matchedInvoiceId: row.matchedInvoiceId,
    matchType: row.matchType as BankingTransaction['matchType'],
    matchConfidence: row.matchConfidence ?? 0,
    reconciledAt: row.reconciledAt ? row.reconciledAt.toISOString() : null,
    reconciledBy: row.reconciledBy,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTS — list, get, create, update, delete, sync
// ═══════════════════════════════════════════════════════════════════════════════

export async function listAccounts(organizationId: string): Promise<BankingAccountListResult> {
  // PERF: Previously loaded ALL transactions for every account (selecting only
  // amount/date/type). For accounts with thousands of historical transactions,
  // this loaded the entire history on every banking-page mount just to compute
  // `transactionCount` and current-month inflow/outflow.
  //
  // Now we use:
  //   • `_count` — Prisma's relation count, computed server-side as a single
  //     aggregate (no row transfer).
  //   • A `where`-filtered `transactions` include limited to the current month
  //     + a safety `take: 1000` cap. This is exactly the slice `toAccountDTO`
  //     needs for monthlyInflow/monthlyOutflow.
  const monthStart = startOfMonth();
  const rows = await db.bankAccount.findMany({
    where: { organizationId },
    include: {
      transactions: {
        where: { date: { gte: monthStart } },
        select: { amount: true, date: true, type: true },
        orderBy: { date: 'desc' },
        take: 1000,
      },
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const accounts = rows.map(toAccountDTO);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const availableBalance = accounts.reduce((s, a) => s + a.availableBalance, 0);
  const activeAccounts = accounts.filter((a) => a.status === 'active').length;
  const syncedToday = accounts.filter((a) =>
    isToday(a.lastSyncAt ? new Date(a.lastSyncAt) : null),
  ).length;

  return {
    accounts,
    totalBalance,
    availableBalance,
    totalAccounts: accounts.length,
    activeAccounts,
    syncedToday,
    hasLiveData: accounts.length > 0,
  };
}

export async function getAccount(accountId: string, organizationId: string): Promise<BankingAccount | null> {
  const row = await db.bankAccount.findFirst({
    where: { id: accountId, organizationId },
    include: {
      transactions: {
        select: { amount: true, date: true, type: true },
        orderBy: { date: 'desc' },
      },
    },
  });
  return row ? toAccountDTO(row) : null;
}

export async function createAccount(input: {
  organizationId: string;
  bankName: string;
  accountNumber: string;
  ifsc?: string;
  branch?: string;
  owner?: string;
  accountType?: string;
  upiHandle?: string;
  openingBalance?: number;
  createdBy?: string;
}): Promise<BankingAccount> {
  const accountNumber = input.accountNumber.replace(/\s+/g, '');
  const masked = maskAccountNumber(accountNumber);
  const created = await db.bankAccount.create({
    data: {
      organizationId: input.organizationId,
      bankName: input.bankName.trim(),
      bankLogoUrl: bankLogo(input.bankName),
      accountNumber,
      accountMasked: masked,
      accountType: input.accountType || 'current',
      ifsc: input.ifsc?.toUpperCase() || null,
      branch: input.branch || null,
      owner: input.owner || null,
      balance: input.openingBalance || 0,
      availableBalance: input.openingBalance || 0,
      upiHandle: input.upiHandle || null,
      status: 'active',
      lastSyncAt: new Date(),
      provider: 'mock',
    },
    include: {
      transactions: { select: { amount: true, date: true, type: true }, orderBy: { date: 'desc' } },
    },
  });
  await writeAuditLog({
    organizationId: input.organizationId,
    actor: input.createdBy || 'system',
    action: 'bank_account.create',
    targetType: 'BankAccount',
    targetId: created.id,
    metadata: { bankName: created.bankName, accountMasked: masked },
  });
  return toAccountDTO(created);
}

export async function updateAccount(
  accountId: string,
  organizationId: string,
  patch: Partial<{
    bankName: string;
    ifsc: string;
    branch: string;
    owner: string;
    accountType: string;
    upiHandle: string;
    balance: number;
    availableBalance: number;
    overdraftLimit: number;
    status: string;
  }>,
  actor?: string,
): Promise<BankingAccount | null> {
  const updated = await db.bankAccount.update({
    where: { id: accountId },
    data: {
      ...(patch.bankName !== undefined ? { bankName: patch.bankName } : {}),
      ...(patch.ifsc !== undefined ? { ifsc: patch.ifsc.toUpperCase() } : {}),
      ...(patch.branch !== undefined ? { branch: patch.branch } : {}),
      ...(patch.owner !== undefined ? { owner: patch.owner } : {}),
      ...(patch.accountType !== undefined ? { accountType: patch.accountType } : {}),
      ...(patch.upiHandle !== undefined ? { upiHandle: patch.upiHandle } : {}),
      ...(patch.balance !== undefined ? { balance: patch.balance } : {}),
      ...(patch.availableBalance !== undefined ? { availableBalance: patch.availableBalance } : {}),
      ...(patch.overdraftLimit !== undefined ? { overdraftLimit: patch.overdraftLimit } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    },
    include: {
      transactions: { select: { amount: true, date: true, type: true }, orderBy: { date: 'desc' } },
    },
  });
  await writeAuditLog({
    organizationId,
    actor: actor || 'system',
    action: 'bank_account.update',
    targetType: 'BankAccount',
    targetId: accountId,
    metadata: patch,
  });
  return toAccountDTO(updated);
}

export async function deleteAccount(accountId: string, organizationId: string, actor?: string): Promise<void> {
  await db.bankTransaction.deleteMany({ where: { accountId, organizationId } });
  await db.bankAccount.deleteMany({ where: { id: accountId, organizationId } });
  await writeAuditLog({
    organizationId,
    actor: actor || 'system',
    action: 'bank_account.delete',
    targetType: 'BankAccount',
    targetId: accountId,
  });
}

// ─── Sync (MockProvider → DB) ─────────────────────────────────────────────────
// Generates deterministic recent transactions for the account using the same
// algorithm as MockBankProvider, then persists them to the local DB. In
// production this is where we'd call provider.fetchTransactions(session) and
// persist the result — the signature stays identical.

const SYNC_TEMPLATES = [
  { desc: 'UPI/4521/ABC CORP', amt: 45000, type: 'credit', cat: 'sales' },
  { desc: 'NEFT/SALARY/AUG', amt: 85000, type: 'debit', cat: 'salary' },
  { desc: 'UPI/8890/VENDOR XY', amt: 12800, type: 'debit', cat: 'purchase' },
  { desc: 'GST PAYMENT/3B', amt: 34000, type: 'debit', cat: 'gst' },
  { desc: 'UPI/Refund/INV22', amt: 5600, type: 'credit', cat: 'refund' },
  { desc: 'NEFT Cr/Bharat Tech', amt: 78000, type: 'credit', cat: 'sales' },
  { desc: 'Electricity Bill/Tata Power', amt: 14500, type: 'debit', cat: 'utilities' },
  { desc: 'UPI Dr/okhdfc/Raw Materials', amt: 23000, type: 'debit', cat: 'purchase' },
  { desc: 'RTGS Cr/Indus Traders', amt: 156000, type: 'credit', cat: 'sales' },
  { desc: 'Loan EMI/HDFC', amt: 42000, type: 'debit', cat: 'loan' },
  { desc: 'ATM Withdrawal', amt: 10000, type: 'debit', cat: 'cash_withdrawal' },
  { desc: 'Mutual Fund Investment', amt: 25000, type: 'debit', cat: 'investment' },
];

export async function syncAccount(
  accountId: string,
  organizationId: string,
  actor?: string,
): Promise<{ synced: boolean; newTransactions: number; balance: number }> {
  const account = await db.bankAccount.findFirst({
    where: { id: accountId, organizationId },
  });
  if (!account) return { synced: false, newTransactions: 0, balance: 0 };

  await db.bankAccount.update({
    where: { id: accountId },
    data: { status: 'syncing' },
  });

  try {
    const now = new Date();
    // Pull the last 3 days of transactions; generate 5-8 new ones if sparse.
    const recentCount = await db.bankTransaction.count({
      where: {
        accountId,
        date: { gte: daysAgo(3) },
      },
    });

    let newCount = 0;
    if (recentCount < 8) {
      const seed = accountId.charCodeAt(0) || 1;
      const numNew = Math.max(5, 8 - recentCount);
      let runningBalance = account.balance;
      for (let i = 0; i < numNew; i++) {
        const tpl = SYNC_TEMPLATES[(seed + i) % SYNC_TEMPLATES.length];
        const d = new Date(now.getTime() - i * 5 * 3_600_000); // every 5 hours
        const signedAmt = tpl.type === 'credit' ? tpl.amt : -tpl.amt;
        runningBalance = Math.round((runningBalance + signedAmt) * 100) / 100;
        const category = categorizeTransaction({
          description: tpl.desc,
          type: tpl.type as TransactionType,
          amount: tpl.amt,
        });
        const counterparty = extractCounterparty(tpl.desc);
        // De-dup by (accountId + date + amount + description) so re-sync is idempotent.
        const exists = await db.bankTransaction.findFirst({
          where: { accountId, date: d, amount: tpl.amt, description: tpl.desc },
          select: { id: true },
        });
        if (exists) continue;
        await db.bankTransaction.create({
          data: {
            organizationId,
            accountId,
            date: d,
            description: tpl.desc,
            narration: tpl.desc,
            amount: tpl.amt,
            type: tpl.type,
            balance: runningBalance,
            category,
            counterparty,
            status: 'posted',
            source: 'api',
          },
        });
        newCount++;
      }
      const totalDelta = Array.from({ length: newCount }, (_, i) => {
        const tpl = SYNC_TEMPLATES[(seed + i) % SYNC_TEMPLATES.length];
        return tpl.type === 'credit' ? tpl.amt : -tpl.amt;
      }).reduce((s, n) => s + n, 0);
      const newBalance = Math.round((account.balance + totalDelta) * 100) / 100;
      await db.bankAccount.update({
        where: { id: accountId },
        data: {
          balance: newBalance,
          availableBalance: newBalance,
          lastSyncAt: now,
          status: 'active',
        },
      });
      await writeAuditLog({
        organizationId,
        actor: actor || 'system',
        action: 'bank_account.sync',
        targetType: 'BankAccount',
        targetId: accountId,
        metadata: { newTransactions: newCount, newBalance },
      });
      return { synced: true, newTransactions: newCount, balance: newBalance };
    }

    await db.bankAccount.update({
      where: { id: accountId },
      data: { lastSyncAt: now, status: 'active' },
    });
    return { synced: true, newTransactions: 0, balance: account.balance };
  } catch (err) {
    await db.bankAccount.update({
      where: { id: accountId },
      data: { status: 'error' },
    });
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS — list (with filters), create, update, delete
// ═══════════════════════════════════════════════════════════════════════════════

export interface TransactionQuery {
  organizationId: string;
  accountId?: string;
  category?: string;
  type?: string;
  matched?: boolean;
  source?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export async function listTransactions(q: TransactionQuery): Promise<BankingTransactionListResult> {
  const where: Record<string, unknown> = { organizationId: q.organizationId };
  if (q.accountId) where.accountId = q.accountId;
  if (q.category) where.category = q.category;
  if (q.type) where.type = q.type;
  if (q.source) where.source = q.source;
  if (q.matched !== undefined) where.matched = q.matched;
  if (q.fromDate || q.toDate) {
    where.date = {};
    if (q.fromDate) (where.date as Record<string, unknown>).gte = new Date(q.fromDate);
    if (q.toDate) (where.date as Record<string, unknown>).lte = new Date(q.toDate);
  }
  if (q.search) {
    where.OR = [
      { description: { contains: q.search } },
      { counterparty: { contains: q.search } },
      { referenceNo: { contains: q.search } },
      { narration: { contains: q.search } },
    ];
  }

  const limit = Math.min(q.limit ?? 200, 500);
  const offset = q.offset ?? 0;
  const sortBy = q.sortBy ?? 'date';
  const sortDir = q.sortDir ?? 'desc';

  const [rows, total] = await Promise.all([
    db.bankTransaction.findMany({
      where,
      include: { account: { select: { bankName: true, accountMasked: true } } },
      orderBy: { [sortBy]: sortDir },
      take: limit,
      skip: offset,
    }),
    db.bankTransaction.count({ where }),
  ]);

  const transactions = rows.map(toTransactionDTO);
  const totalInflow = transactions
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);
  const totalOutflow = transactions
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + t.amount, 0);

  return {
    transactions,
    total,
    totalInflow,
    totalOutflow,
    netFlow: totalInflow - totalOutflow,
    hasLiveData: transactions.length > 0,
  };
}

export async function createTransaction(input: {
  organizationId: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category?: string;
  counterparty?: string;
  referenceNo?: string;
  narration?: string;
  balance?: number;
  source?: TransactionSource;
  notes?: string;
  createdBy?: string;
}): Promise<BankingTransaction> {
  const account = await db.bankAccount.findFirst({
    where: { id: input.accountId, organizationId: input.organizationId },
  });
  if (!account) throw new Error('Account not found in this organization.');

  const signedAmt = input.type === 'credit' ? input.amount : -input.amount;
  const newBalance = Math.round((account.balance + signedAmt) * 100) / 100;
  const category =
    (input.category as TransactionCategory) ||
    categorizeTransaction({
      description: input.description,
      type: input.type,
      amount: input.amount,
      counterparty: input.counterparty,
    });
  const counterparty = input.counterparty || extractCounterparty(input.description);

  const created = await db.bankTransaction.create({
    data: {
      organizationId: input.organizationId,
      accountId: input.accountId,
      date: new Date(input.date),
      description: input.description,
      narration: input.narration || input.description,
      amount: Math.abs(input.amount),
      type: input.type,
      balance: input.balance ?? newBalance,
      category,
      counterparty,
      referenceNo: input.referenceNo || null,
      reference: input.referenceNo || null,
      status: 'posted',
      source: input.source || 'manual',
      notes: input.notes || null,
    },
    include: { account: { select: { bankName: true, accountMasked: true } } },
  });

  // Update the account balance.
  await db.bankAccount.update({
    where: { id: input.accountId },
    data: { balance: newBalance, availableBalance: newBalance, lastSyncAt: new Date() },
  });

  await writeAuditLog({
    organizationId: input.organizationId,
    actor: input.createdBy || 'system',
    action: 'bank_transaction.create',
    targetType: 'BankTransaction',
    targetId: created.id,
    metadata: { amount: input.amount, type: input.type, accountId: input.accountId },
  });
  return toTransactionDTO(created);
}

export async function updateTransaction(
  txnId: string,
  organizationId: string,
  patch: Partial<{
    category: string;
    counterparty: string;
    notes: string;
    status: string;
    matched: boolean;
    matchedInvoiceId: string | null;
    matchType: string | null;
    matchConfidence: number;
    reconciledAt: Date | null;
    reconciledBy: string | null;
  }>,
  actor?: string,
): Promise<BankingTransaction | null> {
  // SECURITY: scope the update by both id AND organizationId — prevents an
  // authenticated caller in org A from patching a transaction in org B by
  // passing their own organizationId alongside a foreign txnId. Mirrors the
  // pattern used by deleteTransaction() below.
  const result = await db.bankTransaction.updateMany({
    where: { id: txnId, organizationId },
    data: patch,
  });
  if (result.count === 0) return null;
  const updated = await db.bankTransaction.findUnique({
    where: { id: txnId },
    include: { account: { select: { bankName: true, accountMasked: true } } },
  });
  if (!updated) return null;
  await writeAuditLog({
    organizationId,
    actor: actor || 'system',
    action: 'bank_transaction.update',
    targetType: 'BankTransaction',
    targetId: txnId,
    metadata: patch,
  });
  return toTransactionDTO(updated);
}

export async function deleteTransaction(txnId: string, organizationId: string, actor?: string): Promise<void> {
  await db.bankTransaction.deleteMany({ where: { id: txnId, organizationId } });
  await writeAuditLog({
    organizationId,
    actor: actor || 'system',
    action: 'bank_transaction.delete',
    targetType: 'BankTransaction',
    targetId: txnId,
  });
}

export async function bulkUpdateTransactions(
  txnIds: string[],
  organizationId: string,
  patch: Partial<Parameters<typeof updateTransaction>[2]>,
  actor?: string,
): Promise<{ updated: number }> {
  const result = await db.bankTransaction.updateMany({
    where: { id: { in: txnIds }, organizationId },
    data: patch,
  });
  await writeAuditLog({
    organizationId,
    actor: actor || 'system',
    action: 'bank_transaction.bulk_update',
    targetType: 'BankTransaction',
    targetId: null,
    metadata: { count: result.count, patch },
  });
  return { updated: result.count };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD SUMMARY — the 8 KPI cards + cash flow trend + recent transactions
// ═══════════════════════════════════════════════════════════════════════════════

export async function getDashboardSummary(organizationId: string): Promise<BankingDashboardSummary> {
  const [accounts, todayTxns, monthTxns, unmatchedCount, recentTxns] = await Promise.all([
    // NOTE: `transactions` include was REMOVED — the DTO only uses `balance`,
    // `availableBalance`, `status`, `lastSyncAt`, and `id` from this query.
    // Including transactions was loading the ENTIRE transaction history for
    // every account on every dashboard load (thousands of rows for active
    // orgs) and discarding it. Monthly inflow/outflow is computed from
    // `monthTxns` below, not from per-account transactions.
    db.bankAccount.findMany({
      where: { organizationId },
      select: {
        id: true,
        balance: true,
        availableBalance: true,
        status: true,
        lastSyncAt: true,
      },
    }),
    db.bankTransaction.findMany({
      where: { organizationId, date: { gte: startOfDay() } },
      select: { amount: true, type: true },
    }),
    db.bankTransaction.findMany({
      where: { organizationId, date: { gte: startOfMonth() } },
      select: { amount: true, type: true },
    }),
    db.bankTransaction.count({
      where: { organizationId, matched: false },
    }),
    db.bankTransaction.findMany({
      where: { organizationId },
      include: { account: { select: { bankName: true, accountMasked: true } } },
      orderBy: { date: 'desc' },
      take: 8,
    }),
  ]);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const availableBalance = accounts.reduce((s, a) => s + a.availableBalance, 0);
  const connectedAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.status === 'active').length;

  const todaysCredits = todayTxns
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const todaysDebits = todayTxns
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const monthlyInflow = monthTxns
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthlyOutflow = monthTxns
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  // Bank health score: weighted blend of active accounts ratio, reconciliation
  // rate, and cash-flow positive momentum. 0-100.
  // (Was 2 sequential counts — now a single Promise.all.)
  const [totalTxns, matchedTxns] = await Promise.all([
    db.bankTransaction.count({ where: { organizationId } }),
    db.bankTransaction.count({ where: { organizationId, matched: true } }),
  ]);
  const reconciliationRate = totalTxns > 0 ? matchedTxns / totalTxns : 0;
  const activeRatio = connectedAccounts > 0 ? activeAccounts / connectedAccounts : 0;
  const cashFlowPositive = monthlyInflow >= monthlyOutflow ? 1 : 0.5;
  const bankHealthScore = Math.round(
    (activeRatio * 30 + reconciliationRate * 40 + cashFlowPositive * 30) * 100,
  ) / 100;

  // Cash flow trend (last 14 days).
  // (Was N+1: 14 sequential findMany calls — now a single findMany for the
  // entire 14-day window, then bucketized in JS.)
  const trendWindowStart = new Date(startOfDay().getTime() - 13 * 86_400_000);
  const trendTxns = await db.bankTransaction.findMany({
    where: {
      organizationId,
      date: { gte: trendWindowStart },
    },
    select: { amount: true, type: true, date: true },
  });

  // Pre-build a per-day inflow/outflow map.
  const dayBuckets = new Map<string, { inflow: number; outflow: number }>();
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(startOfDay().getTime() - i * 86_400_000);
    const key = dayStart.toISOString().slice(0, 10);
    dayBuckets.set(key, { inflow: 0, outflow: 0 });
  }
  for (const t of trendTxns) {
    const d = t.date instanceof Date ? t.date : new Date(t.date);
    const key = d.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue; // txn outside the 14-day window
    const amt = Math.abs(t.amount);
    if (t.type === 'credit') bucket.inflow += amt;
    else bucket.outflow += amt;
  }

  const trend: BankingDashboardSummary['cashFlowTrend'] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(startOfDay().getTime() - i * 86_400_000);
    const key = dayStart.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key) ?? { inflow: 0, outflow: 0 };
    trend.push({
      date: dayStart.toISOString(),
      inflow: bucket.inflow,
      outflow: bucket.outflow,
      net: bucket.inflow - bucket.outflow,
      closingBalance: 0, // filled below
    });
  }
  // Fill closingBalance as a running cumulative from the oldest day.
  let running = totalBalance - trend.reduce((s, p) => s + p.net, 0);
  for (const p of trend) {
    running += p.net;
    p.closingBalance = running;
  }

  return {
    totalBalance,
    availableBalance,
    todaysCredits,
    todaysDebits,
    pendingReconciliation: unmatchedCount,
    connectedAccounts,
    cashFlow: { inflow: monthlyInflow, outflow: monthlyOutflow, net: monthlyInflow - monthlyOutflow },
    bankHealthScore,
    reconciliationRate: Math.round(reconciliationRate * 1000) / 10,
    monthlyInflow,
    monthlyOutflow,
    recentTransactions: recentTxns.map(toTransactionDTO),
    cashFlowTrend: trend,
    hasLiveData: connectedAccounts > 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER INFO — exposes which backend is active (for the UI badge)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getProviderInfo(): Promise<ProviderInfo> {
  // Lazy import so client code that imports types.ts doesn't pull server modules.
  const { describeProvider } = await import('@/lib/banking-provider/server/registry');
  return describeProvider();
}

// ─── Bank logo helper (deterministic brand-color badge) ───────────────────────

export function bankLogo(bankName: string): string {
  const map: Record<string, string> = {
    'HDFC Bank': '#004C8F',
    'ICICI Bank': '#F37D20',
    'Axis Bank': '#97144D',
    SBI: '#1E4DA8',
    'State Bank of India': '#1E4DA8',
    'Kotak Mahindra': '#ED1C24',
    'Kotak Mahindra Bank': '#ED1C24',
    'Yes Bank': '#00529B',
    'IndusInd Bank': '#5C2D91',
    'IDFC First Bank': '#A6093D',
    'Federal Bank': '#A4193D',
    'Punjab National Bank': '#B8B8B8',
    PNB: '#B8B8B8',
    'Bank of Baroda': '#F47B20',
  };
  return map[bankName] || '#1F2937';
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

async function writeAuditLog(input: {
  organizationId: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata?: unknown;
}): Promise<void> {
  try {
    // Only set userId if it looks like a real user id (not 'auto'/'system').
    // The AuditLog.userId has a FK to User.id, so passing a non-existent id
    // would throw a foreign-key constraint violation.
    const isRealUser = input.actor && input.actor !== 'auto' && input.actor !== 'system' && input.actor.length > 10;
    await db.auditLog.create({
      data: {
        userId: isRealUser ? input.actor : null,
        action: input.action,
        entity: input.targetType,
        entityId: input.targetId || null,
        details: JSON.stringify({ ...((input.metadata as Record<string, unknown>) ?? {}), actor: input.actor }),
      },
    });
  } catch {
    // Non-fatal — audit log failure should never break the main operation.
  }
}
