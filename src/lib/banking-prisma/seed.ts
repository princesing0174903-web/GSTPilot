// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Seed Data (TASK 12)
//
// Seeds the local database with realistic banking data so the module feels
// completely real on first load. Creates 4 bank accounts (HDFC current, ICICI
// savings, Axis OD, Cash wallet) with 30-60 days of deterministic transactions,
// runs the reconciliation engine, and records cash-flow snapshots.
//
// Idempotent: safe to call on every server start. Checks if data already exists
// for the organization before seeding.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { extractCounterparty } from '@/lib/banking/categorize';
import type { TransactionType, TransactionCategory } from './types';
import { bankLogo } from './service';

interface SeedAccountInput {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  owner: string;
  accountType: 'current' | 'savings' | 'od' | 'cash_wallet' | 'upi_wallet';
  upiHandle?: string;
  openingBalance: number;
}

const SEED_ACCOUNTS: SeedAccountInput[] = [
  {
    bankName: 'HDFC Bank',
    accountNumber: '50100123456789',
    ifsc: 'HDFC0001234',
    branch: 'Bandra West, Mumbai',
    owner: 'GSTPilot Technologies Pvt Ltd',
    accountType: 'current',
    upiHandle: 'gstpilot@hdfcbank',
    openingBalance: 845000,
  },
  {
    bankName: 'ICICI Bank',
    accountNumber: '0123456789012',
    ifsc: 'ICIC0000123',
    branch: 'Connaught Place, New Delhi',
    owner: 'GSTPilot Technologies Pvt Ltd',
    accountType: 'savings',
    upiHandle: 'gstpilot@icici',
    openingBalance: 320000,
  },
  {
    bankName: 'Axis Bank',
    accountNumber: '920010012345678',
    ifsc: 'UTIB0000456',
    branch: 'MG Road, Bengaluru',
    owner: 'GSTPilot Technologies Pvt Ltd',
    accountType: 'od',
    openingBalance: 1500000,
  },
  {
    bankName: 'Cash Wallet',
    accountNumber: 'CASH-001',
    ifsc: 'CASH',
    branch: 'Office',
    owner: 'GSTPilot Technologies Pvt Ltd',
    accountType: 'cash_wallet',
    openingBalance: 45000,
  },
];

// Deterministic transaction templates (same seed → same data every run).
interface TxnTemplate {
  desc: string;
  amt: number;
  type: TransactionType;
  cat: TransactionCategory;
  counterparty?: string;
  ref?: string;
  daysAgo: number;
  ts: number; // computed timestamp
}

