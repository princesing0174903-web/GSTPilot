// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Collector Registry
//
// The single place new collectors register. The engine imports `COLLECTORS`
// from here and runs them all in parallel. Adding a new data source is a
// one-line change to this array.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Collector } from '../types';
import { bankingCollector } from './banking';
import { calendarCollector } from './calendar';
import { driveCollector } from './drive';
import { gmailCollector } from './gmail';
import { gstCollector } from './gst';
import { invoicesCollector } from './invoices';

/**
 * Ordered list of all registered collectors. Order matters only for the
 * Sources panel display order, not for analysis.
 */
export const COLLECTORS: Collector[] = [
  invoicesCollector,
  gstCollector,
  bankingCollector,
  gmailCollector,
  calendarCollector,
  driveCollector,
];

/** Look up a collector by id. */
export function getCollector(id: string): Collector | undefined {
  return COLLECTORS.find((c) => c.id === id);
}
