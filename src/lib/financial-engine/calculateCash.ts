// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Cash & Bank Balance Calculator
//
// Cash = sum of all connected bank account balances.
// This is the ONLY place where bank balance is computed.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BankAccountRow } from './types';

export interface CashResult {
  bankBalance: number;       // sum of all account balances
  availableBalance: number;  // available (includes overdraft headroom)
  overdraftLimit: number;    // total overdraft facility
  accountCount: number;
  connectedCount: number;
}

/**
 * Calculates total cash position from connected bank accounts.
 *
 * Only counts accounts with status "connected" or "syncing".
 * Disconnected or errored accounts are excluded.
 */
export function calculateCash(
  bankAccounts: BankAccountRow[],
): CashResult {
  let bankBalance = 0;
  let availableBalance = 0;
  let overdraftLimit = 0;
  let connectedCount = 0;

  for (const acct of bankAccounts) {
    if (acct.status === 'disconnected' || acct.status === 'error') continue;
    bankBalance += acct.balance;
    availableBalance += acct.availableBalance;
    overdraftLimit += acct.overdraftLimit;
    connectedCount += 1;
  }

  return {
    bankBalance: round2(bankBalance),
    availableBalance: round2(availableBalance),
    overdraftLimit: round2(overdraftLimit),
    accountCount: bankAccounts.length,
    connectedCount,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