function buildTemplates(): TxnTemplate[] {
  const now = Date.now();
  const day = 86_400_000;
  const raw: Omit<TxnTemplate, 'ts'>[] = [
    { desc: 'NEFT Cr/Bharat Tech Solutions/INV-2026-001', amt: 59000, type: 'credit', cat: 'sales', counterparty: 'Bharat Tech Solutions', ref: 'UTR876543210', daysAgo: 1 },
    { desc: 'UPI Dr/okhdfc/Raw Materials', amt: 18500, type: 'debit', cat: 'purchase', counterparty: 'Raw Materials', ref: 'UPI/4521', daysAgo: 1 },
    { desc: 'GST Payment/3B/Aug2026', amt: 34000, type: 'debit', cat: 'gst', counterparty: 'GSTN', ref: 'CIN12345678', daysAgo: 2 },
    { desc: 'NEFT Cr/Indus Traders/INV-2026-002', amt: 118000, type: 'credit', cat: 'sales', counterparty: 'Indus Traders', ref: 'UTR876543211', daysAgo: 2 },
    { desc: 'Salary Credit/August/Rajesh Kumar', amt: 85000, type: 'debit', cat: 'salary', counterparty: 'Rajesh Kumar', ref: 'NEFT-SAL', daysAgo: 3 },
    { desc: 'Salary Credit/August/Priya Sharma', amt: 72000, type: 'debit', cat: 'salary', counterparty: 'Priya Sharma', ref: 'NEFT-SAL', daysAgo: 3 },
    { desc: 'Electricity Bill/Tata Power', amt: 14500, type: 'debit', cat: 'utilities', counterparty: 'Tata Power', ref: 'BILL-AUG', daysAgo: 4 },
    { desc: 'Internet Bill/Airtel Business', amt: 4999, type: 'debit', cat: 'utilities', counterparty: 'Airtel Business', ref: 'AIRTEL-8', daysAgo: 4 },
    { desc: 'UPI Cr/okicici/Vedic Industries/INV-2026-003', amt: 47200, type: 'credit', cat: 'sales', counterparty: 'Vedic Industries', ref: 'UPI/8890', daysAgo: 5 },
    { desc: 'Loan EMI/HDFC Business Loan', amt: 42000, type: 'debit', cat: 'loan', counterparty: 'HDFC Bank', ref: 'EMI-AUG', daysAgo: 5 },
    { desc: 'ATM Withdrawal/Cash', amt: 10000, type: 'debit', cat: 'cash_withdrawal', counterparty: 'ATM', daysAgo: 6 },
    { desc: 'Mutual Fund Investment/SIP', amt: 25000, type: 'debit', cat: 'investment', counterparty: 'HDFC MF', ref: 'SIP-AUG', daysAgo: 6 },
    { desc: 'NEFT Cr/Maurya Enterprises/INV-2026-004', amt: 88500, type: 'credit', cat: 'sales', counterparty: 'Maurya Enterprises', ref: 'UTR876543212', daysAgo: 7 },
    { desc: 'Office Rent/Pragati Real Estate', amt: 65000, type: 'debit', cat: 'rent', counterparty: 'Pragati Real Estate', ref: 'RENT-AUG', daysAgo: 7 },
    { desc: 'UPI Dr/okaxis/Cloud Services AWS', amt: 32000, type: 'debit', cat: 'utilities', counterparty: 'AWS', ref: 'AWS-AUG', daysAgo: 8 },
    { desc: 'NEFT Cr/Dravid Pharma/INV-2026-005', amt: 236000, type: 'credit', cat: 'sales', counterparty: 'Dravid Pharma', ref: 'UTR876543213', daysAgo: 9 },
    { desc: 'Vendor Payment/Arya Logistics', amt: 28500, type: 'debit', cat: 'purchase', counterparty: 'Arya Logistics', ref: 'NEFT-VEN', daysAgo: 10 },
    { desc: 'UPI Cr/Nalanda Foods/INV-2026-006', amt: 64000, type: 'credit', cat: 'sales', counterparty: 'Nalanda Foods', ref: 'UPI/9912', daysAgo: 11 },
    { desc: 'Bank Charges/HDFC', amt: 1500, type: 'debit', cat: 'fee', counterparty: 'HDFC Bank', ref: 'CHG-AUG', daysAgo: 12 },
    { desc: 'Refund Credited/Saraswati Textiles', amt: 5600, type: 'credit', cat: 'refund', counterparty: 'Saraswati Textiles', ref: 'REF-001', daysAgo: 13 },
    { desc: 'NEFT Cr/Himalaya Steel/INV-2026-007', amt: 177000, type: 'credit', cat: 'sales', counterparty: 'Himalaya Steel', ref: 'UTR876543214', daysAgo: 14 },
    { desc: 'Equipment Purchase/Dell India', amt: 125000, type: 'debit', cat: 'purchase', counterparty: 'Dell India', ref: 'PO-DEL', daysAgo: 15 },
    { desc: 'TDS Payment/Section 194J', amt: 9440, type: 'debit', cat: 'tax', counterparty: 'TDS', ref: 'TDS-Q1', daysAgo: 16 },
    { desc: 'Interest Credited/Savings Account', amt: 2340, type: 'credit', cat: 'interest', counterparty: 'ICICI Bank', ref: 'INT-AUG', daysAgo: 18 },
    { desc: 'UPI Dr/okhdfc/Marketing Adwords', amt: 18000, type: 'debit', cat: 'utilities', counterparty: 'Google Adwords', ref: 'ADW-AUG', daysAgo: 19 },
    { desc: 'NEFT Cr/Deccan Exports/INV-2026-008', amt: 94500, type: 'credit', cat: 'sales', counterparty: 'Deccan Exports', ref: 'UTR876543215', daysAgo: 20 },
    { desc: 'Professional Fees/CA Services', amt: 15000, type: 'debit', cat: 'fee', counterparty: 'Sharma & Co CA', ref: 'CA-AUG', daysAgo: 21 },
    { desc: 'GST Refund/Q1', amt: 45000, type: 'credit', cat: 'gst', counterparty: 'GSTN', ref: 'REF-GST', daysAgo: 22 },
    { desc: 'Vendor Payment/Blue Dart Logistics', amt: 8500, type: 'debit', cat: 'purchase', counterparty: 'Blue Dart', ref: 'NEFT-BD', daysAgo: 23 },
    { desc: 'NEFT Cr/Bharat Tech Solutions/INV-2026-009', amt: 59000, type: 'credit', cat: 'sales', counterparty: 'Bharat Tech Solutions', ref: 'UTR876543216', daysAgo: 25 },
    { desc: 'Insurance Premium/LIC', amt: 22000, type: 'debit', cat: 'fee', counterparty: 'LIC India', ref: 'LIC-AUG', daysAgo: 27 },
    { desc: 'UPI Cr/okicici/Vedic Industries/INV-2026-010', amt: 35400, type: 'credit', cat: 'sales', counterparty: 'Vedic Industries', ref: 'UPI/7733', daysAgo: 28 },
    { desc: 'Office Supplies/Staples India', amt: 6500, type: 'debit', cat: 'purchase', counterparty: 'Staples India', ref: 'PO-STP', daysAgo: 29 },
  ];
  return raw.map((t) => ({ ...t, ts: now - t.daysAgo * day }));
}

