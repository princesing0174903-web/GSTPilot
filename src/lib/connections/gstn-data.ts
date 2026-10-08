// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — GSTN Data Generator
//
// REAL IMPLEMENTATION PENDING — returns null. GSTN API integration is a future
// enterprise phase.
//
// This module previously produced REALISTIC GST data deterministically derived
// from the verified GSTIN via a mulberry32 PRNG (filings, e-invoices, e-way
// bills, notices, ITC/cash/liability ledgers, GSTR-9). That synthetic data
// leaked into production dashboards and Oracle context, masquerading as real
// GSTN data. It has been gutted — `generateGstnDataset` now returns `null`
// (honest empty state) until a real NIC GSTN API client is wired up.
//
// Type definitions are preserved so callers continue to compile. All callers
// must handle the `null` return gracefully (treat as "no GSTN data available").
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  GstnDataset,
  GstrFilingSummary,
  EInvoiceRecord,
  EWayBillRecord,
  GstNoticeRecord,
  FilingHistoryEntry,
  ComplianceStatus,
  RegistrationProfile,
  Gstr9Summary,
  LedgerSummary,
} from './types';

// ─── Public: generate the full GSTN dataset for a verified GSTIN ─────────────────
// Returns null — real GSTN API integration is a future enterprise phase.
// Callers MUST handle null gracefully (show empty state, do not throw).
export function generateGstnDataset(_gstinRaw: string): GstnDataset | null {
  // REAL IMPLEMENTATION PENDING — returns null.
  // GSTN API integration (NIC e-invoice, e-way bill, returns, notices endpoints)
  // is a future enterprise phase. Synthetic data has been removed to ensure the
  // app shows honest empty states when no real GSTN data is available.
  void _gstinRaw;
  return null;
}

// Re-export the types so existing type-only imports from this file continue to work.
export type {
  GstnDataset,
  GstrFilingSummary,
  EInvoiceRecord,
  EWayBillRecord,
  GstNoticeRecord,
  FilingHistoryEntry,
  ComplianceStatus,
  RegistrationProfile,
  Gstr9Summary,
  LedgerSummary,
};
