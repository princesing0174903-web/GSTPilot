// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Real Data Activation Orchestrator
//
// Loads all active connections from the DB, reconstructs the GSTN + Bank datasets
// from stored data, computes the Business Health Score, and assembles the live
// context payload that Oracle consumes with every prompt.
//
// PHASE 2A — Real Data Platform:
//   • Extended OracleLiveData with cashBurn, runwayDays, collectionEfficiency,
//     expenseCategories, dailyCashFlow, topClients, firmProfile, gstr9, ledgers.
//   • syncConnection() / listSyncLogs() — Real-Time Sync Center engine.
//   • computeLiveDataEngine() — 8-card payload for the Data Engine dashboard.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { generateGstnDataset } from './gstn-data';
import { generateBankDataset } from './bank-data';
import { computeBusinessHealth } from './health-engine';
import type {
  GstnDataset,
  BankDataset,
  BankTransactionRecord,
  OracleLiveData,
  BusinessHealthBreakdown,
  BankProvider,
} from './types';

export type SyncLogRow = Awaited<ReturnType<typeof db.syncLog.findFirst>>;
export type ConnectionRow = Awaited<ReturnType<typeof db.businessConnection.findUnique>>;

// ─── Reconstruct a GstnDataset from stored DB rows ──────────────────────────────
// NOTE: `generateGstnDataset` now returns `null` — real GSTN API integration is a
// future enterprise phase. Until then, there is no synthetic GSTN dataset to load,
// so `loadGstnDataset` returns `null` (honest empty state) for every connection.
// Real DB-backed GSTN rows (GSTRFiling / EInvoice / EWayBill / Notice tables) would
// be rehydrated here when a real GSTN API client is wired up.
async function loadGstnDataset(connectionId: string): Promise<GstnDataset | null> {
  const conn = await db.businessConnection.findUnique({ where: { id: connectionId } });
  if (!conn || conn.type !== 'gstn' || conn.status !== 'active') return null;

  // REAL IMPLEMENTATION PENDING — generator returns null (no synthetic data).
  // Future: rehydrate from real GSTRFiling / EInvoice / EWayBill / Notice rows.
  const dataset = generateGstnDataset(conn.gstin!);
  return dataset; // null
}

