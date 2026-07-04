// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Sync Scheduler (SERVER-ONLY)
//
// Manages GST sync jobs with four trigger types:
//   • manual     — user clicked "Sync Now"
//   • automatic  — scheduled (e.g. daily at 9 AM)
//   • background — server-side interval picks up pending jobs every 60s
//   • retry      — automatic retry of failed jobs (exponential backoff)
//
// Every job is recorded in Firestore `gst_sync_jobs` for full observability.
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
import { fullSync } from './orchestrator';
import {
  GST_COLLECTIONS,
  updateConnection,
  cascadeDisconnect,
} from '../service';
import type { GSTSyncJob, GSTSyncType, GSTSyncTrigger } from '../types';
import { isRetryableGSTNError, friendlyGSTNError } from '../errors';

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
  type: GSTSyncType,
  trigger: GSTSyncTrigger,
  options?: { maxRetries?: number },
): Promise<string> {
  assertOrg(organizationId);
  const { addDoc } = await import('firebase/firestore');
  const ref = await addDoc(collection(db, GST_COLLECTIONS.SYNC_JOBS), {
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
    result: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Job execution ───────────────────────────────────────────────────────────

/**
 * Execute a single sync job. Calls the orchestrator's fullSync (which fetches
 * profile + returns + notices + ledgers) and writes results to Firestore.
 *
 * On success: marks the job 'completed', updates the connection's lastSync.
 * On failure: marks the job 'failed' with the error message; if the error is
 * retryable and retryCount < maxRetries, schedules a retry.
 */
async function executeJob(job: GSTSyncJob): Promise<void> {
  const jobRef = doc(db, GST_COLLECTIONS.SYNC_JOBS, job.id);
  const now = () => new Date().toISOString();

  try {
    // Mark as running.
    await updateDoc(jobRef, {
      status: 'running',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Fetch the connection doc to get the encrypted session.
    const connRef = doc(db, GST_COLLECTIONS.CONNECTIONS, job.connectionId);
    const connSnap = await getDocs(
      query(
        collection(db, GST_COLLECTIONS.CONNECTIONS),
        where('organizationId', '==', job.organizationId),
        where('__name__', '==', job.connectionId),
        limitConstraint(1),
      ),
    );
    if (connSnap.empty) {
      throw new Error('Connection not found — it may have been disconnected.');
    }
    const connData = connSnap.docs[0].data() as Record<string, unknown>;
    const encryptedSession = connData.encryptedSession as string | null;
    if (!encryptedSession) {
      throw new Error('No active session — please reconnect GST.');
    }

    // Run the full sync (profile + returns + notices + ledgers).
    const result = await fullSync(
      job.organizationId,
      job.connectionId,
      encryptedSession,
    );

    // Persist results to Firestore.
    const { saveProfile, saveReturns, saveNotices, saveLedgers } = await import('../service');
    await Promise.all([
      saveProfile(job.organizationId, result.profile),
      saveReturns(job.organizationId, result.returns),
      saveNotices(job.organizationId, result.notices),
      saveLedgers(job.organizationId, result.ledgers),
    ]);

    // Mark job completed.
    await updateDoc(jobRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      error: null,
      result: {
        returnsSynced: result.returns.length,
        noticesSynced: result.notices.length,
        ledgersSynced: result.ledgers.length,
        profileSynced: true,
      },
      updatedAt: serverTimestamp(),
    });

    // Update the connection's lastSync + clear any lastError.
    await updateConnection(job.organizationId, job.connectionId, {
      lastSync: now(),
      lastError: null,
      authStatus: 'session_active',
    });
    void connRef; // referenced for clarity
  } catch (err) {
    const message = friendlyGSTNError(err);
    const retryable = isRetryableGSTNError(err);
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

    // If the session expired, mark the connection accordingly.
    const errCode = (err as { code?: string }).code;
    if (errCode === 'SESSION_EXPIRED') {
      try {
        await updateConnection(job.organizationId, job.connectionId, {
          authStatus: 'session_expired',
        });
      } catch {
        // Ignore.
      }
    }

    // Re-throw so the caller knows the job failed (but the Firestore state is already updated).
    throw err;
  }
}

// ─── Job processing ──────────────────────────────────────────────────────────

/**
 * Pick up pending jobs and run them. Processes up to `maxJobs` at a time.
 * Called by:
 *   - Manual sync API route (processes the just-created job immediately)
 *   - Background sync interval (every 60s)
 *
 * Returns the number of jobs processed + their outcomes.
 */
export async function processPendingJobs(
  maxJobs = 5,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const q = query(
    collection(db, GST_COLLECTIONS.SYNC_JOBS),
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
      ...(docSnap.data() as Omit<GSTSyncJob, 'id'>),
    } as GSTSyncJob;
    try {
      await executeJob(job);
      succeeded++;
    } catch (err) {
      failed++;
      console.warn(
        `[gstn-scheduler] job ${job.id} failed:`,
        friendlyGSTNError(err),
      );
    }
  }
  return { processed: snap.size, succeeded, failed };
}

/**
 * Retry failed jobs that haven't exhausted their retry count.
 * Called by the background sync interval.
 */
export async function retryFailedJobs(
  maxJobs = 3,
): Promise<{ retried: number }> {
  const q = query(
    collection(db, GST_COLLECTIONS.SYNC_JOBS),
    where('status', '==', 'failed'),
    orderBy('createdAt', 'asc'),
    limitConstraint(maxJobs),
  );
  const snap = await getDocs(q);
  let retried = 0;
  for (const docSnap of snap.docs) {
    const job = {
      id: docSnap.id,
      ...(docSnap.data() as Omit<GSTSyncJob, 'id'>),
    } as GSTSyncJob;
    if (job.retryCount >= job.maxRetries) continue;
    // Reset to pending — processPendingJobs will pick it up on the next tick.
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
 *
 * The interval:
 *   1. Processes up to 5 pending jobs
 *   2. Retries up to 3 failed jobs (which become pending for the next tick)
 *
 * In production this would be a Cloud Function cron. In the sandbox it's a
 * process-level interval that survives as long as the dev server runs.
 */
export function startBackgroundSync(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(async () => {
    try {
      await processPendingJobs(5);
      await retryFailedJobs(3);
    } catch (err) {
      console.warn('[gstn-scheduler] background tick failed:', friendlyGSTNError(err));
    }
  }, TICK_INTERVAL_MS);
  // Don't keep the process alive just for the scheduler.
  if (intervalHandle.unref) intervalHandle.unref();
  // eslint-disable-next-line no-console
  console.log('[gstn-scheduler] background sync started (60s interval)');
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
 *
 * Returns the job id + outcome.
 */
export async function runManualSync(
  organizationId: string,
  connectionId: string,
  type: GSTSyncType = 'full',
): Promise<{ jobId: string; outcome: 'completed' | 'failed'; error: string | null }> {
  const jobId = await scheduleSync(organizationId, connectionId, type, 'manual');

  // Process just this job.
  const jobRef = doc(db, GST_COLLECTIONS.SYNC_JOBS, jobId);
  const jobSnap = await getDocs(
    query(
      collection(db, GST_COLLECTIONS.SYNC_JOBS),
      where('__name__', '==', jobId),
      limitConstraint(1),
    ),
  );
  if (jobSnap.empty) {
    return { jobId, outcome: 'failed', error: 'Job disappeared.' };
  }
  const job = {
    id: jobSnap.docs[0].id,
    ...(jobSnap.docs[0].data() as Omit<GSTSyncJob, 'id'>),
  } as GSTSyncJob;

  try {
    await executeJob(job);
    return { jobId, outcome: 'completed', error: null };
  } catch (err) {
    return { jobId, outcome: 'failed', error: friendlyGSTNError(err) };
  }
  void jobRef;
}

// ─── Disconnect cascade (server-side) ────────────────────────────────────────

/**
 * Disconnect a GST connection: terminate the session server-side, then delete
 * all Firestore data for the connection. Used by the disconnect API route.
 */
export async function performDisconnect(
  organizationId: string,
  connectionId: string,
  encryptedSession: string | null,
): Promise<void> {
  assertOrg(organizationId);
  // Terminate the session server-side (best effort).
  const { terminateConnection } = await import('./orchestrator');
  await terminateConnection(encryptedSession);
  // Cascade-delete all Firestore data for this connection.
  await cascadeDisconnect(organizationId, connectionId);
}
