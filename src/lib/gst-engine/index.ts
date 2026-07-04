// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot GST Return Engine™ — Barrel Export (CLIENT-SAFE)
//
// The single import surface for the GST Return Engine. Import everything from
// `@/lib/gst-engine` — never reach into individual files.
//
//   import {
//     GSTTransaction,
//     generateGSTSummary,
//     subscribeToTransactions,
//     syncInvoiceToTransaction,
//   } from '@/lib/gst-engine';
//
// All re-exported modules are pure (types) or client-safe (calculations,
// validation, return-prep, service). No server-only code here.
// ═══════════════════════════════════════════════════════════════════════════════

// Types — pure, safe for client + server
export * from './types';

// Calculations — pure functions (GST math, summary, ITC)
export * from './calculations';

// Validation — pure functions (GSTIN, HSN, return-shape checks)
export * from './validation';

// Return preparation — pure functions (GSTR-1, GSTR-3B, GSTR-9 drafts)
export * from './return-prep';

// Client-safe Firestore service (reads + writes + real-time subs)
export {
  GST_COLLECTIONS,
  toTransaction,
  subscribeToTransactions,
  getTransaction,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  deleteTransactionsForInvoice,
  syncInvoiceToTransaction,
  getTransactionsForPeriod,
  getTransactionsForFY,
} from './service';
