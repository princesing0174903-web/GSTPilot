// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real GSTN Integration™ — Client-Safe Firestore Service
//
// The single entry point for all GST Firestore operations on the CLIENT side.
// Mirrors the invoice-engine service pattern:
//   • Real-time subscriptions via onSnapshot (org-scoped)
//   • CRUD writes via the Firebase client SDK (rules enforce org isolation)
//   • Multi-tenant — every function filters on `organizationId`
//
// This module is CLIENT-SAFE — it only imports from `firebase/firestore` and
// `@/lib/firebase` (the client SDK). It NEVER imports the provider, crypto, or
// any server-only code.
//
// The flow for each GST operation:
//   1. Client hook calls the appropriate API route (/api/gstn/*) for the
//      provider work (OTP, sync, etc.). The API route returns plain data +
//      the encrypted session.
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
  GSTConnection,
  GSTLedger,
  GSTNotice,
  GSTProfile,
  GSTReturn,
  GSTSyncJob,
  GSTSyncType,
  GSTSyncTrigger,
} from './types';

// ─── Collection names ────────────────────────────────────────────────────────

export const GST_COLLECTIONS = {
  CONNECTIONS: 'gst_connections',
  PROFILES: 'gst_profiles',
  RETURNS: 'gst_returns',
  NOTICES: 'gst_notices',
  LEDGERS: 'gst_ledgers',
  SYNC_JOBS: 'gst_sync_jobs',
} as const;

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new Error('You must belong to an organization to manage GST data.');
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

// ─── Connection ──────────────────────────────────────────────────────────────

export function toConnection(id: string, raw: Record<string, unknown>): GSTConnection {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    gstin: String(raw.gstin ?? ''),
    legalName: String(raw.legalName ?? ''),
    tradeName: String(raw.tradeName ?? ''),
    stateCode: String(raw.stateCode ?? ''),
    username: String(raw.username ?? ''),
    authStatus: (raw.authStatus as GSTConnection['authStatus']) ?? 'disconnected',
    lastSync: raw.lastSync ? ts(raw.lastSync) : null,
    sessionExpiry: raw.sessionExpiry ? ts(raw.sessionExpiry) : null,
    encryptedSession: (raw.encryptedSession as string | null) ?? null,
    lastError: (raw.lastError as string | null) ?? null,
    createdBy: raw.createdBy as GSTConnection['createdBy'],
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

/**
 * Subscribe to the current org's GST connection in real time.
 * Returns the single active connection (or null if none).
 */
export function subscribeToConnection(
  organizationId: string,
  callback: (connection: GSTConnection | null) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.CONNECTIONS),
    where('organizationId', '==', organizationId),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const docSnap = snap.docs[0];
      callback(toConnection(docSnap.id, docSnap.data() as Record<string, unknown>));
    },
    (err) => options?.onError?.(err as Error),
  );
}

/**
 * Get the current org's GST connection (one-shot read).
 */
export async function getConnection(organizationId: string): Promise<GSTConnection | null> {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.CONNECTIONS),
    where('organizationId', '==', organizationId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return toConnection(docSnap.id, docSnap.data() as Record<string, unknown>);
}

/**
 * Create a new GST connection doc.
 * Called by the client after the OTP request succeeds.
 */
