// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Engine — Barrel Export
//
// Pure, client-safe banking engines:
//   • categorize.ts — Transaction Categorization Engine (12 categories)
//   • reconcile.ts  — Bank Reconciliation Engine (matched / partially / unmatched)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_TONES,
  categorizeTransaction,
  extractCounterparty,
  extractReferenceNumber,
  recategorizeTransactions,
  type CategorizeInput,
} from './categorize';

export {
  reconcileTransaction,
  reconcileTransactions,
  reconciliationSummary,
  type ReconcileInvoiceRef,
  type ReconcileResult,
} from './reconcile';
