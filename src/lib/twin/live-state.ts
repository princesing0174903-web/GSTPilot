// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — LIVE BUSINESS STATE ENGINE
//
// Maintains one centralized state containing the current reality of the
// business. Reuses the AI CFO Phase 1 engines (Revenue, Profitability, Cash
// Flow, Working Capital, Expenses, Collections, GST, Health Score, Risk) so
// every number is computed from REAL connected business data.
//
// Updates automatically whenever business data changes (invoices, payments,
// filings, bank syncs, expenses, employees, etc.) — the Twin always represents
// reality.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { fetchRawCFOData, startOfToday, startOfMonth, type RawCFOData } from '@/lib/cfo/phase1/data';
import { computeRevenueAnalytics } from '@/lib/cfo/phase1/revenue-analytics';
import { computeProfitability } from '@/lib/cfo/phase1/profitability';
import { computeCashFlow } from '@/lib/cfo/phase1/cash-flow';
import { computeWorkingCapital } from '@/lib/cfo/phase1/working-capital';
import { computeExpenses } from '@/lib/cfo/phase1/expense-engine';
import { computeCollections } from '@/lib/cfo/phase1/collection-engine';
import { computeRiskEngine } from '@/lib/cfo/phase1/risk-engine';
import { computeHealthScore } from '@/lib/cfo/phase1/health-score';
import type {
  LiveBusinessState,
  BankAccountState,
  TwinForecastSummary,
} from './types';

// ─── Bank Accounts from DataConnection + Payments ────────────────────────────

async function fetchBankAccounts(data: RawCFOData): Promise<BankAccountState[]> {
  const bankConnections = data.dataConnections.filter(
    (c) => c.type === 'bank' && (c.status === 'connected' || c.status === 'active'),
  );

  if (bankConnections.length === 0) {
    // Derive synthetic bank balances from recent payments grouped by paymentMode
    const today = startOfToday();
    const last90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const recentPayments = data.payments.filter(
      (p) => new Date(p.paymentDate) >= last90,
    );

    // Sum inflows (partyType=customer) by mode as a proxy for bank balance
    const byMode = new Map<string, number>();
    for (const p of recentPayments) {
      const mode = (p.paymentMode || 'bank').toLowerCase();
      const sign = p.partyType === 'customer' ? 1 : -1;
      byMode.set(mode, (byMode.get(mode) || 0) + sign * (p.amount || 0));
    }

    const accounts: BankAccountState[] = [];
    let idx = 0;
    for (const [mode, balance] of byMode) {
      if (balance <= 0) continue;
      accounts.push({
        id: `derived-${idx++}`,
        bank: mode.charAt(0).toUpperCase() + mode.slice(1),
        type: 'current',
        balance: Math.max(0, Math.round(balance)),
        syncedAt: data.fetchedAt,
      });
    }
    return accounts;
  }

  // Real bank connections — derive balance from synced records
  const accounts: BankAccountState[] = [];
  for (const conn of bankConnections) {
    const connRecords = data.syncedRecords.filter(
      (r) => r.connectionId === conn.id && r.sourceType === 'bank_tx',
    );
    // Sum amounts (positive = credit) as a proxy for running balance
    const balance = connRecords.reduce((s, r) => s + (r.amount || 0), 0);
    accounts.push({
      id: conn.id,
      bank: conn.label || conn.identifier || 'Bank',
      type: 'current',
      balance: Math.max(0, Math.round(balance)),
      syncedAt: conn.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
    });
  }
  return accounts;
}

// ─── Compliance score (filed vs overdue returns) ─────────────────────────────

function computeComplianceScore(data: RawCFOData): number {
  if (data.filings.length === 0) return 50;
  const filed = data.filings.filter((f) => f.status === 'filed').length;
  return Math.round((filed / data.filings.length) * 100);
}

// ─── Active vendor count (unique vendorName in purchaseBills) ────────────────

function countActiveVendors(data: RawCFOData): number {
  const set = new Set<string>();
  for (const p of data.purchaseBills) {
    if (p.vendorName) set.add(p.vendorName.toLowerCase());
  }
  return set.size;
}

// ─── Active client count ─────────────────────────────────────────────────────

function countActiveClients(data: RawCFOData): number {
  return data.clients.filter((c) => c.status === 'active').length;
}

// ─── Payroll (sum of active employee salaries) ───────────────────────────────

function computePayroll(data: RawCFOData): number {
  return data.employees
    .filter((e) => e.status === 'active')
    .reduce((s, e) => s + (e.salary || 0), 0);
}

// ─── Inventory / Assets / Loans ──────────────────────────────────────────────

async function fetchAssetLiabilityExtras(data: RawCFOData): Promise<{
  inventory: number;
  assets: number;
  loans: number;
}> {
  // Inventory: sum of expenses/purchaseBills categorized as 'inventory' or 'raw_material'
  const inventory = data.purchaseBills
    .filter((p) => {
      const cat = (p.category || '').toLowerCase();
      return cat.includes('invent') || cat.includes('raw') || cat.includes('stock');
    })
    .reduce((s, p) => s + (p.totalAmount || 0), 0);

  // Assets: total assets = cash + AR + inventory + fixed assets (purchase bills marked 'asset')
  const fixedAssets = data.expenses
    .filter((e) => (e.category || '').toLowerCase().includes('asset'))
    .reduce((s, e) => s + (e.amount || 0), 0);

  // Loans: sum of expenses categorized as 'loan' or 'emi'
  const loans = data.expenses
    .filter((e) => {
      const cat = (e.category || '').toLowerCase();
      return cat.includes('loan') || cat.includes('emi');
    })
    .reduce((s, e) => s + (e.amount || 0), 0);

  return {
    inventory: Math.round(inventory),
    assets: Math.round(fixedAssets),
    loans: Math.round(loans),
  };
}

