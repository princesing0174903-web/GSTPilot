// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Setu SDK — Transaction Mapping Helpers
// ═══════════════════════════════════════════════════════════════════════════════
//
// Converts Setu's `transactions.transaction[]` into our flat `BankingTransaction`
// shape. Reuses `extractCounterparty` from the banking-service rules engine so
// counterparty extraction is identical across providers.
//
// Key mapping rules:
//   - Transaction id is namespaced `setu:${orgId}:${accountId}:${txnId}`.
//   - amount is parsed from string → number (always positive).
//   - type is lowercased CREDIT/DEBIT → 'credit'|'debit'.
//   - counterparty extracted from narration via the shared rules helper.
//   - status defaults to 'unreconciled' (Setu doesn't tell us).
//   - category is NOT set here — the provider's applyRules pass categorizes.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BankingTransaction,
  TransactionType,
} from '@/lib/banking-service/types';
import { extractCounterparty } from '@/lib/banking-service/rules';
import type { SetuSession, SetuTransaction } from './types';
import { parseAmount } from './utils';
import { createHash } from 'node:crypto';

/**
 * Extract the transactions array for a specific account (by linkRefNumber)
 * from a Setu session. Returns an empty array if the account isn't present
 * or has no transactions.
 */
export function fetchTransactionsFromSession(
  session: SetuSession,
  accountId: string,
): SetuTransaction[] {
  // The caller passes either the namespaced id (`setu:orgId:linkRef`) or the
  // raw linkRefNumber. Accept either.
  const parts = accountId.split(':');
  const linkRef = parts.length >= 3 ? parts[parts.length - 1] : accountId;

  for (const fip of session.fips ?? []) {
    for (const acc of fip.accounts ?? []) {
      if (acc.linkRefNumber === linkRef || acc.data?.account?.linkedAccRef === linkRef) {
        return acc.data?.account?.transactions?.transaction ?? [];
      }
    }
  }
  return [];
}

/**
 * Stable id for a transaction when Setu didn't assign a txnId. Hashes the
 * narration + amount + timestamp so duplicate calls produce stable ids.
 */
function stableTxnId(tx: SetuTransaction, accountId: string, orgId: string): string {
  const key = `${orgId}|${accountId}|${tx.narration ?? ''}|${tx.amount}|${tx.transactionTimestamp ?? ''}`;
  const h = createHash('sha256').update(key).digest('hex').slice(0, 16);
  return `setu:${orgId}:${accountId}:${h}`;
}

/**
 * THE KEY MAPPING. Convert a Setu transaction to our `BankingTransaction`.
 *
 * @param tx Setu transaction object
 * @param accountId Namespaced account id (e.g. "setu:org-1:linkRef-123")
 * @param orgId VEYRO org id (used to namespace the transaction id)
 */
export function mapSetuTransactionToBanking(
  tx: SetuTransaction,
  accountId: string,
  orgId: string,
): BankingTransaction {
  // Strip the orgId prefix from accountId for the namespaced txn id.
  // accountId is `setu:orgId:linkRef` → we want `setu:orgId:linkRef:txnId`.
  const type: TransactionType =
    (tx.type ?? '').toLowerCase() === 'credit' ? 'credit' : 'debit';

  const description = tx.narration?.trim() || `${tx.mode ?? 'TXN'} ${tx.reference ?? ''}`.trim();
  const counterparty = extractCounterparty(description);
  const amount = parseAmount(tx.amount);
  const balanceAfter = tx.currentBalance ? parseAmount(tx.currentBalance) : undefined;

  const id = tx.txnId
    ? `setu:${orgId}:${accountId}:${tx.txnId}`
    : stableTxnId(tx, accountId, orgId);

  const now = new Date().toISOString();
  const date = tx.transactionTimestamp ?? tx.valueDate ?? now;

  return {
    id,
    accountId,
    date,
    description,
    counterparty,
    amount,
    type,
    referenceNo: tx.reference,
    balanceAfter,
    status: 'unreconciled',
    createdAt: now,
    updatedAt: now,
  };
}
