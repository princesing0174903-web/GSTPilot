// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Business Health Score Engine
//
// Computes 6 sub-scores + an overall (0-100) Business Health Score from real
// GSTN + Bank data. The weighting and signals are transparent and explainable.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessHealthBreakdown, GstnDataset, BankDataset } from './types';

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// ─── Compliance Score (0-100) ───────────────────────────────────────────────────
// Derived from the GSTN compliance status (overdue/pending/notices).
function complianceScore(gstn: GstnDataset | null): number {
  if (!gstn) return 0;
  return gstn.compliance.score;
}

// ─── Cash Flow Score (0-100) ────────────────────────────────────────────────────
// Cash position health: balance runway, recent debit/credit ratio, EMI load.
function cashFlowScore(bank: BankDataset | null): number {
  if (!bank) return 0;
  const balance = bank.closingBalance;
  const monthlyExpenses = bank.monthlyCollections[bank.monthlyCollections.length - 1]?.expenses ?? 0;
  if (monthlyExpenses === 0) return 75;
  // Runway in months
  const runway = balance / monthlyExpenses;
  // 3+ months runway = 100; 0 months = 0
  let score = (runway / 3) * 100;
  // Credit-to-debit ratio for last month
  const lastMonth = bank.monthlyCollections[bank.monthlyCollections.length - 1];
  if (lastMonth && lastMonth.expenses > 0) {
    const ratio = lastMonth.collections / lastMonth.expenses;
    if (ratio >= 1.5) score += 10;
    else if (ratio >= 1.2) score += 5;
    else if (ratio < 1) score -= 20;
  }
  return clamp(score);
}

// ─── Collection Score (0-100) ───────────────────────────────────────────────────
// Are collections growing? Are they on track vs prior month?
function collectionScore(bank: BankDataset | null): number {
  if (!bank || bank.monthlyCollections.length < 2) return 0;
  const months = bank.monthlyCollections;
  const latest = months[months.length - 1].collections;
  const prev = months[months.length - 2].collections;
  if (prev === 0) return latest > 0 ? 75 : 50;
  const changePct = ((latest - prev) / prev) * 100;
  // 0% change = 70 baseline. +10% = 90. -10% = 50. -25% = 30.
  let score = 70 + changePct * 2;
  return clamp(score);
}

// ─── Growth Score (0-100) ───────────────────────────────────────────────────────
// Revenue growth from GSTR-1 taxable values (last 6 vs previous 6 months).
function growthScore(gstn: GstnDataset | null): number {
  if (!gstn) return 0;
  const gstr1 = gstn.gstrFilings.filter(f => f.returnType === 'GSTR-1')
    .sort((a, b) => a.period.localeCompare(b.period));
  if (gstr1.length < 4) return 65;
  const half = Math.floor(gstr1.length / 2);
  const recent = gstr1.slice(-half).reduce((s, f) => s + f.totalTaxableValue, 0);
  const prior = gstr1.slice(0, half).reduce((s, f) => s + f.totalTaxableValue, 0);
  if (prior === 0) return 70;
  const growthPct = ((recent - prior) / prior) * 100;
  // 0% = 60. +10% = 80. +25% = 95. -10% = 40.
  let score = 60 + growthPct * 2;
  return clamp(score);
}

// ─── Profitability Score (0-100) ────────────────────────────────────────────────
// Net margin: collections - expenses / collections. (Approximation — real
// profitability needs P&L but bank cashflow is a strong proxy.)
function profitabilityScore(bank: BankDataset | null): number {
  if (!bank || bank.monthlyCollections.length === 0) return 0;
  const last = bank.monthlyCollections[bank.monthlyCollections.length - 1];
  if (last.collections === 0) return 40;
  const netMargin = (last.collections - last.expenses) / last.collections;
  // 30%+ margin = 100. 0% = 40. -10% = 15.
  let score = 40 + netMargin * 200;
  return clamp(score);
}

// ─── Risk Score (0-100, HIGHER = SAFER) ─────────────────────────────────────────
// Inverse risk: notices, overdue returns, low runway all reduce it.
function riskScore(
  gstn: GstnDataset | null,
  bank: BankDataset | null,
): number {
  let score = 100;
  if (gstn) {
    score -= gstn.compliance.overdueReturns * 15;
    score -= gstn.compliance.activeNotices * 10;
  }
  if (bank) {
    const last = bank.monthlyCollections[bank.monthlyCollections.length - 1];
    if (last && last.expenses > 0) {
      const ratio = last.collections / last.expenses;
      if (ratio < 1) score -= 25;
      else if (ratio < 1.2) score -= 10;
    }
    if (bank.closingBalance < 200000) score -= 15;
  }
  return clamp(score);
}