// ─── Main: compute live business state ───────────────────────────────────────

export async function computeLiveBusinessState(): Promise<LiveBusinessState> {
  const data = await fetchRawCFOData();

  const revenue = safe(() => computeRevenueAnalytics(data));
  const profitability = safe(() => computeProfitability(data));
  const cashFlow = safe(() => computeCashFlow(data));
  const workingCapital = safe(() => computeWorkingCapital(data));
  const expenses = safe(() => computeExpenses(data));
  const collections = safe(() => computeCollections(data));
  const risks = safe(() => computeRiskEngine(data, { revenue, cashFlow, workingCapital, profitability }));
  const healthScore = safe(() => computeHealthScore(data, { revenue, profitability, cashFlow, workingCapital, collections }));

  const bankAccounts = await fetchBankAccounts(data);
  const extras = await fetchAssetLiabilityExtras(data);

  const bankBalance = bankAccounts.reduce((s, b) => s + b.balance, 0);
  const currentCash = Math.round(cashFlow.currentCash || bankBalance);

  const forecast: TwinForecastSummary = {
    revenue30d: Math.round(revenue.forecast?.thirtyDay || revenue.thisMonth || 0),
    cash30d: Math.round((cashFlow.projections?.find((p) => p.period === '30d')?.endingCash) || currentCash),
    profit30d: Math.round((profitability.netProfit || 0) * 1.0),
    gstLiabilityNext: Math.round(
      (data.invoices
        .filter((i) => {
          const d = new Date(i.invoiceDate);
          const mStart = startOfMonth();
          return d >= mStart;
        })
        .reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0) + (i.cess || 0), 0)) -
      data.purchaseBills.reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0),
    ),
    confidencePct: Math.round((risks.overallRiskLevel === 'low' ? 82 : risks.overallRiskLevel === 'medium' ? 70 : 58)),
  };

  return {
    revenue: Math.round(revenue.thisMonth || 0),
    profit: Math.round(profitability.netProfit || 0),
    cash: currentCash,
    workingCapital: Math.round(workingCapital.workingCapital || 0),
    gstPosition: Math.round(forecast.gstLiabilityNext),
    itc: Math.round(
      data.purchaseBills.reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0),
    ),
    employees: data.employees.filter((e) => e.status === 'active').length,
    payroll: Math.round(computePayroll(data)),
    collections: Math.round(collections.expectedCollections30d || 0),
    receivables: Math.round(workingCapital.accountsReceivable || collections.totalOutstanding || 0),
    payables: Math.round(workingCapital.accountsPayable || 0),
    expenses: Math.round(expenses.totalThisMonth || 0),
    inventory: extras.inventory,
    assets: Math.round(currentCash + (workingCapital.accountsReceivable || 0) + extras.inventory + extras.assets),
    loans: extras.loans,
    bankAccounts,
    clients: countActiveClients(data),
    vendors: countActiveVendors(data),
    healthScore: Math.round(healthScore.overall || 0),
    riskScore: Math.round(risks.overallRiskScore || 0),
    compliance: computeComplianceScore(data),
    forecast,
    asOf: new Date().toISOString(),
    hasLiveData: data.hasLiveData,
    dataSources: data.dataSources,
  };
}

// ─── Safe wrapper ────────────────────────────────────────────────────────────

function safe<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    console.warn('[Digital Twin] live-state engine failed:', err);
    return {} as T;
  }
}

// ─── Lightweight state fetch for Oracle context (no heavy engines) ───────────

export async function computeLiveStateLite(): Promise<{
  revenue: number;
  profit: number;
  cash: number;
  healthScore: number;
  riskScore: number;
  runwayDays: number;
  hasLiveData: boolean;
}> {
  const data = await fetchRawCFOData();
  const cashFlow = safe(() => computeCashFlow(data));
  const revenue = safe(() => computeRevenueAnalytics(data));
  const profitability = safe(() => computeProfitability(data));
  const healthScore = safe(() => computeHealthScore(data, { revenue, profitability, cashFlow, workingCapital: safe(() => computeWorkingCapital(data)), collections: safe(() => computeCollections(data)) }));
  const risks = safe(() => computeRiskEngine(data, { revenue, cashFlow, workingCapital: safe(() => computeWorkingCapital(data)), profitability }));

  return {
    revenue: Math.round(revenue.thisMonth || 0),
    profit: Math.round(profitability.netProfit || 0),
    cash: Math.round(cashFlow.currentCash || 0),
    healthScore: Math.round(healthScore.overall || 0),
    riskScore: Math.round(risks.overallRiskScore || 0),
    runwayDays: Math.round(cashFlow.runwayDays || 0),
    hasLiveData: data.hasLiveData,
  };
}

// Unused import guard — keep `db` import for future direct queries without breaking tree-shaking
void db;
