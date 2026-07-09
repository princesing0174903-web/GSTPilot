// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Client-Safe Firestore Service
//
// The single entry point for all ERP Firestore operations on the CLIENT side.
// Mirrors the banking-provider + communication-provider service pattern:
//   • Real-time subscriptions via onSnapshot (org-scoped)
//   • CRUD writes via the Firebase client SDK (rules enforce org isolation)
//   • Multi-tenant — every function filters on `organizationId`
//
// This module is CLIENT-SAFE — it only imports from `firebase/firestore` and
// `@/lib/firebase` (the client SDK). It NEVER imports the provider, crypto, or
// any server-only code.
//
// The flow for each ERP operation:
//   1. Client hook calls the appropriate API route (/api/erp/*) for the
//      provider work (connect, sync, etc.). The API route returns plain data +
//      the encrypted connection.
//   2. Client hook calls the appropriate function HERE to persist the result
//      to Firestore.
//   3. Real-time onSnapshot subscriptions surface the change to every
//      connected client instantly.
//
// Firestore timeout guard: when the Firebase project has the Firestore API
// disabled, the SDK retries PERMISSION_DENIED for ~120s before rejecting.
// `withTimeout` races every op against a 6s deadline so the UI never hangs.
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
  ERPBankTransaction,
  ERPConnection,
  ERPCustomer,
  ERPInventoryItem,
  ERPInvoice,
  ERPLedger,
  ERPPayment,
  ERPProviderName,
  ERPSyncJob,
  ERPSyncJobType,
  ERPSyncStatus,
  ERPSyncSummary,
  ERPSyncTrigger,
  ERPSummary,
  ERPTax,
  ERPVendor,
} from './types';
import { ERPError } from './errors';

// ─── Collection names ────────────────────────────────────────────────────────

export const ERP_COLLECTIONS = {
  CONNECTIONS: 'erp_connections',
  SYNC_JOBS: 'erp_sync_jobs',
  CUSTOMERS: 'erp_customers',
  VENDORS: 'erp_vendors',
  INVOICES: 'erp_invoices',
  INVENTORY: 'erp_inventory',
  LEDGERS: 'erp_ledgers',
  PAYMENTS: 'erp_payments',
  BANK_TRANSACTIONS: 'erp_bank_transactions',
  TAXES: 'erp_taxes',
} as const;

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new Error('You must belong to an organization to manage ERP data.');
  }
}

// ─── Firestore timeout guard ─────────────────────────────────────────────────

const FIRESTORE_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  promise.catch(() => { /* timed-out op — ignore late rejection */ });
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new ERPError(
              `${label} timed out — Firestore may be unreachable.`,
              { code: 'FIRESTORE_TIMEOUT', statusCode: 503, retryable: true },
            ),
          ),
        FIRESTORE_TIMEOUT_MS,
      ),
    ),
  ]);
}

const safeAddDoc = <T>(ref: ReturnType<typeof collection>, data: T) =>
  withTimeout(addDoc(ref, data as Record<string, unknown>), 'ERP addDoc');
const safeSetDoc = (ref: ReturnType<typeof doc>, data: unknown, opts?: { merge?: boolean }) =>
  withTimeout(setDoc(ref, data as Record<string, unknown>, opts), 'ERP setDoc');
const safeUpdateDoc = (ref: ReturnType<typeof doc>, data: unknown) =>
  withTimeout(updateDoc(ref, data as Record<string, unknown>), 'ERP updateDoc');
const safeDeleteDoc = (ref: ReturnType<typeof doc>) =>
  withTimeout(deleteDoc(ref), 'ERP deleteDoc');
const safeGetDoc = (ref: ReturnType<typeof doc>) =>
  withTimeout(getDoc(ref), 'ERP getDoc');
const safeGetDocs = (q: ReturnType<typeof query>) =>
  withTimeout(getDocs(q), 'ERP getDocs');
const safeCommit = (batch: ReturnType<typeof writeBatch>) =>
  withTimeout(batch.commit(), 'ERP writeBatch.commit');

// ─── Timestamp conversion ────────────────────────────────────────────────────

