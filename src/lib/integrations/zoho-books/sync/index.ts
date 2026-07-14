// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Barrel Export
//
// Single import surface for the Phase 2 data-sync module:
//   import { runSync, getSyncStatus } from '@/lib/integrations/zoho-books/sync';
// ═══════════════════════════════════════════════════════════════════════════════

// Types (zero `any`)
export * from './types';

// Mapper (pure normalization functions — exported for unit testing)
export {
  mapCustomerToClient,
  mapVendor,
  mapInvoice,
  mapBill,
  mapExpense,
  mapBankAccount,
  mapBankTransaction,
  mapJournal,
  mapTax,
  mapCustomerPayment,
  mapVendorPayment,
  mapItem,
  parseZohoLastModified,
  syntheticGstinForContact,
} from './mapper';

// Shared utilities
export {
  paginate,
  findLocalEntityId,
  recordEntityMapping,
  getWatermark,
  countImportedRecords,
  resolveSellerGstin,
} from './shared';

// Per-entity sync services
export { syncCustomers } from './customers';
export { syncVendors } from './vendors';
export { syncTaxes } from './taxes';
export { syncBankAccounts } from './bank-accounts';
export { syncInvoices } from './invoices';
export { syncBills } from './bills';
export { syncExpenses } from './expenses';
export { syncBankTransactions } from './bank-transactions';
export { syncJournals } from './journals';
export { syncPayments } from './payments';
export { syncItems } from './items';

// Orchestrator
export { runSync, getSyncStatus } from './sync';
