// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Mock Tally Prime Provider (SERVER)
//
// Deterministic simulated Tally Prime responses. Seeded by company name so the
// same company always yields the same dataset — syncs are idempotent.
//
// This is the DEFAULT provider. Switch to the real Tally integration later by
// setting ERP_PROVIDER=tally-future (once implemented) — zero downstream changes.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ERPSession, ERPSyncOptions, IERPProvider } from '../provider';
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
import { AuthRejectedError, ERPUnavailableError, ValidationError } from '../errors';
import {
  generateBankTransactions,
  generateCustomers,
  generateInvoices,
  generateInventory,
  generateLedgers,
  generatePayments,
  generateTaxes,
  generateVendors,
  tokenExpiryFromNow,
} from './mock-data';

const ORG_PREFIX = 'mock-tally';

export class MockTallyProvider implements IERPProvider {
  readonly name = 'Mock Tally Prime';
  readonly provider: ERPProviderName = 'tally';
  readonly isLive = false;

  async connect(input: Omit<ConnectERPInput, 'organizationId' | 'createdBy'>): Promise<ConnectERPResult> {
    if (!input.companyName) throw new ValidationError('Company name is required.');
    if (!input.credentials?.host) throw new ValidationError('Tally host is required.');
    if (!input.credentials?.port) throw new ValidationError('Tally port is required.');
    // Simulate Tally being unreachable 5% of the time.
    await delay(300);
    if (Math.random() < 0.05) {
      throw new ERPUnavailableError('tally', 'Cannot reach Tally Prime at the specified host:port.');
    }
    return {
      connectionRef: `${ORG_PREFIX}:${input.companyName}:${Date.now()}`,
      companyNameMasked: maskName(input.companyName),
      companyInfo: {
        companyName: input.companyName,
        companyId: input.companyId || 'TALLY-001',
        gstin: input.companyGstin ?? null,
        financialYear: currentFY(),
        tokenExpiry: tokenExpiryFromNow(7),
      },
      message: 'Connected to Tally Prime successfully.',
    };
  }

  async completeConnection(connectionRef: string): Promise<{
    session: ERPSession;
    companyInfo: CompleteERPConnectionResult['companyInfo'];
  }> {
    await delay(200);
    const [_, companyName] = connectionRef.split(':');
    return {
      session: {
        accessToken: `tally-session-${hash(connectionRef)}`,
        provider: 'tally',
        companyId: 'TALLY-001',
        companyName,
        expiresAt: tokenExpiryFromNow(7),
        metadata: { host: 'localhost', port: 9000, type: 'local' },
      },
      companyInfo: {
        companyName,
        companyId: 'TALLY-001',
        gstin: null,
        financialYear: currentFY(),
        tokenExpiry: tokenExpiryFromNow(7),
      },
    };
  }

  async refreshSession(session: ERPSession): Promise<{ session: ERPSession }> {
    await delay(150);
    return {
      session: {
        ...session,
        accessToken: `tally-session-${hash(session.accessToken + Date.now())}`,
        expiresAt: tokenExpiryFromNow(7),
      },
    };
  }

  async disconnect(_session: ERPSession): Promise<void> {
    await delay(100);
  }

  async syncCustomers(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPCustomer[] }> {
    await delay(400);
    return {
      records: generateCustomers(seed(session), 'tally', session.companyId, '', 25),
    };
  }

  async syncVendors(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPVendor[] }> {
    await delay(400);
    return {
      records: generateVendors(seed(session), 'tally', session.companyId, '', 18),
    };
  }

  async syncInvoices(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    await delay(600);
    const customers = generateCustomers(seed(session), 'tally', session.companyId, '', 25);
    const vendors = generateVendors(seed(session), 'tally', session.companyId, '', 18);
    const inventory = generateInventory(seed(session), 'tally', session.companyId, '');
    return {
      records: generateInvoices(seed(session), 'tally', session.companyId, '', 40, customers, vendors, inventory),
    };
  }

  async syncSales(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    const all = await this.syncInvoices(session, _o);
    return { records: all.records.filter((i) => i.invoiceType === 'sales') };
  }

  async syncPurchases(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    const all = await this.syncInvoices(session, _o);
    return { records: all.records.filter((i) => i.invoiceType === 'purchase') };
  }

  async syncExpenses(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }> {
    await delay(300);
    // Expenses modeled as purchase invoices with expense voucher type.
    const customers = generateCustomers(seed(session), 'tally', session.companyId, '', 5);
    const vendors = generateVendors(seed(session), 'tally', session.companyId, '', 8);
    const inventory = generateInventory(seed(session), 'tally', session.companyId, '');
    return {
      records: generateInvoices(`${ORG_PREFIX}:${session.companyName}:exp`, 'tally', session.companyId, '', 12, customers, vendors, inventory),
    };
  }

  async syncInventory(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPInventoryItem[] }> {
    await delay(400);
    return { records: generateInventory(seed(session), 'tally', session.companyId, '') };
  }

  async syncLedgers(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPLedger[] }> {
    await delay(400);
    return { records: generateLedgers(seed(session), 'tally', session.companyId, '') };
  }

  async syncPayments(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPPayment[] }> {
    await delay(400);
    const customers = generateCustomers(seed(session), 'tally', session.companyId, '', 25);
    const vendors = generateVendors(seed(session), 'tally', session.companyId, '', 18);
    const inventory = generateInventory(seed(session), 'tally', session.companyId, '');
    const invoices = generateInvoices(seed(session), 'tally', session.companyId, '', 40, customers, vendors, inventory);
    return { records: generatePayments(seed(session), 'tally', session.companyId, '', 30, invoices) };
  }

  async syncBankTransactions(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPBankTransaction[] }> {
    await delay(400);
    return { records: generateBankTransactions(seed(session), 'tally', session.companyId, '', 40) };
  }

  async syncTaxes(session: ERPSession, _o?: ERPSyncOptions): Promise<{ records: ERPTax[] }> {
    await delay(300);
    const customers = generateCustomers(seed(session), 'tally', session.companyId, '', 25);
    const vendors = generateVendors(seed(session), 'tally', session.companyId, '', 18);
    const inventory = generateInventory(seed(session), 'tally', session.companyId, '');
    const invoices = generateInvoices(seed(session), 'tally', session.companyId, '', 40, customers, vendors, inventory);
    return { records: generateTaxes(seed(session), 'tally', session.companyId, '', invoices) };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seed(session: ERPSession): string {
  return `${ORG_PREFIX}:${session.companyName}`;
}

function maskName(name: string): string {
  if (name.length <= 4) return name[0] + '***';
  return name.slice(0, 2) + '***' + name.slice(-2);
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function currentFY(): string {
  const now = new Date();
  const y = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  return `FY${y}-${String(y + 1).slice(2)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
