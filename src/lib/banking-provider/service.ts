// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Banking Foundation™ — Client-Safe Firestore Service
//
// The single entry point for all banking Firestore operations on the CLIENT side.
// Mirrors the gstn-provider service pattern:
//   • Real-time subscriptions via onSnapshot (org-scoped)
//   • CRUD writes via the Firebase client SDK (rules enforce org isolation)
//   • Multi-tenant — every function filters on `organizationId`
//
// This module is CLIENT-SAFE — it only imports from `firebase/firestore` and
// `@/lib/firebase` (the client SDK). It NEVER imports the provider, crypto, or
// any server-only code.
//
// The flow for each banking operation:
//   1. Client hook calls the appropriate API route (/api/banking/*) for the
//      provider work (connect, sync, etc.). The API route returns plain data +
//      the encrypted connection.
//   2. Client hook calls the appropriate function HERE to persist the result
//      to Firestore.
//   3. Real-time onSnapshot subscriptions surface the change to every
//      connected client instantly.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  BankAccountSnapshot,
  BankConnection,
  BankSyncJob,
  BankSyncStatus,
  BankSyncTrigger,
  BankSyncType,
  BankTransaction,
  BankingSummary,
  TransactionCategory,
} from './types';

// ─── Collection names ────────────────────────────────────────────────────────

export const BANK_COLLECTIONS = {
  CONNECTIONS: 'bank_connections',
  TRANSACTIONS: 'bank_transactions',
  SYNC_JOBS: 'bank_sync_jobs',
} as const;

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new Error('You must belong to an organization to manage banking data.');
  }
}

// ─── Timestamp conversion ────────────────────────────────────────────────────

function ts(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return '';
}

function snapshotFromRaw(raw: unknown): BankAccountSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  return {
    availableBalance: Number(s.availableBalance ?? 0),
    currentBalance: Number(s.currentBalance ?? 0),
    currency: String(s.currency ?? 'INR'),
    asOf: ts(s.asOf),
    overdraftLimit: Number(s.overdraftLimit ?? 0),
  };
}

// ─── Connection ──────────────────────────────────────────────────────────────

export function toConnection(id: string, raw: Record<string, unknown>): BankConnection {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    provider: (raw.provider as BankConnection['provider']) ?? 'mock',
    accountHolder: String(raw.accountHolder ?? ''),
    bankName: String(raw.bankName ?? ''),
    accountNumberMasked: String(raw.accountNumberMasked ?? ''),
    ifsc: String(raw.ifsc ?? ''),
    accountType: (raw.accountType as BankConnection['accountType']) ?? 'unknown',
    status: (raw.status as BankConnection['status']) ?? 'disconnected',
    lastSync: raw.lastSync ? ts(raw.lastSync) : null,
    consentExpiry: raw.consentExpiry ? ts(raw.consentExpiry) : null,
    encryptedConnection: (raw.encryptedConnection as string | null) ?? null,
    lastSnapshot: snapshotFromRaw(raw.lastSnapshot),
    lastError: (raw.lastError as string | null) ?? null,
    createdBy: raw.createdBy as BankConnection['createdBy'],
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

/**
 * Subscribe to ALL of the current org's bank connections in real time.
 * Returns the list of connections (empty if none).
 */
export function subscribeToConnections(
  organizationId: string,
  callback: (connections: BankConnection[]) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, BANK_COLLECTIONS.CONNECTIONS),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => toConnection(d.id, d.data() as Record<string, unknown>)));
    },
    (err) => options?.onError?.(err as Error),
  );
}

/**
 * Subscribe to a SINGLE bank connection by id (real-time).
 */
export function subscribeToConnection(
  organizationId: string,
  connectionId: string,
  callback: (connection: BankConnection | null) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, BANK_COLLECTIONS.CONNECTIONS),
    where('organizationId', '==', organizationId),
    where('__name__', '==', connectionId),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const d = snap.docs[0];
      callback(toConnection(d.id, d.data() as Record<string, unknown>));
    },
    (err) => options?.onError?.(err as Error),
  );
}

/**
 * Get the current org's bank connections (one-shot read).
 */
export async function getConnections(organizationId: string): Promise<BankConnection[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, BANK_COLLECTIONS.CONNECTIONS),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toConnection(d.id, d.data() as Record<string, unknown>));
}

/**
 * Create a new bank connection doc.
 * Called by the client after the connect flow succeeds.
 */