// ─── Reconstruct a BankDataset from stored BankTransaction rows ─────────────────
async function loadBankDataset(connectionId: string): Promise<BankDataset | null> {
  const conn = await db.businessConnection.findUnique({ where: { id: connectionId } });
  if (!conn || conn.type !== 'bank' || conn.status !== 'active') return null;

  const txns = await db.bankTransaction.findMany({
    where: { connectionId },
    orderBy: { txnDate: 'asc' },
  });
  if (txns.length === 0) return null;

  // Recompute monthly collections from stored transactions
  const monthlyMap = new Map<string, { collections: number; expenses: number }>();
  for (const t of txns) {
    const month = t.txnDate.toISOString().slice(0, 7);
    if (!monthlyMap.has(month)) monthlyMap.set(month, { collections: 0, expenses: 0 });
    const entry = monthlyMap.get(month)!;
    if (t.type === 'credit' && t.category === 'sales') entry.collections += t.amount;
    if (t.type === 'debit') entry.expenses += Math.abs(t.amount);
  }
  const monthlyCollections = Array.from(monthlyMap.entries())
    .map(([month, v]) => ({ month, collections: Math.round(v.collections * 100) / 100, expenses: Math.round(v.expenses * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-3);

  const totalCredits = txns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalDebits = Math.abs(txns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0));
  const closingBalance = txns.length > 0 ? txns[txns.length - 1].balanceAfter ?? 0 : 0;
  const openingBalance = txns.length > 0 ? (txns[0].balanceAfter ?? 0) - txns[0].amount : 0;

  return {
    provider: conn.provider as BankDataset['provider'],
    maskedAccount: conn.maskedRef ?? 'XXXXXX0000',
    accountType: 'current',
    openingBalance,
    closingBalance,
    totalCredits,
    totalDebits,
    transactions: txns.map(t => ({
      txnDate: t.txnDate.toISOString(),
      description: t.description,
      amount: t.amount,
      type: t.type as 'credit' | 'debit',
      category: (t.category ?? 'other') as BankTransactionRecord['category'],
      counterparty: t.counterparty ?? undefined,
      referenceNo: t.referenceNo ?? undefined,
      balanceAfter: t.balanceAfter ?? 0,
    })),
    monthlyCollections,
  };
}

// ─── Public: assemble the full Oracle live-data context ─────────────────────────
export async function loadOracleLiveData(): Promise<OracleLiveData> {
  const connections = await db.businessConnection.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'asc' },
  });

  const gstnConn = connections.find(c => c.type === 'gstn');
  const bankConn = connections.find(c => c.type === 'bank');

  const gstn = gstnConn ? await loadGstnDataset(gstnConn.id) : null;
  const bank = bankConn ? await loadBankDataset(bankConn.id) : null;

  const health: BusinessHealthBreakdown | null = (gstn || bank)
    ? computeBusinessHealth(gstn, bank)
    : null;

  // Recent transactions (last 10)
  const recentTransactions: BankTransactionRecord[] | undefined = bank
    ? bank.transactions.slice(-10).reverse()
    : undefined;

  // Risky clients: customers with declining collections or large overdue amounts.
  // Approximation from bank counterparty concentration.
  const riskyClients: { name: string; reason: string; amount: number }[] | undefined = bank
    ? (() => {
      // Group credits by counterparty over last 60 days
      const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
      const byCustomer = new Map<string, number>();
      for (const t of bank.transactions) {
        if (t.type !== 'credit' || t.category !== 'sales' || !t.counterparty) continue;
        if (new Date(t.txnDate).getTime() < cutoff) continue;
        byCustomer.set(t.counterparty, (byCustomer.get(t.counterparty) ?? 0) + t.amount);
      }
      // Flag customers whose recent inflows are unusually low (< ₹50k in 60 days but > 0)
      const risky: { name: string; reason: string; amount: number }[] = [];
      for (const [name, amount] of byCustomer.entries()) {
        if (amount < 50000) {
          risky.push({
            name,
            reason: 'Low inflow in last 60 days — possible collection delay',
            amount: Math.round(amount),
          });
        }
      }
      // Sort by amount ascending (lowest inflow = riskiest)
      return risky.sort((a, b) => a.amount - b.amount).slice(0, 5);
    })()
    : undefined;

  // ── PHASE 2A — Bank-derived financial signals ──
  let cashBurn: number | undefined;
  let runwayDays: number | undefined;
  let collectionEfficiency: number | undefined;
  let expenseCategories: { category: string; amount: number; pct: number }[] | undefined;
  let dailyCashFlow: { date: string; inflow: number; outflow: number; net: number }[] | undefined;
  let topClients: { name: string; amount: number; sharePct: number }[] | undefined;

  if (bank) {
    // cashBurn = average of last 3 months' expenses
    const months = bank.monthlyCollections;
    const last3 = months.slice(-3);
    const burn = last3.length > 0
      ? last3.reduce((s, m) => s + m.expenses, 0) / last3.length
      : 0;
    cashBurn = Math.round(burn * 100) / 100;

    // runwayDays = closingBalance / max(1, cashBurn) * 30, clamped 0–365 (null if burn==0)
    if (burn > 0) {
      const days = Math.round((bank.closingBalance / Math.max(1, burn)) * 30);
      runwayDays = Math.max(0, Math.min(365, days));
    } else {
      runwayDays = undefined;
    }

    // collectionEfficiency = monthlyCollections / (monthlyCollections + outstandingReceivables) * 100
    // where outstandingReceivables ≈ sum of debits categorized 'vendor' in last 60 days
    const cutoff60 = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const outstandingReceivables = bank.transactions
      .filter(t => t.type === 'debit' && t.category === 'vendor' && new Date(t.txnDate).getTime() >= cutoff60)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const monthlyCollections = months[months.length - 1]?.collections ?? 0;
    const denom = monthlyCollections + outstandingReceivables;
    collectionEfficiency = denom > 0
      ? Math.max(0, Math.min(100, Math.round((monthlyCollections / denom) * 100)))
      : 0;

    // expenseCategories — group all debit txns by category, sum abs(amount), pct of total, top 6
    const byCat = new Map<string, number>();
    for (const t of bank.transactions) {
      if (t.type !== 'debit') continue;
      const cat = t.category ?? 'other';
      byCat.set(cat, (byCat.get(cat) ?? 0) + Math.abs(t.amount));
    }
    const totalExpenses = Array.from(byCat.values()).reduce((s, v) => s + v, 0);
    expenseCategories = Array.from(byCat.entries())
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        pct: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    // dailyCashFlow — last 7 days: inflow (credits), outflow (abs debits), net
    const dailyMap = new Map<string, { inflow: number; outflow: number }>();
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      dailyMap.set(d.toISOString().slice(0, 10), { inflow: 0, outflow: 0 });
    }
    for (const t of bank.transactions) {
      const day = t.txnDate.slice(0, 10);
      if (!dailyMap.has(day)) continue;
      const entry = dailyMap.get(day)!;
      if (t.type === 'credit') entry.inflow += t.amount;
      else entry.outflow += Math.abs(t.amount);
    }
    dailyCashFlow = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      inflow: Math.round(v.inflow * 100) / 100,
      outflow: Math.round(v.outflow * 100) / 100,
      net: Math.round((v.inflow - v.outflow) * 100) / 100,
    }));

    // topClients — group credit txns with category 'sales' by counterparty over last 90 days
    const cutoff90 = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const byClient = new Map<string, number>();
    for (const t of bank.transactions) {
      if (t.type !== 'credit' || t.category !== 'sales' || !t.counterparty) continue;
      if (new Date(t.txnDate).getTime() < cutoff90) continue;
      byClient.set(t.counterparty, (byClient.get(t.counterparty) ?? 0) + t.amount);
    }
    const totalClientRevenue = Array.from(byClient.values()).reduce((s, v) => s + v, 0);
    topClients = Array.from(byClient.entries())
      .filter(([, amt]) => amt > 100000) // > ₹1 lakh
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount * 100) / 100,
        sharePct: totalClientRevenue > 0
          ? Math.round((amount / totalClientRevenue) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  return {
    hasGstn: !!gstn,
    hasBank: !!bank,
    gstin: gstn?.gstin,
    tradeName: gstn?.tradeName,
    compliance: gstn ? {
      score: gstn.compliance.score,
      pendingReturns: gstn.compliance.pendingReturns,
      overdueReturns: gstn.compliance.overdueReturns,
      lastFilingDate: gstn.compliance.lastFilingDate,
      nextDueDate: gstn.compliance.nextDueDate,
      itcAvailable: gstn.compliance.itcAvailable,
      activeNotices: gstn.compliance.activeNotices,
      status: gstn.compliance.status,
    } : null,
    bank: bank ? {
      provider: bank.provider,
      cashAvailable: bank.closingBalance,
      monthlyCollections: bank.monthlyCollections[bank.monthlyCollections.length - 1]?.collections ?? 0,
      monthlyExpenses: bank.monthlyCollections[bank.monthlyCollections.length - 1]?.expenses ?? 0,
      collectionChangePct: bank.monthlyCollections.length >= 2
        ? (() => {
          const l = bank.monthlyCollections[bank.monthlyCollections.length - 1].collections;
          const p = bank.monthlyCollections[bank.monthlyCollections.length - 2].collections;
          return p > 0 ? ((l - p) / p) * 100 : 0;
        })()
        : 0,
      expenseChangePct: bank.monthlyCollections.length >= 2
        ? (() => {
          const l = bank.monthlyCollections[bank.monthlyCollections.length - 1].expenses;
          const p = bank.monthlyCollections[bank.monthlyCollections.length - 2].expenses;
          return p > 0 ? ((l - p) / p) * 100 : 0;
        })()
        : 0,
      totalCredits: bank.totalCredits,
      totalDebits: bank.totalDebits,
    } : null,
    health,
    recentTransactions,
    riskyClients,
    // ── PHASE 2A — Real Data Platform extensions ──
    cashBurn,
    runwayDays,
    collectionEfficiency,
    expenseCategories,
    dailyCashFlow,
    topClients,
    firmProfile: gstn?.registrationProfile,
    gstr9: gstn?.gstr9,
    itcLedger: gstn?.itcLedger,
    cashLedger: gstn?.cashLedger,
    liabilityLedger: gstn?.liabilityLedger,
    lateFees: gstn?.lateFees,
    taxLiability: gstn?.taxLiability,
    recentReturns: gstn?.gstrFilings.slice(-6),
    activeNoticesList: gstn?.notices.filter(n => n.status === 'open').slice(0, 5),
  };
}