function ts(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return '';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Connection ──────────────────────────────────────────────────────────────

export function toConnection(id: string, raw: Record<string, unknown>): ERPConnection {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    companyName: String(raw.companyName ?? ''),
    companyId: String(raw.companyId ?? ''),
    companyGstin: (raw.companyGstin as string | null) ?? null,
    connectionStatus: (raw.connectionStatus as ERPConnection['connectionStatus']) ?? 'disconnected',
    lastSync: raw.lastSync ? ts(raw.lastSync) : null,
    syncProgress: Number(raw.syncProgress ?? 0),
    encryptedConnection: (raw.encryptedConnection as string | null) ?? null,
    tokenExpiry: raw.tokenExpiry ? ts(raw.tokenExpiry) : null,
    lastError: (raw.lastError as string | null) ?? null,
    lastSyncSummary: (raw.lastSyncSummary as ERPSyncSummary | null) ?? null,
    createdBy: raw.createdBy as ERPConnection['createdBy'],
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToConnections(
  organizationId: string,
  callback: (connections: ERPConnection[]) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.CONNECTIONS),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => toConnection(d.id, d.data() as Record<string, unknown>))),
    (err) => options?.onError?.(err as Error),
  );
}

export async function getConnections(organizationId: string): Promise<ERPConnection[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.CONNECTIONS),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  return snap.docs.map((d) => toConnection(d.id, d.data() as Record<string, unknown>));
}

export async function getConnection(
  organizationId: string,
  connectionId: string,
): Promise<ERPConnection | null> {
  assertOrg(organizationId);
  const ref = doc(db, ERP_COLLECTIONS.CONNECTIONS, connectionId);
  const snap = await safeGetDoc(ref).catch(() => null);
  if (!snap || !snap.exists()) return null;
  return toConnection(snap.id, snap.data() as Record<string, unknown>);
}

