// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Bank Data Generator
//
// REAL IMPLEMENTATION PENDING — returns null. Real bank API (Razorpay, Decentro,
// MBS, Anumati, etc.) integration is a future enterprise phase.
//
// This module previously produced REALISTIC bank transactions deterministically
// derived from the connected bank provider + a seeded account number via a
// mulberry32 PRNG (90 days of synthetic NEFT/UPI/salary/EMI/tax/interest txns
// with hardcoded counterparty pools). That synthetic data leaked into
// production dashboards and Oracle context, masquerading as real bank data.
// It has been gutted — `generateBankDataset` now returns `null` (honest empty
// state) until a real bank API client is wired up.
//
// Type definitions are preserved so callers continue to compile. All callers
// must handle the `null` return gracefully (treat as "no bank data available").
// ═══════════════════════════════════════════════════════════════════════════════

import type { BankProvider, BankDataset, BankTransactionRecord } from './types';

// ─── Generate 90 days of transactions ───────────────────────────────────────────
// Returns null — real bank API integration is a future enterprise phase.
// Callers MUST handle null gracefully (show empty state, do not throw).
export function generateBankDataset(
  _provider: BankProvider,
  _accountRef: string,
  _days = 90,
): BankDataset | null {
  // REAL IMPLEMENTATION PENDING — returns null.
  // Real bank API integration (Razorpay, Decentro, MBS, Anumati, etc.) is a
  // future enterprise phase. Synthetic data has been removed to ensure the app
  // shows honest empty states when no real bank data is available.
  void _provider;
  void _accountRef;
  void _days;
  return null;
}

// Re-export the types so existing type-only imports from this file continue to work.
export type { BankProvider, BankDataset, BankTransactionRecord };