// ─── Public: list all connections (for the UI) ──────────────────────────────────
export async function listConnections() {
  return db.businessConnection.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'asc' },
  });
}

// ─── Public: connect GSTN (verify + persist) ────────────────────────────────────
// NOTE: With `generateGstnDataset` returning null (real GSTN API pending), this
// function persists the connection row but does NOT seed synthetic data. The
// connection metadata is intentionally minimal until a real GSTN client populates
// legal/trade name, state, business type, etc. from the live API.
export async function connectGstn(gstinRaw: string, connectedBy?: string) {
  const gstin = gstinRaw.toUpperCase().trim();
  const dataset = generateGstnDataset(gstin); // null (real GSTN API pending)

  // Replace any existing GSTN connection
  const existing = await db.businessConnection.findFirst({
    where: { type: 'gstn', status: 'active' },
  });
  if (existing) {
    await db.businessConnection.update({
      where: { id: existing.id },
      data: { status: 'disconnected' },
    });
  }

  const connection = await db.businessConnection.create({
    data: {
      type: 'gstn',
      provider: 'GSTN',
      gstin,
      legalName: dataset?.legalName ?? null,
      tradeName: dataset?.tradeName ?? null,
      status: 'active',
      maskedRef: gstin,
      metadata: JSON.stringify(dataset ? {
        state: dataset.state,
        stateCode: dataset.stateCode,
        businessType: dataset.businessType,
        registrationDate: dataset.registrationDate,
      } : { pendingRealApi: true }),
      lastSyncedAt: new Date(),
      nextSyncAt: new Date(Date.now() + 15 * 60 * 1000),
      connectedBy,
    },
  });

  return { connection, dataset };
}