export async function saveConnection(
  organizationId: string,
  data: Omit<BankConnection, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, BANK_COLLECTIONS.CONNECTIONS), {
    ...data,
    organizationId, // enforce tenant scope
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Update an existing connection doc.
 */
export async function updateConnection(
  organizationId: string,
  connectionId: string,
  patch: Partial<BankConnection>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, BANK_COLLECTIONS.CONNECTIONS, connectionId);
  const { id: _id, organizationId: _orgId, createdAt: _ca, ...rest } = patch as Record<string, unknown>;
  void _id; void _orgId; void _ca;
  await updateDoc(ref, {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a connection doc (and all related data — the caller is responsible
 * for also deleting transactions + sync_jobs).
 */
export async function deleteConnection(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  await deleteDoc(doc(db, BANK_COLLECTIONS.CONNECTIONS, connectionId));
}

// ─── Transactions ────────────────────────────────────────────────────────────

export function toTransaction(id: string, raw: Record<string, unknown>): BankTransaction {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    accountId: String(raw.accountId ?? ''),
    date: ts(raw.date),
    description: String(raw.description ?? ''),
    amount: Number(raw.amount ?? 0),
    type: (raw.type as BankTransaction['type']) ?? 'debit',
    balance: raw.balance !== null && raw.balance !== undefined ? Number(raw.balance) : null,
    category: (raw.category as BankTransaction['category']) ?? 'other',
    counterparty: (raw.counterparty as string | null) ?? null,
    referenceNumber: (raw.referenceNumber as string | null) ?? null,
    invoiceId: (raw.invoiceId as string | null) ?? null,
    reconciled: (raw.reconciled as BankTransaction['reconciled']) ?? 'unmatched',
    matchConfidence: Number(raw.matchConfidence ?? 0),
    syncedAt: ts(raw.syncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

/**
 * Subscribe to ALL bank transactions for the org, newest date first.
 */
export function subscribeToTransactions(
  organizationId: string,
  callback: (transactions: BankTransaction[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('date', 'desc'),
  ];
  if (options?.connectionId) {
    constraints.push(where('connectionId', '==', options.connectionId));
  }
  if (options?.limitCount) constraints.push(limit(options.limitCount));
  const q = query(collection(db, BANK_COLLECTIONS.TRANSACTIONS), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => toTransaction(d.id, d.data() as Record<string, unknown>)));
    },
    (err) => options?.onError?.(err as Error),
  );
}

/**
 * Save a batch of transactions. Uses setDoc with a deterministic id so
 * re-syncing overwrites the same doc instead of creating duplicates.
 */
export async function saveTransactions(
  organizationId: string,
  transactions: BankTransaction[],
): Promise<void> {
  assertOrg(organizationId);
  if (transactions.length === 0) return;
  const batch = writeBatch(db);
  for (const t of transactions) {
    const { id: _id, ...data } = t;
    void _id;
    const ref = doc(db, BANK_COLLECTIONS.TRANSACTIONS, t.id);
    batch.set(ref, {
      ...data,
      organizationId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

/**
 * Update a single transaction (e.g. to set a manual category or invoice match).
 */
export async function updateTransaction(
  organizationId: string,
  transactionId: string,
  patch: Partial<BankTransaction>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, BANK_COLLECTIONS.TRANSACTIONS, transactionId);
  const { id: _id, organizationId: _orgId, createdAt: _ca, ...rest } = patch as Record<string, unknown>;
  void _id; void _orgId; void _ca;
  await updateDoc(ref, {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete all transactions for a connection (used on disconnect).
 */
export async function deleteTransactionsForConnection(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  const q = query(
    collection(db, BANK_COLLECTIONS.TRANSACTIONS),
    where('organizationId', '==', organizationId),
    where('connectionId', '==', connectionId),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/**
 * Get transactions for a date range (one-shot read).
 */
export async function getTransactionsForPeriod(
  organizationId: string,
  from: string,
  to: string,
): Promise<BankTransaction[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, BANK_COLLECTIONS.TRANSACTIONS),
    where('organizationId', '==', organizationId),
    where('date', '>=', from),
    where('date', '<=', to),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toTransaction(d.id, d.data() as Record<string, unknown>));
}

// ─── Sync Jobs ───────────────────────────────────────────────────────────────

export function toSyncJob(id: string, raw: Record<string, unknown>): BankSyncJob {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    type: (raw.type as BankSyncType) ?? 'full',
    trigger: (raw.trigger as BankSyncTrigger) ?? 'manual',
    status: (raw.status as BankSyncStatus) ?? 'pending',
    startedAt: raw.startedAt ? ts(raw.startedAt) : null,
    completedAt: raw.completedAt ? ts(raw.completedAt) : null,
    retryCount: Number(raw.retryCount ?? 0),
    maxRetries: Number(raw.maxRetries ?? 3),
    error: (raw.error as string | null) ?? null,
    result: (raw.result as BankSyncJob['result']) ?? null,
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToSyncJobs(
  organizationId: string,
  callback: (jobs: BankSyncJob[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (options?.limitCount) constraints.push(limit(options.limitCount));
  const q = query(collection(db, BANK_COLLECTIONS.SYNC_JOBS), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => toSyncJob(d.id, d.data() as Record<string, unknown>)));
    },
    (err) => options?.onError?.(err as Error),
  );
}

export async function createSyncJob(
  organizationId: string,
  data: Pick<BankSyncJob, 'connectionId' | 'type' | 'trigger' | 'maxRetries'>,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, BANK_COLLECTIONS.SYNC_JOBS), {
    organizationId,
    connectionId: data.connectionId,
    type: data.type,
    trigger: data.trigger,
    status: 'pending' as const,
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    maxRetries: data.maxRetries ?? 3,
    error: null,
    result: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSyncJob(
  organizationId: string,
  jobId: string,
  patch: Partial<BankSyncJob>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, BANK_COLLECTIONS.SYNC_JOBS, jobId);
  const { id: _id, organizationId: _orgId, createdAt: _ca, ...rest } = patch as Record<string, unknown>;
  void _id; void _orgId; void _ca;
  await updateDoc(ref, {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

// ─── Disconnect cascade (delete all banking data for a connection) ───────────

/**
 * Delete ALL banking data for a connection — used during disconnect.
 * Order matters: delete child collections first, then the connection doc.
 */
export async function cascadeDisconnect(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  await deleteTransactionsForConnection(organizationId, connectionId);
  // Delete sync jobs for this connection.
  const jobsQ = query(
    collection(db, BANK_COLLECTIONS.SYNC_JOBS),
    where('organizationId', '==', organizationId),
    where('connectionId', '==', connectionId),
  );
  const jobsSnap = await getDocs(jobsQ);
  const batch = writeBatch(db);
  jobsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  // Finally delete the connection doc.
  await deleteConnection(organizationId, connectionId);
}

// ─── Banking summary (computed from transactions + connections) ──────────────

const EMPTY_CATEGORY_MAP: Record<TransactionCategory, number> = {
  sales: 0,
  purchase: 0,
  gst: 0,
  salary: 0,
  rent: 0,
  utilities: 0,
  loan: 0,
  interest: 0,
  transfer: 0,
  investment: 0,
  cash_withdrawal: 0,
  other: 0,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute the BankingSummary from a list of connections + transactions.
 * Pure + deterministic — used by the useBanking hook (memoized) and by the
 * dashboard.
 */
export function computeBankingSummary(
  connections: BankConnection[],
  transactions: BankTransaction[],
): BankingSummary {
  const connectedAccounts = connections.length;
  let totalBalance = 0;
  let availableBalance = 0;
  for (const c of connections) {
    if (c.lastSnapshot) {
      totalBalance += c.lastSnapshot.currentBalance;
      availableBalance += c.lastSnapshot.availableBalance;
    }
  }

  let incomingPayments = 0;
  let outgoingPayments = 0;
  let incomingCount = 0;
  let outgoingCount = 0;
  let pendingReconciliation = 0;
  let matchedCount = 0;
  let partiallyMatchedCount = 0;
  const inflowByCategory = { ...EMPTY_CATEGORY_MAP };
  const outflowByCategory = { ...EMPTY_CATEGORY_MAP };

  for (const tx of transactions) {
    if (tx.type === 'credit') {
      incomingPayments += tx.amount;
      incomingCount++;
      inflowByCategory[tx.category] = round2(inflowByCategory[tx.category] + tx.amount);
    } else {
      outgoingPayments += tx.amount;
      outgoingCount++;
      outflowByCategory[tx.category] = round2(outflowByCategory[tx.category] + tx.amount);
    }
    if (tx.reconciled === 'matched') matchedCount++;
    else if (tx.reconciled === 'partially_matched') partiallyMatchedCount++;
    else pendingReconciliation++;
  }

  return {
    totalBalance: round2(totalBalance),
    availableBalance: round2(availableBalance),
    connectedAccounts,
    incomingPayments: round2(incomingPayments),
    outgoingPayments: round2(outgoingPayments),
    incomingCount,
    outgoingCount,
    pendingReconciliation,
    matchedCount,
    partiallyMatchedCount,
    inflowByCategory,
    outflowByCategory,
    recentTransactions: transactions.slice(0, 10),
  };
}

// ─── One-shot reads (for non-reactive contexts) ──────────────────────────────

export async function getConnection(
  organizationId: string,
  connectionId: string,
): Promise<BankConnection | null> {
  assertOrg(organizationId);
  const ref = doc(db, BANK_COLLECTIONS.CONNECTIONS, connectionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toConnection(snap.id, snap.data() as Record<string, unknown>);
}
