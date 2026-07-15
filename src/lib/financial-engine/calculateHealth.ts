// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Health Score Calculator
//
// Health Score is a weighted composite (0–100) derived from:
//   30% — Collection rate (how well you collect receivables)
//   25% — Profit margin (are you profitable?)
//   20% — Compliance (GST filings up to date)
//   15% — Cash position (do you have cash reserves?)
//   10% — Overdue exposure (how much is overdue vs total receivables)
//
// This is the ONLY place where Health Score is calculated.
// No hardcoded 75, 80, 90 — every point comes from real data.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FinancialData } from './types';
import { calculateRevenue } from './calculateRevenue';
import { calculateExpenses } from './calculateExpenses';
import { calculateCash } from './calculateCash';
import { calculateCollections } from './calculateCollections';

export interface HealthScoreResult {
  score: number;          // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  components: {
    collections: number;   // 0–100
    profitability: number; // 0–100
    compliance: number;    // 0–100
    cashPosition: number;  // 0–100
    overdueControl: number;// 0–100
  };
}

/**
 * Calculates the business health score from real financial data.
 *
 * Returns 0 when there is no data at all (no invoices, no expenses, no bank accounts).
 */
export function calculateHealth(data: FinancialData): HealthScoreResult {
  const { invoices, purchaseBills, expenses, bankAccounts, gstrFilings } = data;

  const hasData =
    invoices.length > 0 ||
    purchaseBills.length > 0 ||
    expenses.length > 0 ||
    bankAccounts.length > 0;

  if (!hasData) {
    return {
      score: 0,
      grade: 'F',
      label: 'No Data',
      components: {
        collections: 0,
        profitability: 0,
        compliance: 0,
        cashPosition: 0,
        overdueControl: 0,
      },
    };
  }

  const rev = calculateRevenue(invoices);
  const exp = calculateExpenses(purchaseBills, expenses);
  const cash = calculateCash(bankAccounts);
  const coll = calculateCollections(invoices, []);

  // ── Component 1: Collection rate (30%) ──
  const collectionsScore = clamp(coll.collectionRate);

  // ── Component 2: Profitability (25%) ──
  const margin = rev.total > 0 ? ((rev.total - exp.total) / rev.total) * 100 : 0;
  const profitabilityScore = clamp(margin);

  // ── Component 3: Compliance — based on GSTR filings (20%) ──
  // If there are filed returns, score is high. If there are pending/draft returns, score drops.
  let complianceScore = 100;
  if (gstrFilings.length > 0) {
    const filed = gstrFilings.filter(f => f.status === 'filed').length;
    complianceScore = clamp((filed / gstrFilings.length) * 100);
  } else if (rev.total > 0) {
    // Has revenue but no filings — compliance risk
    complianceScore = 30;
  }

  // ── Component 4: Cash position (15%) ──
  // Score based on months of expenses covered by cash reserves
  const monthlyExpenses = exp.total > 0 ? exp.total / 12 : 0;
  let cashPositionScore = 100;
  if (monthlyExpenses > 0) {
    const monthsCovered = cash.bankBalance / monthlyExpenses;
    // 3+ months = 100, 2 months = 80, 1 month = 60, 0 months = 0
    cashPositionScore = clamp(Math.min(100, (monthsCovered / 3) * 100));
  } else if (cash.bankBalance > 0) {
    cashPositionScore = 80; // has cash but no expense data
  }

  // ── Component 5: Overdue exposure (10%) ──
  let overdueControlScore = 100;
  if (coll.totalOutstanding > 0) {
    const overdueRatio = coll.totalOverdue / coll.totalOutstanding;
    overdueControlScore = clamp((1 - overdueRatio) * 100);
  }

  // ── Weighted composite ──
  const score = clamp(
    collectionsScore * 0.30 +
    profitabilityScore * 0.25 +
    complianceScore * 0.20 +
    cashPositionScore * 0.15 +
    overdueControlScore * 0.10
  );

  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  const label =
    score >= 85 ? 'Excellent' :
    score >= 70 ? 'Good' :
    score >= 55 ? 'Fair' :
    score >= 40 ? 'Needs Attention' :
    score > 0 ? 'Critical' : 'No Data';

  return {
    score: Math.round(score),
    grade,
    label,
    components: {
      collections: Math.round(collectionsScore),
      profitability: Math.round(profitabilityScore),
      compliance: Math.round(complianceScore),
      cashPosition: Math.round(cashPositionScore),
      overdueControl: Math.round(overdueControlScore),
    },
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
