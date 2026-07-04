// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Server Orchestrator (SERVER-ONLY)
//
// The thin server-side layer that:
//   1. Resolves the active provider via the registry
//   2. Encrypts / decrypts connections with AES-256-GCM (server-only key)
//   3. Calls the provider and returns fully-formed Firestore-ready objects
//   4. Runs the categorization + reconciliation engines on fetched transactions
//
// This file is SERVER-ONLY — it imports `node:crypto` (via the provider + crypto
// modules) and must NEVER be bundled into client code. API routes are the only
// legitimate consumers.
//
// Multi-tenant: every function takes `organizationId` and stamps it onto every
// returned object so the client can write directly to Firestore without
// additional processing.
// ═══════════════════════════════════════════════════════════════════════════════

import { getBankProvider } from './registry';
import { decryptConnection, encryptConnection } from './crypto';
import type { BankSession } from '../provider';
import type {
  BankAccountSnapshot,
  BankConnection,
  BankProviderName,
  BankTransaction,
  CompleteConnectionResult,
  ConnectBankInput,
  ConnectBankResult,
  FetchAccountsResult,
  FetchTransactionsResult,
  RefreshConnectionResult,
} from '../types';
import { categorizeTransaction, extractCounterparty, extractReferenceNumber } from '@/lib/banking/categorize';
import { BankingError, ConnectionExpiredError, friendlyBankingError } from '../errors';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new BankingError(
      'You must belong to an organization to manage bank connections.',
      { code: 'NO_ORGANIZATION', statusCode: 403 },
    );
  }
}

function assertAccountNumber(accountNumber: string | undefined | null): void {
  if (!accountNumber || accountNumber.replace(/\s+/g, '').length < 4) {
    throw new BankingError('A valid account number is required.', {
      code: 'INVALID_ACCOUNT_NUMBER',
      statusCode: 400,
    });
  }
}

// ─── Connection lifecycle ────────────────────────────────────────────────────

/**
 * Step 1 of the connect flow — initiate a bank connection via the provider.
 * Does NOT touch Firestore. The client writes the connection doc with
 * status='consent_pending' after this succeeds.
 */