export async function saveConnection(
  organizationId: string,
  data: Omit<ERPConnection, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await safeAddDoc(collection(db, ERP_COLLECTIONS.CONNECTIONS), {
    ...data,
    organizationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateConnection(
  organizationId: string,
  connectionId: string,
  patch: Partial<ERPConnection>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, ERP_COLLECTIONS.CONNECTIONS, connectionId);
  const { id: _id, organizationId: _orgId, createdAt: _ca, ...rest } = patch as Record<string, unknown>;
  void _id; void _orgId; void _ca;
  await safeUpdateDoc(ref, { ...rest, updatedAt: serverTimestamp() });
}

export async function deleteConnection(organizationId: string, connectionId: string): Promise<void> {
  assertOrg(organizationId);
  await safeDeleteDoc(doc(db, ERP_COLLECTIONS.CONNECTIONS, connectionId));
}

// ─── Sync Jobs ───────────────────────────────────────────────────────────────

export function toSyncJob(id: string, raw: Record<string, unknown>): ERPSyncJob {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    jobType: (raw.jobType as ERPSyncJobType) ?? 'full',
    status: (raw.status as ERPSyncStatus) ?? 'pending',
    trigger: (raw.trigger as ERPSyncTrigger) ?? 'manual',
    startedAt: raw.startedAt ? ts(raw.startedAt) : null,
    completedAt: raw.completedAt ? ts(raw.completedAt) : null,
    recordsProcessed: Number(raw.recordsProcessed ?? 0),
    errors: (raw.errors as string[]) ?? [],
    retryCount: Number(raw.retryCount ?? 0),
    maxRetries: Number(raw.maxRetries ?? 3),
    syncCursor: (raw.syncCursor as string | null) ?? null,
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToSyncJobs(
  organizationId: string,
  callback: (jobs: ERPSyncJob[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (options?.limitCount) constraints.push(limit(options.limitCount));
  const q = query(collection(db, ERP_COLLECTIONS.SYNC_JOBS), ...constraints);
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => toSyncJob(d.id, d.data() as Record<string, unknown>))),
    (err) => options?.onError?.(err as Error),
  );
}

export async function createSyncJob(
  organizationId: string,
  data: {
    connectionId: string;
    provider: ERPProviderName;
    jobType: ERPSyncJobType;
    trigger: ERPSyncTrigger;
    maxRetries?: number;
    syncCursor?: string | null;
  },
): Promise<string> {
  assertOrg(organizationId);
  const ref = await safeAddDoc(collection(db, ERP_COLLECTIONS.SYNC_JOBS), {
    organizationId,
    connectionId: data.connectionId,
    provider: data.provider,
    jobType: data.jobType,
    trigger: data.trigger,
    status: 'pending' as const,
    startedAt: null,
    completedAt: null,
    recordsProcessed: 0,
    errors: [],
    retryCount: 0,
    maxRetries: data.maxRetries ?? 3,
    syncCursor: data.syncCursor ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSyncJob(
  organizationId: string,
  jobId: string,
  patch: Partial<ERPSyncJob>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, ERP_COLLECTIONS.SYNC_JOBS, jobId);
  const { id: _id, organizationId: _orgId, createdAt: _ca, ...rest } = patch as Record<string, unknown>;
  void _id; void _orgId; void _ca;
  await safeUpdateDoc(ref, { ...rest, updatedAt: serverTimestamp() });
}

// ─── Generic entity subscription + save ──────────────────────────────────────

function subscribeToEntities<T>(
  organizationId: string,
  collName: string,
  converter: (id: string, raw: Record<string, unknown>) => T,
  callback: (records: T[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string; orderByField?: string; orderDir?: 'asc' | 'desc' },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [where('organizationId', '==', organizationId)];
  if (options?.connectionId) constraints.push(where('connectionId', '==', options.connectionId));
  if (options?.orderByField) {
    constraints.push(orderBy(options.orderByField, options.orderDir ?? 'desc'));
  }
  if (options?.limitCount) constraints.push(limit(options.limitCount));
  const q = query(collection(db, collName), ...constraints);
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => converter(d.id, d.data() as Record<string, unknown>))),
    (err) => options?.onError?.(err as Error),
  );
}

async function saveEntities<T extends { id: string }>(
  organizationId: string,
  collName: string,
  records: T[],
): Promise<void> {
  assertOrg(organizationId);
  if (records.length === 0) return;
  const batch = writeBatch(db);
  for (const r of records) {
    const { id: _id, ...data } = r;
    void _id;
    const ref = doc(db, collName, r.id);
    batch.set(ref, { ...data, organizationId, updatedAt: serverTimestamp() }, { merge: true });
  }
  await safeCommit(batch);
}

async function deleteEntitiesForConnection(
  organizationId: string,
  collName: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  const q = query(
    collection(db, collName),
    where('organizationId', '==', organizationId),
    where('connectionId', '==', connectionId),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ ref: import('firebase/firestore').DocumentReference }> }));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.docs.length > 0) await safeCommit(batch);
}

// ─── Customers ────────────────────────────────────────────────────────────────