// ─── Public: connect a bank (persist connection; no synthetic txns) ────────────
// NOTE: With `generateBankDataset` returning null (real bank API pending), this
// function persists the connection row but does NOT seed synthetic transactions.
// Real bank transactions will be fetched and persisted when a real bank API
// client (Razorpay / Decentro / MBS / Anumati) is wired up via syncConnection().
export async function connectBank(
  provider: BankDataset['provider'],
  accountRef: string,
  connectedBy?: string,
) {
  const dataset = generateBankDataset(provider, accountRef); // null (real bank API pending)
  const maskedAccount = dataset?.maskedAccount ?? ('XXXXXX' + (accountRef ?? '').slice(-4));

  // Replace any existing bank connection
  const existing = await db.businessConnection.findFirst({
    where: { type: 'bank', status: 'active' },
  });
  if (existing) {
    await db.bankTransaction.deleteMany({ where: { connectionId: existing.id } });
    await db.businessConnection.update({
      where: { id: existing.id },
      data: { status: 'disconnected' },
    });
  }

  const connection = await db.businessConnection.create({
    data: {
      type: 'bank',
      provider,
      status: 'active',
      maskedRef: maskedAccount,
      metadata: JSON.stringify({
        accountType: dataset?.accountType ?? 'current',
        accountRef,
        pendingRealApi: !dataset,
      }),
      lastSyncedAt: new Date(),
      nextSyncAt: new Date(Date.now() + 15 * 60 * 1000),
      connectedBy,
    },
  });

  // Bulk-insert transactions only when a real dataset is available.
  // (Currently never — `generateBankDataset` returns null. Real bank API pending.)
  if (dataset) {
    const txns = dataset.transactions.map(t => ({
      connectionId: connection.id,
      bankProvider: provider,
      txnDate: new Date(t.txnDate),
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category ?? null,
      counterparty: t.counterparty ?? null,
      referenceNo: t.referenceNo ?? null,
      balanceAfter: t.balanceAfter,
      reconciled: false,
    }));

    // Insert in chunks of 200
    for (let i = 0; i < txns.length; i += 200) {
      await db.bankTransaction.createMany({ data: txns.slice(i, i + 200) });
    }
  }

  return { connection, dataset };
}

// ─── Public: disconnect a connection ────────────────────────────────────────────
export async function disconnectConnection(id: string) {
  const conn = await db.businessConnection.findUnique({ where: { id } });
  if (!conn) return;
  if (conn.type === 'bank') {
    await db.bankTransaction.deleteMany({ where: { connectionId: id } });
  }
  await db.businessConnection.update({
    where: { id },
    data: { status: 'disconnected' },
  });
}

