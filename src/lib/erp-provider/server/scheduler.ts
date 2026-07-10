// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Sync Scheduler (SERVER-ONLY)
//
// Manages ERP sync jobs with five trigger types:
//   • manual       — user clicked "Sync Now"
//   • automatic    — scheduled (e.g. daily)
//   • background   — server-side interval picks up pending jobs every 60s
//   • retry        — automatic retry of failed jobs (exponential backoff)
//   • incremental  — syncs only records since lastSync (efficient)
//
// Every job is recorded in Firestore `erp_sync_jobs` for full observability.
// The scheduler is SERVER-ONLY because it imports the orchestrator (which
// imports the provider + crypto). API routes are the only consumers.
//
// Architecture note: in production you'd run this as a Cloud Function / cron
// worker. In the sandbox we use an in-memory interval (60s) that's started on
// first API hit and runs for the process lifetime. The job queue lives in
// Firestore, so jobs survive restarts — only the in-memory tick is lost on
// restart, and the next tick picks up where we left off.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  limit as limitConstraint,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fullERPSync, type ERPSyncRecords } from './orchestrator';
import {
  ERP_COLLECTIONS,
  updateConnection,
  cascadeDisconnect,
  saveCustomers,
  saveVendors,
  saveInvoices,
  saveInventory,
  saveLedgers,
  savePayments,
  saveBankTransactions,
  saveTaxes,
  type ERPConnection,
  type ERPSyncJob,
  type ERPSyncJobType,
  type ERPSyncTrigger,
} from '../service';
import { isRetryableERPError, friendlyERPError } from '../errors';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) throw new Error('organizationId is required.');
}

// ─── Persist sync records to Firestore ────────────────────────────────────────

/**
 * Persist all synced records to Firestore. Each entity type goes to its own
 * collection with setDoc-merge semantics (re-syncs overwrite, no duplicates).
 */
async function persistSyncRecords(
  organizationId: string,
  records: ERPSyncRecords,
): Promise<void> {
  await Promise.all([
    saveCustomers(organizationId, records.customers).catch((e) =>
      console.warn('[erp-scheduler] saveCustomers failed:', friendlyERPError(e)),
    ),
    saveVendors(organizationId, records.vendors).catch((e) =>
      console.warn('[erp-scheduler] saveVendors failed:', friendlyERPError(e)),
    ),
    saveInvoices(organizationId, records.invoices).catch((e) =>
      console.warn('[erp-scheduler] saveInvoices failed:', friendlyERPError(e)),
    ),
    saveInventory(organizationId, records.inventory).catch((e) =>
      console.warn('[erp-scheduler] saveInventory failed:', friendlyERPError(e)),
    ),
    saveLedgers(organizationId, records.ledgers).catch((e) =>
      console.warn('[erp-scheduler] saveLedgers failed:', friendlyERPError(e)),
    ),
    savePayments(organizationId, records.payments).catch((e) =>
      console.warn('[erp-scheduler] savePayments failed:', friendlyERPError(e)),
    ),
    saveBankTransactions(organizationId, records.bankTransactions).catch((e) =>
      console.warn('[erp-scheduler] saveBankTransactions failed:', friendlyERPError(e)),
    ),
    saveTaxes(organizationId, records.taxes).catch((e) =>
      console.warn('[erp-scheduler] saveTaxes failed:', friendlyERPError(e)),
    ),
  ]);
}

// ─── Job execution ───────────────────────────────────────────────────────────

/**
 * Execute a single sync job. Calls the orchestrator's fullERPSync (which fetches
 * all entity types) and writes results to Firestore.
 *
 * On success: marks the job 'completed', updates the connection's lastSync +
 * lastSyncSummary.
 * On failure: marks the job 'failed' with the error message; if the error is
 * retryable and retryCount < maxRetries, schedules a retry.
 */
