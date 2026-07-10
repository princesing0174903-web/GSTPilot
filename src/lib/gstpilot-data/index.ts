// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Firestore Data Layer (barrel)
//
// One import surface for Customers / Products / Invoices:
//   import { subscribeCustomers, createCustomer, ... } from '@/lib/gstpilot-data'
//
// Firestore is the ONLY source of truth for these three modules.
//   organizations/GSTpilot_SAAS/{customers,products,invoices}
// ═══════════════════════════════════════════════════════════════════════════════

export * from './config';
export * from './types';
export * from './gst';
export * from './customers';
export * from './products';
export * from './invoices';