export function toCustomer(id: string, raw: Record<string, unknown>): ERPCustomer {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    erpCustomerId: String(raw.erpCustomerId ?? ''),
    mappedClientId: (raw.mappedClientId as string | null) ?? null,
    name: String(raw.name ?? ''),
    gstin: (raw.gstin as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    city: (raw.city as string | null) ?? null,
    state: (raw.state as string | null) ?? null,
    stateCode: (raw.stateCode as string | null) ?? null,
    outstandingBalance: Number(raw.outstandingBalance ?? 0),
    totalSales: Number(raw.totalSales ?? 0),
    lastTransactionDate: raw.lastTransactionDate ? ts(raw.lastTransactionDate) : null,
    active: Boolean(raw.active ?? true),
    raw: (raw.raw as Record<string, unknown>) ?? {},
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToCustomers(
  organizationId: string,
  callback: (records: ERPCustomer[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string },
): Unsubscribe {
  return subscribeToEntities(organizationId, ERP_COLLECTIONS.CUSTOMERS, toCustomer, callback, {
    ...options,
    orderByField: 'lastSyncedAt',
  });
}

export async function getCustomers(organizationId: string): Promise<ERPCustomer[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.CUSTOMERS),
    where('organizationId', '==', organizationId),
    orderBy('lastSyncedAt', 'desc'),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  return snap.docs.map((d) => toCustomer(d.id, d.data() as Record<string, unknown>));
}

export async function saveCustomers(organizationId: string, records: ERPCustomer[]): Promise<void> {
  return saveEntities(organizationId, ERP_COLLECTIONS.CUSTOMERS, records);
}

// ─── Vendors ──────────────────────────────────────────────────────────────────

export function toVendor(id: string, raw: Record<string, unknown>): ERPVendor {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    erpVendorId: String(raw.erpVendorId ?? ''),
    name: String(raw.name ?? ''),
    gstin: (raw.gstin as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    city: (raw.city as string | null) ?? null,
    state: (raw.state as string | null) ?? null,
    stateCode: (raw.stateCode as string | null) ?? null,
    outstandingPayable: Number(raw.outstandingPayable ?? 0),
    totalPurchases: Number(raw.totalPurchases ?? 0),
    lastTransactionDate: raw.lastTransactionDate ? ts(raw.lastTransactionDate) : null,
    active: Boolean(raw.active ?? true),
    raw: (raw.raw as Record<string, unknown>) ?? {},
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToVendors(
  organizationId: string,
  callback: (records: ERPVendor[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string },
): Unsubscribe {
  return subscribeToEntities(organizationId, ERP_COLLECTIONS.VENDORS, toVendor, callback, {
    ...options,
    orderByField: 'lastSyncedAt',
  });
}

export async function getVendors(organizationId: string): Promise<ERPVendor[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.VENDORS),
    where('organizationId', '==', organizationId),
    orderBy('lastSyncedAt', 'desc'),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  return snap.docs.map((d) => toVendor(d.id, d.data() as Record<string, unknown>));
}

export async function saveVendors(organizationId: string, records: ERPVendor[]): Promise<void> {
  return saveEntities(organizationId, ERP_COLLECTIONS.VENDORS, records);
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export function toInvoice(id: string, raw: Record<string, unknown>): ERPInvoice {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    erpInvoiceNumber: String(raw.erpInvoiceNumber ?? ''),
    mappedInvoiceId: (raw.mappedInvoiceId as string | null) ?? null,
    invoiceType: (raw.invoiceType as ERPInvoice['invoiceType']) ?? 'sales',
    partyName: String(raw.partyName ?? ''),
    partyGstin: (raw.partyGstin as string | null) ?? null,
    invoiceDate: ts(raw.invoiceDate),
    dueDate: raw.dueDate ? ts(raw.dueDate) : null,
    subtotal: Number(raw.subtotal ?? 0),
    taxAmount: Number(raw.taxAmount ?? 0),
    grandTotal: Number(raw.grandTotal ?? 0),
    balanceDue: Number(raw.balanceDue ?? 0),
    status: (raw.status as ERPInvoice['status']) ?? 'unpaid',
    lineItems: (raw.lineItems as ERPInvoice['lineItems']) ?? [],
    raw: (raw.raw as Record<string, unknown>) ?? {},
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToInvoices(
  organizationId: string,
  callback: (records: ERPInvoice[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string },
): Unsubscribe {
  return subscribeToEntities(organizationId, ERP_COLLECTIONS.INVOICES, toInvoice, callback, {
    ...options,
    orderByField: 'invoiceDate',
  });
}

export async function getInvoices(organizationId: string): Promise<ERPInvoice[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.INVOICES),
    where('organizationId', '==', organizationId),
    orderBy('invoiceDate', 'desc'),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  return snap.docs.map((d) => toInvoice(d.id, d.data() as Record<string, unknown>));
}

export async function saveInvoices(organizationId: string, records: ERPInvoice[]): Promise<void> {
  return saveEntities(organizationId, ERP_COLLECTIONS.INVOICES, records);
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export function toInventoryItem(id: string, raw: Record<string, unknown>): ERPInventoryItem {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    erpItemId: String(raw.erpItemId ?? ''),
    itemCode: String(raw.itemCode ?? ''),
    name: String(raw.name ?? ''),
    hsn: (raw.hsn as string | null) ?? null,
    unit: (raw.unit as string | null) ?? null,
    quantity: Number(raw.quantity ?? 0),
    stockValue: Number(raw.stockValue ?? 0),
    salePrice: Number(raw.salePrice ?? 0),
    purchasePrice: Number(raw.purchasePrice ?? 0),
    reorderLevel: Number(raw.reorderLevel ?? 0),
    godown: (raw.godown as string | null) ?? null,
    stockStatus: (raw.stockStatus as ERPInventoryItem['stockStatus']) ?? 'in_stock',
    raw: (raw.raw as Record<string, unknown>) ?? {},
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToInventory(
  organizationId: string,
  callback: (records: ERPInventoryItem[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string },
): Unsubscribe {
  return subscribeToEntities(organizationId, ERP_COLLECTIONS.INVENTORY, toInventoryItem, callback, options);
}

export async function getInventory(organizationId: string): Promise<ERPInventoryItem[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.INVENTORY),
    where('organizationId', '==', organizationId),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  return snap.docs.map((d) => toInventoryItem(d.id, d.data() as Record<string, unknown>));
}

export async function saveInventory(organizationId: string, records: ERPInventoryItem[]): Promise<void> {
  return saveEntities(organizationId, ERP_COLLECTIONS.INVENTORY, records);
}

// ─── Ledgers ──────────────────────────────────────────────────────────────────

export function toLedger(id: string, raw: Record<string, unknown>): ERPLedger {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    erpLedgerId: String(raw.erpLedgerId ?? ''),
    name: String(raw.name ?? ''),
    ledgerType: (raw.ledgerType as ERPLedger['ledgerType']) ?? 'asset',
    gstin: (raw.gstin as string | null) ?? null,
    openingBalance: Number(raw.openingBalance ?? 0),
    closingBalance: Number(raw.closingBalance ?? 0),
    asOfDate: ts(raw.asOfDate),
    parentGroup: (raw.parentGroup as string | null) ?? null,
    raw: (raw.raw as Record<string, unknown>) ?? {},
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToLedgers(
  organizationId: string,
  callback: (records: ERPLedger[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string },
): Unsubscribe {
  return subscribeToEntities(organizationId, ERP_COLLECTIONS.LEDGERS, toLedger, callback, options);
}

export async function getLedgers(organizationId: string): Promise<ERPLedger[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.LEDGERS),
    where('organizationId', '==', organizationId),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  return snap.docs.map((d) => toLedger(d.id, d.data() as Record<string, unknown>));
}

export async function saveLedgers(organizationId: string, records: ERPLedger[]): Promise<void> {
  return saveEntities(organizationId, ERP_COLLECTIONS.LEDGERS, records);
}

// ─── Payments ──────────────────────────────────────────────────────────────────

export function toPayment(id: string, raw: Record<string, unknown>): ERPPayment {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    erpVoucherNumber: String(raw.erpVoucherNumber ?? ''),
    paymentType: (raw.paymentType as ERPPayment['paymentType']) ?? 'payment',
    date: ts(raw.date),
    amount: Number(raw.amount ?? 0),
    debitLedger: String(raw.debitLedger ?? ''),
    creditLedger: String(raw.creditLedger ?? ''),
    mode: (raw.mode as ERPPayment['mode']) ?? 'other',
    referenceNumber: (raw.referenceNumber as string | null) ?? null,
    narration: (raw.narration as string | null) ?? null,
    linkedInvoiceNumbers: (raw.linkedInvoiceNumbers as string[]) ?? [],
    raw: (raw.raw as Record<string, unknown>) ?? {},
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToPayments(
  organizationId: string,
  callback: (records: ERPPayment[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string },
): Unsubscribe {
  return subscribeToEntities(organizationId, ERP_COLLECTIONS.PAYMENTS, toPayment, callback, {
    ...options,
    orderByField: 'date',
  });
}

export async function getPayments(organizationId: string): Promise<ERPPayment[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.PAYMENTS),
    where('organizationId', '==', organizationId),
    orderBy('date', 'desc'),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  return snap.docs.map((d) => toPayment(d.id, d.data() as Record<string, unknown>));
}

export async function savePayments(organizationId: string, records: ERPPayment[]): Promise<void> {
  return saveEntities(organizationId, ERP_COLLECTIONS.PAYMENTS, records);
}

// ─── Bank Transactions ─────────────────────────────────────────────────────────

export function toBankTransaction(id: string, raw: Record<string, unknown>): ERPBankTransaction {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    date: ts(raw.date),
    bankLedger: String(raw.bankLedger ?? ''),
    description: String(raw.description ?? ''),
    amount: Number(raw.amount ?? 0),
    type: (raw.type as ERPBankTransaction['type']) ?? 'debit',
    balance: raw.balance !== null && raw.balance !== undefined ? Number(raw.balance) : null,
    referenceNumber: (raw.referenceNumber as string | null) ?? null,
    raw: (raw.raw as Record<string, unknown>) ?? {},
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToBankTransactions(
  organizationId: string,
  callback: (records: ERPBankTransaction[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string },
): Unsubscribe {
  return subscribeToEntities(organizationId, ERP_COLLECTIONS.BANK_TRANSACTIONS, toBankTransaction, callback, {
    ...options,
    orderByField: 'date',
  });
}

export async function getBankTransactions(organizationId: string): Promise<ERPBankTransaction[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.BANK_TRANSACTIONS),
    where('organizationId', '==', organizationId),
    orderBy('date', 'desc'),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  return snap.docs.map((d) => toBankTransaction(d.id, d.data() as Record<string, unknown>));
}

export async function saveBankTransactions(organizationId: string, records: ERPBankTransaction[]): Promise<void> {
  return saveEntities(organizationId, ERP_COLLECTIONS.BANK_TRANSACTIONS, records);
}

// ─── Taxes ─────────────────────────────────────────────────────────────────────

export function toTax(id: string, raw: Record<string, unknown>): ERPTax {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    provider: (raw.provider as ERPProviderName) ?? 'tally',
    taxHead: (raw.taxHead as ERPTax['taxHead']) ?? 'IGST',
    rate: Number(raw.rate ?? 0),
    direction: (raw.direction as ERPTax['direction']) ?? 'output',
    taxableValue: Number(raw.taxableValue ?? 0),
    taxAmount: Number(raw.taxAmount ?? 0),
    period: String(raw.period ?? ''),
    raw: (raw.raw as Record<string, unknown>) ?? {},
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToTaxes(
  organizationId: string,
  callback: (records: ERPTax[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number; connectionId?: string },
): Unsubscribe {
  return subscribeToEntities(organizationId, ERP_COLLECTIONS.TAXES, toTax, callback, options);
}

export async function getTaxes(organizationId: string): Promise<ERPTax[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, ERP_COLLECTIONS.TAXES),
    where('organizationId', '==', organizationId),
  );
  const snap = await safeGetDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  return snap.docs.map((d) => toTax(d.id, d.data() as Record<string, unknown>));
}

export async function saveTaxes(organizationId: string, records: ERPTax[]): Promise<void> {
  return saveEntities(organizationId, ERP_COLLECTIONS.TAXES, records);
}

// ─── Disconnect cascade (delete all ERP data for a connection) ───────────────

/**
 * Delete ALL ERP data for a connection — used during disconnect.
 * Order: delete child collections first, then sync jobs, then the connection.
 */
export async function cascadeDisconnect(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  await Promise.all([
    deleteEntitiesForConnection(organizationId, ERP_COLLECTIONS.CUSTOMERS, connectionId),
    deleteEntitiesForConnection(organizationId, ERP_COLLECTIONS.VENDORS, connectionId),
    deleteEntitiesForConnection(organizationId, ERP_COLLECTIONS.INVOICES, connectionId),
    deleteEntitiesForConnection(organizationId, ERP_COLLECTIONS.INVENTORY, connectionId),
    deleteEntitiesForConnection(organizationId, ERP_COLLECTIONS.LEDGERS, connectionId),
    deleteEntitiesForConnection(organizationId, ERP_COLLECTIONS.PAYMENTS, connectionId),
    deleteEntitiesForConnection(organizationId, ERP_COLLECTIONS.BANK_TRANSACTIONS, connectionId),
    deleteEntitiesForConnection(organizationId, ERP_COLLECTIONS.TAXES, connectionId),
    deleteEntitiesForConnection(organizationId, ERP_COLLECTIONS.SYNC_JOBS, connectionId),
  ]).catch(() => { /* partial — continue */ });
  await deleteConnection(organizationId, connectionId);
}

// ─── ERP summary (computed from Firestore data) ──────────────────────────────

function emptySummary(): ERPSummary {
  return {
    connectedERPs: 0,
    connectedProviders: [],
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    outstandingReceivables: 0,
    outstandingPayables: 0,
    inventoryValue: 0,
    cashPosition: 0,
    lowStockItems: 0,
    overdueInvoices: 0,
    netTaxLiability: 0,
    customerCount: 0,
    vendorCount: 0,
    inventoryItemCount: 0,
    isConnected: false,
    recentInvoices: [],
    topCustomers: [],
    topVendors: [],
  };
}

/**
 * Compute the ERPSummary from real-time Firestore data.
 * Pure + deterministic — used by the useERP hook (memoized) and dashboard.
 *
 * Accepts the entity arrays (which the hook already has from subscriptions) so
 * this is a pure function with no Firestore reads.
 */
export function computeERPSummary(
  connections: ERPConnection[],
  customers: ERPCustomer[],
  vendors: ERPVendor[],
  invoices: ERPInvoice[],
  inventory: ERPInventoryItem[],
  ledgers: ERPLedger[],
  taxes: ERPTax[],
): ERPSummary {
  const connected = connections.filter((c) => c.connectionStatus === 'connected');
  if (connections.length === 0 && customers.length === 0 && invoices.length === 0) {
    return emptySummary();
  }

  // Revenue = Σ sales invoices grandTotal
  const totalRevenue = round2(
    invoices.filter((i) => i.invoiceType === 'sales').reduce((s, i) => s + i.grandTotal, 0),
  );
  // Expenses = Σ purchase invoices grandTotal
  const totalExpenses = round2(
    invoices.filter((i) => i.invoiceType === 'purchase').reduce((s, i) => s + i.grandTotal, 0),
  );
  const netProfit = round2(totalRevenue - totalExpenses);

  const outstandingReceivables = round2(
    customers.reduce((s, c) => s + c.outstandingBalance, 0),
  );
  const outstandingPayables = round2(
    vendors.reduce((s, v) => s + v.outstandingPayable, 0),
  );

  const inventoryValue = round2(
    inventory.reduce((s, i) => s + i.stockValue, 0),
  );
  const lowStockItems = inventory.filter(
    (i) => i.stockStatus === 'low_stock' || i.stockStatus === 'out_of_stock',
  ).length;

  const now = new Date().toISOString();
  const overdueInvoices = invoices.filter(
    (i) => i.status === 'overdue' || (i.balanceDue > 0 && i.dueDate && i.dueDate < now.slice(0, 10)),
  ).length;

  // Cash position = Σ bank + cash ledger closing balances
  const cashPosition = round2(
    ledgers
      .filter((l) => l.ledgerType === 'bank' || l.ledgerType === 'cash')
      .reduce((s, l) => s + l.closingBalance, 0),
  );

  // Net tax liability = output tax - input tax (current period)
  const outputTax = taxes.filter((t) => t.direction === 'output').reduce((s, t) => s + t.taxAmount, 0);
  const inputTax = taxes.filter((t) => t.direction === 'input').reduce((s, t) => s + t.taxAmount, 0);
  const netTaxLiability = round2(outputTax - inputTax);

  const recentInvoices = invoices.slice(0, 10);

  const topCustomers = [...customers]
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 5)
    .map((c) => ({ name: c.name, totalSales: round2(c.totalSales) }));

  const topVendors = [...vendors]
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, 5)
    .map((v) => ({ name: v.name, totalPurchases: round2(v.totalPurchases) }));

  return {
    connectedERPs: connected.length,
    connectedProviders: connected.map((c) => c.provider),
    totalRevenue,
    totalExpenses,
    netProfit,
    outstandingReceivables,
    outstandingPayables,
    inventoryValue,
    cashPosition,
    lowStockItems,
    overdueInvoices,
    netTaxLiability,
    customerCount: customers.length,
    vendorCount: vendors.length,
    inventoryItemCount: inventory.length,
    isConnected: connected.length > 0,
    recentInvoices,
    topCustomers,
    topVendors,
  };
}
