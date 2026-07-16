// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Risk Score Calculator
//
// Risk Score is a composite (0–100, higher = worse) derived from:
//   35% — Overdue exposure (% of receivables that are overdue)
//   25% — Cash flow risk (monthly burn vs cash reserves)
//   20% — Compliance risk (unfiled returns)
//   20% — Concentration risk (top customer % of revenue)
//
// This is the ONLY place where Risk Score is calculated.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FinancialData } from './types';
import { calculateRevenue } from './calculateRevenue';
import { calculateExpenses } from './calculateExpenses';
import { calculateCash } from './calculateCash';
import { calculateCollections } from './calculateCollections';

export interface RiskResult {
  overallRisk: number;       // 0–100 (higher = worse)
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  overdueExposure: number;   // INR amount overdue
  complianceRisk: number;    // 0–100
  cashFlowRisk: number;      // 0–100
  concentrationRisk: number; // 0–100
}

/**
 * Calculates the business risk score from real financial data.
 *
 * Returns 0 risk when there is no data (no data = no measurable risk, but also
 * no business — the health score will show "No Data").
 */
export function calculateRisk(data: FinancialData): RiskResult {
  const { invoices, purchaseBills, expenses, bankAccounts, gstrFilings, clients } = data;

  const hasData =
    invoices.length > 0 ||
    purchaseBills.length > 0 ||
    expenses.length > 0;

  if (!hasData) {
    return {
      overallRisk: 0,
      riskLevel: 'low',
      overdueExposure: 0,
      complianceRisk: 0,
      cashFlowRisk: 0,
      concentrationRisk: 0,
    };
  }

  const rev = calculateRevenue(invoices);
  const exp = calculateExpenses(purchaseBills, expenses);
  const cash = calculateCash(bankAccounts);
  const coll = calculateCollections(invoices, []);

  // ── Component 1: Overdue exposure (35%) ──
  const overdueExposure = coll.totalOverdue;
  let overdueRisk = 0;
  if (coll.totalOutstanding > 0) {
    overdueRisk = (coll.totalOverdue / coll.totalOutstanding) * 100;
  }

  // ── Component 2: Cash flow risk (25%) ──
  const monthlyExpenses = exp.total > 0 ? exp.total / 12 : 0;
  let cashFlowRisk = 0;
  if (monthlyExpenses > 0 && cash.bankBalance >= 0) {
    const monthsOfCash = cash.bankBalance / monthlyExpenses;
    // 3+ months = 0 risk, 1 month = 70 risk, 0 months = 100 risk
    if (monthsOfCash >= 3) cashFlowRisk = 0;
    else if (monthsOfCash >= 2) cashFlowRisk = 30;
    else if (monthsOfCash >= 1) cashFlowRisk = 60;
    else cashFlowRisk = 100;
  } else if (exp.total > 0 && cash.bankBalance <= 0) {
    cashFlowRisk = 100;
  }

  // ── Component 3: Compliance risk (20%) ──
  let complianceRisk = 0;
  if (rev.total > 0 && gstrFilings.length === 0) {
    complianceRisk = 80; // has revenue but no filings
  } else if (gstrFilings.length > 0) {
    const pending = gstrFilings.filter(f => f.status === 'draft' || f.status === 'pending').length;
    complianceRisk = (pending / gstrFilings.length) * 100;
  }

  // ── Component 4: Concentration risk (20%) ──
  let concentrationRisk = 0;
  if (rev.total > 0 && invoices.length > 0) {
    // Group revenue by client
    const byClient = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === 'draft' || inv.status === 'cancelled') continue;
      byClient.set(inv.clientId, (byClient.get(inv.clientId) ?? 0) + inv.totalAmount);
    }
    const maxClientRevenue = Math.max(0, ...byClient.values());
    const concentration = (maxClientRevenue / rev.total) * 100;
    // >80% concentration = 100 risk, >50% = 60, >30% = 30, <30% = 10
    if (concentration > 80) concentrationRisk = 100;
    else if (concentration > 50) concentrationRisk = 60;
    else if (concentration > 30) concentrationRisk = 30;
    else concentrationRisk = 10;
  }

  // ── Weighted composite ──
  const overall = clamp(
    overdueRisk * 0.35 +
    cashFlowRisk * 0.25 +
    complianceRisk * 0.20 +
    concentrationRisk * 0.20
  );

  const riskLevel: RiskResult['riskLevel'] =
    overall >= 75 ? 'critical' :
    overall >= 50 ? 'high' :
    overall >= 25 ? 'medium' : 'low';

  return {
    overallRisk: Math.round(overall),
    riskLevel,
    overdueExposure: round2(overdueExposure),
    complianceRisk: Math.round(complianceRisk),
    cashFlowRisk: Math.round(cashFlowRisk),
    concentrationRisk: Math.round(concentrationRisk),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
