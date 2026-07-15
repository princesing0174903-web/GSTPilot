// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Signal Ranker
//
// Turns a flat list of Signals into a ranked list (RankedSignal[]) by scoring
// each on five factors:
//   1. severity     — critical/high/medium/low
//   2. monetary     — INR impact (log-scaled so a ₹10L problem isn't 1000× a ₹1K one)
//   3. urgency      — how soon the due date is (overdue > due-today > due-soon > no-date)
//   4. confidence   — analyzer-declared 0–1 confidence
//   5. category     — compliance / cashflow weigh higher than info-only categories
//
// Each factor contributes 0–20 points; the final score is 0–100. Ties are
// broken by (severity, monetaryValue, dueDate) so the order is deterministic.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RankedSignal, Signal, SignalCategory, SignalSeverity } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Severity weights ────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<SignalSeverity, number> = {
  critical: 20,
  high: 14,
  medium: 8,
  low: 3,
};

// ─── Category weights ─────────────────────────────────────────────────────────
// Compliance and cashflow problems are existential for a finance business —
// they get the maximum category weight. Growth/info signals get less.

const CATEGORY_WEIGHT: Record<SignalCategory, number> = {
  compliance: 20,
  cashflow: 20,
  deadline: 18,
  notice: 17,
  itc: 16,
  receivables: 14,
  payables: 13,
  banking: 12,
  growth: 10,
  productivity: 7,
};

// ─── Scoring functions ────────────────────────────────────────────────────────

function severityScore(signal: Signal): number {
  return SEVERITY_WEIGHT[signal.severity] ?? 0;
}

/**
 * Monetary score uses a log10 scale so:
 *   ₹0       → 0
 *   ₹1,000   → 5
 *   ₹1,00,000 → 10
 *   ₹1,00,00,000 → 15
 *   capped at 20.
 */
function monetaryScore(signal: Signal): number {
  const v = Math.max(0, signal.monetaryValue ?? 0);
  if (v <= 0) return 0;
  const raw = Math.log10(v + 1) * 2.5; // ₹100k → ~12.5
  return Math.min(20, raw);
}

/**
 * Urgency score. Overdue items get max; items due within 3 days get ~17;
 * within 7 days ~12; within 30 days ~6; no date → 0 for problems, 2 for
 * opportunities (so they surface even without a deadline).
 */
function urgencyScore(signal: Signal): number {
  if (!signal.dueDate) {
    return signal.kind === 'problem' ? 0 : 2;
  }
  const due = Date.parse(signal.dueDate);
  if (Number.isNaN(due)) return 0;
  const days = (due - Date.now()) / DAY_MS;
  if (days < 0) return 20; // overdue
  if (days <= 1) return 19;
  if (days <= 3) return 17;
  if (days <= 7) return 13;
  if (days <= 14) return 9;
  if (days <= 30) return 5;
  return 2;
}

function confidenceScore(signal: Signal): number {
  const c = Math.max(0, Math.min(1, signal.confidence ?? 0));
  return Math.round(c * 20);
}

function categoryScore(signal: Signal): number {
  return CATEGORY_WEIGHT[signal.category] ?? 5;
}

// ─── Ranker ───────────────────────────────────────────────────────────────────

export function rankSignals(signals: Signal[]): RankedSignal[] {
  const scored = signals.map((signal) => {
    const sev = severityScore(signal);
    const mon = monetaryScore(signal);
    const urg = urgencyScore(signal);
    const con = confidenceScore(signal);
    const cat = categoryScore(signal);
    const score = Math.round(sev + mon + urg + con + cat);
    return {
      ...signal,
      score,
      scoreBreakdown: {
        severity: sev,
        monetary: Math.round(mon * 10) / 10,
        urgency: urg,
        confidence: con,
        category: cat,
      },
    };
  });

  // Deterministic sort: score desc, then severity rank desc, then monetary desc,
  // then due-date asc (earliest first), then id asc.
  const severityRank: Record<SignalSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (severityRank[b.severity] !== severityRank[a.severity]) {
      return severityRank[b.severity] - severityRank[a.severity];
    }
    if (b.monetaryValue !== a.monetaryValue) return b.monetaryValue - a.monetaryValue;
    const aDue = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return a.id.localeCompare(b.id);
  });

  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}

/**
 * Convenience: return only the top-N signals (still ranked 1..N).
 */
export function topN(signals: RankedSignal[], n: number): RankedSignal[] {
  return signals.slice(0, n);
}
