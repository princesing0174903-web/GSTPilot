// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — Mock QuickBooks Online Provider (SERVER)
//
// Deterministic simulated QuickBooks Online responses. Seeded by company name.
//
// GATING: Disabled by default. Set `MOCK_ERP_PROVIDER=true` in env to enable.
// When disabled, every sync method returns empty records (`{ records: [] }`),
// the connect/complete/refresh lifecycle methods throw, and healthCheck returns
// `false`. Real ERP integration is via Zoho Books customer sync
// (/api/integrations/zoho/customers). This mock is retained only as a
// provider-architecture fallback for local development.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ERPSession, ERPSyncOptions, IERPProvider } from '../provider';
import type {
  CompleteERPConnectionResult, ConnectERPInput, ConnectERPResult,
  ERPCustomer, ERPInventoryItem, ERPInvoice, ERPLedger, ERPPayment,
  ERPProviderName, ERPBankTransaction, ERPTax, ERPVendor,
} from '../types';
import { ERPUnavailableError, ValidationError } from '../errors';
import {
  generateBankTransactions, generateCustomers, generateInvoices, generateInventory,
  generateLedgers, generatePayments, generateTaxes, generateVendors, tokenExpiryFromNow,
} from './mock-data';

const ORG_PREFIX = 'mock-qbo';

// Mock ERP provider is disabled by default. Set MOCK_ERP_PROVIDER=true to enable.
const MOCK_ERP_ENABLED = process.env.MOCK_ERP_PROVIDER === 'true';
const MOCK_DISABLED_MSG = 'Mock ERP provider disabled. Connect a real ERP (Zoho Books).';

export class MockQuickBooksProvider implements IERPProvider {
  readonly name = 'Mock QuickBooks Online';
  readonly provider: ERPProviderName = 'quickbooks';
  readonly isLive = false;

  async connect(input: Omit<ConnectERPInput, 'organizationId' | 'createdBy'>): Promise<ConnectERPResult> {
    if (!MOCK_ERP_ENABLED) throw new ERPUnavailableError('quickbooks', MOCK_DISABLED_MSG);
    if (!input.companyName) throw new ValidationError('Company name is required.');
    if (!input.credentials?.realmId) throw new ValidationError('QuickBooks realm id is required.');
    await delay(300);
    if (Math.random() < 0.05) throw new ERPUnavailableError('quickbooks');
    return {
      connectionRef: `${ORG_PREFIX}:${input.companyName}:${Date.now()}`,
      companyNameMasked: maskName(input.companyName),
      companyInfo: {
        companyName: input.companyName,
        companyId: input.companyId || input.credentials.realmId,
        gstin: input.companyGstin ?? null,
        financialYear: currentFY(),
        tokenExpiry: tokenExpiryFromNow(1), // QBO access tokens last 1 hour
      },
      message: 'Connected to QuickBooks Online successfully.',
    };
  }

  async completeConnection(connectionRef: string): Promise<{
    session: ERPSession; companyInfo: CompleteERPConnectionResult['companyInfo'];
  }> {
    if (!MOCK_ERP_ENABLED) throw new ERPUnavailableError('quickbooks', MOCK_DISABLED_MSG);
    await delay(200);
    const [, companyName] = connectionRef.split(':');
    return {
      session: {
        accessToken: `qbo-oauth-${hash(connectionRef)}`,
        refreshToken: `qbo-refresh-${hash(connectionRef + 'r')}`,
        provider: 'quickbooks',
        companyId: 'QBO-001',
        companyName,
        expiresAt: tokenExpiryFromNow(1),
        metadata: { realmId: 'QBO-001', environment: 'sandbox' },
      },
      companyInfo: {
        companyName, companyId: 'QBO-001', gstin: null,
        financialYear: currentFY(), tokenExpiry: tokenExpiryFromNow(1),
      },
    };
  }