// ─── Public: persist a BusinessHealthSnapshot ───────────────────────────────────
export async function saveHealthSnapshot(health: BusinessHealthBreakdown) {
  const period = new Date().toISOString().slice(0, 7);
  return db.businessHealthSnapshot.create({
    data: {
      overall: health.overall,
      complianceScore: health.compliance,
      cashFlowScore: health.cashFlow,
      collectionScore: health.collection,
      growthScore: health.growth,
      profitabilityScore: health.profitability,
      riskScore: health.risk,
      components: JSON.stringify(health.components),
      signals: JSON.stringify(health.signals),
      period,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2A — Real-Time Sync Center + Data Engine
// ═══════════════════════════════════════════════════════════════════════════════

function parseConnectionMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Public: sync a single connection (re-pull + persist + log) ─────────────────
// Never throws — on any error, marks the SyncLog + connection 'failed' and returns.
export async function syncConnection(
  connectionId: string,
): Promise<{ log: SyncLogRow; connection: ConnectionRow }> {
  let log: SyncLogRow = null;
  let connection: ConnectionRow = null;

  try {
    const conn = await db.businessConnection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new Error('Connection not found');
    if (conn.status === 'disconnected') throw new Error('Connection is disconnected — please reconnect first');

    // 1. Start sync — create SyncLog row + mark BusinessConnection.syncStatus='syncing'
    log = await db.syncLog.create({
      data: {
        connectionId: conn.id,
        status: 'syncing',
        startedAt: new Date(),
      },
    });
    connection = await db.businessConnection.update({
      where: { id: conn.id },
      data: { syncStatus: 'syncing' },
    });

    // 2. Re-fetch (regenerate) the dataset
    let recordsImported = 0;
    let partialErrors: string[] = [];

    if (conn.type === 'gstn') {
      // REAL GSTN API PENDING — generator returns null, nothing to import.
      // Future: fetch real GSTR filings / e-invoices / e-way bills / notices from
      // the live GSTN API and persist them, then set recordsImported to the count.
      const dataset = generateGstnDataset(conn.gstin!);
      recordsImported = dataset
        ? dataset.gstrFilings.length +
          dataset.eInvoices.length +
          dataset.eWayBills.length +
          dataset.notices.length
        : 0;
    } else if (conn.type === 'bank') {
      const provider = (conn.provider ?? 'HDFC') as BankProvider;
      const meta = parseConnectionMeta(conn.metadata);
      const accountRef = (meta.accountRef as string) ?? (conn.maskedRef ?? '').slice(-4) ?? '0000';
      const dataset = generateBankDataset(provider, accountRef);

      // Delete old bank transactions for this connection before re-importing
      await db.bankTransaction.deleteMany({ where: { connectionId: conn.id } });

      // REAL BANK API PENDING — generator returns null, no transactions to insert.
      // Future: fetch real bank transactions from the live bank API and persist them.
      if (dataset) {
        const txns = dataset.transactions.map(t => ({
          connectionId: conn.id,
          bankProvider: provider,
          txnDate: new Date(t.txnDate),
          description: t.description,
          amount: t.amount,
          type: t.type,
          category: t.category ?? null,
          counterparty: t.counterparty ?? null,
          referenceNo: t.referenceNo ?? null,
          balanceAfter: t.balanceAfter,
          reconciled: false,
        }));
        for (let i = 0; i < txns.length; i += 200) {
          await db.bankTransaction.createMany({ data: txns.slice(i, i + 200) });
        }
        recordsImported = dataset.transactions.length;
      } else {
        recordsImported = 0;
      }
    } else {
      throw new Error(`Unknown connection type: ${conn.type}`);
    }

    // 3. Simulate rare partial / failed outcomes (5% partial, 2% failed)
    const r = Math.random();
    if (r < 0.02) {
      // Failed
      const errMsg = 'Sync failed — upstream API timeout (simulated)';
      log = await db.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorsCount: 1,
          message: errMsg,
          errorDetail: JSON.stringify([errMsg]),
          completedAt: new Date(),
        },
      });
      connection = await db.businessConnection.update({
        where: { id: conn.id },
        data: {
          syncStatus: 'failed',
          lastSyncedAt: new Date(),
          lastSyncRecords: recordsImported,
          lastSyncErrors: 1,
          lastSyncMessage: errMsg,
        },
      });
      return { log, connection };
    }

    if (r < 0.05) {
      // Partial — 1–2 errors
      partialErrors = [
        'Row 23: counterparty name truncated',
        ...(Math.random() > 0.5 ? ['Row 67: amount sign normalised'] : []),
      ];
      log = await db.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'partial',
          recordsImported,
          errorsCount: partialErrors.length,
          message: `Partial sync — ${recordsImported} records imported, ${partialErrors.length} errors`,
          errorDetail: JSON.stringify(partialErrors),
          completedAt: new Date(),
        },
      });
      connection = await db.businessConnection.update({
        where: { id: conn.id },
        data: {
          syncStatus: 'partial',
          lastSyncedAt: new Date(),
          lastSyncRecords: recordsImported,
          lastSyncErrors: partialErrors.length,
          lastSyncMessage: `Partial sync — ${recordsImported} records imported`,
        },
      });
      return { log, connection };
    }

    // 4. Success
    const okMsg = `Synced ${recordsImported} records`;
    log = await db.syncLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        recordsImported,
        errorsCount: 0,
        message: okMsg,
        completedAt: new Date(),
      },
    });
    connection = await db.businessConnection.update({
      where: { id: conn.id },
      data: {
        syncStatus: 'connected',
        lastSyncedAt: new Date(),
        lastSyncRecords: recordsImported,
        lastSyncErrors: 0,
        lastSyncMessage: okMsg,
      },
    });
    return { log, connection };
  } catch (err) {
    // Never throw — mark log + connection as failed and return
    const errMsg = err instanceof Error ? err.message : 'Unknown sync error';
    console.error('syncConnection error:', errMsg);
    try {
      if (log) {
        log = await db.syncLog.update({
          where: { id: log.id },
          data: {
            status: 'failed',
            errorsCount: 1,
            message: errMsg,
            errorDetail: JSON.stringify([errMsg]),
            completedAt: new Date(),
          },
        });
      }
      if (connectionId) {
        connection = await db.businessConnection.update({
          where: { id: connectionId },
          data: {
            syncStatus: 'failed',
            lastSyncedAt: new Date(),
            lastSyncErrors: 1,
            lastSyncMessage: errMsg,
          },
        });
      }
    } catch (innerErr) {
      console.error('syncConnection fallback-failure:', innerErr);
    }
    return { log, connection };
  }
}

