// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Service — Mock Provider (In-Memory, Production-Quality Seed)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The BankingService implementation used today. Holds accounts + transactions
// + categorization rules + a synthetic reconciliation ledger entirely in
// memory. State persists across requests via the globalThis singleton set up
// in provider.ts#getBankingService().
//
// When Setu (or any account aggregator) is wired up, a SetuBankingProvider
// will implement the SAME BankingService interface against live banking APIs.
// Nothing in the UI, API routes, Oracle actions, or workflows changes — they
// all consume `BankingService`, never this class directly.
//
// Design choices:
//   - Pure TS, no external deps, no Prisma. Self-contained + swappable.
//   - Seeded PRNG (mulberry32) so the dashboard looks stable across reloads.
//   - All money is plain INR numbers. Strings only at the intelligence layer.
//   - Every method handles empty/missing data gracefully (no crashes).
//   - The synthetic ledger mirrors what a real SME books would look like —
//     40 invoices, 30 expenses, 20 internal payments — so reconcileAll()
//     returns realistic matched/suggested/unmatched results.
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
} from './types';
import type { BankingService } from './provider';
import { evaluateRules, extractCounterparty, CATEGORY_META, CATEGORY_ORDER } from './rules';
import {
  classifyMatch,
  findCandidates,
  type ReconcileLedger,
} from './reconcile';
import { buildNarrative, computeForecast } from './forecast';
import { matchQuestion } from './intelligence';

// ─── PRNG (deterministic seed) ────────────────────────────────────────────────

/**
 * mulberry32 — tiny, fast, well-distributed seeded PRNG. Deterministic given
 * the same seed, so the dashboard is stable across reloads (no flicker in
 * charts/numbers between server and client renders).
 */
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

// ─── Misc helpers ─────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

const nowISO = () => new Date().toISOString();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

