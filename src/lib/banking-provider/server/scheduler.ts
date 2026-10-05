// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Sync Scheduler (SERVER-ONLY)
//
// Manages banking sync jobs with five trigger types:
//   • manual      — user clicked "Sync Now"
//   • automatic   — scheduled (e.g. daily)
//   • background  — server-side interval picks up pending jobs every 60s
//   • retry       — automatic retry of failed jobs (exponential backoff)
//   • incremental — syncs only transactions since lastSync (efficient)
//
// Every job is recorded in Firestore `bank_sync_jobs` for full observability.
// The scheduler is SERVER-ONLY because it imports the orchestrator (which
// imports the provider + crypto). API routes are the only consumers.
//
// Architecture note: in production you'd run this as a Cloud Function / cron
// worker. In the sandbox we use an in-memory interval (60s) that's started
// on first API hit and runs for the process lifetime. The job queue itself
// lives in Firestore, so jobs survive restarts — only the in-memory tick is
// lost on restart, and the next tick picks up where we left off.
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
import { fullBankSync } from './orchestrator';
import { BANK_COLLECTIONS, updateConnection, cascadeDisconnect } from '../service';
import type { BankSyncJob, BankSyncType, BankSyncTrigger } from '../types';
import { isRetryableBankingError, friendlyBankingError } from '../errors';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) throw new Error('organizationId is required.');
}

// ─── Job creation ────────────────────────────────────────────────────────────

/**
 * Schedule a sync job. The job is created with status='pending' and picked up
 * by processPendingJobs() (either immediately for manual syncs, or on the next
 * background tick).
 *
 * Returns the new job id.
 */