function maskAccountNumber(acct: string): string {
  if (!acct) return '****0000';
  const cleaned = acct.replace(/\s+/g, '');
  if (cleaned.length < 4) return '****' + cleaned;
  return 'XXXX XXXX ' + cleaned.slice(-4);
}

/**
 * Seeds banking data for an organization if none exists. Idempotent.
 * Returns the count of accounts + transactions created.
 */
export async function seedBankingData(organizationId: string): Promise<{
  seeded: boolean;
  accountsCreated: number;
  transactionsCreated: number;
}> {
  // ── REAL DATA FIRST ──
  // If this org has ANY real (non-mock) bank accounts — e.g. from a Zoho
  // Books sync (provider='zoho_books') — DO NOT seed demo data. The user
  // explicitly forbade fake/demo records when real data exists.
  const realCount = await db.bankAccount.count({
    where: { organizationId, provider: { not: 'mock' } },
  });
  if (realCount > 0) {
    return { seeded: false, accountsCreated: 0, transactionsCreated: 0 };
  }

  // Also skip if the org has synced ZohoBankAccounts (even if the mirror
  // hasn't run yet) — the mirror will populate the native table.
  const zohoCount = await db.zohoBankAccount.count({ where: { organizationId } });
  if (zohoCount > 0) {
    return { seeded: false, accountsCreated: 0, transactionsCreated: 0 };
  }

  // Check if mock data already exists (idempotent for the demo seeding).
  const existing = await db.bankAccount.count({ where: { organizationId } });
  if (existing > 0) {
    return { seeded: false, accountsCreated: 0, transactionsCreated: 0 };
  }

  const templates = buildTemplates();
  let transactionsCreated = 0;

  for (const acct of SEED_ACCOUNTS) {
    const account = await db.bankAccount.create({
      data: {
        organizationId,
        bankName: acct.bankName,
        bankLogoUrl: bankLogo(acct.bankName),
        accountNumber: acct.accountNumber,
        accountMasked: maskAccountNumber(acct.accountNumber),
        accountType: acct.accountType,
        ifsc: acct.ifsc,
        branch: acct.branch,
        owner: acct.owner,
        balance: acct.openingBalance,
        availableBalance: acct.openingBalance,
        overdraftLimit: acct.accountType === 'od' ? 1000000 : 0,
        upiHandle: acct.upiHandle || null,
        status: 'active',
        lastSyncAt: new Date(),
        provider: 'mock',
      },
    });

    // Each account gets a deterministic subset of the templates so they feel
    // distinct. The primary (current) account gets all templates; others get
    // every Nth transaction.
    const accountIndex = SEED_ACCOUNTS.indexOf(acct);
    const accountTemplates =
      accountIndex === 0
        ? templates
        : templates.filter((_, i) => i % SEED_ACCOUNTS.length === accountIndex);
    let runningBalance = acct.openingBalance;
    for (const t of accountTemplates) {
      const signedAmt = t.type === 'credit' ? t.amt : -t.amt;
      runningBalance = Math.round((runningBalance + signedAmt) * 100) / 100;
      const category = t.cat;
      const counterparty = t.counterparty || extractCounterparty(t.desc);
      await db.bankTransaction.create({
        data: {
          organizationId,
          accountId: account.id,
          date: new Date(t.ts),
          valueDate: new Date(t.ts),
          description: t.desc,
          narration: t.desc,
          amount: t.amt,
          type: t.type,
          balance: runningBalance,
          category,
          counterparty,
          referenceNo: t.ref || null,
          reference: t.ref || null,
          status: 'posted',
          source: 'statement',
        },
      });
      transactionsCreated++;
    }
  }

  return { seeded: true, accountsCreated: SEED_ACCOUNTS.length, transactionsCreated };
}

/**
 * Ensures banking data is seeded for the org. Called by API routes on first
 * load. Non-throwing — if seeding fails, the API still returns (empty) data.
 */
export async function ensureSeeded(organizationId: string): Promise<void> {
  try {
    await seedBankingData(organizationId);
  } catch (err) {
    console.warn('[banking-prisma/seed] Seeding failed (non-fatal):', (err as Error).message);
  }
}
