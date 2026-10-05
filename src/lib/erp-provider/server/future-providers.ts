// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Future (Real-API) Providers
//
// Placeholder implementations of the four real ERP backends. Every method
// throws NotImplementedError so the app fails loudly if someone switches
// ERP_PROVIDER to a 'future' variant before the real integration is built.
//
// When the real integrations are implemented, replace the throw bodies with
// real fetch() calls. The IERPProvider contract + service layer + UI all stay
// identical — zero downstream changes.
//
// ENV VARS (set when implementing the real provider):
//   • Tally:    TALLY_HOST, TALLY_PORT (default 9000), TALLY_COMPANY
//   • Zoho:     ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN,
//               ZOHO_ORGANIZATION_ID, ZOHO_DATA_CENTER (in/com/eu)
//   • Busy:     BUSY_API_BASE, BUSY_API_KEY, BUSY_COMPANY
//   • QuickBooks: QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REFRESH_TOKEN,
//                 QBO_REALM_ID, QBO_ENVIRONMENT (production/sandbox)
// ═══════════════════════════════════════════════════════════════════════════════

import { NotImplementedError } from '../errors';
import type { ERPSession, IERPProvider, ERPSyncOptions } from '../provider';
import type {
  CompleteERPConnectionResult,
  ConnectERPInput,
  ConnectERPResult,
  ERPCustomer,
  ERPInventoryItem,
  ERPInvoice,
  ERPLedger,
  ERPPayment,
  ERPProviderName,
  ERPBankTransaction,
  ERPTax,
  ERPVendor,
} from '../types';

// ─── Shared placeholder body ──────────────────────────────────────────────────

function notImplemented(provider: string, method: string): never {
  throw new NotImplementedError(provider, method);
}

function requireConfig(keys: string[], provider: string): void {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.warn(
      `[erp-provider] ${provider} is missing env vars: ${missing.join(', ')}. ` +
        `Set them before enabling this provider.`,
    );
  }
}

// ─── Future Tally Prime Provider ──────────────────────────────────────────────

/**
 * Real Tally Prime integration (placeholder).
 *
 * Tally Prime exposes a local HTTP XML-over-HTTP API on port 9000. The real
 * implementation will POST TDL XML envelopes to http://<host>:<port> and parse
 * the XML response. See:
 *   https://tallysolutions.com/developers/
 */
export class FutureTallyProvider implements IERPProvider {
  readonly name = 'Tally Prime (Live)';
  readonly provider: ERPProviderName = 'tally';
  readonly isLive = true;

  constructor() {
    requireConfig(['TALLY_HOST', 'TALLY_PORT', 'TALLY_COMPANY'], 'FutureTallyProvider');
  }

  async connect(_input: Omit<ConnectERPInput, 'organizationId' | 'createdBy'>): Promise<ConnectERPResult> {
    notImplemented('FutureTallyProvider', 'connect');
  }
  async completeConnection(_ref: string): Promise<{
    session: ERPSession;
    companyInfo: CompleteERPConnectionResult['companyInfo'];
  }> {
    notImplemented('FutureTallyProvider', 'completeConnection');
  }
  async refreshSession(_session: ERPSession): Promise<{ session: ERPSession }> {
    notImplemented('FutureTallyProvider', 'refreshSession');
  }
  async disconnect(_session: ERPSession): Promise<void> {
    notImplemented('FutureTallyProvider', 'disconnect');
  }
  async syncCustomers(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPCustomer[] }> {
    notImplemented('FutureTallyProvider', 'syncCustomers');
  }
  async syncVendors(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPVendor[] }> {
    notImplemented('FutureTallyProvider', 'syncVendors');
  }
  async syncInvoices(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureTallyProvider', 'syncInvoices');
  }
  async syncSales(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureTallyProvider', 'syncSales');
  }
  async syncPurchases(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureTallyProvider', 'syncPurchases');
  }
  async syncExpenses(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureTallyProvider', 'syncExpenses');
  }
  async syncInventory(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInventoryItem[] }> {
    notImplemented('FutureTallyProvider', 'syncInventory');
  }
  async syncLedgers(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPLedger[] }> {
    notImplemented('FutureTallyProvider', 'syncLedgers');
  }
  async syncPayments(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPPayment[] }> {
    notImplemented('FutureTallyProvider', 'syncPayments');
  }
  async syncBankTransactions(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPBankTransaction[] }> {
    notImplemented('FutureTallyProvider', 'syncBankTransactions');
  }
  async syncTaxes(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPTax[] }> {
    notImplemented('FutureTallyProvider', 'syncTaxes');
  }
  async healthCheck(): Promise<boolean> {
    // Real implementation: GET http://<host>:<port> and check for Tally response.
    return false;
  }
}