// ─── Overall: weighted blend of all 6 ───────────────────────────────────────────
// Weights reflect what an Indian SME owner cares about most:
// Compliance 22% · Cash Flow 22% · Collection 18% · Growth 12% · Profitability 14% · Risk 12%
export function computeBusinessHealth(
  gstn: GstnDataset | null,
  bank: BankDataset | null,
): BusinessHealthBreakdown {
  const compliance = complianceScore(gstn);
  const cashFlow = cashFlowScore(bank);
  const collection = collectionScore(bank);
  const growth = growthScore(gstn);
  const profitability = profitabilityScore(bank);
  const risk = riskScore(gstn, bank);

  // Only blend the components that have data; if one is missing, redistribute.
  type Component = { name: string; value: number; weight: number };
  const present: Component[] = [];
  if (gstn) present.push({ name: 'compliance', value: compliance, weight: 0.22 });
  if (bank) present.push(
    { name: 'cashFlow', value: cashFlow, weight: 0.22 },
    { name: 'collection', value: collection, weight: 0.18 },
    { name: 'profitability', value: profitability, weight: 0.14 },
  );
  if (gstn) present.push({ name: 'growth', value: growth, weight: 0.12 });
  if (gstn || bank) present.push({ name: 'risk', value: risk, weight: 0.12 });

  const totalWeight = present.reduce((s, c) => s + c.weight, 0);
  const overall = totalWeight > 0
    ? Math.round(present.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight)
    : 0;

  // Build signals
  const signals: BusinessHealthBreakdown['signals'] = [];
  if (gstn) {
    if (gstn.compliance.overdueReturns > 0) {
      signals.push({
        text: `${gstn.compliance.overdueReturns} GST return${gstn.compliance.overdueReturns > 1 ? 's are' : ' is'} overdue — late fees accruing`,
        tone: 'negative',
        score: compliance,
      });
    } else if (gstn.compliance.pendingReturns > 0) {
      signals.push({
        text: `${gstn.compliance.pendingReturns} return${gstn.compliance.pendingReturns > 1 ? 's' : ''} pending — due ${gstn.compliance.nextDueDate ?? 'soon'}`,
        tone: 'warning',
        score: compliance,
      });
    } else {
      signals.push({
        text: `All GST returns filed on time — last filed ${gstn.compliance.lastFilingDate ?? 'recently'}`,
        tone: 'positive',
        score: compliance,
      });
    }
    if (gstn.compliance.activeNotices > 0) {
      signals.push({
        text: `${gstn.compliance.activeNotices} active GST notice${gstn.compliance.activeNotices > 1 ? 's' : ''} require response`,
        tone: 'warning',
        score: risk,
      });
    }
    if (gstn.compliance.itcAvailable > 0) {
      signals.push({
        text: `₹${gstn.compliance.itcAvailable.toLocaleString('en-IN')} ITC available to claim`,
        tone: 'positive',
        score: compliance,
      });
    }
  }
  if (bank) {
    const last = bank.monthlyCollections[bank.monthlyCollections.length - 1];
    const prev = bank.monthlyCollections[bank.monthlyCollections.length - 2];
    if (last && prev) {
      const changePct = prev.collections > 0 ? ((last.collections - prev.collections) / prev.collections) * 100 : 0;
      if (changePct < -5) {
        signals.push({
          text: `Collections dropped by ${Math.abs(changePct).toFixed(1)}% vs last month`,
          tone: 'negative',
          score: collection,
        });
      } else if (changePct > 5) {
        signals.push({
          text: `Collections grew by ${changePct.toFixed(1)}% vs last month`,
          tone: 'positive',
          score: collection,
        });
      }
    }
    if (bank.closingBalance < 500000) {
      signals.push({
        text: `Cash position tight — ₹${Math.round(bank.closingBalance).toLocaleString('en-IN')} available`,
        tone: 'warning',
        score: cashFlow,
      });
    } else {
      signals.push({
        text: `₹${Math.round(bank.closingBalance).toLocaleString('en-IN')} cash available today`,
        tone: 'positive',
        score: cashFlow,
      });
    }
  }

  const components: BusinessHealthBreakdown['components'] = {
    pendingReturns: gstn?.compliance.pendingReturns ?? 0,
    overdueReturns: gstn?.compliance.overdueReturns ?? 0,
    itcAvailable: gstn?.compliance.itcAvailable ?? 0,
    cashAvailable: bank?.closingBalance ?? 0,
    monthlyCollections: bank?.monthlyCollections[bank.monthlyCollections.length - 1]?.collections ?? 0,
    monthlyExpenses: bank?.monthlyCollections[bank.monthlyCollections.length - 1]?.expenses ?? 0,
    collectionChangePct: bank && bank.monthlyCollections.length >= 2
      ? (() => {
        const l = bank.monthlyCollections[bank.monthlyCollections.length - 1].collections;
        const p = bank.monthlyCollections[bank.monthlyCollections.length - 2].collections;
        return p > 0 ? ((l - p) / p) * 100 : 0;
      })()
      : 0,
    expenseChangePct: bank && bank.monthlyCollections.length >= 2
      ? (() => {
        const l = bank.monthlyCollections[bank.monthlyCollections.length - 1].expenses;
        const p = bank.monthlyCollections[bank.monthlyCollections.length - 2].expenses;
        return p > 0 ? ((l - p) / p) * 100 : 0;
      })()
      : 0,
    activeNotices: gstn?.compliance.activeNotices ?? 0,
    revenueGrowthPct: gstn ? (() => {
      const gstr1 = gstn.gstrFilings.filter(f => f.returnType === 'GSTR-1').sort((a, b) => a.period.localeCompare(b.period));
      if (gstr1.length < 4) return 0;
      const half = Math.floor(gstr1.length / 2);
      const recent = gstr1.slice(-half).reduce((s, f) => s + f.totalTaxableValue, 0);
      const prior = gstr1.slice(0, half).reduce((s, f) => s + f.totalTaxableValue, 0);
      return prior > 0 ? ((recent - prior) / prior) * 100 : 0;
    })() : 0,
  };

  return {
    overall,
    compliance,
    cashFlow,
    collection,
    growth,
    profitability,
    risk,
    signals,
    components,
  };
}
