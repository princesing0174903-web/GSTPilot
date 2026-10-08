// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Cloud™ — Module 1: Bank Account Integration
// Deterministic engine. Reads from Prisma. No LLM.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BankAccountDTO, BankAccountListResult } from './types';
import { SUPPORTED_BANKS } from './types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function maskAccountNumber(acct: string): string {
  if (!acct || acct.length < 4) return '****' + acct;
  return '****' + acct.slice(-4);
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

function isToday(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ─── DTO builder ───────────────────────────────────────────────────────────────

function toDTO(
  row: {
    id: string;
    businessId: string | null;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountType: string;
    currentBalance: number;
    lastSyncAt: Date | null;
    status: string;
    aaConnected: boolean;
    aaConsentExpiry: Date | null;
    createdAt: Date;
    transactions: { amount: number; date: string; type: string }[];
  },
): BankAccountDTO {
  const monthStart = startOfMonth();
  const monthTxns = row.transactions.filter((t) => new Date(t.date) >= monthStart);
  const monthlyInflow = monthTxns
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthlyOutflow = monthTxns
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    id: row.id,
    businessId: row.businessId || 'firm',
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountNumberMasked: maskAccountNumber(row.accountNumber),
    ifsc: row.ifsc,
    accountType: (row.accountType as 'current' | 'savings') || 'current',
    currentBalance: row.currentBalance,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    lastSyncAgo: timeAgo(row.lastSyncAt),
    status: (row.status as 'active' | 'paused' | 'syncing' | 'error') || 'active',
    aaConnected: row.aaConnected,
    aaConsentExpiry: row.aaConsentExpiry ? row.aaConsentExpiry.toISOString() : null,
    transactionCount: row.transactions.length,
    monthlyInflow,
    monthlyOutflow,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getAccounts(): Promise<BankAccountListResult> {
  const rows = await db.bankAccount.findMany({
    include: {
      transactions: {
        select: { amount: true, date: true, type: true },
        orderBy: { date: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const accounts = rows.map(toDTO);
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);
  const activeAccounts = accounts.filter((a) => a.status === 'active').length;
  const syncedToday = accounts.filter((a) => isToday(a.lastSyncAt ? new Date(a.lastSyncAt) : null)).length;

  return {
    accounts,
    totalBalance,
    totalAccounts: accounts.length,
    activeAccounts,
    syncedToday,
    hasLiveData: accounts.length > 0,
  };
}

export async function connectAccount(input: {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  accountType?: string;
}): Promise<BankAccountDTO> {
  const bankName = input.bankName?.trim() || 'HDFC Bank';
  const isSupported = (SUPPORTED_BANKS as readonly string[]).includes(bankName);
  const created = await db.bankAccount.create({
    data: {
      businessId: 'firm',
      bankName: isSupported ? bankName : 'HDFC Bank',
      accountNumber: input.accountNumber.trim(),
      ifsc: input.ifsc.trim().toUpperCase(),
      accountType: input.accountType || 'current',
      currentBalance: 0,
      status: 'active',
      lastSyncAt: new Date(),
    },
    include: {
      transactions: { select: { amount: true, date: true, type: true }, orderBy: { date: 'desc' } },
    },
  });
  return toDTO(created);
}

export async function syncAccount(accountId: string): Promise<{ synced: boolean; newTransactions: number; balance: number }> {
  // Deterministic simulated sync — generates recent transactions for the account.
  const account = await db.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) return { synced: false, newTransactions: 0, balance: 0 };

  // Generate up to 5 new deterministic transactions for the last 3 days if none recent.
  const now = new Date();
  const recentTxns = await db.bankTransaction.count({
    where: { accountId, date: { gte: new Date(now.getTime() - 3 * 86_400_000).toISOString() } },
  });

  let newCount = 0;
  if (recentTxns < 5) {
    const seed = accountId.charCodeAt(0) || 1;
    const samples = [
      { desc: 'UPI/4521/ABC CORP', amt: 45000, type: 'credit', cat: 'sales' },
      { desc: 'NEFT/SALARY/AUG', amt: -85000, type: 'debit', cat: 'salary' },
      { desc: 'UPI/8890/VENDOR XY', amt: -12800, type: 'debit', cat: 'vendor' },
      { desc: 'GST PAYMENT/3B', amt: -34000, type: 'debit', cat: 'gst' },
      { desc: 'UPI/Refund/INV22', amt: 5600, type: 'credit', cat: 'refund' },
    ];
    for (let i = 0; i < samples.length; i++) {
      const s = samples[(seed + i) % samples.length];
      const d = new Date(now.getTime() - i * 7 * 3_600_000);
      await db.bankTransaction.create({
        data: {
          accountId,
          date: d.toISOString(),
          description: s.desc,
          amount: s.amt,
          type: s.type,
          category: s.cat,
          balance: account.currentBalance + s.amt,
          source: 'statement',
        },
      });
      newCount++;
    }
    const totalDelta = samples.reduce((sum, s) => sum + s.amt, 0);
    await db.bankAccount.update({
      where: { id: accountId },
      data: { currentBalance: account.currentBalance + totalDelta, lastSyncAt: now, status: 'active' },
    });
    return { synced: true, newTransactions: newCount, balance: account.currentBalance + totalDelta };
  }

  await db.bankAccount.update({ where: { id: accountId }, data: { lastSyncAt: now, status: 'active' } });
  return { synced: true, newTransactions: 0, balance: account.currentBalance };
}

export async function deleteAccount(accountId: string): Promise<{ deleted: boolean }> {
  await db.bankTransaction.deleteMany({ where: { accountId } });
  await db.bankAccount.delete({ where: { id: accountId } });
  return { deleted: true };
}

export { SUPPORTED_BANKS };