// ─── Public: list recent sync logs for a connection ─────────────────────────────
export async function listSyncLogs(connectionId: string, limit = 20): Promise<SyncLogRow[]> {
  try {
    return await db.syncLog.findMany({
      where: { connectionId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  } catch (err) {
    console.error('listSyncLogs error:', err);
    return [];
  }
}

// ─── Public: 8-card Data Engine payload ─────────────────────────────────────────
export interface DataEngineCard {
  value: number | unknown[];
  label: string;
  sublabel: string;
  changePct?: number;
  status?: string;
  hasData: boolean;
}

export interface LiveDataEnginePayload {
  hasData: boolean;
  hasGstn: boolean;
  hasBank: boolean;
  cards: {
    revenue: DataEngineCard;
    cashPosition: DataEngineCard;
    itcAvailable: DataEngineCard;
    complianceScore: DataEngineCard;
    collections: DataEngineCard;
    pendingReturns: DataEngineCard;
    pendingNotices: DataEngineCard;
    topClients: DataEngineCard;
  };
  syncSummary: {
    lastSyncedAt: string | null;
    totalRecords: number;
    gstnStatus: string;
    bankStatus: string;
  } | null;
  computedAt: string;
}

function inrShort(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

function complianceStatusFor(score: number): 'compliant' | 'at_risk' | 'critical' {
  if (score >= 75) return 'compliant';
  if (score >= 50) return 'at_risk';
  return 'critical';
}

function statusLabel(status: 'compliant' | 'at_risk' | 'critical'): string {
  if (status === 'compliant') return 'Compliant';
  if (status === 'at_risk') return 'At Risk';
  return 'Critical';
}

const EMPTY_CARD: DataEngineCard = {
  value: 0,
  label: '—',
  sublabel: '',
  hasData: false,
};

export async function computeLiveDataEngine(): Promise<LiveDataEnginePayload> {
  const live = await loadOracleLiveData();
  const computedAt = new Date().toISOString();

  if (!live.hasGstn && !live.hasBank) {
    return {
      hasData: false,
      hasGstn: false,
      hasBank: false,
      cards: {
        revenue: { ...EMPTY_CARD },
        cashPosition: { ...EMPTY_CARD },
        itcAvailable: { ...EMPTY_CARD },
        complianceScore: { ...EMPTY_CARD },
        collections: { ...EMPTY_CARD },
        pendingReturns: { ...EMPTY_CARD },
        pendingNotices: { ...EMPTY_CARD },
        topClients: { ...EMPTY_CARD },
      },
      syncSummary: null,
      computedAt,
    };
  }

  // Sync summary — pull the latest sync status per source from BusinessConnection
  let syncSummary: LiveDataEnginePayload['syncSummary'] = null;
  try {
    const conns = await db.businessConnection.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
    const gstnConn = conns.find(c => c.type === 'gstn');
    const bankConn = conns.find(c => c.type === 'bank');
    const lastGstnSync = gstnConn?.lastSyncedAt?.toISOString() ?? null;
    const lastBankSync = bankConn?.lastSyncedAt?.toISOString() ?? null;
    const totalRecords =
      (gstnConn?.lastSyncRecords ?? 0) + (bankConn?.lastSyncRecords ?? 0);
    const latestSyncedAt = [lastGstnSync, lastBankSync]
      .filter(Boolean)
      .sort()
      .slice(-1)[0] ?? null;
    syncSummary = {
      lastSyncedAt: latestSyncedAt,
      totalRecords,
      gstnStatus: gstnConn?.syncStatus ?? 'connected',
      bankStatus: bankConn?.syncStatus ?? 'connected',
    };
  } catch (err) {
    console.error('computeLiveDataEngine syncSummary error:', err);
    syncSummary = null;
  }

  // Build the 8 cards
  const monthlyCollections = live.bank?.monthlyCollections ?? 0;
  const collectionChangePct = live.bank?.collectionChangePct ?? 0;
  const cashAvailable = live.bank?.cashAvailable ?? 0;
  const itcAvailable = live.compliance?.itcAvailable ?? 0;
  const complianceScore = live.compliance?.score ?? 0;
  const pendingReturns = live.compliance?.pendingReturns ?? 0;
  const activeNotices = live.compliance?.activeNotices ?? 0;
  const topClientsArr = live.topClients ?? [];

  const compStatus = complianceStatusFor(complianceScore);

  return {
    hasData: true,
    hasGstn: live.hasGstn,
    hasBank: live.hasBank,
    cards: {
      revenue: {
        value: monthlyCollections,
        label: inrShort(monthlyCollections),
        sublabel: 'Monthly collections',
        changePct: Math.round(collectionChangePct),
        hasData: live.hasBank,
      },
      cashPosition: {
        value: cashAvailable,
        label: inrShort(cashAvailable),
        sublabel: 'Bank balance',
        hasData: live.hasBank,
      },
      itcAvailable: {
        value: itcAvailable,
        label: inrShort(itcAvailable),
        sublabel: 'GSTR-2B ITC',
        hasData: live.hasGstn,
      },
      complianceScore: {
        value: complianceScore,
        label: `${complianceScore}/100`,
        sublabel: statusLabel(compStatus),
        status: compStatus,
        hasData: live.hasGstn,
      },
      collections: {
        value: monthlyCollections,
        label: inrShort(monthlyCollections),
        sublabel: 'This month',
        changePct: Math.round(collectionChangePct),
        hasData: live.hasBank,
      },
      pendingReturns: {
        value: pendingReturns,
        label: String(pendingReturns),
        sublabel: 'Pending returns',
        hasData: live.hasGstn,
      },
      pendingNotices: {
        value: activeNotices,
        label: String(activeNotices),
        sublabel: 'Active notices',
        hasData: live.hasGstn,
      },
      topClients: {
        value: topClientsArr,
        label: `${topClientsArr.length} client${topClientsArr.length === 1 ? '' : 's'}`,
        sublabel: 'Top by revenue',
        hasData: topClientsArr.length > 0,
      },
    },
    syncSummary,
    computedAt,
  };
}