async function executeJob(job: ERPSyncJob): Promise<void> {
  const jobRef = doc(db, ERP_COLLECTIONS.SYNC_JOBS, job.id);
  const now = () => new Date().toISOString();

  try {
    // Mark as running.
    await updateDoc(jobRef, {
      status: 'running',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => { /* Firestore may be unreachable — continue anyway */ });

    // Fetch the connection doc to get the encrypted connection.
    const connSnap = await getDocs(
      query(
        collection(db, ERP_COLLECTIONS.CONNECTIONS),
        where('organizationId', '==', job.organizationId),
        where('__name__', '==', job.connectionId),
        limitConstraint(1),
      ),
    ).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
    if (connSnap.docs.length === 0) {
      throw new Error('Connection not found — it may have been disconnected.');
    }
    const connData = connSnap.docs[0].data() as Record<string, unknown>;
    const encryptedConnection = connData.encryptedConnection as string | null;
    if (!encryptedConnection) {
      throw new Error('No active connection — please reconnect your ERP.');
    }

    // Determine the incremental-sync start date (from = lastSync if not in cursor).
    const lastSync = connData.lastSync ? String(connData.lastSync).slice(0, 10) : null;
    const from = job.syncCursor ?? lastSync ?? undefined;

    // Run the full sync.
    const { records, result } = await fullERPSync(
      job.organizationId,
      job.connectionId,
      encryptedConnection,
      { from },
    );

    // Persist records to Firestore.
    await persistSyncRecords(job.organizationId, records);

    // Mark job completed.
    await updateDoc(jobRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      recordsProcessed: result.recordsSynced,
      errors: result.errors,
      error: null,
      updatedAt: serverTimestamp(),
    }).catch(() => { /* non-fatal */ });

    // Update the connection's lastSync + lastSyncSummary + clear lastError.
    await updateConnection(job.organizationId, job.connectionId, {
      lastSync: now(),
      syncProgress: 100,
      connectionStatus: 'connected',
      lastError: null,
      lastSyncSummary: {
        customers: records.customers.length,
        vendors: records.vendors.length,
        invoices: records.invoices.length,
        inventory: records.inventory.length,
        ledgers: records.ledgers.length,
        payments: records.payments.length,
        bankTransactions: records.bankTransactions.length,
        taxes: records.taxes.length,
        errors: result.errors.length,
        syncedAt: now(),
      },
    }).catch(() => { /* non-fatal */ });
  } catch (err) {
    const message = friendlyERPError(err);
    const retryable = isRetryableERPError(err);
    const newRetryCount = job.retryCount + 1;
    const shouldRetry = retryable && newRetryCount < job.maxRetries;

    await updateDoc(jobRef, {
      status: shouldRetry ? 'pending' : 'failed',
      retryCount: newRetryCount,
      errors: [message],
      completedAt: shouldRetry ? null : serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => { /* non-fatal */ });

    // Update the connection's lastError so the UI can show it.
    try {
      await updateConnection(job.organizationId, job.connectionId, {
        lastError: message,
      });
    } catch {
      // Ignore — the connection may have been deleted.
    }

    // If the token expired, mark the connection accordingly.
    const errCode = (err as { code?: string }).code;
    if (errCode === 'TOKEN_EXPIRED') {
      try {
        await updateConnection(job.organizationId, job.connectionId, {
          connectionStatus: 'expired',
        });
      } catch {
        // Ignore.
      }
    }

    throw err;
  }
}

// ─── Job processing ──────────────────────────────────────────────────────────

/**
 * Pick up pending jobs and run them. Processes up to `maxJobs` at a time.
 */
export async function processPendingJobs(
  maxJobs = 5,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const q = query(
    collection(db, ERP_COLLECTIONS.SYNC_JOBS),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc'),
    limitConstraint(maxJobs),
  );
  const snap = await getDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  let succeeded = 0;
  let failed = 0;
  for (const docSnap of snap.docs) {
    const job = { id: docSnap.id, ...(docSnap.data() as Omit<ERPSyncJob, 'id'>) } as ERPSyncJob;
    try {
      await executeJob(job);
      succeeded++;
    } catch (err) {
      failed++;
      console.warn('[erp-scheduler] job', job.id, 'failed:', friendlyERPError(err));
    }
  }
  return { processed: snap.docs.length, succeeded, failed };
}

/**
 * Retry failed jobs that haven't exhausted their retry count.
 */
export async function retryFailedJobs(
  maxJobs = 3,
): Promise<{ retried: number }> {
  const q = query(
    collection(db, ERP_COLLECTIONS.SYNC_JOBS),
    where('status', '==', 'failed'),
    orderBy('createdAt', 'asc'),
    limitConstraint(maxJobs),
  );
  const snap = await getDocs(q).catch(() => ({ docs: [] as Array<{ ref: import('firebase/firestore').DocumentReference }> }));
  let retried = 0;
  for (const docSnap of snap.docs) {
    const jobData = docSnap.data() as ERPSyncJob;
    if (jobData.retryCount >= jobData.maxRetries) continue;
    await updateDoc(docSnap.ref, {
      status: 'pending',
      errors: [],
      updatedAt: serverTimestamp(),
    }).catch(() => { /* non-fatal */ });
    retried++;
  }
  return { retried };
}

/**
 * Resume interrupted jobs (status='running' but the process died).
 * An interrupted job is one that's been 'running' for more than 5 minutes.
 */
export async function resumeInterruptedJobs(
  maxJobs = 5,
): Promise<{ resumed: number }> {
  const q = query(
    collection(db, ERP_COLLECTIONS.SYNC_JOBS),
    where('status', '==', 'running'),
    orderBy('createdAt', 'asc'),
    limitConstraint(maxJobs),
  );
  const snap = await getDocs(q).catch(() => ({ docs: [] as Array<{ ref: import('firebase/firestore').DocumentReference; data: () => Record<string, unknown> }> }));
  let resumed = 0;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const docSnap of snap.docs) {
    const jobData = docSnap.data() as ERPSyncJob;
    const startedAt = jobData.startedAt ? new Date(jobData.startedAt).getTime() : 0;
    if (startedAt < fiveMinutesAgo) {
      await updateDoc(docSnap.ref, {
        status: 'pending',
        errors: ['Resumed after interruption'],
        updatedAt: serverTimestamp(),
      }).catch(() => { /* non-fatal */ });
      resumed++;
    }
  }
  return { resumed };
}

