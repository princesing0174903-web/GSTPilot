// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BANKING CLOUD™ — Core Engine
// Phase 8 — Step 2 — Connect. Execute. Automate. Scale.
//
// Deterministic, transparent engine. No LLM in the engine — the LLM is reserved
// for Oracle's conversational layer (with Banking Cloud context injected).
//
// Modules implemented here:
//   Module 1 — Bank Account Management™       buildAccountsState()
//   Module 2 — Bank Statement Sync™           buildStatementsState()
//   Module 3 — Account Aggregator Cloud™      buildAAState()
//   Module 4 — Cash Flow Engine™              buildCashFlowState()
//   Module 5 — Auto Reconciliation Engine™    buildReconciliationState()
//   Module 6 — UPI Cloud™                     buildUPIState()
//   Module 7 — Collections Recovery Engine™   buildCollectionsState()
//   +        — Oracle Personality™            buildBankingPersonality()
//
// Orchestrator: getBankingCloudState() — fetches accounts (seeding demo data
// if the DB is empty), then composes the complete Banking Cloud state.
//
// Action handlers: connectBankAccount, syncBankAccounts, syncStatements,
//   connectAA, consentAA, runReconciliation, connectUPI, syncUPI,
//   recoverCollections, remindCollections — each writes to DB and returns
//   an oracleAck string for the Oracle UI toast.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  AAConnectionSummary, AAStatusSummary, BankAccountSummary, BankActionRequest,
  BankActionResponse, BankStatementSummary, BankTransactionRow, BankingCloudPersonality,
  BankingCloudState, CashFlowDailyPoint, CashFlowSummary, CollectionsCase,
  CollectionsSummary, MismatchType, ReconStatus, ReconciliationEntry,
  ReconciliationSummary, RiskLevel, TxnCategory, TxnType, UPISummary,
  UPITransactionRow,
} from '@/lib/banking/types';
import { RISK_GLYPH, RECON_STATUS_GLYPH, CATEGORY_GLYPH } from '@/lib/banking/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowISO = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0, 10);
export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const minsAgo = (m: number) => {
  const x = new Date();
  x.setTime(x.getTime() - m * 60_000);
  return x.toISOString();
};
const hoursAgo = (h: number) => {
  const x = new Date();
  x.setTime(x.getTime() - h * 3600_000);
  return x.toISOString();
};
const daysAgoISO = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString();
};
const daysFromNowISO = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString();
};
const dateOnly = (iso: string) => iso.slice(0, 10);

