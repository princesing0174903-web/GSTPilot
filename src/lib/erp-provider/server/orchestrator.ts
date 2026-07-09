// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Server Orchestrator (SERVER-ONLY)
//
// The thin server-side layer that:
//   1. Resolves the active provider via the registry
//   2. Encrypts / decrypts connections with AES-256-GCM (server-only key)
//   3. Calls the provider and returns fully-formed Firestore-ready objects
//   4. Stamps every record with organizationId + connectionId + provider
//
// This file is SERVER-ONLY — it imports `node:crypto` (via the provider + crypto
// modules) and must NEVER be bundled into client code. API routes are the only
// legitimate consumers.
//
// Multi-tenant: every function takes `organizationId` and stamps it onto every
// returned object so the client can write directly to Firestore without
// additional processing.
// ═══════════════════════════════════════════════════════════════════════════════

import { getERPProvider } from './registry';
import { decryptConnection, encryptConnection } from './crypto';
import type { ERPSession, ERPSyncOptions } from '../provider';
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
  ERPSyncJobType,
  ERPSyncResult,
  ERPTax,
  ERPVendor,
  RefreshERPConnectionResult,
} from '../types';
import { ERPError, TokenExpiredError, ValidationError, friendlyERPError } from '../errors';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new ERPError(
      'You must belong to an organization to manage ERP connections.',
      { code: 'NO_ORGANIZATION', statusCode: 403 },
    );
  }
}

// ─── Connection lifecycle ────────────────────────────────────────────────────

/**
 * Step 1 of the connect flow — initiate an ERP connection via the provider.
 * Does NOT touch Firestore. The client writes the connection doc with
 * status='connecting' after this succeeds.
 */