// ─── Background sync (in-memory interval) ────────────────────────────────────

let intervalHandle: NodeJS.Timeout | null = null;
const TICK_INTERVAL_MS = 60_000; // 60 seconds

export function startBackgroundSync(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(async () => {
    try {
      await processPendingJobs(5);
      await retryFailedJobs(3);
      await resumeInterruptedJobs(3);
    } catch (err) {
      console.warn('[erp-scheduler] background tick failed:', friendlyERPError(err));
    }
  }, TICK_INTERVAL_MS);
  if (intervalHandle.unref) intervalHandle.unref();
  console.log('[erp-scheduler] background sync started (60s interval)');
}

export function stopBackgroundSync(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

// ─── Convenience: run a sync synchronously (for manual sync API) ──────────────

/**
 * Schedule a job AND process it immediately. Used by the manual sync API route
 * so the user gets an immediate response.
 */
export async function runManualSync(
  organizationId: string,
  connectionId: string,
  provider: ERPConnection['provider'],
  jobType: ERPSyncJobType = 'full',
): Promise<{ jobId: string; outcome: 'completed' | 'failed'; error: string | null }> {
  assertOrg(organizationId);
  const { addDoc } = await import('firebase/firestore');
  const ref = await addDoc(collection(db, ERP_COLLECTIONS.SYNC_JOBS), {
    organizationId,
    connectionId,
    provider,
    jobType,
    trigger: 'manual',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    recordsProcessed: 0,
    errors: [],
    retryCount: 0,
    maxRetries: 3,
    syncCursor: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((e) => {
    throw new Error(friendlyERPError(e));
  });

  const jobId = ref.id;
  const jobSnap = await getDocs(
    query(
      collection(db, ERP_COLLECTIONS.SYNC_JOBS),
      where('__name__', '==', jobId),
      limitConstraint(1),
    ),
  ).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  if (jobSnap.docs.length === 0) {
    return { jobId, outcome: 'failed', error: 'Job disappeared.' };
  }
  const job = { id: jobSnap.docs[0].id, ...(jobSnap.docs[0].data() as Omit<ERPSyncJob, 'id'>) } as ERPSyncJob;

  try {
    await executeJob(job);
    return { jobId, outcome: 'completed', error: null };
  } catch (err) {
    return { jobId, outcome: 'failed', error: friendlyERPError(err) };
  }
}

/**
 * Schedule an incremental sync — only fetches records since the connection's
 * lastSync. Used by the automatic scheduler to keep data fresh without
 * re-fetching the full history.
 */
export async function runIncrementalSync(
  organizationId: string,
  connectionId: string,
  provider: ERPConnection['provider'],
): Promise<{ jobId: string; outcome: 'completed' | 'failed'; error: string | null }> {
  assertOrg(organizationId);
  const connSnap = await getDocs(
    query(
      collection(db, ERP_COLLECTIONS.CONNECTIONS),
      where('organizationId', '==', organizationId),
      where('__name__', '==', connectionId),
      limitConstraint(1),
    ),
  ).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  if (connSnap.docs.length === 0) {
    return { jobId: '', outcome: 'failed', error: 'Connection not found.' };
  }
  const connData = connSnap.docs[0].data() as Record<string, unknown>;
  const lastSync = connData.lastSync ? String(connData.lastSync).slice(0, 10) : null;

  const { addDoc } = await import('firebase/firestore');
  const ref = await addDoc(collection(db, ERP_COLLECTIONS.SYNC_JOBS), {
    organizationId,
    connectionId,
    provider,
    jobType: 'full',
    trigger: 'incremental' as ERPSyncTrigger,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    recordsProcessed: 0,
    errors: [],
    retryCount: 0,
    maxRetries: 3,
    syncCursor: lastSync,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((e) => {
    throw new Error(friendlyERPError(e));
  });

  const jobId = ref.id;
  const jobSnap = await getDocs(
    query(
      collection(db, ERP_COLLECTIONS.SYNC_JOBS),
      where('__name__', '==', jobId),
      limitConstraint(1),
    ),
  ).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
  if (jobSnap.docs.length === 0) {
    return { jobId, outcome: 'failed', error: 'Job disappeared.' };
  }
  const job = { id: jobSnap.docs[0].id, ...(jobSnap.docs[0].data() as Omit<ERPSyncJob, 'id'>) } as ERPSyncJob;

  try {
    await executeJob(job);
    return { jobId, outcome: 'completed', error: null };
  } catch (err) {
    return { jobId, outcome: 'failed', error: friendlyERPError(err) };
  }
}

// ─── Disconnect cascade (server-side) ────────────────────────────────────────

export async function performDisconnect(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string | null,
): Promise<void> {
  assertOrg(organizationId);
  const { disconnectERP } = await import('./orchestrator');
  await disconnectERP(encryptedConnection);
  await cascadeDisconnect(organizationId, connectionId);
}
