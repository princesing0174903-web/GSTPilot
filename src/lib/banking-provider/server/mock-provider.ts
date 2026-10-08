// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Banking Foundation™ — MockBankProvider (SERVER-ONLY)
//
// The default provider. Produces DETERMINISTIC, realistic-looking banking data
// seeded by account number — the same account always returns the same balances,
// the same transaction history, the same counterparties. This lets the UI feel
// real without ever touching production bank / AA APIs.
//
// This file is SERVER-ONLY (uses node:crypto for deterministic seeding). It
// should NEVER be imported by client code. API routes are the only consumers.
//
// When you're ready to go live: set `BANK_PROVIDER=<aa|razorpayx|setu|perfios|finvu>`
// in env, configure the provider credentials, and the registry will swap to the
// appropriate Future*Provider → real production calls.
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import type { IBankProvider, BankSession } from '../provider';
import type {
  BankAccountSnapshot,
  BankTransaction,
  BankTransactionType,
  ConnectBankResult,
  FetchAccountsResult,
  FetchTransactionsResult,
  TransactionCategory,
} from '../types';
import { categorizeTransaction, extractCounterparty } from '@/lib/banking/categorize';
import { ValidationError } from '../errors';

// ─── Deterministic PRNG (seeded by account number) ───────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  return crypto.createHash('sha1').update(input).digest().readUInt32LE(0);
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.replace(/\s+/g, '');
  if (cleaned.length < 4) {
    throw new ValidationError('Account number must be at least 4 digits.');
  }
  return 'XXXX XXXX ' + cleaned.slice(-4);
}

