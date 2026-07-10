// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Bank Data Generator
//
// NOTE ON DATA SOURCING:
// This module produces REALISTIC bank transactions deterministically derived
// from the connected bank provider + a seeded account number. In production
// with bank API partnerships (Razorpay, Decentro, MBS, etc.), the
// `generateBankDataset` function would be replaced with live bank API calls.
// The schema, storage, Oracle context, and UI are all designed to consume
// real data — only the fetch layer is simulated.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BankProvider, BankDataset, BankTransactionRecord } from './types';

// ─── Deterministic PRNG ─────────────────────────────────────────────────────────
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

function providerSeed(provider: BankProvider, accountRef: string): number {
  const s = provider + ':' + accountRef;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }
function round2(n: number): number { return Math.round(n * 100) / 100; }
function roundTo(n: number, step: number): number { return Math.round(n / step) * step; }

function isoDate(d: Date): string { return d.toISOString().split('T')[0]; }

// ─── Counterparties ─────────────────────────────────────────────────────────────
const CUSTOMERS = [
  'Patel Enterprises', 'Sharma Traders', 'Reddy Industries', 'Mehta Exports',
  'Singh Manufacturing', 'Gupta & Sons', 'Kumar Distributors', 'Jain Supplies',
  'Verma Tech', 'Iyer Logistics', 'Nair Wholesale', 'Bose Electronics',
];

const VENDORS = [
  'Raw Materials Co', 'Aditya Logistics', 'Reliance Power', 'Tata Steel Supplier',
  'BlueDart Express', 'AWS Cloud Services', 'Microsoft 365', 'Jio Business',
  'Office Depot', 'Airtel Business',
];

const TAX_DESCRIPTONS = ['GST TAX PAYMENT', 'TDS PAYMENT Q', 'ADVANCE TAX PAYMENT'];
const SALARY_DESCRIPTIONS = ['SALARY - EMP', 'SALARY PAYOUT', 'PAYROLL - STAFF'];

