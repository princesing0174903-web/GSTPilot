// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Banking Collector
//
// Reads real bank accounts + transactions from Prisma. Computes aggregate
// cash position (total balance, recent 30-day inflow/outflow/net, unmatched
// transactions) that the cashflow analyzer consumes.
//
// Graceful contract: if no bank accounts / transactions exist, returns an
// empty BankingData with connected=false — never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';

import { db } from '@/lib/db';
import type {
  BankAccountSummary,
  BankTransactionSummary,
  BankingData,
  Collector,
  CollectorContext,
  CollectorResult,
} from '../types';

function emptyData(): BankingData {
  return {
    accounts: [],
    transactions: [],
    totals: {
      totalBalance: 0,
      availableBalance: 0,
      recentCredits: 0,
      recentDebits: 0,
      netFlow: 0,
      unmatchedTransactions: 0,
    },
  };
}

export const bankingCollector: Collector<BankingData> = {
  id: 'banking',
  label: 'Banking',
  async collect(_ctx: CollectorContext): Promise<CollectorResult<BankingData>> {
    const collectedAt = new Date().toISOString();

    try {
      const [accounts, transactions] = await Promise.all([
        db.bankAccount.findMany({ take: 50 }).catch(() => []),
        db.bankTransaction.findMany({
          take: 500,
          orderBy: { date: 'desc' },
        }).catch(() => []),
      ]);

      const accountSummaries: BankAccountSummary[] = accounts.map((a) => ({
        id: a.id,
        bankName: a.bankName,
        accountMasked: a.accountMasked,
        accountType: a.accountType,
        balance: a.balance,
        availableBalance: a.availableBalance,
        overdraftLimit: a.overdraftLimit,
        status: a.status,
        lastSyncAt: a.lastSyncAt ? a.lastSyncAt.toISOString() : null,
      }));

      const transactionSummaries: BankTransactionSummary[] = transactions.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        date: t.date.toISOString(),
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category,
        referenceNo: t.referenceNo,
        matched: t.matched,
        balanceAfter: t.balanceAfter,
      }));

      // ── Aggregate totals (last 30 days for "recent" metrics) ─────────────
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent = transactionSummaries.filter((t) => Date.parse(t.date) >= thirtyDaysAgo);

      const recentCredits = recent
        .filter((t) => t.type === 'credit')
        .reduce((s, t) => s + (t.amount || 0), 0);
      const recentDebits = recent
        .filter((t) => t.type === 'debit')
        .reduce((s, t) => s + (t.amount || 0), 0);

      const totalBalance = accountSummaries.reduce((s, a) => s + (a.balance || 0), 0);
      const availableBalance = accountSummaries.reduce((s, a) => s + (a.availableBalance || 0), 0);
      const unmatchedTransactions = transactionSummaries.filter((t) => !t.matched).length;

      const data: BankingData = {
        accounts: accountSummaries,
        transactions: transactionSummaries,
        totals: {
          totalBalance,
          availableBalance,
          recentCredits,
          recentDebits,
          netFlow: recentCredits - recentDebits,
          unmatchedTransactions,
        },
      };

      const totalRecords = accountSummaries.length + transactionSummaries.length;
      return {
        source: 'banking',
        connected: totalRecords > 0,
        recordCount: totalRecords,
        data,
        collectedAt,
      };
    } catch (err) {
      return {
        source: 'banking',
        connected: false,
        recordCount: 0,
        data: emptyData(),
        error: err instanceof Error ? err.message : 'Banking collector failed.',
        collectedAt,
      };
    }
  },
};