export async function saveConnection(
  organizationId: string,
  data: Omit<GSTConnection, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, GST_COLLECTIONS.CONNECTIONS), {
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
  patch: Partial<GSTConnection>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, GST_COLLECTIONS.CONNECTIONS, connectionId);
  // Strip fields that should never be updated directly.
  const { id: _id, organizationId: _orgId, createdAt: _ca, ...rest } = patch as Record<string, unknown>;
  void _id; void _orgId; void _ca;
  await updateDoc(ref, {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a connection doc (and all related data — the caller is responsible
 * for also deleting profiles/returns/notices/ledgers/sync_jobs).
 */
export async function deleteConnection(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  await deleteDoc(doc(db, GST_COLLECTIONS.CONNECTIONS, connectionId));
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export function toProfile(id: string, raw: Record<string, unknown>): GSTProfile {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    gstin: String(raw.gstin ?? ''),
    legalName: String(raw.legalName ?? ''),
    tradeName: String(raw.tradeName ?? ''),
    businessConstitution: String(raw.businessConstitution ?? ''),
    registrationDate: String(raw.registrationDate ?? ''),
    taxpayerType: String(raw.taxpayerType ?? ''),
    principalAddress: String(raw.principalAddress ?? ''),
    additionalPlaceOfBusiness: Array.isArray(raw.additionalPlaceOfBusiness)
      ? (raw.additionalPlaceOfBusiness as string[])
      : [],
    state: String(raw.state ?? ''),
    stateCode: String(raw.stateCode ?? ''),
    jurisdiction: String(raw.jurisdiction ?? ''),
    status: String(raw.status ?? ''),
    filingFrequency: (raw.filingFrequency as GSTProfile['filingFrequency']) ?? 'monthly',
    lastUpdated: ts(raw.lastUpdated),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToProfile(
  organizationId: string,
  callback: (profile: GSTProfile | null) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.PROFILES),
    where('organizationId', '==', organizationId),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const docSnap = snap.docs[0];
      callback(toProfile(docSnap.id, docSnap.data() as Record<string, unknown>));
    },
    (err) => options?.onError?.(err as Error),
  );
}

export async function saveProfile(
  organizationId: string,
  profile: GSTProfile,
): Promise<void> {
  assertOrg(organizationId);
  const { id: _id, ...data } = profile;
  void _id;
  await setDoc(
    doc(db, GST_COLLECTIONS.PROFILES, profile.id),
    {
      ...data,
      organizationId, // enforce tenant scope
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ─── Returns ─────────────────────────────────────────────────────────────────

export function toReturn(id: string, raw: Record<string, unknown>): GSTReturn {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    returnType: (raw.returnType as GSTReturn['returnType']) ?? 'GSTR-1',
    financialYear: String(raw.financialYear ?? ''),
    period: String(raw.period ?? ''),
    status: (raw.status as GSTReturn['status']) ?? 'not_filed',
    filingDate: raw.filingDate ? ts(raw.filingDate) : null,
    dueDate: raw.dueDate ? ts(raw.dueDate) : null,
    ackNo: (raw.ackNo as string | null) ?? null,
    ackDate: raw.ackDate ? ts(raw.ackDate) : null,
    totalTaxableValue: Number(raw.totalTaxableValue ?? 0),
    totalTax: Number(raw.totalTax ?? 0),
    totalItc: Number(raw.totalItc ?? 0),
    netPayable: Number(raw.netPayable ?? 0),
    igstPayable: Number(raw.igstPayable ?? 0),
    cgstPayable: Number(raw.cgstPayable ?? 0),
    sgstPayable: Number(raw.sgstPayable ?? 0),
    cessPayable: Number(raw.cessPayable ?? 0),
    jsonPayload: (raw.jsonPayload as Record<string, unknown>) ?? {},
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToReturns(
  organizationId: string,
  callback: (returns: GSTReturn[]) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.RETURNS),
    where('organizationId', '==', organizationId),
    orderBy('period', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const returns = snap.docs.map((d) => toReturn(d.id, d.data() as Record<string, unknown>));
      callback(returns);
    },
    (err) => options?.onError?.(err as Error),
  );
}

/**
 * Save a batch of returns. Uses setDoc with the deterministic id so re-syncing
 * overwrites the same doc instead of creating duplicates.
 */
export async function saveReturns(
  organizationId: string,
  returns: GSTReturn[],
): Promise<void> {
  assertOrg(organizationId);
  if (returns.length === 0) return;
  const batch = writeBatch(db);
  for (const r of returns) {
    const { id: _id, ...data } = r;
    void _id;
    const ref = doc(db, GST_COLLECTIONS.RETURNS, r.id);
    batch.set(ref, {
      ...data,
      organizationId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

/**
 * Delete all returns for a connection (used on disconnect).
 */
export async function deleteReturnsForConnection(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.RETURNS),
    where('organizationId', '==', organizationId),
    where('connectionId', '==', connectionId),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── Notices ─────────────────────────────────────────────────────────────────

export function toNotice(id: string, raw: Record<string, unknown>): GSTNotice {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    noticeType: (raw.noticeType as GSTNotice['noticeType']) ?? 'notice',
    referenceNumber: String(raw.referenceNumber ?? ''),
    subject: String(raw.subject ?? ''),
    issueDate: ts(raw.issueDate),
    dueDate: raw.dueDate ? ts(raw.dueDate) : null,
    priority: (raw.priority as GSTNotice['priority']) ?? 'medium',
    status: (raw.status as GSTNotice['status']) ?? 'open',
    issuingAuthority: String(raw.issuingAuthority ?? ''),
    description: String(raw.description ?? ''),
    content: (raw.content as Record<string, unknown>) ?? {},
    attachmentUrl: (raw.attachmentUrl as string | null) ?? null,
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToNotices(
  organizationId: string,
  callback: (notices: GSTNotice[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('issueDate', 'desc'),
  ];
  if (options?.limitCount) constraints.push(limit(options.limitCount));
  const q = query(collection(db, GST_COLLECTIONS.NOTICES), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const notices = snap.docs.map((d) => toNotice(d.id, d.data() as Record<string, unknown>));
      callback(notices);
    },
    (err) => options?.onError?.(err as Error),
  );
}

export async function saveNotices(
  organizationId: string,
  notices: GSTNotice[],
): Promise<void> {
  assertOrg(organizationId);
  if (notices.length === 0) return;
  const batch = writeBatch(db);
  for (const n of notices) {
    const { id: _id, ...data } = n;
    void _id;
    const ref = doc(db, GST_COLLECTIONS.NOTICES, n.id);
    batch.set(ref, {
      ...data,
      organizationId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

export async function deleteNoticesForConnection(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.NOTICES),
    where('organizationId', '==', organizationId),
    where('connectionId', '==', connectionId),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── Ledgers ─────────────────────────────────────────────────────────────────

export function toLedger(id: string, raw: Record<string, unknown>): GSTLedger {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    ledgerType: (raw.ledgerType as GSTLedger['ledgerType']) ?? 'cash',
    asOfDate: ts(raw.asOfDate),
    igstBalance: Number(raw.igstBalance ?? 0),
    cgstBalance: Number(raw.cgstBalance ?? 0),
    sgstBalance: Number(raw.sgstBalance ?? 0),
    cessBalance: Number(raw.cessBalance ?? 0),
    totalBalance: Number(raw.totalBalance ?? 0),
    entries: Array.isArray(raw.entries)
      ? (raw.entries as GSTLedger['entries'])
      : [],
    lastSyncedAt: ts(raw.lastSyncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToLedger(
  organizationId: string,
  ledgerType: GSTLedger['ledgerType'],
  callback: (ledger: GSTLedger | null) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.LEDGERS),
    where('organizationId', '==', organizationId),
    where('ledgerType', '==', ledgerType),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const docSnap = snap.docs[0];
      callback(toLedger(docSnap.id, docSnap.data() as Record<string, unknown>));
    },
    (err) => options?.onError?.(err as Error),
  );
}

export async function saveLedgers(
  organizationId: string,
  ledgers: GSTLedger[],
): Promise<void> {
  assertOrg(organizationId);
  if (ledgers.length === 0) return;
  const batch = writeBatch(db);
  for (const l of ledgers) {
    const { id: _id, ...data } = l;
    void _id;
    const ref = doc(db, GST_COLLECTIONS.LEDGERS, l.id);
    batch.set(ref, {
      ...data,
      organizationId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

export async function deleteLedgersForConnection(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.LEDGERS),
    where('organizationId', '==', organizationId),
    where('connectionId', '==', connectionId),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── Sync Jobs ───────────────────────────────────────────────────────────────

export function toSyncJob(id: string, raw: Record<string, unknown>): GSTSyncJob {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    type: (raw.type as GSTSyncType) ?? 'full',
    trigger: (raw.trigger as GSTSyncTrigger) ?? 'manual',
    status: (raw.status as GSTSyncJob['status']) ?? 'pending',
    startedAt: raw.startedAt ? ts(raw.startedAt) : null,
    completedAt: raw.completedAt ? ts(raw.completedAt) : null,
    retryCount: Number(raw.retryCount ?? 0),
    maxRetries: Number(raw.maxRetries ?? 3),
    error: (raw.error as string | null) ?? null,
    result: (raw.result as GSTSyncJob['result']) ?? null,
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToSyncJobs(
  organizationId: string,
  callback: (jobs: GSTSyncJob[]) => void,
  options?: { onError?: (err: Error) => void; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (options?.limitCount) constraints.push(limit(options.limitCount));
  const q = query(collection(db, GST_COLLECTIONS.SYNC_JOBS), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const jobs = snap.docs.map((d) => toSyncJob(d.id, d.data() as Record<string, unknown>));
      callback(jobs);
    },
    (err) => options?.onError?.(err as Error),
  );
}

export async function createSyncJob(
  organizationId: string,
  data: Pick<GSTSyncJob, 'connectionId' | 'type' | 'trigger' | 'maxRetries'>,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, GST_COLLECTIONS.SYNC_JOBS), {
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
  patch: Partial<GSTSyncJob>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, GST_COLLECTIONS.SYNC_JOBS, jobId);
  const { id: _id, organizationId: _orgId, createdAt: _ca, ...rest } = patch as Record<string, unknown>;
  void _id; void _orgId; void _ca;
  await updateDoc(ref, {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

// ─── Disconnect cascade (delete all GST data for a connection) ───────────────

/**
 * Delete ALL GST data for a connection — used during disconnect.
 * Order matters: delete child collections first, then the connection doc.
 */
export async function cascadeDisconnect(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  await Promise.all([
    deleteReturnsForConnection(organizationId, connectionId),
    deleteNoticesForConnection(organizationId, connectionId),
    deleteLedgersForConnection(organizationId, connectionId),
  ]);
  // Delete the profile doc(s) for this connection.
  const profileQ = query(
    collection(db, GST_COLLECTIONS.PROFILES),
    where('organizationId', '==', organizationId),
    where('connectionId', '==', connectionId),
  );
  const profileSnap = await getDocs(profileQ);
  const batch = writeBatch(db);
  profileSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  // Finally delete the connection doc.
  await deleteConnection(organizationId, connectionId);
}

// ─── One-shot reads (for non-reactive contexts) ──────────────────────────────

export async function getProfile(organizationId: string): Promise<GSTProfile | null> {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.PROFILES),
    where('organizationId', '==', organizationId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toProfile(d.id, d.data() as Record<string, unknown>);
}

export async function getReturns(organizationId: string): Promise<GSTReturn[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.RETURNS),
    where('organizationId', '==', organizationId),
    orderBy('period', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toReturn(d.id, d.data() as Record<string, unknown>));
}

export async function getNotices(organizationId: string, limitCount = 50): Promise<GSTNotice[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.NOTICES),
    where('organizationId', '==', organizationId),
    orderBy('issueDate', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toNotice(d.id, d.data() as Record<string, unknown>));
}

export async function getLedger(
  organizationId: string,
  ledgerType: GSTLedger['ledgerType'],
): Promise<GSTLedger | null> {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.LEDGERS),
    where('organizationId', '==', organizationId),
    where('ledgerType', '==', ledgerType),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toLedger(d.id, d.data() as Record<string, unknown>);
}

export async function getSyncJobs(organizationId: string, limitCount = 20): Promise<GSTSyncJob[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, GST_COLLECTIONS.SYNC_JOBS),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toSyncJob(d.id, d.data() as Record<string, unknown>));
}
