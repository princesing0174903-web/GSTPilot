// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Bank Connector™ — Account Aggregator Framework
// ═══════════════════════════════════════════════════════════════════════════════
//
// In production, bank data is fetched via the RBI Account Aggregator (AA) framework:
//   1. User consents to share financial data via an AA (e.g., OneMoney, Anumati)
//   2. VEYRO registers a consent request with the AA
//   3. User approves via the AA app
//   4. VEYRO fetches FI data (balances, transactions) from the AA
//
// This module provides the connection storage + transaction parsing structure.
// When a real AA API key is configured, actual transactions are fetched.
// Until then, the connection stores the user's bank details for Oracle awareness.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BankMetadata } from './types';
import { SUPPORTED_BANKS } from './types';

/** A bank transaction parsed from the AA feed or statement upload. */
export interface BankTransaction {
  transactionId: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  balanceAfter: number;
  category?: string;
  reconciled?: boolean;
}

/** Validate a bank account number format (basic sanity check). */
export function validateBankAccount(accountNumber: string): { valid: boolean; masked: string } {
  const cleaned = accountNumber.replace(/\s|-/g, '');
  const valid = /^\d{9,18}$/.test(cleaned);
  const masked = valid && cleaned.length >= 4
    ? '****' + cleaned.slice(-4)
    : cleaned.slice(-4).padStart(4, '*');
  return { valid, masked };
}

/** Look up a supported bank by code. */
export function getBankByCode(code: string) {
  return SUPPORTED_BANKS.find((b) => b.code === code.toLowerCase());
}

/** Create bank connection metadata from user input. */
export function createBankMetadata(
  bankCode: string,
  accountNumber: string,
  accountType: string = 'savings',
): BankMetadata {
  const bank = getBankByCode(bankCode);
  const { masked } = validateBankAccount(accountNumber);
  return {
    bankName: bank?.name ?? 'Unknown Bank',
    bankCode,
    accountNumberMasked: masked,
    accountType,
    currentBalance: 0,
    availableBalance: 0,
  };
}

/** Generate the label for a bank connection. */
export function bankConnectionLabel(metadata: BankMetadata): string {
  return `${metadata.bankName} ${metadata.accountNumberMasked}`;
}

/**
 * Parse transactions from an uploaded bank statement CSV/JSON.
 * In production, this would come from the AA API. Here we provide the parser
 * so statement uploads work immediately.
 */
export function parseTransactionsFromStatement(
  rows: Array<Record<string, string>>,
): BankTransaction[] {
  const transactions: BankTransaction[] = [];
  for (const row of rows) {
    const date = row['Date'] ?? row['date'] ?? row['Txn Date'] ?? '';
    const description = row['Description'] ?? row['Narration'] ?? row['Particulars'] ?? '';
    const amountStr = row['Amount'] ?? row['Withdrawal'] ?? row['Deposit'] ?? '0';
    const amount = parseFloat(String(amountStr).replace(/[₹,\s]/g, '')) || 0;
    const balanceStr = row['Balance'] ?? row['Running Balance'] ?? '0';
    const balance = parseFloat(String(balanceStr).replace(/[₹,\s]/g, '')) || 0;

    if (!date || !description) continue;

    // Determine credit vs debit — positive amount = credit, negative = debit
    // Some statements have separate Withdrawal/Deposit columns
    const withdrawal = parseFloat(String(row['Withdrawal'] ?? '0').replace(/[₹,\s]/g, '')) || 0;
    const deposit = parseFloat(String(row['Deposit'] ?? '0').replace(/[₹,\s]/g, '')) || 0;

    let type: 'credit' | 'debit';
    let finalAmount: number;
    if (deposit > 0) {
      type = 'credit';
      finalAmount = deposit;
    } else if (withdrawal > 0) {
      type = 'debit';
      finalAmount = withdrawal;
    } else {
      type = amount >= 0 ? 'credit' : 'debit';
      finalAmount = Math.abs(amount);
    }

    transactions.push({
      transactionId: `txn_${Date.now()}_${transactions.length}`,
      date,
      description,
      amount: finalAmount,
      type,
      balanceAfter: balance,
      category: categorizeTransaction(description),
      reconciled: false,
    });
  }
  return transactions;
}

/** Auto-categorize a bank transaction by description keywords. */
export function categorizeTransaction(description: string): string {
  const desc = description.toLowerCase();
  if (/salary|payroll|wages/.test(desc)) return 'payroll';
  if (/gst|tax|tds/.test(desc)) return 'tax';
  if (/rent/.test(desc)) return 'rent';
  if (/electricity|water|gas|internet|broadband/.test(desc)) return 'utilities';
  if (/salary|vendor|supplier|payment to/.test(desc)) return 'vendor_payment';
  if (/received from|neft|rtgs|imps|utr|collection/.test(desc)) return 'collection';
  if (/atm|cash withdrawal/.test(desc)) return 'cash';
  if (/upi/.test(desc)) return 'upi';
  if (/interest/.test(desc)) return 'interest';
  if (/charges|fee|penalty/.test(desc)) return 'charges';
  return 'other';
}

/** Compute cash position from transactions. */
export function computeCashPosition(transactions: BankTransaction[]): {
  totalCredits: number;
  totalDebits: number;
  netFlow: number;
  currentBalance: number;
  credits: BankTransaction[];
  debits: BankTransaction[];
  collections: BankTransaction[];
} {
  const credits = transactions.filter((t) => t.type === 'credit');
  const debits = transactions.filter((t) => t.type === 'debit');
  const totalCredits = credits.reduce((s, t) => s + t.amount, 0);
  const totalDebits = debits.reduce((s, t) => s + t.amount, 0);
  const collections = credits.filter((t) =>
    /collection|received from|neft|rtgs|imps|utr|payment received/i.test(t.description),
  );
  const currentBalance = transactions.length > 0
    ? transactions[transactions.length - 1].balanceAfter
    : 0;

  return {
    totalCredits,
    totalDebits,
    netFlow: totalCredits - totalDebits,
    currentBalance,
    credits,
    debits,
    collections,
  };
}