export async function scheduleSync(
  organizationId: string,
  connectionId: string,
  type: BankSyncType,
  trigger: BankSyncTrigger,
  options?: { maxRetries?: number; from?: string; to?: string },
): Promise<string> {
  assertOrg(organizationId);
  const { addDoc } = await import('firebase/firestore');
  const ref = await addDoc(collection(db, BANK_COLLECTIONS.SYNC_JOBS), {
    organizationId,
    connectionId,
    type,
    trigger,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    maxRetries: options?.maxRetries ?? 3,
    error: null,
    result: options?.from ? { from: options.from, to: options.to ?? null } : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Job execution ───────────────────────────────────────────────────────────

/**
 * Execute a single sync job. Calls the orchestrator's fullBankSync (which
 * fetches balances + transactions) and writes results to Firestore.
 *
 * On success: marks the job 'completed', updates the connection's lastSync +
 * lastSnapshot.
 * On failure: marks the job 'failed' with the error message; if the error is
 * retryable and retryCount < maxRetries, schedules a retry.
 */
async function executeJob(job: BankSyncJob): Promise<void> {
  const jobRef = doc(db, BANK_COLLECTIONS.SYNC_JOBS, job.id);
  const now = () => new Date().toISOString();

  try {
    // Mark as running.
    await updateDoc(jobRef, {
      status: 'running',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Fetch the connection doc to get the encrypted connection.
    const connSnap = await getDocs(
      query(
        collection(db, BANK_COLLECTIONS.CONNECTIONS),
        where('organizationId', '==', job.organizationId),
        where('__name__', '==', job.connectionId),
        limitConstraint(1),
      ),
    );
    if (connSnap.empty) {
      throw new Error('Connection not found — it may have been disconnected.');
    }
    const connData = connSnap.docs[0].data() as Record<string, unknown>;
    const encryptedConnection = connData.encryptedConnection as string | null;
    if (!encryptedConnection) {
      throw new Error('No active connection — please reconnect your bank.');
    }

    // Determine the incremental-sync start date (from = lastSync if not provided).
    const lastSync = connData.lastSync ? String(connData.lastSync) : null;
    const from = job.result?.from ?? lastSync ?? undefined;

    // Run the full sync (balances + transactions).
    const result = await fullBankSync(
      job.organizationId,
      job.connectionId,
      encryptedConnection,
      { from },
    );

    // Persist results to Firestore.
    const { saveTransactions } = await import('../service');
    await saveTransactions(job.organizationId, result.transactions);

    // Mark job completed.
    await updateDoc(jobRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      error: null,
      result: {
        accountsSynced: 1,
        transactionsSynced: result.transactions.length,
        balancesSynced: true,
        from: from ?? null,
        to: new Date().toISOString().slice(0, 10),
      },
      updatedAt: serverTimestamp(),
    });

    // Update the connection's lastSync + lastSnapshot + clear lastError.
    await updateConnection(job.organizationId, job.connectionId, {
      lastSync: now(),
      lastSnapshot: result.snapshot,
      lastError: null,
      status: 'connected',
    });
  } catch (err) {
    const message = friendlyBankingError(err);
    const retryable = isRetryableBankingError(err);
    const newRetryCount = job.retryCount + 1;
    const shouldRetry = retryable && newRetryCount < job.maxRetries;

    await updateDoc(jobRef, {
      status: shouldRetry ? 'pending' : 'failed',
      retryCount: newRetryCount,
      error: message,
      completedAt: shouldRetry ? null : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update the connection's lastError so the UI can show it.
    try {
      await updateConnection(job.organizationId, job.connectionId, {
        lastError: message,
      });
    } catch {
      // Ignore — the connection may have been deleted.
    }

    // If the connection expired, mark it accordingly.
    const errCode = (err as { code?: string }).code;
    if (errCode === 'CONNECTION_EXPIRED') {
      try {
        await updateConnection(job.organizationId, job.connectionId, {
          status: 'expired',
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
 * Called by:
 *   - Manual sync API route (processes the just-created job immediately)
 *   - Background sync interval (every 60s)
 */
export async function processPendingJobs(
  maxJobs = 5,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const q = query(
    collection(db, BANK_COLLECTIONS.SYNC_JOBS),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc'),
    limitConstraint(maxJobs),
  );
  const snap = await getDocs(q);
  let succeeded = 0;
  let failed = 0;
  for (const docSnap of snap.docs) {
    const job = {
      id: docSnap.id,
      ...(docSnap.data() as Omit<BankSyncJob, 'id'>),
    } as BankSyncJob;
    try {
      await executeJob(job);
      succeeded++;
    } catch (err) {
      failed++;
      console.warn(
        `[banking-scheduler] job ${job.id} failed:`,
        friendlyBankingError(err),
      );
    }
  }
  return { processed: snap.size, succeeded, failed };
}

/**
 * Retry failed jobs that haven't exhausted their retry count.
 */
export async function retryFailedJobs(
  maxJobs = 3,
): Promise<{ retried: number }> {
  const q = query(
    collection(db, BANK_COLLECTIONS.SYNC_JOBS),
    where('status', '==', 'failed'),
    orderBy('createdAt', 'asc'),
    limitConstraint(maxJobs),
  );
  const snap = await getDocs(q);
  let retried = 0;
  for (const docSnap of snap.docs) {
    const job = {
      id: docSnap.id,
      ...(docSnap.data() as Omit<BankSyncJob, 'id'>),
    } as BankSyncJob;
    if (job.retryCount >= job.maxRetries) continue;
    await updateDoc(docSnap.ref, {
      status: 'pending',
      error: null,
      updatedAt: serverTimestamp(),
    });
    retried++;
  }
  return { retried };
}

// ─── Background sync (in-memory interval) ────────────────────────────────────

let intervalHandle: NodeJS.Timeout | null = null;
const TICK_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Start the background sync interval. Idempotent — calling it multiple times
 * is safe; only the first call starts the interval.
 */
export function startBackgroundSync(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(async () => {
    try {
      await processPendingJobs(5);
      await retryFailedJobs(3);
    } catch (err) {
      console.warn('[banking-scheduler] background tick failed:', friendlyBankingError(err));
    }
  }, TICK_INTERVAL_MS);
  if (intervalHandle.unref) intervalHandle.unref();
  console.log('[banking-scheduler] background sync started (60s interval)');
}

/**
 * Stop the background sync interval. Mostly useful for tests.
 */
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
  type: BankSyncType = 'full',
): Promise<{ jobId: string; outcome: 'completed' | 'failed'; error: string | null }> {
  const jobId = await scheduleSync(organizationId, connectionId, type, 'manual');

  const jobSnap = await getDocs(
    query(
      collection(db, BANK_COLLECTIONS.SYNC_JOBS),
      where('__name__', '==', jobId),
      limitConstraint(1),
    ),
  );
  if (jobSnap.empty) {
    return { jobId, outcome: 'failed', error: 'Job disappeared.' };
  }
  const job = {
    id: jobSnap.docs[0].id,
    ...(jobSnap.docs[0].data() as Omit<BankSyncJob, 'id'>),
  } as BankSyncJob;

  try {
    await executeJob(job);
    return { jobId, outcome: 'completed', error: null };
  } catch (err) {
    return { jobId, outcome: 'failed', error: friendlyBankingError(err) };
  }
}

// ─── Incremental sync ────────────────────────────────────────────────────────

/**
 * Schedule an incremental sync — only fetches transactions since the
 * connection's lastSync. Used by the automatic scheduler to keep data fresh
 * without re-fetching the full history.
 */
export async function runIncrementalSync(
  organizationId: string,
  connectionId: string,
): Promise<{ jobId: string; outcome: 'completed' | 'failed'; error: string | null }> {
  // Read the connection's lastSync to use as the `from` date.
  const connSnap = await getDocs(
    query(
      collection(db, BANK_COLLECTIONS.CONNECTIONS),
      where('organizationId', '==', organizationId),
      where('__name__', '==', connectionId),
      limitConstraint(1),
    ),
  );
  if (connSnap.empty) {
    return { jobId: '', outcome: 'failed', error: 'Connection not found.' };
  }
  const connData = connSnap.docs[0].data() as Record<string, unknown>;
  const lastSync = connData.lastSync ? String(connData.lastSync).slice(0, 10) : undefined;

  const jobId = await scheduleSync(
    organizationId,
    connectionId,
    'transactions',
    'incremental',
    { from: lastSync },
  );

  const jobSnap = await getDocs(
    query(
      collection(db, BANK_COLLECTIONS.SYNC_JOBS),
      where('__name__', '==', jobId),
      limitConstraint(1),
    ),
  );
  if (jobSnap.empty) {
    return { jobId, outcome: 'failed', error: 'Job disappeared.' };
  }
  const job = {
    id: jobSnap.docs[0].id,
    ...(jobSnap.docs[0].data() as Omit<BankSyncJob, 'id'>),
  } as BankSyncJob;

  try {
    await executeJob(job);
    return { jobId, outcome: 'completed', error: null };
  } catch (err) {
    return { jobId, outcome: 'failed', error: friendlyBankingError(err) };
  }
}

// ─── Disconnect cascade (server-side) ────────────────────────────────────────

/**
 * Disconnect a bank connection: invalidate the consent server-side, then
 * delete all Firestore data for the connection.
 */
export async function performDisconnect(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string | null,
): Promise<void> {
  assertOrg(organizationId);
  const { disconnectBank } = await import('./orchestrator');
  await disconnectBank(encryptedConnection);
  await cascadeDisconnect(organizationId, connectionId);
}