export async function connectBank(input: ConnectBankInput): Promise<ConnectBankResult> {
  assertOrg(input.organizationId);
  assertAccountNumber(input.accountNumber);
  if (!input.ifsc) {
    throw new BankingError('IFSC code is required.', {
      code: 'INVALID_IFSC',
      statusCode: 400,
    });
  }
  const provider = getBankProvider();
  try {
    return await provider.connect({
      accountHolder: input.accountHolder,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      ifsc: input.ifsc,
      accountType: input.accountType,
      consentHandle: input.consentHandle,
    });
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Step 2 of the connect flow — complete the connection (post-consent).
 * Returns the ENCRYPTED connection (safe to store in Firestore) + initial snapshot.
 * The client writes both to Firestore after this succeeds.
 */
export async function completeBankConnection(
  organizationId: string,
  connectionRef: string,
): Promise<CompleteConnectionResult> {
  assertOrg(organizationId);
  if (!connectionRef) {
    throw new BankingError('connectionRef is required.', {
      code: 'INVALID_CONNECTION_REF',
      statusCode: 400,
    });
  }
  const provider = getBankProvider();
  try {
    const { session, snapshot } = await provider.completeConnection(connectionRef);
    const encryptedConnection = encryptConnection(session);
    return {
      encryptedConnection,
      consentExpiry: session.expiresAt,
      accountSnapshot: snapshot,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Refresh an existing connection using the refresh token.
 * The client passes the encrypted connection blob; we decrypt, refresh, re-encrypt.
 */
export async function refreshBankConnection(
  encryptedConnection: string,
): Promise<RefreshConnectionResult> {
  if (!encryptedConnection) {
    throw new ConnectionExpiredError();
  }
  let session: BankSession;
  try {
    session = decryptConnection<BankSession>(encryptedConnection);
  } catch {
    throw new ConnectionExpiredError();
  }
  const provider = getBankProvider();
  try {
    const { session: newSession } = await provider.refreshConnection(session);
    return {
      encryptedConnection: encryptConnection(newSession),
      consentExpiry: newSession.expiresAt,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Disconnect — invalidate the connection server-side.
 * Idempotent: does not throw if the connection is already invalid.
 */
export async function disconnectBank(encryptedConnection: string | null): Promise<void> {
  if (!encryptedConnection) return;
  let session: BankSession;
  try {
    session = decryptConnection<BankSession>(encryptedConnection);
  } catch {
    // Already invalid / corrupt — nothing to terminate.
    return;
  }
  const provider = getBankProvider();
  try {
    await provider.disconnect(session);
  } catch (err) {
    // Don't throw on disconnect — the user is disconnecting anyway.
    console.warn('[banking-provider] disconnect failed (non-fatal):', friendlyBankingError(err));
  }
}

// ─── Data fetch (sync) operations ────────────────────────────────────────────

/**
 * Fetch the current account balances. Returns a Firestore-ready snapshot.
 */
export async function syncBalances(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
): Promise<BankAccountSnapshot> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new BankingError('connectionId is required.', {
      code: 'INVALID_CONNECTION',
      statusCode: 400,
    });
  }
  const session = requireSession(encryptedConnection);
  const provider = getBankProvider();
  try {
    const { snapshot } = await provider.fetchAccounts(session);
    return snapshot;
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Sync bank transactions for a date range. Runs each fetched transaction
 * through the categorization + reconciliation engines before returning.
 *
 * The `invoices` param is OPTIONAL — if provided, the reconciliation engine
 * will match transactions against invoices. If omitted, transactions are
 * returned with reconciled='unmatched'.
 */
export async function syncTransactions(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  options?: {
    from?: string;
    to?: string;
    invoices?: Array<{
      id: string;
      invoiceNumber: string;
      clientName: string;
      grandTotal: number;
      balanceDue: number;
      invoiceType: 'sales' | 'purchase';
    }>;
  },
): Promise<BankTransaction[]> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new BankingError('connectionId is required.', {
      code: 'INVALID_CONNECTION',
      statusCode: 400,
    });
  }
  const session = requireSession(encryptedConnection);
  const provider = getBankProvider();
  try {
    const { transactions } = await provider.fetchTransactions(session, {
      from: options?.from,
      to: options?.to,
    });

    // Stamp tenant scope + connection id + account id.
    const stamped = transactions.map((tx) => ({
      ...tx,
      organizationId,
      connectionId,
      accountId: session.accountNumberMasked,
    }));

    // Categorize + extract counterparty / reference (idempotent — overwrites).
    for (const tx of stamped) {
      if (!tx.counterparty) {
        tx.counterparty = extractCounterparty(tx.description);
      }
      if (!tx.referenceNumber) {
        tx.referenceNumber = extractReferenceNumber(tx.description);
      }
      tx.category = categorizeTransaction({
        description: tx.description,
        type: tx.type,
        amount: tx.amount,
        counterparty: tx.counterparty,
      });
    }

    // Reconcile against invoices (if provided).
    if (options?.invoices && options.invoices.length > 0) {
      const { reconcileTransactions } = await import('@/lib/banking/reconcile');
      return reconcileTransactions(stamped, options.invoices);
    }

    return stamped;
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Sync accounts (balances) — alias for syncBalances that returns the
 * FetchAccountsResult shape for API compatibility.
 */
export async function syncAccounts(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
): Promise<FetchAccountsResult> {
  const snapshot = await syncBalances(organizationId, connectionId, encryptedConnection);
  return { snapshot };
}

/**
 * Full sync — balances + transactions. Returns everything in one shot so the
 * client can write atomically.
 *
 * Used by:
 *   - Manual "Sync Now" button
 *   - Automatic scheduler
 *   - Background sync
 *   - Retry-failed logic
 *   - Incremental sync (with `from` = lastSync)
 */
export async function fullBankSync(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  options?: {
    from?: string;
    to?: string;
    invoices?: Array<{
      id: string;
      invoiceNumber: string;
      clientName: string;
      grandTotal: number;
      balanceDue: number;
      invoiceType: 'sales' | 'purchase';
    }>;
  },
): Promise<{
  snapshot: BankAccountSnapshot;
  transactions: BankTransaction[];
}> {
  const snapshot = await syncBalances(organizationId, connectionId, encryptedConnection);
  const transactions = await syncTransactions(
    organizationId,
    connectionId,
    encryptedConnection,
    options,
  );
  return { snapshot, transactions };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireSession(encryptedConnection: string): BankSession {
  if (!encryptedConnection) {
    throw new ConnectionExpiredError();
  }
  try {
    return decryptConnection<BankSession>(encryptedConnection);
  } catch {
    throw new ConnectionExpiredError();
  }
}

/**
 * Wrap an unknown error in a typed BankingError if it isn't already one.
 * Preserves the original message + code.
 */
function rethrowTyped(err: unknown): never {
  if (err instanceof BankingError) throw err;
  if (err instanceof Error) {
    throw new BankingError(err.message, {
      code: 'PROVIDER_ERROR',
      statusCode: 502,
      retryable: true,
      cause: err,
    });
  }
  throw new BankingError('An unknown error occurred while contacting the bank.', {
    code: 'UNKNOWN',
    statusCode: 500,
  });
}

// ─── Provider diagnostics ────────────────────────────────────────────────────

export async function providerHealthCheck(): Promise<{
  healthy: boolean;
  name: string;
  provider: BankProviderName;
  isLive: boolean;
}> {
  const provider = getBankProvider();
  try {
    const healthy = await provider.healthCheck();
    return { healthy, name: provider.name, provider: provider.provider, isLive: provider.isLive };
  } catch {
    return { healthy: false, name: provider.name, provider: provider.provider, isLive: provider.isLive };
  }
}

// ─── Type re-exports for convenience ─────────────────────────────────────────

export type { BankConnection, BankProviderName };