function isValidIfsc(ifsc: string): boolean {
  // IFSC = 4 letters + 0 + 6 alphanumeric = 11 chars
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

// ─── Deterministic data pools ────────────────────────────────────────────────

const BANK_NAMES = [
  'HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank',
  'Yes Bank', 'IndusInd Bank', 'IDFC First Bank', 'Federal Bank', 'Punjab National Bank',
];

const CUSTOMER_NAMES = [
  'Bharat Tech Solutions', 'Indus Traders', 'Vedic Industries', 'Maurya Enterprises',
  'Dravid Pharma', 'Arya Logistics', 'Nalanda Foods', 'Saraswati Textiles',
  'Himalaya Steel', 'Deccan Exports',
];

const VENDOR_NAMES = [
  'Reliance Jio', 'Tata Communications', 'Airtel Business', 'BSNL Corporate',
  'Adani Electricity', 'Tata Power', 'Mahindra Logistics', 'Blue Dart',
  'GAIL Limited', 'Indian Oil Corp',
];

const UPI_HANDLES = ['okhdfc', 'okicici', 'okaxis', 'oksbi', 'okkotak'];

// ─── In-memory connection store (mock) ───────────────────────────────────────
// In production, the AA / bank tracks connection state. The mock has to do it
// locally. We keep connectionRef → account info so completeConnection can
// reconstruct the session.

interface MockConnectionEntry {
  connectionRef: string;
  accountNumber: string;
  accountNumberMasked: string;
  ifsc: string;
  accountHolder: string;
  bankName: string;
  accountType: 'savings' | 'current' | 'credit' | 'loan' | 'unknown';
  createdAt: number;
}

const connectionStore = new Map<string, MockConnectionEntry>();

// ─── Transaction generator ───────────────────────────────────────────────────

function generateTransactions(
  rng: () => number,
  connectionId: string,
  accountId: string,
  organizationId: string,
  from?: string,
  to?: string,
): BankTransaction[] {
  const transactions: BankTransaction[] = [];
  const now = new Date();

  // Default: last 30 days. Honor from/to if provided.
  const startDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to) : now;
  if (startDate > endDate) return [];

  // Seeded starting balance so the running balance is deterministic.
  let runningBalance = round2(randInt(rng, 50_000, 500_000));
  const startBalance = runningBalance;

  // Generate 15-40 transactions across the period.
  const count = randInt(rng, 15, 40);
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

  for (let i = 0; i < count; i++) {
    // Spread transactions across the date range.
    const dayOffset = Math.floor((i / count) * totalDays) + randInt(rng, 0, 1);
    const txDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    if (txDate > endDate) continue;

    // Decide transaction type: ~55% debit (outgoing), ~45% credit (incoming).
    const type: BankTransactionType = rng() < 0.55 ? 'debit' : 'credit';
    const amount = round2(randInt(rng, 500, 80_000));

    // Build a realistic description.
    let description: string;
    let counterparty: string | null = null;
    let referenceNumber: string | null = null;

    if (type === 'credit') {
      // Incoming — usually a customer payment or UPI credit.
      if (rng() < 0.7) {
        counterparty = pick(rng, CUSTOMER_NAMES);
        description = `NEFT Cr ${counterparty} UTR${randInt(rng, 10_000_000, 99_999_999)}`;
        referenceNumber = `UTR${randInt(rng, 10_000_000, 99_999_999)}`;
      } else {
        description = pick(rng, [
          `UPI Cr ${pick(rng, UPI_HANDLES)}/${pick(rng, CUSTOMER_NAMES).split(' ')[0]}`,
          `RTGS Cr ${pick(rng, CUSTOMER_NAMES)}`,
          'Interest Credited',
          'Refund Credited',
        ]);
      }
      runningBalance = round2(runningBalance + amount);
    } else {
      // Outgoing — vendor payment, salary, rent, utilities, GST, etc.
      const kind = rng();
      if (kind < 0.3) {
        counterparty = pick(rng, VENDOR_NAMES);
        description = `NEFT Dr ${counterparty} UTR${randInt(rng, 10_000_000, 99_999_999)}`;
        referenceNumber = `UTR${randInt(rng, 10_000_000, 99_999_999)}`;
      } else if (kind < 0.45) {
        description = `UPI Dr ${pick(rng, UPI_HANDLES)}/${pick(rng, VENDOR_NAMES).split(' ')[0]}`;
      } else if (kind < 0.6) {
        description = 'GST Payment CIN';
        referenceNumber = `CIN${randInt(rng, 10_000_000, 99_999_999)}`;
      } else if (kind < 0.7) {
        description = 'Salary Credit - Employee';
      } else if (kind < 0.8) {
        description = 'ATM Withdrawal';
      } else if (kind < 0.88) {
        description = 'Electricity Bill Payment';
      } else if (kind < 0.94) {
        description = 'Loan EMI';
      } else {
        description = 'Mutual Fund Investment';
      }
      runningBalance = round2(runningBalance - amount);
    }

    const category: TransactionCategory = categorizeTransaction({
      description,
      type,
      amount,
      counterparty,
    });
    // Re-extract counterparty if categorizer found one we missed.
    if (!counterparty) {
      counterparty = extractCounterparty(description);
    }

    const id = `${accountId}-${txDate.toISOString().slice(0, 10)}-${i}-${Math.floor(rng() * 1e6)}`;
    transactions.push({
      id,
      organizationId,
      connectionId,
      accountId,
      date: txDate.toISOString().slice(0, 10),
      description,
      amount,
      type,
      balance: runningBalance,
      category,
      counterparty,
      referenceNumber,
      invoiceId: null, // set by the reconciliation engine
      reconciled: 'unmatched',
      matchConfidence: 0,
      syncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Sort by date descending (most recent first) — matches dashboard convention.
  transactions.sort((a, b) => (a.date < b.date ? 1 : -1));

  // Reset running balance reference (unused but kept for clarity).
  void startBalance;
  return transactions;
}

// ─── MockBankProvider ─────────────────────────────────────────────────────────

export class MockBankProvider implements IBankProvider {
  // Premium, honest labelling: this is a "Sandbox" provider (real software
  // running on seeded test data), not a "mock". The UI surfaces this name to
  // users, so it must read as a deliberate testing environment.
  readonly name = 'Sandbox Banking Environment';
  readonly provider = 'mock' as const;
  readonly isLive = false;

  async connect(input: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountType: 'savings' | 'current' | 'credit' | 'loan' | 'unknown';
    consentHandle?: string;
  }): Promise<ConnectBankResult> {
    if (!input.accountHolder || input.accountHolder.trim().length < 2) {
      throw new ValidationError('Account holder name must be at least 2 characters.');
    }
    if (!input.accountNumber || input.accountNumber.replace(/\s+/g, '').length < 4) {
      throw new ValidationError('A valid account number is required.');
    }
    if (!isValidIfsc(input.ifsc)) {
      throw new ValidationError('Invalid IFSC code. Expected 11 chars (e.g. HDFC0001234).');
    }

    const connectionRef = `MOCK-BANK-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const masked = maskAccountNumber(input.accountNumber);

    connectionStore.set(connectionRef, {
      connectionRef,
      accountNumber: input.accountNumber.replace(/\s+/g, ''),
      accountNumberMasked: masked,
      ifsc: input.ifsc.toUpperCase(),
      accountHolder: input.accountHolder.trim(),
      bankName: input.bankName || pick(mulberry32(hashSeed(input.accountNumber)), BANK_NAMES),
      accountType: input.accountType,
      createdAt: Date.now(),
    });

    return {
      connectionRef,
      consentSentTo: null,
      accountNumberMasked: masked,
      accountSnapshot: null,
      message:
        'Mock bank connection initiated. In production, this would trigger the AA consent flow or credential validation. The connection is immediately ready (no real OTP needed).',
    };
  }

  async completeConnection(connectionRef: string): Promise<{
    session: BankSession;
    snapshot: BankAccountSnapshot;
  }> {
    const entry = connectionStore.get(connectionRef);
    if (!entry) {
      throw new ValidationError('Connection reference not found. Please restart the connect flow.');
    }

    const now = Date.now();
    const expiresAt = new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90-day consent
    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');

    const session: BankSession = {
      accessToken,
      refreshToken,
      provider: 'mock',
      accountNumberMasked: entry.accountNumberMasked,
      ifsc: entry.ifsc,
      expiresAt,
      metadata: {
        connectionRef,
        accountNumber: entry.accountNumber,
        accountHolder: entry.accountHolder,
        bankName: entry.bankName,
        accountType: entry.accountType,
      },
    };

    // Deterministic initial balance seeded by account number.
    const rng = mulberry32(hashSeed(entry.accountNumber));
    const currentBalance = round2(randInt(rng, 50_000, 800_000));
    const snapshot: BankAccountSnapshot = {
      availableBalance: round2(currentBalance - randInt(rng, 0, 20_000)),
      currentBalance,
      currency: 'INR',
      asOf: new Date().toISOString(),
      overdraftLimit: 0,
    };

    // Connection established — keep the entry so syncTransactions can use the
    // account metadata. In production the session token is the only thing
    // needed; the mock keeps the entry for deterministic data generation.
    return { session, snapshot };
  }

  async refreshConnection(session: BankSession): Promise<{ session: BankSession }> {
    if (!session.refreshToken) {
      throw new ValidationError('No refresh token available. Please reconnect.');
    }
    const now = Date.now();
    return {
      session: {
        ...session,
        accessToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  async disconnect(session: BankSession): Promise<void> {
    // Mock — nothing to clean up server-side. The Firestore doc is removed by the service.
    // Remove any in-memory connection entry tied to this session.
    const ref = session.metadata?.connectionRef as string | undefined;
    if (ref) connectionStore.delete(ref);
  }

  async fetchAccounts(session: BankSession): Promise<FetchAccountsResult> {
    // Deterministic balance seeded by the masked account number.
    const accountNumber = (session.metadata?.accountNumber as string) ?? session.accountNumberMasked;
    const rng = mulberry32(hashSeed(accountNumber));
    const currentBalance = round2(randInt(rng, 50_000, 800_000));
    return {
      snapshot: {
        availableBalance: round2(currentBalance - randInt(rng, 0, 20_000)),
        currentBalance,
        currency: 'INR',
        asOf: new Date().toISOString(),
        overdraftLimit: 0,
      },
    };
  }

  async fetchTransactions(
    session: BankSession,
    options?: { from?: string; to?: string },
  ): Promise<FetchTransactionsResult> {
    const accountNumber = (session.metadata?.accountNumber as string) ?? session.accountNumberMasked;
    const bankName = (session.metadata?.bankName as string) ?? 'Mock Bank';
    const rng = mulberry32(hashSeed(accountNumber + (options?.from ?? '') + (options?.to ?? '')));

    // connectionId / organizationId are filled in by the orchestrator.
    const transactions = generateTransactions(
      rng,
      '', // connectionId — filled by orchestrator
      session.accountNumberMasked,
      '', // organizationId — filled by orchestrator
      options?.from,
      options?.to,
    );

    // Tag each transaction with the bank name in the description if missing.
    for (const tx of transactions) {
      if (!tx.counterparty) {
        tx.counterparty = bankName;
      }
    }

    return { transactions };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