export async function connectERP(input: ConnectERPInput): Promise<ConnectERPResult> {
  assertOrg(input.organizationId);
  if (!input.provider) throw new ValidationError('ERP provider is required.');
  if (!input.companyName) throw new ValidationError('Company name is required.');
  if (!input.credentials || Object.keys(input.credentials).length === 0) {
    throw new ValidationError('ERP credentials are required.');
  }
  const provider = getERPProvider(input.provider);
  try {
    return await provider.connect({
      provider: input.provider,
      companyName: input.companyName,
      companyId: input.companyId,
      companyGstin: input.companyGstin,
      credentials: input.credentials,
    });
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Step 2 of the connect flow — complete the connection (post-validation).
 * Returns the ENCRYPTED connection (safe to store in Firestore) + company info.
 * The client writes both to Firestore after this succeeds.
 */
export async function completeERPConnection(
  organizationId: string,
  connectionRef: string,
): Promise<CompleteERPConnectionResult> {
  assertOrg(organizationId);
  if (!connectionRef) throw new ValidationError('connectionRef is required.');
  // Provider is determined by the connectionRef prefix (mock-tally / mock-zoho_books / etc.)
  const providerName = parseProviderFromRef(connectionRef);
  const provider = getERPProvider(providerName);
  try {
    const { session, companyInfo } = await provider.completeConnection(connectionRef);
    const encryptedConnection = encryptConnection(session);
    return {
      encryptedConnection,
      tokenExpiry: session.expiresAt,
      companyInfo,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Refresh an existing connection using the refresh token.
 * The client passes the encrypted connection blob; we decrypt, refresh, re-encrypt.
 */
export async function refreshERPConnection(
  encryptedConnection: string,
): Promise<RefreshERPConnectionResult> {
  if (!encryptedConnection) throw new TokenExpiredError();
  let session: ERPSession;
  try {
    session = decryptConnection<ERPSession>(encryptedConnection);
  } catch {
    throw new TokenExpiredError();
  }
  const provider = getERPProvider(session.provider);
  try {
    const { session: newSession } = await provider.refreshSession(session);
    return {
      encryptedConnection: encryptConnection(newSession),
      tokenExpiry: newSession.expiresAt,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Disconnect — invalidate the connection server-side.
 * Idempotent: does not throw if the connection is already invalid.
 */
export async function disconnectERP(encryptedConnection: string | null): Promise<void> {
  if (!encryptedConnection) return;
  let session: ERPSession;
  try {
    session = decryptConnection<ERPSession>(encryptedConnection);
  } catch {
    return;
  }
  const provider = getERPProvider(session.provider);
  try {
    await provider.disconnect(session);
  } catch (err) {
    console.warn('[erp-provider] disconnect failed (non-fatal):', friendlyERPError(err));
  }
}

// ─── Data fetch (sync) operations ────────────────────────────────────────────

/** Records returned from a sync, grouped by entity type. */
export interface ERPSyncRecords {
  customers: ERPCustomer[];
  vendors: ERPVendor[];
  invoices: ERPInvoice[];
  inventory: ERPInventoryItem[];
  ledgers: ERPLedger[];
  payments: ERPPayment[];
  bankTransactions: ERPBankTransaction[];
  taxes: ERPTax[];
}

export function emptySyncRecords(): ERPSyncRecords {
  return {
    customers: [], vendors: [], invoices: [], inventory: [],
    ledgers: [], payments: [], bankTransactions: [], taxes: [],
  };
}

/**
 * Sync a specific entity type. Returns Firestore-ready records stamped with
 * organizationId + connectionId + provider. The caller persists them.
 */
export async function syncEntity(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  jobType: Exclude<ERPSyncJobType, 'full'>,
  options?: ERPSyncOptions,
): Promise<unknown[]> {
  assertOrg(organizationId);
  if (!connectionId) throw new ValidationError('connectionId is required.');
  const session = requireSession(encryptedConnection);
  const provider = getERPProvider(session.provider);

  try {
    switch (jobType) {
      case 'customers': {
        const r = await provider.syncCustomers(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'vendors': {
        const r = await provider.syncVendors(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'invoices': {
        const r = await provider.syncInvoices(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'sales': {
        const r = await provider.syncSales(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'purchases': {
        const r = await provider.syncPurchases(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'expenses': {
        const r = await provider.syncExpenses(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'inventory': {
        const r = await provider.syncInventory(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'ledgers': {
        const r = await provider.syncLedgers(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'payments': {
        const r = await provider.syncPayments(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'bank_transactions': {
        const r = await provider.syncBankTransactions(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      case 'taxes': {
        const r = await provider.syncTaxes(session, options);
        return r.records.map((x) => stamp(x, organizationId, connectionId, session.provider));
      }
      default: {
        const _exhaustive: never = jobType;
        void _exhaustive;
        throw new ValidationError(`Unknown sync job type: ${jobType}`);
      }
    }
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Full sync — all entity types in one call. Returns records grouped by type +
 * an aggregate result. Used by: Manual "Sync Now", background sync, full sync,
 * retry-failed, resume-interrupted.
 *
 * The caller persists the returned records to Firestore.
 */
export async function fullERPSync(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  options?: ERPSyncOptions,
): Promise<{ records: ERPSyncRecords; result: ERPSyncResult }> {
  assertOrg(organizationId);
  const errors: string[] = [];
  const records = emptySyncRecords();
  let total = 0;

  const entityTypes: Array<Exclude<ERPSyncJobType, 'full'>> = [
    'customers', 'vendors', 'invoices', 'inventory', 'ledgers',
    'payments', 'bank_transactions', 'taxes',
  ];

  for (const et of entityTypes) {
    try {
      const r = await syncEntity(organizationId, connectionId, encryptedConnection, et, options);
      switch (et) {
        case 'customers': records.customers = r as ERPCustomer[]; break;
        case 'vendors': records.vendors = r as ERPVendor[]; break;
        case 'invoices': records.invoices = r as ERPInvoice[]; break;
        case 'inventory': records.inventory = r as ERPInventoryItem[]; break;
        case 'ledgers': records.ledgers = r as ERPLedger[]; break;
        case 'payments': records.payments = r as ERPPayment[]; break;
        case 'bank_transactions': records.bankTransactions = r as ERPBankTransaction[]; break;
        case 'taxes': records.taxes = r as ERPTax[]; break;
      }
      total += r.length;
    } catch (err) {
      // Don't abort the whole sync on one entity failure — record and continue.
      errors.push(`${et}: ${friendlyERPError(err)}`);
    }
  }
  return {
    records,
    result: {
      success: errors.length === 0,
      jobType: 'full',
      recordsSynced: total,
      errors,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireSession(encryptedConnection: string): ERPSession {
  if (!encryptedConnection) throw new TokenExpiredError();
  try {
    return decryptConnection<ERPSession>(encryptedConnection);
  } catch {
    throw new TokenExpiredError();
  }
}

function parseProviderFromRef(connectionRef: string): ERPProviderName {
  if (connectionRef.startsWith('mock-tally') || connectionRef.startsWith('tally')) return 'tally';
  if (connectionRef.startsWith('mock-zoho') || connectionRef.startsWith('zoho')) return 'zoho_books';
  if (connectionRef.startsWith('mock-busy') || connectionRef.startsWith('busy')) return 'busy';
  if (connectionRef.startsWith('mock-qbo') || connectionRef.startsWith('qbo') || connectionRef.startsWith('quickbooks')) return 'quickbooks';
  // Default — shouldn't happen.
  return 'tally';
}

/**
 * Stamp an ERP record with organizationId + connectionId + provider.
 * Overwrites any existing stamps (provider records don't carry tenant scope).
 */
function stamp<T extends { organizationId?: string; connectionId?: string; provider?: string }>(
  record: T,
  organizationId: string,
  connectionId: string,
  provider: ERPProviderName,
): T {
  return {
    ...record,
    organizationId,
    connectionId,
    provider,
  };
}

/**
 * Wrap an unknown error in a typed ERPError if it isn't already one.
 */
function rethrowTyped(err: unknown): never {
  if (err instanceof ERPError) throw err;
  if (err instanceof Error) {
    throw new ERPError(err.message, {
      code: 'PROVIDER_ERROR',
      statusCode: 502,
      retryable: true,
      cause: err,
    });
  }
  throw new ERPError('An unknown error occurred while contacting the ERP.', {
    code: 'UNKNOWN',
    statusCode: 500,
  });
}

// ─── Provider diagnostics ────────────────────────────────────────────────────

export async function providerHealthCheck(provider: ERPProviderName): Promise<{
  healthy: boolean;
  name: string;
  provider: ERPProviderName;
  isLive: boolean;
}> {
  const p = getERPProvider(provider);
  try {
    const healthy = await p.healthCheck();
    return { healthy, name: p.name, provider: p.provider, isLive: p.isLive };
  } catch {
    return { healthy: false, name: p.name, provider: p.provider, isLive: p.isLive };
  }
}

// ─── Type re-exports ─────────────────────────────────────────────────────────

export type {
  ERPCustomer,
  ERPVendor,
  ERPInvoice,
  ERPInventoryItem,
  ERPLedger,
  ERPPayment,
  ERPBankTransaction,
  ERPTax,
  ERPSyncJobType,
};
