// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — Mock Busy Accounting Provider (SERVER)
//
// Deterministic simulated Busy Accounting responses. Seeded by company name.
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

const ORG_PREFIX = 'mock-busy';

// Mock ERP provider is disabled by default. Set MOCK_ERP_PROVIDER=true to enable.
const MOCK_ERP_ENABLED = process.env.MOCK_ERP_PROVIDER === 'true';
const MOCK_DISABLED_MSG = 'Mock ERP provider disabled. Connect a real ERP (Zoho Books).';

export class MockBusyProvider implements IERPProvider {
  readonly name = 'Mock Busy Accounting';
  readonly provider: ERPProviderName = 'busy';
  readonly isLive = false;

  async connect(input: Omit<ConnectERPInput, 'organizationId' | 'createdBy'>): Promise<ConnectERPResult> {
    if (!MOCK_ERP_ENABLED) throw new ERPUnavailableError('busy', MOCK_DISABLED_MSG);
    if (!input.companyName) throw new ValidationError('Company name is required.');
    if (!input.credentials?.apiKey) throw new ValidationError('Busy API key is required.');
    await delay(300);
    if (Math.random() < 0.05) throw new ERPUnavailableError('busy');
    return {
      connectionRef: `${ORG_PREFIX}:${input.companyName}:${Date.now()}`,
      companyNameMasked: maskName(input.companyName),
      companyInfo: {
        companyName: input.companyName,
        companyId: input.companyId || 'BUSY-001',
        gstin: input.companyGstin ?? null,
        financialYear: currentFY(),
        tokenExpiry: tokenExpiryFromNow(30), // Busy local API key — long-lived
      },
      message: 'Connected to Busy Accounting successfully.',
    };
  }

  async completeConnection(connectionRef: string): Promise<{
    session: ERPSession; companyInfo: CompleteERPConnectionResult['companyInfo'];
  }> {
    if (!MOCK_ERP_ENABLED) throw new ERPUnavailableError('busy', MOCK_DISABLED_MSG);
    await delay(200);
    const [, companyName] = connectionRef.split(':');
    return {
      session: {
        accessToken: `busy-key-${hash(connectionRef)}`,
        provider: 'busy',
        companyId: 'BUSY-001',
        companyName,
        expiresAt: tokenExpiryFromNow(30),
        metadata: { apiBase: 'http://localhost:8080' },
      },
      companyInfo: {
        companyName, companyId: 'BUSY-001', gstin: null,
        financialYear: currentFY(), tokenExpiry: tokenExpiryFromNow(30),
      },
    };
  }

  async refreshSession(session: ERPSession): Promise<{ session: ERPSession }> {
    if (!MOCK_ERP_ENABLED) throw new ERPUnavailableError('busy', MOCK_DISABLED_MSG);
    await delay(150);
    return { session: { ...session, expiresAt: tokenExpiryFromNow(30) } };
  }

  async disconnect(_session: ERPSession): Promise<void> { await delay(100); }

  async syncCustomers(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPCustomer[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateCustomers(seed(session), 'busy', session.companyId, '', 22) };
  }
  async syncVendors(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPVendor[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateVendors(seed(session), 'busy', session.companyId, '', 20) };
  }
  async syncInvoices(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(600);
    const customers = generateCustomers(seed(session), 'busy', session.companyId, '', 22);
    const vendors = generateVendors(seed(session), 'busy', session.companyId, '', 20);
    const inventory = generateInventory(seed(session), 'busy', session.companyId, '');
    return { records: generateInvoices(seed(session), 'busy', session.companyId, '', 38, customers, vendors, inventory) };
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
    const customers = generateCustomers(seed(session), 'busy', session.companyId, '', 5);
    const vendors = generateVendors(seed(session), 'busy', session.companyId, '', 8);
    const inventory = generateInventory(seed(session), 'busy', session.companyId, '');
    return { records: generateInvoices(`${ORG_PREFIX}:${session.companyName}:exp`, 'busy', session.companyId, '', 10, customers, vendors, inventory) };
  }
  async syncInventory(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInventoryItem[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateInventory(seed(session), 'busy', session.companyId, '') };
  }
  async syncLedgers(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPLedger[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateLedgers(seed(session), 'busy', session.companyId, '') };
  }
  async syncPayments(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPPayment[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    const customers = generateCustomers(seed(session), 'busy', session.companyId, '', 22);
    const vendors = generateVendors(seed(session), 'busy', session.companyId, '', 20);
    const inventory = generateInventory(seed(session), 'busy', session.companyId, '');
    const invoices = generateInvoices(seed(session), 'busy', session.companyId, '', 38, customers, vendors, inventory);
    return { records: generatePayments(seed(session), 'busy', session.companyId, '', 28, invoices) };
  }
  async syncBankTransactions(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPBankTransaction[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(400);
    return { records: generateBankTransactions(seed(session), 'busy', session.companyId, '', 35) };
  }
  async syncTaxes(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPTax[] }> {
    if (!MOCK_ERP_ENABLED) return { records: [] };
    await delay(300);
    const customers = generateCustomers(seed(session), 'busy', session.companyId, '', 22);
    const vendors = generateVendors(seed(session), 'busy', session.companyId, '', 20);
    const inventory = generateInventory(seed(session), 'busy', session.companyId, '');
    const invoices = generateInvoices(seed(session), 'busy', session.companyId, '', 38, customers, vendors, inventory);
    return { records: generateTaxes(seed(session), 'busy', session.companyId, '', invoices) };
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
