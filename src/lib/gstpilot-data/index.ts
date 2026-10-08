// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Firestore Data Layer (barrel)
//
// One import surface for Customers / Products / Invoices:
//   import { subscribeCustomers, createCustomer, ... } from '@/lib/gstpilot-data'
//
// Firestore is the ONLY source of truth for these three modules.
//   organizations/GSTpilot_SAAS/{customers,products,invoices}
// ═══════════════════════════════════════════════════════════════════════════════

// Explicit named re-exports for config helpers — webpack's `export *` can
// silently drop these in dev mode when the barrel is imported by many
// modules simultaneously. Explicit exports are tree-shakeable AND reliable.
export {
  isSyntheticOrgId,
  shouldSkipFirestore,
  orgCollectionPath,
  orgDocPath,
  CUSTOMERS_SUB,
  PRODUCTS_SUB,
  INVOICES_SUB,
  VENDORS_SUB,
  EXPENSES_SUB,
  PAYMENTS_SUB,
  COUNTERS_SUB,
  ACTIVITIES_SUB,
  ORG_ID,
  ORG_PATH,
  CUSTOMERS_COLLECTION,
  PRODUCTS_COLLECTION,
  INVOICES_COLLECTION,
  VENDORS_COLLECTION,
  EXPENSES_COLLECTION,
  PAYMENTS_COLLECTION,
  COUNTERS_COLLECTION,
  INVOICE_COUNTER_DOC,
  GST_RATES,
  DEFAULT_GST_RATE,
  STATE_CODES,
  CODE_TO_STATE,
  type GstRate,
} from './config';

export * from './types';
export * from './gst';
export * from './customers';
export * from './products';
export * from './invoices';
export * from './vendors';
export * from './expenses';
export * from './payments';
export * from './local-workspace';