// ─── Future Zoho Books Provider ───────────────────────────────────────────────

/**
 * Real Zoho Books integration (placeholder).
 *
 * Zoho Books uses OAuth 2.0 + REST API at https://www.zohoapis.<dc>/books/v3/.
 * The real implementation will refresh the access token using the refresh
 * token, then call the /contacts, /invoices, /expenses, /items, /chartofaccounts
 * endpoints. See: https://www.zoho.com/books/api/v3/
 */
export class FutureZohoBooksProvider implements IERPProvider {
  readonly name = 'Zoho Books (Live)';
  readonly provider: ERPProviderName = 'zoho_books';
  readonly isLive = true;

  constructor() {
    requireConfig(
      ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ORGANIZATION_ID'],
      'FutureZohoBooksProvider',
    );
  }

  async connect(_input: Omit<ConnectERPInput, 'organizationId' | 'createdBy'>): Promise<ConnectERPResult> {
    notImplemented('FutureZohoBooksProvider', 'connect');
  }
  async completeConnection(_ref: string): Promise<{
    session: ERPSession;
    companyInfo: CompleteERPConnectionResult['companyInfo'];
  }> {
    notImplemented('FutureZohoBooksProvider', 'completeConnection');
  }
  async refreshSession(_session: ERPSession): Promise<{ session: ERPSession }> {
    notImplemented('FutureZohoBooksProvider', 'refreshSession');
  }
  async disconnect(_session: ERPSession): Promise<void> {
    notImplemented('FutureZohoBooksProvider', 'disconnect');
  }
  async syncCustomers(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPCustomer[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncCustomers');
  }
  async syncVendors(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPVendor[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncVendors');
  }
  async syncInvoices(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncInvoices');
  }
  async syncSales(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncSales');
  }
  async syncPurchases(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncPurchases');
  }
  async syncExpenses(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncExpenses');
  }
  async syncInventory(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInventoryItem[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncInventory');
  }
  async syncLedgers(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPLedger[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncLedgers');
  }
  async syncPayments(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPPayment[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncPayments');
  }
  async syncBankTransactions(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPBankTransaction[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncBankTransactions');
  }
  async syncTaxes(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPTax[] }> {
    notImplemented('FutureZohoBooksProvider', 'syncTaxes');
  }
  async healthCheck(): Promise<boolean> {
    return false;
  }
}

// ─── Future Busy Accounting Provider ──────────────────────────────────────────

/**
 * Real Busy Accounting integration (placeholder).
 *
 * Busy exposes a local REST export API. The real implementation will call the
 * /sales, /purchase, /stock, /ledger, /gst-returns endpoints. See:
 *   https://busy.in/
 */
export class FutureBusyProvider implements IERPProvider {
  readonly name = 'Busy Accounting (Live)';
  readonly provider: ERPProviderName = 'busy';
  readonly isLive = true;

  constructor() {
    requireConfig(['BUSY_API_BASE', 'BUSY_API_KEY', 'BUSY_COMPANY'], 'FutureBusyProvider');
  }

  async connect(_input: Omit<ConnectERPInput, 'organizationId' | 'createdBy'>): Promise<ConnectERPResult> {
    notImplemented('FutureBusyProvider', 'connect');
  }
  async completeConnection(_ref: string): Promise<{
    session: ERPSession;
    companyInfo: CompleteERPConnectionResult['companyInfo'];
  }> {
    notImplemented('FutureBusyProvider', 'completeConnection');
  }
  async refreshSession(_session: ERPSession): Promise<{ session: ERPSession }> {
    notImplemented('FutureBusyProvider', 'refreshSession');
  }
  async disconnect(_session: ERPSession): Promise<void> {
    notImplemented('FutureBusyProvider', 'disconnect');
  }
  async syncCustomers(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPCustomer[] }> {
    notImplemented('FutureBusyProvider', 'syncCustomers');
  }
  async syncVendors(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPVendor[] }> {
    notImplemented('FutureBusyProvider', 'syncVendors');
  }
  async syncInvoices(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureBusyProvider', 'syncInvoices');
  }
  async syncSales(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureBusyProvider', 'syncSales');
  }
  async syncPurchases(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureBusyProvider', 'syncPurchases');
  }
  async syncExpenses(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureBusyProvider', 'syncExpenses');
  }
  async syncInventory(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInventoryItem[] }> {
    notImplemented('FutureBusyProvider', 'syncInventory');
  }
  async syncLedgers(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPLedger[] }> {
    notImplemented('FutureBusyProvider', 'syncLedgers');
  }
  async syncPayments(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPPayment[] }> {
    notImplemented('FutureBusyProvider', 'syncPayments');
  }
  async syncBankTransactions(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPBankTransaction[] }> {
    notImplemented('FutureBusyProvider', 'syncBankTransactions');
  }
  async syncTaxes(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPTax[] }> {
    notImplemented('FutureBusyProvider', 'syncTaxes');
  }
  async healthCheck(): Promise<boolean> {
    return false;
  }
}

// ─── Future QuickBooks Online Provider ────────────────────────────────────────

/**
 * Real QuickBooks Online integration (placeholder).
 *
 * QBO uses OAuth 2.0 + REST at https://quickbooks.api.intuit.com/v3/company/
 * <realm>/query. The real implementation will refresh the access token, then
 * run SQL-like queries against the Query API. See:
 *   https://developer.intuit.com/app/developer/qbo/docs/api
 */
export class FutureQuickBooksProvider implements IERPProvider {
  readonly name = 'QuickBooks Online (Live)';
  readonly provider: ERPProviderName = 'quickbooks';
  readonly isLive = true;

  constructor() {
    requireConfig(
      ['QBO_CLIENT_ID', 'QBO_CLIENT_SECRET', 'QBO_REFRESH_TOKEN', 'QBO_REALM_ID'],
      'FutureQuickBooksProvider',
    );
  }

  async connect(_input: Omit<ConnectERPInput, 'organizationId' | 'createdBy'>): Promise<ConnectERPResult> {
    notImplemented('FutureQuickBooksProvider', 'connect');
  }
  async completeConnection(_ref: string): Promise<{
    session: ERPSession;
    companyInfo: CompleteERPConnectionResult['companyInfo'];
  }> {
    notImplemented('FutureQuickBooksProvider', 'completeConnection');
  }
  async refreshSession(_session: ERPSession): Promise<{ session: ERPSession }> {
    notImplemented('FutureQuickBooksProvider', 'refreshSession');
  }
  async disconnect(_session: ERPSession): Promise<void> {
    notImplemented('FutureQuickBooksProvider', 'disconnect');
  }
  async syncCustomers(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPCustomer[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncCustomers');
  }
  async syncVendors(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPVendor[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncVendors');
  }
  async syncInvoices(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncInvoices');
  }
  async syncSales(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncSales');
  }
  async syncPurchases(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncPurchases');
  }
  async syncExpenses(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncExpenses');
  }
  async syncInventory(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInventoryItem[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncInventory');
  }
  async syncLedgers(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPLedger[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncLedgers');
  }
  async syncPayments(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPPayment[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncPayments');
  }
  async syncBankTransactions(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPBankTransaction[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncBankTransactions');
  }
  async syncTaxes(_s: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPTax[] }> {
    notImplemented('FutureQuickBooksProvider', 'syncTaxes');
  }
  async healthCheck(): Promise<boolean> {
    return false;
  }
}