// ─── Generate 90 days of transactions ───────────────────────────────────────────
export function generateBankDataset(
  provider: BankProvider,
  accountRef: string,
  days = 90,
): BankDataset {
  const rng = mulberry32(providerSeed(provider, accountRef));
  const maskedAccount = 'XXXXXX' + accountRef.slice(-4);

  const transactions: BankTransactionRecord[] = [];
  const now = new Date();
  // Opening balance ~ ₹8-15 lakh for a healthy SME
  let balance = roundTo(800000 + rng() * 700000, 1000);

  // Walk backwards from today, generating transactions per day
  for (let i = days; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    // Skip Sundays (no banking)
    if (day.getDay() === 0) continue;

    const dayTxns: BankTransactionRecord[] = [];

    // 0-3 sales credits per working day
    const salesCount = Math.floor(rng() * 4);
    for (let s = 0; s < salesCount; s++) {
      const amount = roundTo(25000 + rng() * 380000, 100);
      balance = round2(balance + amount);
      dayTxns.push({
        txnDate: isoDate(day),
        description: `NEFT CR-${pick(rng, CUSTOMERS)}`.toUpperCase(),
        amount,
        type: 'credit',
        category: 'sales',
        counterparty: pick(rng, CUSTOMERS),
        referenceNo: `N${Math.floor(rng() * 9e9 + 1e9)}`,
        balanceAfter: balance,
      });
    }

    // Vendor / expense payments (1-3 per day)
    const expenseCount = Math.floor(rng() * 3) + 1;
    for (let e = 0; e < expenseCount; e++) {
      const amount = roundTo(8000 + rng() * 95000, 100);
      balance = round2(balance - amount);
      dayTxns.push({
        txnDate: isoDate(day),
        description: `UPI DR-${pick(rng, VENDORS)}`.toUpperCase(),
        amount: -amount,
        type: 'debit',
        category: 'vendor',
        counterparty: pick(rng, VENDORS),
        referenceNo: `U${Math.floor(rng() * 9e9 + 1e9)}`,
        balanceAfter: balance,
      });
    }

    // Monthly salary payout (on the 1st or last working day of month)
    const dayOfMonth = day.getDate();
    if (dayOfMonth === 1 || (dayOfMonth === 2 && day.getDay() === 1)) {
      const amount = roundTo(280000 + rng() * 120000, 1000);
      balance = round2(balance - amount);
      dayTxns.push({
        txnDate: isoDate(day),
        description: pick(rng, SALARY_DESCRIPTIONS),
        amount: -amount,
        type: 'debit',
        category: 'salary',
        counterparty: 'Staff Payroll',
        referenceNo: `SAL${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}`,
        balanceAfter: balance,
      });
    }

    // Monthly GST tax payment (around the 20th)
    if (dayOfMonth === 20) {
      const amount = roundTo(180000 + rng() * 140000, 1000);
      balance = round2(balance - amount);
      dayTxns.push({
        txnDate: isoDate(day),
        description: pick(rng, TAX_DESCRIPTONS),
        amount: -amount,
        type: 'debit',
        category: 'tax_payment',
        counterparty: 'GSTN CBIC',
        referenceNo: `CPM${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}`,
        balanceAfter: balance,
      });
    }

    // Interest credit (quarterly, ~1st of quarter months)
    if ([1, 4, 7, 10].includes(day.getMonth() + 1) && dayOfMonth === 1) {
      const amount = round2(4200 + rng() * 3800);
      balance = round2(balance + amount);
      dayTxns.push({
        txnDate: isoDate(day),
        description: 'INTEREST CREDIT',
        amount,
        type: 'credit',
        category: 'interest',
        counterparty: provider,
        referenceNo: `INT${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}`,
        balanceAfter: balance,
      });
    }

    // Loan EMI (5th of each month)
    if (dayOfMonth === 5) {
      const amount = roundTo(85000 + rng() * 25000, 1000);
      balance = round2(balance - amount);
      dayTxns.push({
        txnDate: isoDate(day),
        description: 'LOAN EMI - WORKING CAPITAL',
        amount: -amount,
        type: 'debit',
        category: 'loan',
        counterparty: provider + ' Loan',
        referenceNo: `EMI${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}`,
        balanceAfter: balance,
      });
    }

    // Sort the day's transactions and append
    transactions.push(...dayTxns.sort((a, b) => a.referenceNo!.localeCompare(b.referenceNo!)));
  }

  transactions.sort((a, b) => a.txnDate.localeCompare(b.txnDate) || a.referenceNo!.localeCompare(b.referenceNo!));

  // Recompute running balance to be safe
  let running = balance - transactions.reduce((sum, t) => sum + t.amount, 0);
  for (const t of transactions) {
    running = round2(running + t.amount);
    t.balanceAfter = running;
  }
  const openingBalance = round2(running);
  const closingBalance = round2(running + transactions.reduce((sum, t) => sum + t.amount, 0));

  const totalCredits = round2(
    transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0),
  );
  const totalDebits = round2(
    Math.abs(transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)),
  );

  // Monthly collections vs expenses (last 3 months)
  const monthlyCollections = computeMonthly(transactions, 3);

  return {
    provider,
    maskedAccount,
    accountType: 'current',
    openingBalance,
    closingBalance,
    totalCredits,
    totalDebits,
    transactions,
    monthlyCollections,
  };
}

function computeMonthly(txns: BankTransactionRecord[], months: number): { month: string; collections: number; expenses: number }[] {
  const out: { month: string; collections: number; expenses: number }[] = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthTxns = txns.filter(t => t.txnDate.startsWith(period));
    out.push({
      month: period,
      collections: round2(monthTxns.filter(t => t.type === 'credit' && t.category === 'sales').reduce((s, t) => s + t.amount, 0)),
      expenses: round2(Math.abs(monthTxns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0))),
    });
  }
  return out.reverse(); // oldest → newest
}