let _idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++_idCounter}`;

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

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rngRange(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

function rngInt(rng: () => number, lo: number, hi: number): number {
  return Math.floor(rngRange(rng, lo, hi + 1));
}

// ─── Synthetic ledger (reconciliation source-of-truth) ────────────────────────

function buildSyntheticLedger(rng: () => number): ReconcileLedger {
  const customers = [
    'ACME PVT LTD',
    'STEEL CORP INDIA',
    'TECHNOVATE SYSTEMS',
    'PIONEER TRADERS',
    'GLOBEX MANUFACTURING',
    'BHARAT INDUSTRIES',
    'NEELKANTH ENTERPRISES',
    'SRI BALAJI SUPPLIERS',
    'VIRAT LOGISTICS',
    'MEENAKSHI TEX',
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
    'AIRTEL BUSINESS',
    'BLUE DART',
  ];

  const invoices = [];
  const today = new Date();
  for (let i = 0; i < 40; i++) {
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
      id: `inv-${String(i + 1).padStart(3, '0')}`,
      number: num,
      amount,
      date,
      customer: cust,
      status,
    });
  }

  const expenses = [];
  for (let i = 0; i < 30; i++) {
    const v = vendors[i % vendors.length];
    const amount = rngInt(rng, 5000, 220000);
    const daysAgo = rngInt(rng, 0, 150);
    const date = isoDate(new Date(today.getTime() - daysAgo * DAY_MS));
    expenses.push({
      id: `exp-${String(i + 1).padStart(3, '0')}`,
      amount,
      date,
      vendor: v,
      category: pick(rng, ['Raw Materials', 'Office Supplies', 'Utilities', 'Logistics', 'IT & Software']),
    });
  }

  const payments = [];
  for (let i = 0; i < 20; i++) {
    const isInbound = i % 2 === 0;
    const party = isInbound
      ? pick(rng, customers)
      : pick(rng, vendors);
    const amount = rngInt(rng, 15000, 350000);
    const daysAgo = rngInt(rng, 0, 120);
    const date = isoDate(new Date(today.getTime() - daysAgo * DAY_MS));
    payments.push({
      id: `pay-${String(i + 1).padStart(3, '0')}`,
      amount,
      date,
      party,
      direction: isInbound ? 'in' : ('out' as 'in' | 'out'),
      reference: `REF${1000 + i}`,
    });
  }

  return { invoices, payments, expenses };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class MockBankingProvider implements BankingService {
  private accounts: BankingAccount[] = [];
  private transactions: BankingTransaction[] = [];
  private rules: CategorizationRule[] = [];
  private ledger: ReconcileLedger = { invoices: [], payments: [], expenses: [] };
  private seeded = false;
  private readonly rng: () => number;

  constructor() {
    this.rng = mulberry32(0x5eed1234);
    this.ensureSeed();
  }

  // ─── Seed ──────────────────────────────────────────────────────────────────

  private ensureSeed(): void {
    if (this.seeded) return;
    this.seeded = true;
    this.seedAccounts();
    this.seedRules();
    this.ledger = buildSyntheticLedger(this.rng);
    this.seedTransactions();
  }

  private seedAccounts(): void {
    const today = new Date();
    const daysAgo = (n: number) =>
      new Date(today.getTime() - n * DAY_MS).toISOString();

    this.accounts = [
      {
        id: 'bacct-001',
        bankName: 'HDFC Bank',
        accountName: 'HDFC Current — Acme Pvt Ltd',
        accountMasked: '••••4821',
        accountType: 'current',
        ifsc: 'HDFC0000123',
        balance: 1845000,
        availableBalance: 1845000,
        currency: 'INR',
        status: 'connected',
        lastSyncAt: daysAgo(0),
        createdAt: daysAgo(220),
        updatedAt: daysAgo(0),
      },
      {
        id: 'bacct-002',
        bankName: 'ICICI Bank',
        accountName: 'ICICI Savings — Acme Pvt Ltd',
        accountMasked: '••••7732',
        accountType: 'savings',
        ifsc: 'ICIC0000456',
        balance: 420500,
        availableBalance: 420500,
        currency: 'INR',
        status: 'connected',
        lastSyncAt: daysAgo(0),
        createdAt: daysAgo(220),
        updatedAt: daysAgo(0),
      },
      {
        id: 'bacct-003',
        bankName: 'Axis Bank',
        accountName: 'Axis Current — Operations',
        accountMasked: '••••3091',
        accountType: 'current',
        ifsc: 'AXIS0000789',
        balance: 987250,
        availableBalance: 987250,
        currency: 'INR',
        status: 'connected',
        lastSyncAt: daysAgo(1),
        createdAt: daysAgo(190),
        updatedAt: daysAgo(1),
      },
      {
        id: 'bacct-004',
        bankName: 'Kotak Mahindra',
        accountName: 'Kotak Savings — Tax Reserve',
        accountMasked: '••••5564',
        accountType: 'savings',
        ifsc: 'KKBK0000123',
        balance: 215800,
        availableBalance: 215800,
        currency: 'INR',
        status: 'syncing',
        lastSyncAt: daysAgo(2),
        createdAt: daysAgo(180),
        updatedAt: daysAgo(0),
      },
      {
        id: 'bacct-005',
        bankName: 'State Bank of India',
        accountName: 'SBI Overdraft — Working Capital',
        accountMasked: '••••1198',
        accountType: 'overdraft',
        ifsc: 'SBIN0000456',
        balance: 0,
        availableBalance: 500000,
        currency: 'INR',
        overdraftLimit: 500000,
        status: 'connected',
        lastSyncAt: daysAgo(1),
        createdAt: daysAgo(150),
        updatedAt: daysAgo(1),
      },
    ];
  }

  private seedRules(): void {
    const now = nowISO();
    const base: Array<Omit<CategorizationRule, 'id' | 'createdAt' | 'updatedAt' | 'matchCount'>> = [
      { pattern: 'salary', isRegex: false, category: 'salary', priority: 90, active: true },
      { pattern: 'rent', isRegex: false, category: 'rent', priority: 90, active: true },
      { pattern: 'electricity|water|gas|broadband|tangedco|bescom|indane|airtel|jio', isRegex: true, category: 'utilities', priority: 80, active: true },
      { pattern: 'gst|tds|tax|income tax', isRegex: true, category: 'tax', priority: 80, active: true },
      { pattern: 'upi/.*consult|consulting|consultancy', isRegex: true, category: 'sales', priority: 70, active: true },
      { pattern: 'bigbasket|grocery|amazon|flipkart|jio mart|reliance', isRegex: true, category: 'vendor_payment', priority: 60, active: true },
      { pattern: 'refund|return', isRegex: true, category: 'refund', priority: 60, active: true },
      { pattern: 'interest|int/', isRegex: true, category: 'interest', priority: 70, active: true },
    ];
    this.rules = base.map((r, i) => ({
      ...r,
      id: `brule-${String(i + 1).padStart(3, '0')}`,
      matchCount: 0,
      createdAt: now,
      updatedAt: now,
    }));
  }

  private seedTransactions(): void {
    const rng = this.rng;
    const today = new Date();
    const txs: BankingTransaction[] = [];

    // The customer + vendor pools. Used both for descriptions and for
    // reconciliation matching (some amounts will match the synthetic ledger).
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
    const smallMerchants = [
      'BIGBASKET',
      'AMAZON IN',
      'FLIPKART',
      'JIO MART',
      'SWIGGY',
      'ZOMATO',
      'DMART',
      'BOOKMYSHOW',
    ];
    const vendorBig = [
      'TATA STEEL',
      'RELIANCE IND',
      'JINDAL POWER',
      'BLUE DART',
      'TCS BPO',
    ];

    const accountIds = this.accounts.map((a) => a.id);

    // We walk 180 days back to today and emit transactions per template.
    // Determinism: rng calls happen in stable order, so output is stable.

    const pushTx = (
      daysAgo: number,
      accountId: string,
      description: string,
      amount: number,
      type: TransactionType,
      category: TransactionCategory,
      opts: {
        referenceNo?: string;
        upiRef?: string;
        aiCategory?: TransactionCategory;
        confidence?: number;
        status?: TransactionStatus;
        linkedInvoiceId?: string;
        linkedInvoiceNumber?: string;
        matchType?: 'exact' | 'fuzzy' | 'manual' | 'none';
        counterparty?: string;
      } = {},
    ) => {
      const date = new Date(today.getTime() - daysAgo * DAY_MS);
      const iso = date.toISOString();
      const counterparty = opts.counterparty ?? extractCounterparty(description);
      const status = opts.status ?? 'unreconciled';
      txs.push({
        id: nextId('btx'),
        accountId,
        date: iso,
        description,
        counterparty,
        amount,
        type,
        category,
        aiCategory: opts.aiCategory,
        confidence: opts.confidence,
        referenceNo: opts.referenceNo,
        upiRef: opts.upiRef,
        status,
        linkedInvoiceId: opts.linkedInvoiceId,
        linkedInvoiceNumber: opts.linkedInvoiceNumber,
        matchType: opts.matchType,
        createdAt: iso,
        updatedAt: iso,
      });
    };

    // Generate per-day transactions for 180 days.
    for (let dayOffset = 180; dayOffset >= 0; dayOffset--) {
      const date = new Date(today.getTime() - dayOffset * DAY_MS);
      const dayOfMonth = date.getDate();
      const dow = date.getDay(); // 0 Sun .. 6 Sat
      const monthLabel = date.toLocaleString('en-US', { month: 'short' });

      // ── Monthly recurring ──
      // Salary (1st) — debit on HDFC current
      if (dayOfMonth === 1) {
        pushTx(
          dayOffset,
          'bacct-001',
          `NEFT/HDFC/Salary ${monthLabel}`,
          rngInt(rng, 280000, 320000),
          'debit',
          'salary',
          {
            referenceNo: `SAL${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`,
            status: 'reconciled',
            matchType: 'exact',
          },
        );
      }

      // Rent (5th) — debit on Axis current
      if (dayOfMonth === 5) {
        pushTx(
          dayOffset,
          'bacct-003',
          `UPI/LANDLORD RAMESH/Office Rent ${monthLabel}`,
          125000,
          'debit',
          'rent',
          {
            referenceNo: `RENT${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`,
            upiRef: `UPI${rngInt(rng, 100000000, 999999999)}`,
            status: 'reconciled',
            matchType: 'exact',
          },
        );
      }

      // GST payment (20th)
      if (dayOfMonth === 20) {
        pushTx(
          dayOffset,
          'bacct-004',
          `GST/PAYMENT/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          rngInt(rng, 80000, 250000),
          'debit',
          'tax',
          {
            referenceNo: `GST${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`,
            status: 'reconciled',
            matchType: 'manual',
          },
        );
      }

      // Interest credit (last day of month — approximate with day 28/29/30)
      if (dayOfMonth === 28) {
        pushTx(
          dayOffset,
          'bacct-002',
          `INT/SAVINGS/ICICI ${monthLabel}`,
          rngInt(rng, 1800, 4200),
          'credit',
          'interest',
          { status: 'reconciled', matchType: 'exact' },
        );
      }

      // Electricity bill (12th)
      if (dayOfMonth === 12) {
        pushTx(
          dayOffset,
          'bacct-001',
          `BILLPAY/ELECTRICITY/TANGEDCO`,
          rngInt(rng, 22000, 48000),
          'debit',
          'utilities',
          { status: 'reconciled', matchType: 'exact' },
        );
      }

      // Internet (15th)
      if (dayOfMonth === 15) {
        pushTx(
          dayOffset,
          'bacct-003',
          `BILLPAY/BROADBAND/AIRTEL BUSINESS`,
          rngInt(rng, 4500, 8200),
          'debit',
          'utilities',
          { status: 'reconciled', matchType: 'exact' },
        );
      }

      // Bank charges (random day, monthly)
      if (dayOfMonth === rngInt(rng, 18, 25)) {
        pushTx(
          dayOffset,
          'bacct-001',
          `CHARGES/MIN_BAL/HDFC`,
          rngInt(rng, 250, 1200),
          'debit',
          'fees',
          { status: 'reconciled', matchType: 'manual' },
        );
      }

      // ── Weekly recurring ──
      // Vendor payment (every Monday) — debit on Axis current
      if (dow === 1) {
        const v = pick(rng, vendorBig);
        pushTx(
          dayOffset,
          'bacct-003',
          `NEFT/AXIS/${v} Supply`,
          rngInt(rng, 85000, 350000),
          'debit',
          'vendor_payment',
          {
            referenceNo: `NEFT${rngInt(rng, 100000, 999999)}`,
            status: rng() < 0.7 ? 'reconciled' : 'unreconciled',
            matchType: rng() < 0.7 ? 'exact' : undefined,
            counterparty: v,
          },
        );
      }

      // ── Random daily ──
      // Small POS / UPI purchases (40% chance per weekday)
      if (dow >= 1 && dow <= 5 && rng() < 0.4) {
        const m = pick(rng, smallMerchants);
        pushTx(
          dayOffset,
          pick(rng, ['bacct-001', 'bacct-002', 'bacct-003']),
          `POS/PURCHASE/${m}`,
          rngInt(rng, 800, 12000),
          'debit',
          // Some get an AI category differing from the manual one
          evaluateRules(this.rules, m)
            ? (evaluateRules(this.rules, m)!.category as TransactionCategory)
            : 'misc',
          {
            aiCategory: rng() < 0.4 ? 'vendor_payment' : undefined,
            confidence: rng() < 0.4 ? rngRange(rng, 0.6, 0.98) : undefined,
            status: rng() < 0.6 ? 'reconciled' : 'unreconciled',
            counterparty: m,
          },
        );
      }

      // Customer inflow (sales) — credits. Three branches:
      //   - 45% pre-linked to a ledger invoice (status=reconciled, matchType=exact)
      //   - 30% matchable: uses an invoice's amount+date but is NOT pre-linked,
      //     so reconcileAll() can find it as a `matched`/`suggested` candidate
      //   - 25% purely synthetic (no ledger match — reconcile returns unmatched)
      if (rng() < 0.45) {
        const cust = pick(rng, customers);
        const branch = rng();
        let amount: number;
        let invId: string | undefined;
        let invNum: string | undefined;
        let invDate: Date | undefined;
        let preStatus: TransactionStatus;
        let preMatchType: 'exact' | 'fuzzy' | 'manual' | undefined;
        if (branch < 0.45) {
          // Pre-linked — reconciled in seed.
          const inv = pick(rng, this.ledger.invoices);
          amount = inv.amount;
          invId = inv.id;
          invNum = inv.number;
          invDate = new Date(inv.date);
          preStatus = 'reconciled';
          preMatchType = 'exact';
        } else if (branch < 0.75) {
          // Matchable but unreconciled — reconcileAll() will surface this.
          const inv = pick(rng, this.ledger.invoices);
          amount = inv.amount;
          invDate = new Date(inv.date);
          preStatus = 'unreconciled';
          preMatchType = undefined;
        } else {
          // Purely synthetic — no invoice match.
          amount = rngInt(rng, 35000, 600000);
          preStatus = pick(rng, ['unreconciled', 'pending']);
          preMatchType = undefined;
        }
        // Date proximity: ensure transaction is on/after invoice date for realism.
        const txDateOffset = invDate
          ? Math.max(0, Math.floor((today.getTime() - invDate.getTime()) / DAY_MS) - rngInt(rng, 0, 3))
          : dayOffset;
        pushTx(
          txDateOffset,
          pick(rng, accountIds),
          `UPI/${cust}/Payment`,
          amount,
          'credit',
          'sales',
          {
            referenceNo: `UPI${rngInt(rng, 100000000, 999999999)}`,
            upiRef: `UPI${rngInt(rng, 100000000, 999999999)}`,
            aiCategory: rng() < 0.4 ? 'sales' : undefined,
            confidence: rng() < 0.4 ? rngRange(rng, 0.6, 0.98) : undefined,
            status: preStatus,
            linkedInvoiceId: invId,
            linkedInvoiceNumber: invNum,
            matchType: preMatchType,
            counterparty: cust,
          },
        );
      }

      // Consulting inflow (sometimes) — credit, sales category
      if (rng() < 0.12) {
        const party = pick(rng, ['RAJESH K', 'ANITA S', 'MEGHA CONSULTING']);
        pushTx(
          dayOffset,
          'bacct-002',
          `UPI/${party}/Consulting`,
          rngInt(rng, 25000, 110000),
          'credit',
          'sales',
          {
            referenceNo: `UPI${rngInt(rng, 100000000, 999999999)}`,
            status: rng() < 0.5 ? 'reconciled' : 'unreconciled',
            counterparty: party,
          },
        );
      }

      // Refund (occasional) — credit
      if (rng() < 0.08) {
        const m = pick(rng, smallMerchants);
        pushTx(
          dayOffset,
          'bacct-002',
          `REFUND/${m}/Return`,
          rngInt(rng, 500, 8000),
          'credit',
          'refund',
          { status: 'reconciled', matchType: 'exact' },
        );
      }

      // Internal transfer (occasional)
      if (rng() < 0.1) {
        pushTx(
          dayOffset,
          'bacct-001',
          `NEFT/HDFC/Internal Transfer to Operations`,
          rngInt(rng, 50000, 250000),
          'debit',
          'transfer',
          {
            status: 'reconciled',
            matchType: 'manual',
          },
        );
        pushTx(
          dayOffset,
          'bacct-003',
          `NEFT/AXIS/Internal Transfer from Main`,
          0, // placeholder; we'll re-write amount below
          'credit',
          'transfer',
          { status: 'reconciled', matchType: 'manual' },
        );
        // Patch the credit amount to match the debit (paired transfer).
        const last = txs[txs.length - 1];
        const debitTx = txs[txs.length - 2];
        last.amount = debitTx.amount;
      }

      // Cheque deposit (rare) — credit
      if (rng() < 0.05) {
        const cust = pick(rng, customers);
        pushTx(
          dayOffset,
          'bacct-001',
          `CHQ/DEPOSIT/${cust}`,
          rngInt(rng, 40000, 250000),
          'credit',
          'payment_received',
          {
            referenceNo: `CHQ${rngInt(rng, 100000, 999999)}`,
            status: 'pending',
            counterparty: cust,
          },
        );
      }
    }

    // Distribute the ~5% ignored + ~10% pending status more carefully.
    // We've already set most statuses above; if we still don't have enough
    // 'ignored' rows, flip a small random subset.
    const ignoredTarget = Math.ceil(txs.length * 0.05);
    let ignoredCount = txs.filter((t) => t.status === 'ignored').length;
    while (ignoredCount < ignoredTarget) {
      const idx = rngInt(rng, 0, txs.length - 1);
      if (txs[idx].status !== 'ignored') {
        txs[idx].status = 'ignored';
        ignoredCount++;
      }
    }

    // Sort transactions by date descending for natural listing.
    txs.sort((a, b) => b.date.localeCompare(a.date));
    this.transactions = txs;

    // Update rule matchCount for the rules list endpoint.
    for (const rule of this.rules) {
      rule.matchCount = txs.filter((t) => {
        const r = evaluateRules([rule], t.description);
        return r !== null;
      }).length;
    }
  }

  // ─── Accounts ──────────────────────────────────────────────────────────────

  async listAccounts(_orgId: string): Promise<BankingAccount[]> {
    return [...this.accounts];
  }

  async getAccount(_orgId: string, accountId: string): Promise<BankingAccount | null> {
    return this.accounts.find((a) => a.id === accountId) ?? null;
  }

  async createAccount(
    _orgId: string,
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
    const now = nowISO();
    const acct: BankingAccount = {
      id: nextId('bacct'),
      bankName: input.bankName,
      accountName: input.accountName,
      accountMasked: input.accountMasked,
      accountType: input.accountType,
      ifsc: input.ifsc,
      balance: input.balance ?? 0,
      availableBalance: input.balance ?? 0,
      currency: input.currency ?? 'INR',
      upiHandle: input.upiHandle,
      status: 'connected',
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.push(acct);
    return acct;
  }

  async syncAccount(_orgId: string, accountId: string): Promise<BankingAccount> {
    const acct = this.accounts.find((a) => a.id === accountId);
    if (!acct) throw new Error(`Account not found: ${accountId}`);
    // Simulate the sync round-trip — flip to 'syncing' then back to 'connected'
    // with a fresh lastSyncAt. We do this synchronously (no delay) so the API
    // response is immediate; a real provider would await a webhook.
    acct.status = 'connected';
    acct.lastSyncAt = nowISO();
    acct.updatedAt = nowISO();
    return acct;
  }

  async updateAccountStatus(
    _orgId: string,
    accountId: string,
    status: AccountStatus,
  ): Promise<BankingAccount> {
    const acct = this.accounts.find((a) => a.id === accountId);
    if (!acct) throw new Error(`Account not found: ${accountId}`);
    acct.status = status;
    acct.updatedAt = nowISO();
    return acct;
  }

  // ─── Transactions ──────────────────────────────────────────────────────────

  async listTransactions(
    _orgId: string,
    filter: TransactionFilter,
  ): Promise<PaginatedResult<BankingTransaction>> {
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    const offset = Math.max(filter.offset ?? 0, 0);

    let rows = [...this.transactions];

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

    // Sort newest first.
    rows.sort((a, b) => b.date.localeCompare(a.date));

    const total = rows.length;
    const sliced = rows.slice(offset, offset + limit);
    return { rows: sliced, total, limit, offset };
  }

  async getTransaction(_orgId: string, transactionId: string): Promise<BankingTransaction | null> {
    return this.transactions.find((t) => t.id === transactionId) ?? null;
  }

  async createTransaction(
    _orgId: string,
    input: Omit<BankingTransaction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
      status?: BankingTransaction['status'];
    },
  ): Promise<BankingTransaction> {
    const now = nowISO();
    // Auto-extract counterparty if missing.
    const counterparty =
      input.counterparty ?? extractCounterparty(input.description);
    // Auto-categorize via rules if no category was provided.
    let category = input.category;
    if (!category) {
      const m = evaluateRules(this.rules, input.description);
      if (m) category = m.category;
    }
    const tx: BankingTransaction = {
      ...input,
      id: nextId('btx'),
      counterparty,
      category,
      status: input.status ?? 'unreconciled',
      createdAt: now,
      updatedAt: now,
    };
    this.transactions.unshift(tx);
    return tx;
  }

  async updateTransaction(
    _orgId: string,
    transactionId: string,
    patch: Partial<BankingTransaction>,
  ): Promise<BankingTransaction> {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    Object.assign(tx, patch, { updatedAt: nowISO() });
    return tx;
  }

  async deleteTransaction(_orgId: string, transactionId: string): Promise<{ ok: boolean }> {
    const idx = this.transactions.findIndex((t) => t.id === transactionId);
    if (idx < 0) return { ok: false };
    this.transactions.splice(idx, 1);
    return { ok: true };
  }

  async linkInvoice(
    _orgId: string,
    transactionId: string,
    invoiceId: string,
    matchType: 'manual' | 'exact' | 'fuzzy' = 'manual',
  ): Promise<BankingTransaction> {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    // Look up the invoice in the synthetic ledger for the number.
    const inv = this.ledger.invoices.find((i) => i.id === invoiceId);
    tx.linkedInvoiceId = invoiceId;
    tx.linkedInvoiceNumber = inv?.number;
    tx.status = 'reconciled';
    tx.matchType = matchType;
    tx.updatedAt = nowISO();
    return tx;
  }

  async categorize(
    _orgId: string,
    transactionId: string,
    category: TransactionCategory,
  ): Promise<BankingTransaction> {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    tx.category = category;
    tx.updatedAt = nowISO();
    return tx;
  }

  async splitTransaction(
    _orgId: string,
    transactionId: string,
    splits: Array<{ amount: number; category: TransactionCategory }>,
  ): Promise<BankingTransaction[]> {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    if (!splits?.length) return [tx];

    // Replace the original with one row per split. We preserve date / account /
    // type / description / counterparty. The original is removed; the new rows
    // inherit a `(split N of M)` suffix in their description for clarity.
    const idx = this.transactions.findIndex((t) => t.id === transactionId);
    if (idx >= 0) this.transactions.splice(idx, 1);

    const now = nowISO();
    const created: BankingTransaction[] = splits.map((s, i) => ({
      ...tx,
      id: nextId('btx'),
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
    // Insert at the original position to keep ordering sensible.
    this.transactions.splice(idx, 0, ...created);
    return created;
  }

  // ─── Dashboard & Cash Flow ─────────────────────────────────────────────────

  async getDashboard(_orgId: string): Promise<BankingDashboard> {
    const totalBalance = this.accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
    const todaysBalance = this.accounts.reduce((s, a) => s + (a.availableBalance ?? 0), 0);

    const today = startOfDay(new Date());
    const last30Start = new Date(today.getTime() - 30 * DAY_MS);
    const last30Txs = this.transactions.filter((t) => new Date(t.date) >= last30Start);

    const cashIn = last30Txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const cashOut = last30Txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

    const pendingPayments = this.transactions.filter(
      (t) => t.status === 'unreconciled' && t.type === 'debit',
    ).length;
    const upcomingReceipts = this.transactions.filter(
      (t) => t.status === 'unreconciled' && t.type === 'credit',
    ).length;

    const reconciledCount = this.transactions.filter((t) => t.status === 'reconciled').length;
    const reconciledPct =
      this.transactions.length === 0
        ? 0
        : Math.round((reconciledCount / this.transactions.length) * 100);
    const unreconciledCount = this.transactions.filter((t) => t.status === 'unreconciled').length;

    // cashFlowSeries (last 30d daily)
    const cashFlowSeries = this.buildDailySeries(30);

    // incomeVsExpense (last 6 months)
    const incomeVsExpense = this.buildMonthlyIncomeExpense(6);

    // monthlyTrend (last 6 months)
    const monthlyTrend = incomeVsExpense.map((m) => ({
      month: m.date,
      inflow: m.income,
      outflow: m.expense,
      net: m.income - m.expense,
    }));

    // categoryBreakdown (last 30d)
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
        linkedAccounts: this.accounts.length,
      },
      cashFlowSeries,
      incomeVsExpense,
      monthlyTrend,
      categoryBreakdown,
    };
  }

  /** Build a daily CashFlowPoint series for the last N days (oldest→newest). */
  private buildDailySeries(days: number, accountId?: string): CashFlowPoint[] {
    const today = startOfDay(new Date());
    const start = new Date(today.getTime() - (days - 1) * DAY_MS);

    // Compute opening balance at series start: current balance minus net
    // movement over the series window (walk backward).
    const relevantTxs = this.transactions.filter(
      (t) => (!accountId || t.accountId === accountId) && new Date(t.date) >= start,
    );
    const netOverWindow = relevantTxs.reduce(
      (s, t) => s + (t.type === 'credit' ? t.amount : -t.amount),
      0,
    );
    const currentBalance = accountId
      ? (this.accounts.find((a) => a.id === accountId)?.balance ?? 0)
      : this.accounts.reduce((s, a) => s + a.balance, 0);
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
      points.push({
        date: isoDate(d),
        inflow,
        outflow,
        net,
        balance: running,
      });
    }
    return points;
  }

  /** Build a monthly income/expense series for the last N months (oldest→newest). */
  private buildMonthlyIncomeExpense(
    months: number,
  ): Array<{ date: string; income: number; expense: number }> {
    const out: Array<{ date: string; income: number; expense: number }> = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthTxs = this.transactions.filter((t) => {
        const td = new Date(t.date);
        return td >= monthStart && td < monthEnd;
      });
      const income = monthTxs
        .filter((t) => t.type === 'credit')
        .reduce((s, t) => s + t.amount, 0);
      const expense = monthTxs
        .filter((t) => t.type === 'debit')
        .reduce((s, t) => s + t.amount, 0);
      out.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        income,
        expense,
      });
    }
    return out;
  }

  async getCashFlow(
    _orgId: string,
    opts: { from?: string; to?: string; accountId?: string },
  ): Promise<CashFlowSummary> {
    const today = startOfDay(new Date());
    const to = opts.to ? new Date(opts.to) : today;
    const from = opts.from ? new Date(opts.from) : new Date(to.getTime() - 30 * DAY_MS);
    const days = Math.max(
      1,
      Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1,
    );

    // Build a daily series for the [from, to] window.
    const relevantTxs = this.transactions.filter((t) => {
      if (opts.accountId && t.accountId !== opts.accountId) return false;
      const td = new Date(t.date);
      return td >= from && td <= new Date(to.getTime() + DAY_MS);
    });

    const currentBalance = opts.accountId
      ? (this.accounts.find((a) => a.id === opts.accountId)?.balance ?? 0)
      : this.accounts.reduce((s, a) => s + a.balance, 0);

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
      series.push({
        date: isoDate(d),
        inflow,
        outflow,
        net,
        balance: running,
      });
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

  async forecastCashFlow(_orgId: string, horizon: '7d' | '30d'): Promise<CashFlowForecast> {
    // Build the last 60 days of history as CashFlowPoint[] for the forecast
    // model (oldest→newest).
    const history = this.buildDailySeries(60);
    const currentBalance = this.accounts.reduce((s, a) => s + a.balance, 0);

    const computed = computeForecast({ history, currentBalance, horizon });
    const narrative = buildNarrative(computed, currentBalance);
    return { ...computed, ...narrative };
  }

  // ─── Reconciliation ────────────────────────────────────────────────────────

  async reconcileAll(_orgId: string): Promise<ReconcileResult[]> {
    const out: ReconcileResult[] = [];
    // Only reconcile unreconciled + pending (skipping already-reconciled and
    // ignored — those have been dispositioned already).
    const targets = this.transactions.filter(
      (t) => t.status === 'unreconciled' || t.status === 'pending',
    );
    for (const tx of targets) {
      out.push(this.computeReconcile(tx));
    }
    return out;
  }

  async reconcileOne(_orgId: string, transactionId: string): Promise<ReconcileResult> {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    return this.computeReconcile(tx);
  }

  private computeReconcile(tx: BankingTransaction): ReconcileResult {
    const candidates = findCandidates(tx, this.ledger);
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

  async getReconcileSummary(_orgId: string): Promise<ReconcileSummary> {
    const total = this.transactions.length;
    const reconciled = this.transactions.filter((t) => t.status === 'reconciled').length;
    const unreconciled = this.transactions.filter((t) => t.status === 'unreconciled').length;

    // For matched/partial/suggested we'd need to run reconcileAll — but that's
    // expensive. We approximate using existing linked transactions + a quick
    // pass over unreconciled only when there are any. For the summary, we use
    // counts derived from linkedInvoiceId / matchType.
    const matched = this.transactions.filter(
      (t) => t.status === 'reconciled' && (t.matchType === 'exact' || t.matchType === 'fuzzy'),
    ).length;
    const suggested = this.transactions.filter(
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
    _orgId: string,
    transactionId: string,
    candidateId?: string,
    candidateKind?: 'invoice' | 'payment' | 'expense' | 'refund' | 'receipt',
  ): Promise<BankingTransaction> {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    tx.status = 'reconciled';
    tx.matchType = 'manual';
    if (candidateId && candidateKind === 'invoice') {
      const inv = this.ledger.invoices.find((i) => i.id === candidateId);
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
    _orgId: string,
    format: ImportFormat,
    rawContent: string,
    accountId?: string,
  ): Promise<ImportPreview> {
    const rows: ImportedRow[] = [];
    let issueCount = 0;
    let detectedFrom: string | undefined;
    let detectedTo: string | undefined;

    if (format === 'csv') {
      // Parse CSV: split on newlines, detect header row, map columns
      // heuristically (date / description / amount / type).
      const lines = rawContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length) {
        return emptyPreview(accountId);
      }

      // Header detection: if first line contains "date" or "amount" (case-
      // insensitive), skip it.
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
    } else {
      // Excel / PDF: we can't truly parse binary formats here. Return a small
      // synthetic preview derived from the text content (extract whatever
      // looks like date+amount tuples). This keeps the contract usable for
      // demos; a real provider would parse the binary properly.
      const lines = rawContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 10);
      for (const line of lines) {
        // Look for a date (YYYY-MM-DD or DD/MM/YYYY) and a number (possibly
        // with commas / decimal).
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

    const validRows = rows.filter((r) => !r.issues?.length);
    const totalInflow = rows
      .filter((r) => r.type === 'credit')
      .reduce((s, r) => s + r.amount, 0);
    const totalOutflow = rows
      .filter((r) => r.type === 'debit')
      .reduce((s, r) => s + r.amount, 0);

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

  async categorizeImport(_orgId: string, preview: ImportPreview): Promise<ImportPreview> {
    const rows = preview.rows.map((r) => {
      const m = evaluateRules(this.rules, r.description);
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

  async listRules(_orgId: string): Promise<CategorizationRule[]> {
    return [...this.rules];
  }

  async createRule(
    _orgId: string,
    input: Omit<CategorizationRule, 'id' | 'createdAt' | 'updatedAt' | 'matchCount'>,
  ): Promise<CategorizationRule> {
    const now = nowISO();
    const rule: CategorizationRule = {
      ...input,
      id: nextId('brule'),
      matchCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.rules.push(rule);
    return rule;
  }

  async updateRule(
    _orgId: string,
    ruleId: string,
    patch: Partial<CategorizationRule>,
  ): Promise<CategorizationRule> {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    Object.assign(rule, patch, { updatedAt: nowISO() });
    return rule;
  }

  async deleteRule(_orgId: string, ruleId: string): Promise<{ ok: boolean }> {
    const idx = this.rules.findIndex((r) => r.id === ruleId);
    if (idx < 0) return { ok: false };
    this.rules.splice(idx, 1);
    return { ok: true };
  }

  async applyRules(_orgId: string): Promise<{ applied: number; touched: number }> {
    // Re-evaluate every active rule against every transaction. Update category
    // where a rule matches with HIGHER priority than the existing manual
    // category (we don't clobber explicit user categorization — we only fill
    // gaps or upgrade to a higher-priority match).
    let touched = 0;
    let applied = 0;

    for (const tx of this.transactions) {
      const m = evaluateRules(this.rules, tx.description);
      if (!m) continue;
      applied++;
      // Only overwrite if the tx has no category OR the matched rule has
      // higher priority than the rule that produced the current category
      // (proxied by: if the current category came from `misc` or is missing,
      // accept any rule; otherwise leave the user's choice alone).
      if (!tx.category || tx.category === 'misc') {
        if (tx.category !== m.category) {
          tx.category = m.category;
          tx.updatedAt = nowISO();
          touched++;
        }
      }
    }

    // Refresh matchCount.
    for (const rule of this.rules) {
      rule.matchCount = this.transactions.filter((t) => {
        const r = evaluateRules([rule], t.description);
        return r !== null;
      }).length;
    }

    return { applied, touched };
  }

  // ─── AI Insights (Oracle Banking Intelligence) ─────────────────────────────

  async answerQuestion(orgId: string, question: string): Promise<BankingInsightAnswer> {
    const matched = matchQuestion(question);
    switch (matched.kind) {
      case 'total_balance':
        return this.answerTotalBalance(question, matched.label);
      case 'this_month_expenses':
        return this.answerThisMonthExpenses(question, matched.label);
      case 'unpaid_invoices':
        return this.answerUnpaidInvoices(question, matched.label);
      case 'cash_next_week':
        return this.answerCashNextWeek(orgId, question, matched.label);
      case 'cash_flow_decreasing':
        return this.answerCashFlowDecreasing(question, matched.label);
      case 'suspicious_transactions':
        return this.answerSuspicious(question, matched.label);
      case 'largest_expenses':
        return this.answerLargestExpenses(question, matched.label);
      case 'late_payers':
        return this.answerLatePayers(question, matched.label);
      case 'generic':
      default:
        return this.answerGeneric(question, matched.label);
    }
  }

  // ─── Oracle answer builders ────────────────────────────────────────────────

  private answerTotalBalance(question: string, label: string): BankingInsightAnswer {
    const total = this.accounts.reduce((s, a) => s + a.balance, 0);
    const rows = this.accounts.map((a) => ({
      Bank: a.bankName,
      Account: a.accountName,
      Type: a.accountType,
      Balance: fmtINR(a.balance),
    }));
    return {
      question,
      label,
      answer:
        `You currently hold **${fmtINR(total)}** across ${this.accounts.length} linked account(s). ` +
        `The largest concentration is in your primary current account. ` +
        `Available balance (excluding holds) is ${fmtINR(
          this.accounts.reduce((s, a) => s + a.availableBalance, 0),
        )}.`,
      metrics: [
        { label: 'Total balance', value: fmtINR(total), tone: 'positive' },
        {
          label: 'Available balance',
          value: fmtINR(this.accounts.reduce((s, a) => s + a.availableBalance, 0)),
          tone: 'neutral',
        },
        { label: 'Linked accounts', value: String(this.accounts.length), tone: 'neutral' },
      ],
      table: { columns: ['Bank', 'Account', 'Type', 'Balance'], rows },
    };
  }

  private answerThisMonthExpenses(question: string, label: string): BankingInsightAnswer {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTxs = this.transactions.filter(
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
        `Top spending categories: ${top
          .map(([c, a]) => `${CATEGORY_META[c].label} (${fmtINRShort(a)})`)
          .join(', ')}.`,
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

  private answerUnpaidInvoices(question: string, label: string): BankingInsightAnswer {
    // Use the synthetic ledger invoices marked unpaid / partial / overdue.
    const unpaid = this.ledger.invoices.filter(
      (i) => i.status !== 'paid',
    );
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
    question: string,
    label: string,
  ): Promise<BankingInsightAnswer> {
    const forecast = await this.forecastCashFlow(orgId, '7d');
    const currentBalance = this.accounts.reduce((s, a) => s + a.balance, 0);
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

  private answerCashFlowDecreasing(question: string, label: string): BankingInsightAnswer {
    const today = startOfDay(new Date());
    const last30Start = new Date(today.getTime() - 30 * DAY_MS);
    const prev30Start = new Date(today.getTime() - 60 * DAY_MS);

    const last30 = this.transactions.filter(
      (t) => new Date(t.date) >= last30Start && new Date(t.date) < today,
    );
    const prev30 = this.transactions.filter(
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

    // Top outflow categories that grew in the last 30d vs previous 30d.
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

  private answerSuspicious(question: string, label: string): BankingInsightAnswer {
    // Flag transactions that are amount outliers (>2σ above mean) OR have low
    // AI confidence OR fall into 'misc' with no rule match.
    const all = this.transactions;
    if (!all.length) {
      return {
        question,
        label,
        answer: 'No transactions to analyze.',
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

  private answerLargestExpenses(question: string, label: string): BankingInsightAnswer {
    const top = [...this.transactions]
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
          const acct = this.accounts.find((a) => a.id === t.accountId);
          return {
            Date: isoDate(new Date(t.date)),
            Description: t.description,
            Amount: fmtINR(t.amount),
            Category: t.category ? CATEGORY_META[t.category].label : 'Uncategorized',
            Account: acct ? `${acct.bankName}` : t.accountId,
          };
        }),
      },
    };
  }

  private answerLatePayers(question: string, label: string): BankingInsightAnswer {
    // From reconciled credit transactions linked to invoices, compute the
    // delay (transaction date - invoice date). Aggregate by customer.
    const linked = this.transactions.filter(
      (t) => t.status === 'reconciled' && t.linkedInvoiceId && t.type === 'credit',
    );
    const byCustomer = new Map<
      string,
      { customer: string; count: number; totalDelay: number; maxDelay: number; amount: number }
    >();
    for (const t of linked) {
      const inv = this.ledger.invoices.find((i) => i.id === t.linkedInvoiceId);
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
        {
          label: 'Customers analyzed',
          value: String(rows.length),
          tone: 'neutral',
        },
        {
          label: 'Avg delay (all)',
          value: `${overallAvg} days`,
          tone: overallAvg > 14 ? 'negative' : 'neutral',
        },
        {
          label: 'Slowest payer',
          value: rows[0]?.customer ?? '—',
          tone: 'negative',
        },
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

  private answerGeneric(question: string, label: string): BankingInsightAnswer {
    const total = this.accounts.reduce((s, a) => s + a.balance, 0);
    const today = startOfDay(new Date());
    const last7Start = new Date(today.getTime() - 7 * DAY_MS);
    const last7 = this.transactions.filter((t) => new Date(t.date) >= last7Start);
    const inflow = last7.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const outflow = last7.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

    return {
      question,
      label,
      answer:
        `Here's a quick summary: you hold **${fmtINR(total)}** across ${this.accounts.length} accounts. ` +
        `Over the last 7 days, ${fmtINR(inflow)} came in and ${fmtINR(outflow)} went out ` +
        `(net ${fmtINR(inflow - outflow)}). ` +
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

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/**
 * Split a single CSV line into cells. Handles quoted fields with embedded
 * commas + escaped quotes (""). Does NOT handle multi-line quoted fields —
 * bank statement CSVs are single-line-per-row in practice.
 */
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

/**
 * Heuristically map CSV cells → ImportedRow fields. Looks for a date-shaped
 * cell, a numeric cell (the amount), a free-text cell (description), and a
 * debit/credit indicator. Falls back gracefully when columns are ambiguous.
 */
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

    // Date detection.
    if (!date) {
      const d = normalizeDate(c);
      if (d) {
        date = d;
        continue;
      }
    }

    // Numeric detection (allow commas, leading minus, decimal).
    if (amount === null && /^-?[\d,]+\.?\d*$/.test(c) && c.length > 0) {
      const n = Number(c.replace(/,/g, ''));
      if (!Number.isNaN(n)) {
        amount = Math.abs(n);
        type = n < 0 ? 'debit' : 'credit';
        continue;
      }
    }

    // Reference number detection (alphanumeric, 6+ chars, no spaces).
    if (!referenceNo && /^[A-Z0-9]{6,}$/i.test(c) && c.length <= 24) {
      referenceNo = c;
      continue;
    }

    // Description (longest free-text cell).
    if (!description || c.length > description.length) {
      description = c;
    }
  }

  return { date, description, amount, type, referenceNo };
}

/** Normalize a date string to ISO YYYY-MM-DD. Accepts DD/MM/YYYY, MM/DD/YYYY
 * (heuristic — if first part > 12 it's a day), YYYY-MM-DD. */
function normalizeDate(s: string): string | undefined {
  const t = s.trim();
  // YYYY-MM-DD
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YYYY or MM/DD/YYYY
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3];
    const day = a > 12 ? a : b > 12 ? b : a;
    const month = a > 12 ? b : b > 12 ? a : b;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  // DD-MM-YYYY
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
