// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Risk Score Calculator (DELEGATES TO CANONICAL SNAPSHOT ENGINE)
//
// This file is kept ONLY for backward compatibility with the legacy
// financial-engine/ pipeline (consumed by financial-engine/businessSnapshot.ts).
//
// The ACTUAL risk score is computed by the canonical engine in
// `src/lib/business/snapshot.ts` — `computeRiskScore(input: BusinessSnapshotInput)`.
// This wrapper builds a BusinessSnapshotInput from the in-memory FinancialData
// bundle (no extra Prisma round-trip) and delegates to the canonical engine.
//
// The legacy RiskResult shape (overallRisk / riskLevel / overdueExposure /
// complianceRisk / cashFlowRisk / concentrationRisk) is preserved. The
// overallRisk comes straight from the canonical engine; the per-component
// fields are best-effort derived from the canonical engine's triggered factors
// so that downstream consumers (e.g. the merged /api/business/snapshot route
// that reads `risks.overdueExposure`, `risks.complianceRisk`, `risks.cashFlowRisk`,
// `risks.riskLevel`) continue to work without breaking.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FinancialData } from './types';
import { calculateCollections } from './calculateCollections';
import {
  computeRiskScore,
  type BusinessSnapshotInput,
} from '@/lib/business/snapshot';
import { buildCanonicalInputFromFinancialData } from './calculateHealth';

export interface RiskResult {
  overallRisk: number;       // 0–100 (from canonical engine, higher = worse)
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  overdueExposure: number;   // INR amount overdue
  complianceRisk: number;    // 0–100
  cashFlowRisk: number;      // 0–100
  concentrationRisk: number; // 0–100
}

/**
 * Calculate the business risk score by DELEGATING to the canonical engine.
 *
 * Builds a {@link BusinessSnapshotInput} from the in-memory FinancialData and
 * passes it to `computeRiskScore` from `@/lib/business/snapshot`. This keeps a
 * single source of truth for the risk scoring formula while preserving the
 * legacy function signature.
 */
export function calculateRisk(data: FinancialData): RiskResult {
  const { invoices, purchaseBills, expenses, bankAccounts, gstrFilings, payments } = data;

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

  const input: BusinessSnapshotInput = buildCanonicalInputFromFinancialData(data);
  const result = computeRiskScore(input);

  // Map canonical factor triggers → legacy component buckets.
  const factor = (key: string) => result.factors.find((f) => f.key === key);
  const complianceRisk = factor('overdue_filings')?.triggered ? 80 : 0;
  const cashFlowRisk = factor('cash_runway')?.triggered ? 80 : 0;
  const concentrationRisk = factor('high_concentration')?.triggered ? 60 : 10;

  // Overdue exposure (INR amount) — kept from the legacy collections calc.
  const coll = calculateCollections(invoices, []);
  const overdueExposure = coll.totalOverdue;

  const overall = result.score;
  const riskLevel: RiskResult['riskLevel'] =
    overall >= 75 ? 'critical' :
    overall >= 50 ? 'high' :
    overall >= 25 ? 'medium' : 'low';

  return {
    overallRisk: overall,
    riskLevel,
    overdueExposure: round2(overdueExposure),
    complianceRisk,
    cashFlowRisk,
    concentrationRisk,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