  async refreshSession(session: ERPSession): Promise<{ session: ERPSession }> {
    if (!MOCK_ERP_ENABLED) throw new ERPUnavailableError('quickbooks', MOCK_DISABLED_MSG);
    await delay(150);
    return {
      session: {
        ...session,
        accessToken: `qbo-oauth-${hash(session.accessToken + Date.now())}`,
        expiresAt: tokenExpiryFromNow(1),
      },
    };
  }

  async disconnect(_session: ERPSession): Promise<void> { await delay(100); }

  async syncCustomers(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPCustomer[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateCustomers(seed(session), 'quickbooks', session.companyId, '', 24) };
  }
  async syncVendors(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPVendor[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateVendors(seed(session), 'quickbooks', session.companyId, '', 17) };
  }
  async syncInvoices(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(600);
    const customers = generateCustomers(seed(session), 'quickbooks', session.companyId, '', 24);
    const vendors = generateVendors(seed(session), 'quickbooks', session.companyId, '', 17);
    const inventory = generateInventory(seed(session), 'quickbooks', session.companyId, '');
    return { records: generateInvoices(seed(session), 'quickbooks', session.companyId, '', 42, customers, vendors, inventory) };
  }
  async syncSales(session: ERPSession, o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    const all = await this.syncInvoices(session, o);
    return { records: all.records.filter((i) => i.invoiceType === 'sales') };
  }
  async syncPurchases(session: ERPSession, o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    const all = await this.syncInvoices(session, o);
    return { records: all.records.filter((i) => i.invoiceType === 'purchase') };
  }
  async syncExpenses(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(300);
    const customers = generateCustomers(seed(session), 'quickbooks', session.companyId, '', 5);
    const vendors = generateVendors(seed(session), 'quickbooks', session.companyId, '', 8);
    const inventory = generateInventory(seed(session), 'quickbooks', session.companyId, '');
    return { records: generateInvoices(`${ORG_PREFIX}:${session.companyName}:exp`, 'quickbooks', session.companyId, '', 13, customers, vendors, inventory) };
  }
  async syncInventory(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInventoryItem[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateInventory(seed(session), 'quickbooks', session.companyId, '') };
  }
  async syncLedgers(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPLedger[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateLedgers(seed(session), 'quickbooks', session.companyId, '') };
  }
  async syncPayments(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPPayment[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    const customers = generateCustomers(seed(session), 'quickbooks', session.companyId, '', 24);
    const vendors = generateVendors(seed(session), 'quickbooks', session.companyId, '', 17);
    const inventory = generateInventory(seed(session), 'quickbooks', session.companyId, '');
    const invoices = generateInvoices(seed(session), 'quickbooks', session.companyId, '', 42, customers, vendors, inventory);
    return { records: generatePayments(seed(session), 'quickbooks', session.companyId, '', 30, invoices) };
  }
  async syncBankTransactions(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPBankTransaction[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateBankTransactions(seed(session), 'quickbooks', session.companyId, '', 38) };
  }
  async syncTaxes(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPTax[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(300);
    const customers = generateCustomers(seed(session), 'quickbooks', session.companyId, '', 24);
    const vendors = generateVendors(seed(session), 'quickbooks', session.companyId, '', 17);
    const inventory = generateInventory(seed(session), 'quickbooks', session.companyId, '');
    const invoices = generateInvoices(seed(session), 'quickbooks', session.companyId, '', 42, customers, vendors, inventory);
    return { records: generateTaxes(seed(session), 'quickbooks', session.companyId, '', invoices) };
  }
  async healthCheck(): Promise<boolean> { return MOCK_ERP_ENABLED; }
}

function seed(session: ERPSession): string { return `${ORG_PREFIX}:${session.companyName}`; }
function maskName(name: string): string {
  if (name.length <= 4) return name[0] + '***';
  return name.slice(0, 2) + '***' + name.slice(-2);
}
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
function currentFY(): string {
  const now = new Date();
  const y = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  return `FY${y}-${String(y + 1).slice(2)}`;
}
function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
