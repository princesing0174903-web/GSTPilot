// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Barrel Export (CLIENT-SAFE)
//
// The single import surface for ERP functionality. This file is CLIENT-SAFE —
// it only re-exports types, errors, the provider interface, and the client-side
// Firestore service. The server-only modules (crypto, providers, orchestrator,
// scheduler) are NOT re-exported here; they must be imported directly from
// `./server/*` by API routes only.
//
// Importing from this file:
//   import { useERP, ERPConnection, ERPSummary } from '@/lib/erp-provider';
//
// API routes import the server modules directly:
//   import { getERPProvider } from '@/lib/erp-provider/server/registry';
//   import { fullERPSync } from '@/lib/erp-provider/server/orchestrator';
// ═══════════════════════════════════════════════════════════════════════════════

// Types — pure, safe for client + server
export * from './types';

// Errors — pure classes, safe for client + server
export * from './errors';

// Provider interface — pure, safe for client + server
export type { IERPProvider, ERPSession, ERPSyncOptions } from './provider';

// Client-safe Firestore service (reads + writes + real-time subs + summary)
export {
  ERP_COLLECTIONS,
  toConnection,
  subscribeToConnections,
  getConnections,
  getConnection,
  saveConnection,
  updateConnection,
  deleteConnection,
  toSyncJob,
  subscribeToSyncJobs,
  createSyncJob,
  updateSyncJob,
  toCustomer,
  subscribeToCustomers,
  getCustomers,
  saveCustomers,
  toVendor,
  subscribeToVendors,
  getVendors,
  saveVendors,
  toInvoice,
  subscribeToInvoices,
  getInvoices,
  saveInvoices,
  toInventoryItem,
  subscribeToInventory,
  getInventory,
  saveInventory,
  toLedger,
  subscribeToLedgers,
  getLedgers,
  saveLedgers,
  toPayment,
  subscribeToPayments,
  getPayments,
  savePayments,
  toBankTransaction,
  subscribeToBankTransactions,
  getBankTransactions,
  saveBankTransactions,
  toTax,
  subscribeToTaxes,
  getTaxes,
  saveTaxes,
  cascadeDisconnect,
  computeERPSummary,
} from './service';
