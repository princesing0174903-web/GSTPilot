// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Analyzer Registry
//
// The single place new analyzers register. The engine imports `ANALYZERS`
// from here and runs them all in parallel over the collected dataset. Adding
// a new analyzer is a one-line change to this array.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Analyzer } from '../types';
import { cashflowAnalyzer } from './cashflow';
import { complianceAnalyzer } from './compliance';
import { deadlinesAnalyzer } from './deadlines';
import { productivityAnalyzer } from './productivity';
import { receivablesAnalyzer } from './receivables';

/**
 * Ordered list of all registered analyzers. Order matters only for the
 * metrics-panel grouping, not for the final ranking.
 */
export const ANALYZERS: Analyzer[] = [
  cashflowAnalyzer,
  complianceAnalyzer,
  receivablesAnalyzer,
  deadlinesAnalyzer,
  productivityAnalyzer,
];

/** Look up an analyzer by id. */
export function getAnalyzer(id: string): Analyzer | undefined {
  return ANALYZERS.find((a) => a.id === id);
}