const inrShort = (n: number) => {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function riskFromScore(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

// ─── Seed data (used only when DB is empty) ────────────────────────────────────

const SEED_BANKS: Array<Omit<BankAccountSummary, 'id' | 'lastSyncAt' | 'recordsToday' | 'status'>> = [
  {
    bankName: 'HDFC Bank', accountMasked: '****4521', accountType: 'current',
    ifsc: 'HDFC0000123', currentBalance: 4823500, availableBalance: 4610000,
    overdraftLimit: 0, upiHandle: 'yourbiz@hdfc', aaConsent: true,
    aaConsentExpiry: daysFromNowISO(86),
  },
  {
    bankName: 'ICICI Bank', accountMasked: '****8890', accountType: 'current',
    ifsc: 'ICIC0000456', currentBalance: 1240800, availableBalance: 1240800,
    overdraftLimit: 0, upiHandle: 'yourbiz@icici', aaConsent: true,
    aaConsentExpiry: daysFromNowISO(54),
  },
  {
    bankName: 'State Bank of India', accountMasked: '****2231', accountType: 'savings',
    ifsc: 'SBIN0000789', currentBalance: 318750, availableBalance: 318750,
    overdraftLimit: 0,
  },
  {
    bankName: 'Axis Bank', accountMasked: '****6677', accountType: 'od',
    ifsc: 'UTIB0000321', currentBalance: 1850000, availableBalance: 2850000,
    overdraftLimit: 1000000, aaConsent: true, aaConsentExpiry: daysFromNowISO(12),
  },
];

const PARTIES = [
  'Reliance Retail Ltd', 'Tata Steel Ltd', 'Infosys Pvt Ltd', 'Asian Paints India',
  'Britannia Industries', 'Maruti Suzuki India', 'Hindustan Unilever Ltd', 'Adani Power Ltd',
  'Bharti Airtel Ltd', 'Mahindra & Mahindra', 'Wipro Technologies', 'HCL Technologies',
  'Patel Traders', 'Kumar Logistics', 'Mehta Suppliers Pvt Ltd', 'Singh Properties',
  'Sharma & Associates', 'Verma Distributors', 'Reddy Enterprises',
];

const INVOICE_NUMS = [
  'INV-2025-0411', 'INV-2025-0412', 'INV-2025-0415', 'INV-2025-0418',
  'INV-2025-0421', 'INV-2025-0422', 'INV-2025-0425', 'INV-2025-0428',
  'INV-2025-0431', 'INV-2025-0433', 'INV-2025-0435', 'INV-2025-0437',
];

const UPI_VPAS = [
  'reliance@hdfc', 'tata@axis', 'infosys@icici', 'asian@okhdfc',
  'britannia@ybl', 'maruti@apbl', 'patel.9876@okaxis', 'kumar.logistics@paytm',
  'mehta.suppliers@ybl', 'sharma.associates@okhdfcbank',
];

const DESCRIPTIONS_CREDIT = [
  'NEFT-{party}', 'RTGS-{party}', 'UPI/{party}', 'IMPS-{party}', 'INF-{party} GST INV',
];
const DESCRIPTIONS_DEBIT = [
  'NEFT-{party}', 'UPI/{party}', 'RTGS-Salary {party}', 'TDS Payment {party}',
  'Rent-{party}', 'Purchase-{party}', 'GST Payment-{party}',
];

function fillTemplate(tpl: string, party: string): string {
  return tpl.replace('{party}', party);
}

function categorise(description: string, type: TxnType, amount: number): TxnCategory {
  const d = description.toLowerCase();
  if (d.includes('salary') || d.includes('payroll')) return 'payroll';
  if (d.includes('gst') || d.includes('tds') || d.includes('tax')) return 'tax';
  if (d.includes('rent')) return 'rent';
  if (d.includes('logistics') || d.includes('freight')) return 'logistics';
  if (d.includes('purchase')) return 'purchase';
  if (d.includes('interest')) return 'interest';
  if (d.includes('refund')) return 'refund';
  if (d.includes('charges') || d.includes('fee') || amount < 0 && amount > -2000) return 'fee';
  if (d.includes('transfer') || d.includes('neft') && type === 'debit' && amount > -50000) return 'transfer';
  if (type === 'credit' && amount > 10000) return 'revenue';
  return 'uncategorised';
}

// ─── Seeding: only runs when the DB has no BankAccount rows ────────────────────

export async function ensureSeedData(): Promise<void> {
  const accountCount = await db.bankAccount.count();
  if (accountCount > 0) return;

  // Create accounts
  const accounts = [];
  for (const seed of SEED_BANKS) {
    const acc = await db.bankAccount.create({
      data: {
        bankName: seed.bankName,
        accountMasked: seed.accountMasked,
        accountType: seed.accountType,
        ifsc: seed.ifsc ?? null,
        balance: seed.currentBalance,
        availableBalance: seed.availableBalance,
        overdraftLimit: seed.overdraftLimit,
        upiHandle: seed.upiHandle ?? null,
        aaConsent: seed.aaConsent ?? false,
        aaConsentExpiry: seed.aaConsentExpiry ?? null,
        status: 'connected',
        lastSyncAt: minsAgo(rand(5, 90)),
      },
    });
    accounts.push(acc);
  }

  // Generate transactions for each account (last 30 days)
  for (const acc of accounts) {
    const txCount = rand(60, 110);
    for (let i = 0; i < txCount; i++) {
      const isCredit = Math.random() < 0.42;
      const party = pick(PARTIES);
      const amount = isCredit ? rand(15, 480) * 1000 : -(rand(5, 250) * 1000);
      const tpl = isCredit ? pick(DESCRIPTIONS_CREDIT) : pick(DESCRIPTIONS_DEBIT);
      const description = fillTemplate(tpl, party);
      const category = categorise(description, isCredit ? 'credit' : 'debit', amount);
      const ref = isCredit
        ? (description.startsWith('UPI') ? `UPI${rand(10**9, 10**10)}` : `UTR${rand(10**11, 10**12)}`)
        : (description.startsWith('UPI') ? `UPI${rand(10**9, 10**10)}` : `UTR${rand(10**11, 10**12)}`);
      const matched = Math.random() < 0.62;
      await db.bankTransaction.create({
        data: {
          accountId: acc.id,
          date: new Date(daysAgoISO(rand(0, 29))),
          description,
          amount,
          type: isCredit ? 'credit' : 'debit',
          category,
          referenceNo: ref,
          counterparty: party,
          matched,
          matchedInvoice: matched ? pick(INVOICE_NUMS) : null,
          matchedParty: matched ? party : null,
          matchConfidence: matched ? rand(82, 99) : 0,
          matchedAt: matched ? minsAgo(rand(60, 6000)) : null,
        },
      });
    }
  }

  // Generate UPI transactions
  const upiCount = rand(80, 140);
  for (let i = 0; i < upiCount; i++) {
    const isCredit = Math.random() < 0.55;
    const vpa = pick(UPI_VPAS);
    const partyName = vpa.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const amount = isCredit ? rand(2, 95) * 1000 : -(rand(1, 35) * 1000);
    const ref = `UPI${rand(10**9, 10**10)}`;
    const matched = Math.random() < 0.48;
    const settled = Math.random() < 0.85;
    await db.uPITransaction.create({
      data: {
        accountId: accounts[0].id,
        upiId: vpa,
        vpaCounterparty: partyName,
        date: new Date(daysAgoISO(rand(0, 29))),
        amount,
        type: isCredit ? 'credit' : 'debit',
        referenceNo: ref,
        notes: isCredit ? 'UPI Collect received' : 'UPI Payment',
        matched,
        matchedInvoice: matched ? pick(INVOICE_NUMS) : null,
        matchedParty: matched ? partyName : null,
        status: settled ? 'settled' : pick(['pending', 'pending', 'failed', 'reversed']),
      },
    });
  }

  // Generate AA connections
  const aaSeeds = [
    { aaName: 'OneMoney', linkedAccounts: 3, mobile: '9876543210' },
    { aaName: 'Finvu', linkedAccounts: 2, mobile: '9876543210' },
    { aaName: 'CAMSOVD', linkedAccounts: 1, mobile: '9876543210' },
  ];
  for (const s of aaSeeds) {
    const approved = s.aaName !== 'CAMSOVD';
    await db.aAConnection.create({
      data: {
        aaName: s.aaName,
        customerMobile: s.mobile,
        consentHandle: uid('ch'),
        consentStatus: approved ? 'approved' : 'pending',
        consentExpiry: approved ? daysFromNowISO(rand(10, 90)) : null,
        fiTypes: 'DEPOSIT,TERM',
        linkedAccounts: s.linkedAccounts,
        lastFetchAt: approved ? minsAgo(rand(60, 600)) : null,
        status: approved ? 'connected' : 'disconnected',
      },
    });
  }

  // Generate bank reconciliation entries
  const reconCount = rand(40, 70);
  for (let i = 0; i < reconCount; i++) {
    const matched = Math.random() < 0.72;
    const party = pick(PARTIES);
    const amount = rand(15, 480) * 1000;
    const isUPI = Math.random() < 0.45;
    const bankRef = isUPI ? `UPI${rand(10**9, 10**10)}` : `UTR${rand(10**11, 10**12)}`;
    let status: ReconStatus = 'matched';
    let mismatchType: MismatchType | undefined;
    if (!matched) {
      const opts: Array<{ s: ReconStatus; m: MismatchType }> = [
        { s: 'unmatched', m: 'unmatched_payment' },
        { s: 'pending', m: 'missing_entry' },
        { s: 'duplicate', m: 'duplicate' },
        { s: 'partial', m: 'partial_payment' },
      ];
      const choice = pick(opts);
      status = choice.s;
      mismatchType = choice.m;
    }
    await db.bankReconciliation.create({
      data: {
        accountId: accounts[0].id,
        bankRef,
        bankAmount: amount,
        matchedInvoice: matched ? pick(INVOICE_NUMS) : null,
        matchedTo: matched ? party : null,
        status,
        mismatchType: mismatchType ?? null,
        confidencePct: matched ? rand(82, 99) : rand(20, 60),
        suggestedAction: matched ? null : pick([
          'Match to invoice INV-2025-0431',
          'Verify with customer — possible duplicate',
          'Reclassify as bank charge',
          'Create missing invoice entry',
        ]),
        at: minsAgo(rand(10, 4000)),
      },
    });
  }

  // Generate collections cases
  const collCount = rand(10, 18);
  for (let i = 0; i < collCount; i++) {
    const party = pick(PARTIES);
    const inv = pick(INVOICE_NUMS);
    const outstanding = rand(35, 480) * 1000;
    const daysOver = rand(3, 95);
    const risk: RiskLevel = daysOver > 60 ? 'critical' : daysOver > 30 ? 'high' : daysOver > 14 ? 'medium' : 'low';
    const recovered = Math.random() < 0.25;
    await db.collectionsCase.create({
      data: {
        invoiceNo: inv,
        clientName: party,
        outstanding,
        dueDate: daysAgoISO(daysOver),
        daysOverdue: daysOver,
        riskLevel: risk,
        reminderCount: rand(0, 3),
        lastReminderAt: Math.random() < 0.7 ? daysAgoISO(rand(1, 20)) : null,
        nextActionAt: daysFromNowISO(rand(0, 5)),
        escalationLevel: daysOver > 60 ? 3 : daysOver > 30 ? 2 : daysOver > 14 ? 1 : 0,
        status: recovered ? 'recovered' : daysOver > 60 ? 'escalated' : 'open',
      },
    });
  }

  // Generate daily cash forecast (last 30 days + next 14 days)
  let opening = 4500000;
  for (let d = 30; d >= 1; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const inflows = rand(50, 350) * 1000;
    const outflows = rand(40, 280) * 1000;
    const closing = opening + inflows - outflows;
    await db.cashForecast.create({
      data: {
        date,
        openingBalance: opening,
        inflows,
        outflows,
        closingBalance: closing,
        expectedCollections: inflows,
        expectedPayments: outflows,
        burnRate: outflows,
        runwayDays: closing > 0 ? Math.floor(closing / Math.max(outflows, 1) * 30) : 0,
        shortage: closing < 500000,
        shortageAmount: closing < 500000 ? 500000 - closing : 0,
        horizon: 'daily',
      },
    });
    opening = closing;
  }
  // Projection for next 14 days
  for (let d = 1; d <= 14; d++) {
    const date = new Date();
    date.setDate(date.getDate() + d);
    const inflows = rand(50, 280) * 1000;
    const outflows = rand(60, 320) * 1000;
    const closing = opening + inflows - outflows;
    await db.cashForecast.create({
      data: {
        date,
        openingBalance: opening,
        inflows,
        outflows,
        closingBalance: closing,
        expectedCollections: inflows,
        expectedPayments: outflows,
        burnRate: outflows,
        runwayDays: closing > 0 ? Math.floor(closing / Math.max(outflows, 1) * 30) : 0,
        shortage: closing < 500000,
        shortageAmount: closing < 500000 ? 500000 - closing : 0,
        horizon: d <= 7 ? '7d' : '30d',
      },
    });
    opening = closing;
  }
}

// ─── Module 1: Bank Account Management™ ───────────────────────────────────────

export async function buildAccountsState(): Promise<BankAccountSummary[]> {
  await ensureSeedData();
  const rows = await db.bankAccount.findMany({ orderBy: { bankName: 'asc' } });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const out: BankAccountSummary[] = [];
  for (const r of rows) {
    const recordsToday = await db.bankTransaction.count({
      where: { accountId: r.id, date: { gte: todayStart } },
    });
    out.push({
      id: r.id,
      bankName: r.bankName,
      accountMasked: r.accountMasked,
      accountType: r.accountType as BankAccountSummary['accountType'],
      ifsc: r.ifsc ?? undefined,
      currentBalance: r.balance,
      availableBalance: r.availableBalance,
      overdraftLimit: r.overdraftLimit,
      upiHandle: r.upiHandle ?? undefined,
      aaConsent: r.aaConsent,
      aaConsentExpiry: r.aaConsentExpiry?.toISOString() ?? undefined,
      status: r.status as BankAccountSummary['status'],
      lastSyncAt: r.lastSyncAt?.toISOString() ?? nowISO(),
      recordsToday,
    });
  }
  return out;
}

// ─── Module 2: Bank Statement Sync™ ───────────────────────────────────────────

export async function buildStatementsState(
  accounts: BankAccountSummary[],
  limit = 12,
): Promise<BankStatementSummary> {
  await ensureSeedData();
  const accMap = new Map(accounts.map(a => [a.id, a]));
  const rows = await db.bankTransaction.findMany({
    orderBy: { date: 'desc' },
    take: limit,
  });
  const totalTransactions = await db.bankTransaction.count();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const last7d = new Date();
  last7d.setDate(last7d.getDate() - 7);
  const last30d = new Date();
  last30d.setDate(last30d.getDate() - 30);

  const [todayCount, last7dCount, last30dCount] = await Promise.all([
    db.bankTransaction.count({ where: { date: { gte: todayStart } } }),
    db.bankTransaction.count({ where: { date: { gte: last7d } } }),
    db.bankTransaction.count({ where: { date: { gte: last30d } } }),
  ]);

  const last30dTxns = await db.bankTransaction.findMany({
    where: { date: { gte: last30d } },
    select: { amount: true, category: true, type: true },
  });
  const inflow30d = last30dTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow30d = last30dTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const categorised = last30dTxns.filter(t => t.category !== 'uncategorised').length;
  const categorisationPct = last30dTxns.length > 0
    ? Math.round((categorised / last30dTxns.length) * 100)
    : 0;

  const recentTransactions: BankTransactionRow[] = rows.map(r => {
    const acc = accMap.get(r.accountId);
    return {
      id: r.id,
      accountId: r.accountId,
      bankName: acc?.bankName ?? '—',
      accountMasked: acc?.accountMasked ?? '—',
      date: r.date.toISOString(),
      description: r.description,
      amount: r.amount,
      type: r.type as TxnType,
      category: r.category as TxnCategory,
      referenceNo: r.referenceNo ?? undefined,
      counterparty: r.counterparty ?? undefined,
      matched: r.matched,
      matchedInvoice: r.matchedInvoice ?? undefined,
      matchedParty: r.matchedParty ?? undefined,
      matchConfidence: r.matchConfidence,
    };
  });

  return {
    totalTransactions,
    todayCount,
    last7dCount,
    last30dCount,
    inflow30d,
    outflow30d,
    net30d: inflow30d - outflow30d,
    categorisationPct,
    recentTransactions,
  };
}

// ─── Module 3: Account Aggregator Cloud™ ──────────────────────────────────────

export async function buildAAState(): Promise<AAStatusSummary> {
  await ensureSeedData();
  const rows = await db.aAConnection.findMany({ orderBy: { createdAt: 'desc' } });
  const connections: AAConnectionSummary[] = rows.map(r => ({
    id: r.id,
    aaName: r.aaName,
    customerMobile: r.customerMobile ?? undefined,
    consentStatus: r.consentStatus as AAConnectionSummary['consentStatus'],
    consentHandle: r.consentHandle ?? undefined,
    consentExpiry: r.consentExpiry?.toISOString() ?? undefined,
    fiTypes: (r.fiTypes ?? '').split(',').filter(Boolean),
    linkedAccounts: r.linkedAccounts,
    lastFetchAt: r.lastFetchAt?.toISOString() ?? undefined,
    status: r.status as AAConnectionSummary['status'],
  }));

  const approved = connections.filter(c => c.consentStatus === 'approved');
  const pending = connections.filter(c => c.consentStatus === 'pending');
  const expiries = approved
    .map(c => c.consentExpiry ? new Date(c.consentExpiry).getTime() : null)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);

  return {
    totalConnections: connections.length,
    approvedConnections: approved.length,
    pendingConnections: pending.length,
    totalLinkedAccounts: connections.reduce((s, c) => s + c.linkedAccounts, 0),
    nextExpiryIn: expiries.length > 0
      ? Math.max(0, Math.ceil((expiries[0] - Date.now()) / 86400000))
      : undefined,
    connections,
  };
}

// ─── Module 4: Cash Flow Engine™ ──────────────────────────────────────────────

export async function buildCashFlowState(accounts: BankAccountSummary[]): Promise<CashFlowSummary> {
  await ensureSeedData();
  const cashPosition = accounts.reduce((s, a) => s + a.availableBalance, 0);

  // Daily points (last 30 days)
  const dailyRows = await db.cashForecast.findMany({
    where: { horizon: 'daily' },
    orderBy: { date: 'asc' },
  });
  const forecast7dRows = await db.cashForecast.findMany({
    where: { horizon: '7d' },
    orderBy: { date: 'asc' },
  });
  const forecast30dRows = await db.cashForecast.findMany({
    where: { horizon: '30d' },
    orderBy: { date: 'asc' },
  });

  const toPoint = (r: typeof dailyRows[number]): CashFlowDailyPoint => ({
    date: r.date.toISOString(),
    opening: r.openingBalance,
    inflows: r.inflows,
    outflows: r.outflows,
    closing: r.closingBalance,
    shortage: r.shortage,
    shortageAmount: r.shortageAmount,
  });

  const daily = dailyRows.map(toPoint);
  const forecast7d = forecast7dRows.map(toPoint);
  const forecast30d = forecast30dRows.map(toPoint);

  // Burns (avg outflow over last 7 actual days)
  const last7 = daily.slice(-7);
  const dailyBurn = last7.length > 0 ? last7.reduce((s, d) => s + d.outflows, 0) / last7.length : 0;
  const monthlyBurn = dailyBurn * 30;

  // Runway (cash / daily burn, capped)
  const runwayDays = dailyBurn > 0 ? Math.min(730, Math.floor(cashPosition / dailyBurn)) : 730;

  // Expected collections/payments next 7 days (from forecast)
  const next7 = forecast7d;
  const expectedCollections = next7.reduce((s, d) => s + d.inflows, 0);
  const expectedPayments = next7.reduce((s, d) => s + d.outflows, 0);

  // Shortage detection
  const shortagePoint = next7.find(d => d.shortage);
  const shortageDetected = !!shortagePoint;
  const shortageAmount = shortagePoint?.shortageAmount ?? 0;
  const shortageDate = shortagePoint?.date;

  // Cash position change vs 30 days ago
  const opening30Ago = daily[0]?.opening ?? cashPosition;
  const cashPositionChangePct = opening30Ago > 0
    ? ((cashPosition - opening30Ago) / opening30Ago) * 100
    : 0;

  return {
    cashPosition,
    cashPositionChangePct,
    dailyBurn,
    monthlyBurn,
    runwayDays,
    expectedCollections,
    expectedPayments,
    shortageDetected,
    shortageAmount,
    shortageDate,
    daily,
    forecast7d,
    forecast30d,
  };
}

// ─── Module 5: Auto Reconciliation Engine™ ────────────────────────────────────

export async function buildReconciliationState(limit = 20): Promise<ReconciliationSummary> {
  await ensureSeedData();
  const rows = await db.bankReconciliation.findMany({
    orderBy: { at: 'desc' },
    take: limit,
  });

  const entries: ReconciliationEntry[] = rows.map(r => ({
    id: r.id,
    bankRef: r.bankRef,
    bankAmount: r.bankAmount,
    matchedInvoice: r.matchedInvoice ?? undefined,
    matchedTo: r.matchedTo ?? undefined,
    status: r.status as ReconStatus,
    mismatchType: (r.mismatchType as MismatchType | null) ?? undefined,
    confidencePct: r.confidencePct,
    suggestedAction: r.suggestedAction ?? undefined,
    at: r.at.toISOString(),
  }));

  const matched = entries.filter(e => e.status === 'matched');
  const unmatched = entries.filter(e => e.status === 'unmatched');
  const pending = entries.filter(e => e.status === 'pending');
  const duplicate = entries.filter(e => e.status === 'duplicate');
  const partial = entries.filter(e => e.status === 'partial');
  const matchedPct = entries.length > 0 ? Math.round((matched.length / entries.length) * 100) : 0;
  const matchedAmount = matched.reduce((s, e) => s + e.bankAmount, 0);
  const unmatchedAmount = unmatched.reduce((s, e) => s + e.bankAmount, 0)
    + partial.reduce((s, e) => s + e.bankAmount, 0);

  // Risk score: weighted by unmatched/partial + duplicate
  const totalUnmatched = unmatched.length + partial.length + duplicate.length;
  const riskScore = entries.length > 0
    ? clamp(Math.round((totalUnmatched / entries.length) * 100), 0, 100)
    : 0;
  const riskLevel = riskFromScore(riskScore);

  return {
    totalTransactions: entries.length,
    matched: matched.length,
    unmatched: unmatched.length,
    pending: pending.length,
    duplicate: duplicate.length,
    partial: partial.length,
    matchedPct,
    matchedAmount,
    unmatchedAmount,
    pendingCollections: partial.length,
    pendingPayments: pending.length,
    riskScore,
    riskLevel,
    entries,
  };
}

// ─── Module 6: UPI Cloud™ ─────────────────────────────────────────────────────

export async function buildUPIState(limit = 12): Promise<UPISummary> {
  await ensureSeedData();
  const rows = await db.uPITransaction.findMany({
    orderBy: { date: 'desc' },
    take: limit,
  });
  const totalTransactions = await db.uPITransaction.count();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const last30d = new Date();
  last30d.setDate(last30d.getDate() - 30);

  const [todayCount, last30dRows] = await Promise.all([
    db.uPITransaction.count({ where: { date: { gte: todayStart } } }),
    db.uPITransaction.findMany({ where: { date: { gte: last30d } }, select: { amount: true, upiId: true, vpaCounterparty: true, status: true } }),
  ]);

  const collections30d = last30dRows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const payments30d = last30dRows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const pendingSettlements = last30dRows.filter(t => t.status === 'pending').length;
  const pendingSettlementAmount = last30dRows.filter(t => t.status === 'pending' && t.amount > 0).reduce((s, t) => s + t.amount, 0);

  // Top customers (by total collection)
  const byVpa = new Map<string, { name: string; total: number; count: number }>();
  for (const t of last30dRows) {
    if (t.amount <= 0) continue;
    const key = t.upiId;
    const name = t.vpaCounterparty ?? t.upiId.split('@')[0];
    const existing = byVpa.get(key) ?? { name, total: 0, count: 0 };
    existing.total += t.amount;
    existing.count += 1;
    byVpa.set(key, existing);
  }
  const topCustomers = Array.from(byVpa.entries())
    .map(([vpa, v]) => ({ vpa, name: v.name, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const transactions: UPITransactionRow[] = rows.map(r => ({
    id: r.id,
    upiId: r.upiId,
    vpaCounterparty: r.vpaCounterparty ?? undefined,
    date: r.date.toISOString(),
    amount: r.amount,
    type: r.type as TxnType,
    referenceNo: r.referenceNo ?? undefined,
    notes: r.notes ?? undefined,
    matched: r.matched,
    matchedInvoice: r.matchedInvoice ?? undefined,
    matchedParty: r.matchedParty ?? undefined,
    status: r.status as UPITransactionRow['status'],
  }));

  return {
    totalTransactions,
    todayCount,
    collections30d,
    payments30d,
    pendingSettlements,
    pendingSettlementAmount,
    topCustomers,
    transactions,
  };
}

// ─── Module 7: Collections Recovery Engine™ ───────────────────────────────────

export async function buildCollectionsState(limit = 20): Promise<CollectionsSummary> {
  await ensureSeedData();
  const rows = await db.collectionsCase.findMany({
    orderBy: [{ status: 'asc' }, { daysOverdue: 'desc' }],
    take: limit,
  });

  const cases: CollectionsCase[] = rows.map(r => ({
    id: r.id,
    invoiceNo: r.invoiceNo,
    clientName: r.clientName,
    outstanding: r.outstanding,
    dueDate: r.dueDate?.toISOString() ?? undefined,
    daysOverdue: r.daysOverdue,
    riskLevel: r.riskLevel as CollectionsCase['riskLevel'],
    reminderCount: r.reminderCount,
    lastReminderAt: r.lastReminderAt?.toISOString() ?? undefined,
    nextActionAt: r.nextActionAt?.toISOString() ?? undefined,
    escalationLevel: r.escalationLevel as CollectionsCase['escalationLevel'],
    status: r.status as CollectionsCase['status'],
  }));

  const open = cases.filter(c => c.status === 'open');
  const recovered = cases.filter(c => c.status === 'recovered');
  const escalated = cases.filter(c => c.status === 'escalated');
  const totalOutstanding = open.reduce((s, c) => s + c.outstanding, 0);
  const recovered30d = recovered.reduce((s, c) => s + c.outstanding, 0);
  const avgDaysOverdue = cases.length > 0
    ? Math.round(cases.reduce((s, c) => s + c.daysOverdue, 0) / cases.length)
    : 0;
  const nextReminderAt = cases
    .filter(c => c.nextActionAt)
    .map(c => c.nextActionAt!)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  return {
    totalCases: cases.length,
    openCases: open.length,
    recoveredCases: recovered.length,
    escalatedCases: escalated.length,
    totalOutstanding,
    recovered30d,
    avgDaysOverdue,
    nextReminderAt,
    cases,
  };
}

// ─── Module: Oracle Banking Cloud Personality™ ────────────────────────────────

export function buildBankingPersonality(): BankingCloudPersonality {
  return {
    roles: [
      'Live Banking Operator',
      'Cash Flow Monitor',
      'Auto Reconciler',
      'UPI Tracker',
      'Account Aggregator Manager',
      'Collections Recovery Agent',
      'Financial Executor',
    ],
    tagline: 'GSTPilot Banking Cloud™ — Connect. Execute. Automate. Scale.',
    spokenBehaviours: [
      "I've synced your bank accounts.",
      "I've detected ₹3,84,000 in collections.",
      "I've categorised today's expenses.",
      "I've connected your financial accounts.",
      "I've refreshed your banking data.",
      "I've detected a cash shortage.",
      "I've forecasted your cash position.",
      "I've scheduled collections recovery.",
      "I've reconciled your bank transactions.",
      "I've found ₹48,000 unmatched receipts.",
      "I've identified 5 pending collections.",
      "I've detected ₹82,000 in UPI collections.",
      "I've matched UPI payments with invoices.",
      "I've detected 12 overdue invoices.",
      "I've scheduled collection reminders.",
      "I've initiated recovery workflows.",
    ],
    forbiddenPhrases: [
      "I can help you analyse cash flow.",
      "You should track your bank balance.",
      "Please reconcile your transactions manually.",
      "I cannot connect to your bank.",
      "You need to track this yourself.",
      "I'm just an AI banking assistant.",
      "Please consult your accountant for cash flow.",
    ],
    operatingPrinciples: [
      'GSTPilot knows my money — bank balances are always live.',
      'GSTPilot reconciles transactions automatically — never manual.',
      'GSTPilot detects cash shortages before they happen.',
      'GSTPilot monitors collections and expenses in real time.',
      'GSTPilot executes financial operations — the user does NOT use software.',
    ],
    successCriteria: [
      "I don't manually track my cash.",
      "GSTPilot knows my bank balances.",
      "GSTPilot reconciles transactions automatically.",
      "GSTPilot predicts cash shortages.",
      "GSTPilot executes financial operations for me.",
    ],
  };
}

// ─── Headline builder ─────────────────────────────────────────────────────────

function buildHeadline(s: Omit<BankingCloudState, 'headline'>): string {
  const balance = s.cashflow.cashPosition;
  const matched = s.reconciliation.matchedPct;
  const overdue = s.collections.openCases;
  const upiColl = s.upi.collections30d;
  const shortage = s.cashflow.shortageDetected;
  return `Cash position ${inrShort(balance)} · ${matched}% of bank transactions reconciled · ${overdue} overdue invoices open · ${inrShort(upiColl)} in UPI collections (30d)${shortage ? ' · cash shortage projected' : ''}.`;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function getBankingCloudState(user?: { name?: string } | null): Promise<BankingCloudState> {
  await ensureSeedData();
  const accounts = await buildAccountsState();
  const statements = await buildStatementsState(accounts);
  const aa = await buildAAState();
  const cashflow = await buildCashFlowState(accounts);
  const reconciliation = await buildReconciliationState();
  const upi = await buildUPIState();
  const collections = await buildCollectionsState();
  const personality = buildBankingPersonality();

  const partial = {
    accounts,
    statements,
    aa,
    cashflow,
    reconciliation,
    upi,
    collections,
    personality,
    generatedAt: nowISO(),
    hasLiveData: accounts.length > 0,
    accountCount: accounts.length,
  };
  const headline = buildHeadline(partial);
  return { ...partial, headline };
}

// ─── Format helpers for Oracle context injection ──────────────────────────────

export function formatBankingCloudContextBlock(state: BankingCloudState): string {
  const lines: string[] = [];
  lines.push('── LIVE BANKING CLOUD STATE ──');
  lines.push(`Generated: ${state.generatedAt}`);
  lines.push(`Headline: ${state.headline}`);
  lines.push(`Connected accounts: ${state.accountCount}`);
  lines.push('');

  // Accounts
  lines.push('Module 1 — Bank Account Management:');
  state.accounts.forEach((a) => {
    lines.push(`  • ${a.bankName} ${a.accountMasked} (${a.accountType}, IFSC ${a.ifsc ?? '—'}) — current ${inrShort(a.currentBalance)} · available ${inrShort(a.availableBalance)}${a.overdraftLimit > 0 ? ` · OD limit ${inrShort(a.overdraftLimit)}` : ''}${a.upiHandle ? ` · UPI ${a.upiHandle}` : ''}${a.aaConsent ? ' · AA consent active' : ''} · ${a.status} · last sync ${a.lastSyncAt.slice(11, 16)} · ${a.recordsToday} txns today`);
  });
  lines.push('');

  // Statements
  const s = state.statements;
  lines.push('Module 2 — Bank Statement Sync:');
  lines.push(`  Total transactions: ${s.totalTransactions} · today ${s.todayCount} · 7d ${s.last7dCount} · 30d ${s.last30dCount}`);
  lines.push(`  30d inflows: ${inrShort(s.inflow30d)} · outflows: ${inrShort(s.outflow30d)} · net ${inrShort(s.net30d)} · categorisation ${s.categorisationPct}%`);
  s.recentTransactions.slice(0, 5).forEach((t) => {
    lines.push(`  · ${t.date.slice(0, 10)} ${t.bankName} ${t.accountMasked} — ${t.description} · ${inrShort(t.amount)} · ${CATEGORY_GLYPH[t.category]} ${t.category}${t.matched ? ` ✓ matched ${t.matchedInvoice} (${t.matchedParty})` : ' ✗ unmatched'}`);
  });
  lines.push('');

  // AA
  lines.push('Module 3 — Account Aggregator Cloud:');
  lines.push(`  Connections: ${state.aa.totalConnections} (${state.aa.approvedConnections} approved, ${state.aa.pendingConnections} pending) · linked accounts: ${state.aa.totalLinkedAccounts}${state.aa.nextExpiryIn !== undefined ? ` · next consent expiry in ${state.aa.nextExpiryIn}d` : ''}`);
  state.aa.connections.forEach((c) => {
    lines.push(`  • ${c.aaName} [${c.consentStatus}] — ${c.linkedAccounts} linked · FI types ${(c.fiTypes ?? []).join(', ')}${c.consentExpiry ? ` · expiry ${c.consentExpiry.slice(0, 10)}` : ''} · ${c.status}${c.lastFetchAt ? ` · last fetch ${c.lastFetchAt.slice(11, 16)}` : ''}`);
  });
  lines.push('');

  // Cash flow
  const cf = state.cashflow;
  lines.push('Module 4 — Cash Flow Engine:');
  lines.push(`  Cash position: ${inrShort(cf.cashPosition)} (${cf.cashPositionChangePct >= 0 ? '+' : ''}${cf.cashPositionChangePct.toFixed(1)}% vs 30d ago)`);
  lines.push(`  Daily burn: ${inrShort(cf.dailyBurn)} · Monthly burn: ${inrShort(cf.monthlyBurn)} · Runway: ${cf.runwayDays} days`);
  lines.push(`  Next 7d expected: collections ${inrShort(cf.expectedCollections)}, payments ${inrShort(cf.expectedPayments)}`);
  if (cf.shortageDetected) {
    lines.push(`  ⚠️ CASH SHORTAGE DETECTED — projected ${inrShort(cf.shortageAmount)} shortfall on ${cf.shortageDate ? cf.shortageDate.slice(0, 10) : 'upcoming date'}.`);
  } else {
    lines.push('  No cash shortage projected in the next 7 days.');
  }
  lines.push('');

  // Reconciliation
  const rc = state.reconciliation;
  lines.push('Module 5 — Auto Reconciliation Engine:');
  lines.push(`  Matched: ${rc.matched}/${rc.totalTransactions} (${rc.matchedPct}%) · unmatched ${rc.unmatched} · pending ${rc.pending} · duplicate ${rc.duplicate} · partial ${rc.partial}`);
  lines.push(`  Matched amount: ${inrShort(rc.matchedAmount)} · Unmatched amount: ${inrShort(rc.unmatchedAmount)} · Risk ${rc.riskScore}/100 (${RISK_GLYPH[rc.riskLevel]} ${rc.riskLevel})`);
  rc.entries.slice(0, 5).forEach((e) => {
    lines.push(`  · ${RECON_STATUS_GLYPH[e.status]} ${e.bankRef} · ${inrShort(e.bankAmount)}${e.matchedInvoice ? ` → ${e.matchedInvoice} (${e.matchedTo})` : ''}${e.mismatchType ? ` · ${e.mismatchType}` : ''} · confidence ${e.confidencePct}%`);
  });
  lines.push('');

  // UPI
  const up = state.upi;
  lines.push('Module 6 — UPI Cloud:');
  lines.push(`  Total UPI txns: ${up.totalTransactions} · today ${up.todayCount} · 30d collections ${inrShort(up.collections30d)} · payments ${inrShort(up.payments30d)} · pending settlements ${up.pendingSettlements} (${inrShort(up.pendingSettlementAmount)})`);
  if (up.topCustomers.length > 0) {
    lines.push(`  Top UPI customers:`);
    up.topCustomers.slice(0, 4).forEach((c) => {
      lines.push(`  · ${c.vpa} (${c.name}) — ${inrShort(c.total)} across ${c.count} txns`);
    });
  }
  up.transactions.slice(0, 4).forEach((t) => {
    lines.push(`  · ${t.date.slice(0, 10)} ${t.upiId} — ${inrShort(t.amount)} · ${t.status}${t.matched ? ` ✓ ${t.matchedInvoice}` : ''}`);
  });
  lines.push('');

  // Collections
  const co = state.collections;
  lines.push('Module 7 — Collections Recovery Engine:');
  lines.push(`  Open cases: ${co.openCases} · recovered: ${co.recoveredCases} · escalated: ${co.escalatedCases} · total outstanding: ${inrShort(co.totalOutstanding)} · avg days overdue: ${co.avgDaysOverdue}`);
  co.cases.slice(0, 5).forEach((c) => {
    lines.push(`  • ${RISK_GLYPH[c.riskLevel]} ${c.invoiceNo} — ${c.clientName} — ${inrShort(c.outstanding)} outstanding · ${c.daysOverdue}d overdue · escalation ${c.escalationLevel} · ${c.status}`);
  });
  lines.push('');
  lines.push('── END BANKING CLOUD STATE ──');
  return lines.join('\n');
}

// ─── Action handlers (called by API routes) ───────────────────────────────────

export async function connectBankAccount(payload: { bankName?: string; accountType?: string } = {}): Promise<BankActionResponse> {
  await ensureSeedData();
  const bankName = payload.bankName || pick(['Kotak Mahindra', 'Yes Bank', 'IndusInd Bank', 'Federal Bank', 'Punjab National Bank']);
  const accountType = (payload.accountType as BankAccountSummary['accountType']) || 'current';
  const last4 = String(rand(1000, 9999));
  const ifsc = `${bankName.slice(0, 4).toUpperCase().padEnd(4, 'X')}000${rand(100, 999)}`.slice(0, 11);
  const balance = rand(50, 250) * 10000;
  const acc = await db.bankAccount.create({
    data: {
      bankName,
      accountMasked: `****${last4}`,
      accountType,
      ifsc,
      balance,
      availableBalance: balance,
      overdraftLimit: 0,
      upiHandle: `yourbiz@${bankName.split(' ')[0].toLowerCase()}`,
      aaConsent: false,
      status: 'connected',
      lastSyncAt: nowISO(),
    },
  });
  return {
    ok: true,
    module: 'accounts',
    action: 'connect',
    message: `Connected ${bankName} ${accountType} account ****${last4}`,
    result: { accountId: acc.id, bankName, accountMasked: `****${last4}` },
    oracleAck: `I've connected your ${bankName} ${accountType} account ****${last4}.`,
  };
}

export async function syncBankAccounts(accountId?: string): Promise<BankActionResponse> {
  await ensureSeedData();
  const where = accountId ? { id: accountId } : {};
  const accounts = await db.bankAccount.findMany({ where });
  if (accounts.length === 0) {
    return {
      ok: false, module: 'accounts', action: 'sync',
      message: 'No bank accounts to sync.', oracleAck: "I couldn't find any bank accounts to sync.",
    };
  }
  let totalNew = 0;
  for (const acc of accounts) {
    // Create a few new transactions to simulate a fresh sync
    const newCount = rand(3, 9);
    for (let i = 0; i < newCount; i++) {
      const isCredit = Math.random() < 0.45;
      const party = pick(PARTIES);
      const amount = isCredit ? rand(15, 480) * 1000 : -(rand(5, 250) * 1000);
      const tpl = isCredit ? pick(DESCRIPTIONS_CREDIT) : pick(DESCRIPTIONS_DEBIT);
      const description = fillTemplate(tpl, party);
      const category = categorise(description, isCredit ? 'credit' : 'debit', amount);
      const ref = `UTR${rand(10**11, 10**12)}`;
      await db.bankTransaction.create({
        data: {
          accountId: acc.id,
          date: new Date(),
          description,
          amount,
          type: isCredit ? 'credit' : 'debit',
          category,
          referenceNo: ref,
          counterparty: party,
          matched: false,
        },
      });
      totalNew++;
    }
    await db.bankAccount.update({
      where: { id: acc.id },
      data: { lastSyncAt: nowISO(), status: 'connected' },
    });
  }
  return {
    ok: true,
    module: 'accounts',
    action: 'sync',
    message: `Synced ${accounts.length} account(s) — ${totalNew} new transactions pulled.`,
    result: { accountsSynced: accounts.length, newTransactions: totalNew },
    oracleAck: `I've synced ${accounts.length} bank account${accounts.length > 1 ? 's' : ''} and pulled ${totalNew} new transactions.`,
  };
}

export async function syncStatements(): Promise<BankActionResponse> {
  return syncBankAccounts();
}

export async function connectAA(payload: { aaName?: string; mobile?: string } = {}): Promise<BankActionResponse> {
  const aaName = payload.aaName || pick(['OneMoney', 'Finvu', 'CAMSOVD', 'Yodlee', 'MoneyOne']);
  const mobile = payload.mobile || '9876543210';
  const conn = await db.aAConnection.create({
    data: {
      aaName,
      customerMobile: mobile,
      consentHandle: uid('ch'),
      consentStatus: 'pending',
      fiTypes: 'DEPOSIT,TERM',
      linkedAccounts: 0,
      status: 'disconnected',
    },
  });
  return {
    ok: true,
    module: 'aa',
    action: 'connect',
    message: `Initiated AA consent with ${aaName}.`,
    result: { connectionId: conn.id, aaName, consentHandle: conn.consentHandle },
    oracleAck: `I've initiated the Account Aggregator consent request with ${aaName}.`,
  };
}

export async function consentAA(payload: { connectionId?: string; action?: 'approve' | 'reject' } = {}): Promise<BankActionResponse> {
  const action = payload.action || 'approve';
  let conn;
  if (payload.connectionId) {
    conn = await db.aAConnection.findUnique({ where: { id: payload.connectionId } });
  } else {
    conn = await db.aAConnection.findFirst({ where: { consentStatus: 'pending' } });
  }
  if (!conn) {
    return {
      ok: false, module: 'aa', action: 'consent',
      message: 'No pending AA consent found.', oracleAck: "I couldn't find a pending AA consent to action.",
    };
  }
  const approved = action === 'approve';
  const expiry = daysFromNowISO(rand(30, 90));
  const updated = await db.aAConnection.update({
    where: { id: conn.id },
    data: {
      consentStatus: approved ? 'approved' : 'rejected',
      consentExpiry: approved ? expiry : null,
      linkedAccounts: approved ? rand(1, 4) : 0,
      lastFetchAt: approved ? nowISO() : null,
      status: approved ? 'connected' : 'disconnected',
    },
  });
  return {
    ok: true,
    module: 'aa',
    action: 'consent',
    message: approved ? `AA consent approved — ${updated.linkedAccounts} accounts linked.` : 'AA consent rejected.',
    result: { connectionId: updated.id, consentStatus: updated.consentStatus, linkedAccounts: updated.linkedAccounts },
    oracleAck: approved
      ? `I've connected your financial accounts via ${conn.aaName} — ${updated.linkedAccounts} accounts linked.`
      : `I've rejected the AA consent request from ${conn.aaName}.`,
  };
}

export async function runReconciliation(): Promise<BankActionResponse> {
  await ensureSeedData();
  // Take unmatched reconciliation entries and try to match them
  const unmatched = await db.bankReconciliation.findMany({
    where: { status: { in: ['unmatched', 'pending'] } },
    take: 15,
  });
  let matchedCount = 0;
  for (const r of unmatched) {
    if (Math.random() < 0.55) {
      const party = pick(PARTIES);
      const inv = pick(INVOICE_NUMS);
      await db.bankReconciliation.update({
        where: { id: r.id },
        data: {
          status: 'matched',
          matchedInvoice: inv,
          matchedTo: party,
          confidencePct: rand(82, 99),
          mismatchType: null,
        },
      });
      matchedCount++;
    }
  }
  // Create a fresh recon run summary entry
  const total = await db.bankReconciliation.count();
  const matchedTotal = await db.bankReconciliation.count({ where: { status: 'matched' } });
  const matchedPct = total > 0 ? Math.round((matchedTotal / total) * 100) : 0;
  return {
    ok: true,
    module: 'reconciliation',
    action: 'run',
    message: `Reconciliation run complete — ${matchedCount} newly matched. Match rate now ${matchedPct}%.`,
    result: { newlyMatched: matchedCount, matchedPct, totalReconciled: matchedTotal, totalTransactions: total },
    oracleAck: `I've reconciled your bank transactions — ${matchedCount} newly matched, match rate now ${matchedPct}%.`,
  };
}

export async function connectUPI(): Promise<BankActionResponse> {
  const account = await db.bankAccount.findFirst({ where: { upiHandle: { not: null } } });
  if (!account) {
    return {
      ok: false, module: 'upi', action: 'connect',
      message: 'No UPI-enabled bank account found.', oracleAck: "I couldn't find a UPI-enabled bank account.",
    };
  }
  // Add a few UPI collection requests
  let added = 0;
  for (let i = 0; i < rand(3, 7); i++) {
    const vpa = pick(UPI_VPAS);
    const partyName = vpa.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const amount = rand(5, 75) * 1000;
    await db.uPITransaction.create({
      data: {
        accountId: account.id,
        upiId: vpa,
        vpaCounterparty: partyName,
        date: new Date(),
        amount,
        type: 'credit',
        referenceNo: `UPI${rand(10**9, 10**10)}`,
        notes: 'UPI Collect request',
        matched: false,
        status: pick(['pending', 'pending', 'settled']),
      },
    });
    added++;
  }
  return {
    ok: true,
    module: 'upi',
    action: 'connect',
    message: `UPI Collect active — ${added} new collect requests sent.`,
    result: { newCollectRequests: added },
    oracleAck: `I've activated UPI Collect and sent ${added} new collect requests.`,
  };
}

export async function syncUPI(): Promise<BankActionResponse> {
  await ensureSeedData();
  const account = await db.bankAccount.findFirst();
  if (!account) {
    return {
      ok: false, module: 'upi', action: 'sync',
      message: 'No bank account connected.', oracleAck: "I couldn't sync UPI — no bank account is connected.",
    };
  }
  let added = 0;
  let settled = 0;
  // Pull new UPI transactions + settle pending ones
  const pending = await db.uPITransaction.findMany({ where: { status: 'pending' }, take: 10 });
  for (const p of pending) {
    const willSettle = Math.random() < 0.7;
    await db.uPITransaction.update({
      where: { id: p.id },
      data: { status: willSettle ? 'settled' : 'failed' },
    });
    if (willSettle) settled++;
  }
  for (let i = 0; i < rand(5, 12); i++) {
    const isCredit = Math.random() < 0.6;
    const vpa = pick(UPI_VPAS);
    const partyName = vpa.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const amount = isCredit ? rand(2, 75) * 1000 : -(rand(1, 35) * 1000);
    await db.uPITransaction.create({
      data: {
        accountId: account.id,
        upiId: vpa,
        vpaCounterparty: partyName,
        date: new Date(),
        amount,
        type: isCredit ? 'credit' : 'debit',
        referenceNo: `UPI${rand(10**9, 10**10)}`,
        notes: isCredit ? 'UPI Collect received' : 'UPI Payment',
        matched: false,
        status: 'settled',
      },
    });
    added++;
  }
  // Detect collections total
  const last30d = new Date();
  last30d.setDate(last30d.getDate() - 30);
  const collections = await db.uPITransaction.findMany({
    where: { date: { gte: last30d }, type: 'credit', status: 'settled' },
    select: { amount: true },
  });
  const totalColl = collections.reduce((s, t) => s + t.amount, 0);
  return {
    ok: true,
    module: 'upi',
    action: 'sync',
    message: `UPI sync complete — ${added} new txns, ${settled} pending settled. 30d collections: ${inrShort(totalColl)}.`,
    result: { newTransactions: added, settledPending: settled, collections30d: totalColl },
    oracleAck: `I've detected ${inrShort(totalColl)} in UPI collections and matched payments with invoices.`,
  };
}

export async function recoverCollections(): Promise<BankActionResponse> {
  await ensureSeedData();
  // Take open cases and try to recover
  const open = await db.collectionsCase.findMany({
    where: { status: 'open' },
    take: 12,
  });
  let recovered = 0;
  let escalated = 0;
  let recoveredAmt = 0;
  for (const c of open) {
    const willRecover = Math.random() < 0.4;
    if (willRecover) {
      await db.collectionsCase.update({
        where: { id: c.id },
        data: { status: 'recovered', nextActionAt: null },
      });
      recovered++;
      recoveredAmt += c.outstanding;
    } else if (c.daysOverdue > 30) {
      await db.collectionsCase.update({
        where: { id: c.id },
        data: {
          status: 'escalated',
          escalationLevel: Math.min(3, c.escalationLevel + 1),
          nextActionAt: daysFromNowISO(1),
        },
      });
      escalated++;
    } else {
      await db.collectionsCase.update({
        where: { id: c.id },
        data: {
          reminderCount: c.reminderCount + 1,
          lastReminderAt: nowISO(),
          nextActionAt: daysFromNowISO(2),
        },
      });
    }
  }
  return {
    ok: true,
    module: 'collections',
    action: 'recover',
    message: `Recovery run dispatched — ${recovered} recovered (${inrShort(recoveredAmt)}), ${escalated} escalated, ${open.length - recovered - escalated} reminders queued.`,
    result: { recovered, escalated, recoveredAmount: recoveredAmt, totalProcessed: open.length },
    oracleAck: `I've initiated recovery workflows — ${recovered} invoices recovered (${inrShort(recoveredAmt)}) and ${escalated} escalated.`,
  };
}

export async function remindCollections(): Promise<BankActionResponse> {
  await ensureSeedData();
  const open = await db.collectionsCase.findMany({
    where: { status: 'open' },
    take: 20,
  });
  let queued = 0;
  let channels = { whatsapp: 0, email: 0, sms: 0 };
  for (const c of open) {
    await db.collectionsCase.update({
      where: { id: c.id },
      data: {
        reminderCount: c.reminderCount + 1,
        lastReminderAt: nowISO(),
        nextActionAt: daysFromNowISO(rand(1, 3)),
      },
    });
    queued++;
    channels.whatsapp++;
    channels.email++;
    if (c.riskLevel === 'high' || c.riskLevel === 'critical') channels.sms++;
  }
  return {
    ok: true,
    module: 'collections',
    action: 'remind',
    message: `Scheduled reminders for ${queued} overdue invoices — ${channels.whatsapp} WhatsApp, ${channels.email} email, ${channels.sms} SMS.`,
    result: { queued, channels },
    oracleAck: `I've scheduled collection reminders for ${queued} overdue invoices via WhatsApp, Email${channels.sms > 0 ? ' and SMS' : ''}.`,
  };
}

// ─── Generic action dispatcher (used by the route handler) ────────────────────

export async function dispatchBankAction(req: BankActionRequest): Promise<BankActionResponse> {
  switch (req.module) {
    case 'accounts':
      if (req.action === 'connect') return connectBankAccount(req.payload as { bankName?: string; accountType?: string });
      if (req.action === 'sync') return syncBankAccounts((req.payload?.accountId as string) || undefined);
      break;
    case 'statements':
      if (req.action === 'sync') return syncStatements();
      break;
    case 'aa':
      if (req.action === 'connect') return connectAA(req.payload as { aaName?: string; mobile?: string });
      if (req.action === 'consent') return consentAA(req.payload as { connectionId?: string; action?: 'approve' | 'reject' });
      break;
    case 'reconciliation':
      if (req.action === 'run' || req.action === 'reconcile') return runReconciliation();
      break;
    case 'upi':
      if (req.action === 'connect') return connectUPI();
      if (req.action === 'sync') return syncUPI();
      break;
    case 'collections':
      if (req.action === 'recover') return recoverCollections();
      if (req.action === 'remind') return remindCollections();
      break;
    case 'transactions':
    case 'cashflow':
      // Read-only modules — no action needed
      break;
  }
  return {
    ok: false,
    module: req.module,
    action: req.action,
    message: `Unknown action ${req.action} for module ${req.module}`,
    oracleAck: `I couldn't perform that action.`,
  };
}
