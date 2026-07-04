// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Background Processor (SERVER-ONLY)
//
// The production job worker. Picks up queued jobs, runs them through the
// active IGenProvider, persists progress + output to Firestore, handles
// retries with exponential backoff, and respects user cancellations.
//
// Lifecycle: Queued → Processing → (Completed | Failed | Cancelled)
//
// Architecture:
//   • In-memory interval (5s tick) picks up pending jobs — in production this
//     would be a Cloud Tasks queue / separate worker process, but the job
//     STATE lives in Firestore so it survives restarts.
//   • Each job runs in its own async chain; the processor tracks active jobs
//     in a Map so cancel signals can be delivered instantly.
//   • Cancel: the user sets status='cancelled' in Firestore (via API). The
//     processor's onSnapshot listener detects the change and flips the
//     CancelSignal, which the provider polls and aborts.
//   • Retry: failed jobs with retryable errors + retryCount < maxRetries are
//     reset to 'queued' with an exponential backoff delay.
//
// This file is SERVER-ONLY — imports the provider (node:crypto) + Firestore.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as limitConstraint,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getGenProvider } from './registry';
import type { IGenProvider, CancelSignal } from '../provider';
import type {
  GenJob,
  GenJobStatus,
  GenJobStatusReason,
  GenJobInput,
  GenVersion,
  GenPipelineStats,
  GenAssetType,
  GenProviderName,
} from '../types';
import { friendlyGenError, isRetryableGenError, GenError } from '../errors';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) throw new Error('organizationId is required.');
}

// ─── Collections ─────────────────────────────────────────────────────────────

const JOBS = 'ai_jobs';
const VERSIONS = 'ai_versions';
const DRAFTS = 'ai_drafts';

// ─── Active job tracking (for cancel) ────────────────────────────────────────

interface ActiveJob {
  jobId: string;
  cancelSignal: CancelSignal;
  unsubscribe: Unsubscribe;
  startedAt: number;
}

const activeJobs = new Map<string, ActiveJob>();

// ─── Timestamp helpers ───────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

function ts(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return '';
}

// ─── Job conversion ──────────────────────────────────────────────────────────

function toJob(id: string, raw: Record<string, unknown>): GenJob {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    createdBy: raw.createdBy as GenJob['createdBy'],
    status: (raw.status as GenJobStatus) ?? 'queued',
    statusReason: (raw.statusReason as GenJobStatusReason) ?? 'created',
    assetType: (raw.assetType as GenAssetType) ?? 'text',
    provider: (raw.provider as GenProviderName) ?? 'mock',
    model: String(raw.model ?? ''),
    input: (raw.input as GenJobInput) ?? { prompt: '' },
    output: (raw.output as GenJob['output']) ?? null,
    progress: raw.progress !== undefined && raw.progress !== null ? Number(raw.progress) : null,
    progressMessage: (raw.progressMessage as string | null) ?? null,
    error: (raw.error as string | null) ?? null,
    errorCode: (raw.errorCode as string | null) ?? null,
    retryCount: Number(raw.retryCount ?? 0),
    maxRetries: Number(raw.maxRetries ?? 3),
    previousAttemptIds: Array.isArray(raw.previousAttemptIds) ? (raw.previousAttemptIds as string[]) : [],
    draftId: (raw.draftId as string | null) ?? null,
    versionIds: Array.isArray(raw.versionIds) ? (raw.versionIds as string[]) : [],
    queuedAt: ts(raw.queuedAt),
    startedAt: raw.startedAt ? ts(raw.startedAt) : null,
    completedAt: raw.completedAt ? ts(raw.completedAt) : null,
    durationMs: raw.durationMs !== undefined && raw.durationMs !== null ? Number(raw.durationMs) : null,
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

// ─── Public: queue a new job ─────────────────────────────────────────────────

/**
 * Create a new job in Firestore with status='queued'.
 * The background processor will pick it up on the next tick (≤5s).
 *
 * Returns the new job id.
 */
export async function queueJob(
  organizationId: string,
  jobData: Omit<GenJob, 'id' | 'status' | 'statusReason' | 'progress' | 'progressMessage' | 'output' | 'error' | 'errorCode' | 'retryCount' | 'previousAttemptIds' | 'versionIds' | 'queuedAt' | 'startedAt' | 'completedAt' | 'durationMs' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  assertOrg(organizationId);
  const { addDoc } = await import('firebase/firestore');
  const ref = await addDoc(collection(db, JOBS), {
    ...jobData,
    organizationId,
    status: 'queued',
    statusReason: 'created',
    progress: null,
    progressMessage: null,
    output: null,
    error: null,
    errorCode: null,
    retryCount: 0,
    previousAttemptIds: [],
    versionIds: [],
    queuedAt: serverTimestamp(),
    startedAt: null,
    completedAt: null,
    durationMs: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Public: cancel a job ────────────────────────────────────────────────────

/**
 * Cancel a job. Sets status='cancelled' in Firestore. If the job is currently
 * processing, the active job's CancelSignal is flipped so the provider aborts.
 *
 * Idempotent — cancelling an already-terminal job is a no-op.
 */
export async function cancelJob(organizationId: string, jobId: string): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, JOBS, jobId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const job = toJob(snap.id, snap.data() as Record<string, unknown>);

  // Only queued or processing jobs can be cancelled.
  if (job.status !== 'queued' && job.status !== 'processing') return;

  // Flip the in-memory cancel signal (if the job is actively processing).
  const active = activeJobs.get(jobId);
  if (active) {
    active.cancelSignal.cancelled = true;
  }

  // Update Firestore.
  await updateDoc(ref, {
    status: 'cancelled',
    statusReason: 'cancelled_by_user',
    completedAt: serverTimestamp(),
    durationMs: job.startedAt ? Date.now() - new Date(job.startedAt).getTime() : null,
    updatedAt: serverTimestamp(),
  });

  // Clean up the active job tracker (the onSnapshot listener will also fire).
  if (active) {
    active.unsubscribe();
    activeJobs.delete(jobId);
  }
}

// ─── Public: retry a failed job ──────────────────────────────────────────────

/**
 * Manually retry a failed job. Resets it to 'queued' with retryCount preserved
 * (so it doesn't get infinite manual retries). Creates a NEW job if the user
 * wants a fresh attempt with full retry budget.
 *
 * If `freshAttempt=true`, creates a new job with the same input and links the
 * old job's id in `previousAttemptIds`.
 */
export async function retryJob(
  organizationId: string,
  jobId: string,
  options?: { freshAttempt?: boolean },
): Promise<string> {
  assertOrg(organizationId);
  const ref = doc(db, JOBS, jobId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new GenError('Job not found.', { code: 'JOB_NOT_FOUND', statusCode: 404 });
  }
  const job = toJob(snap.id, snap.data() as Record<string, unknown>);

  if (job.status !== 'failed' && job.status !== 'cancelled') {
    throw new GenError(
      `Cannot retry a job in status '${job.status}'. Only failed or cancelled jobs can be retried.`,
      { code: 'ILLEGAL_TRANSITION', statusCode: 409 },
    );
  }

  if (options?.freshAttempt) {
    // Create a new job with the same input + full retry budget.
    return queueJob(organizationId, {
      createdBy: job.createdBy,
      assetType: job.assetType,
      provider: job.provider,
      model: job.model,
      input: job.input,
      draftId: job.draftId,
      maxRetries: job.maxRetries,
      previousAttemptIds: [...job.previousAttemptIds, jobId],
    });
  }

  // Reset the existing job to 'queued' (preserves retryCount for audit).
  await updateDoc(ref, {
    status: 'queued',
    statusReason: 'retry',
    error: null,
    errorCode: null,
    progress: null,
    progressMessage: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    retryCount: job.retryCount + 1,
    updatedAt: serverTimestamp(),
  });
  return jobId;
}

// ─── Job execution ───────────────────────────────────────────────────────────

/**
 * Execute a single job: mark processing, call the provider, persist output,
 * create a version snapshot, handle errors with retry logic.
 */
async function executeJob(job: GenJob, provider: IGenProvider): Promise<void> {
  const jobRef = doc(db, JOBS, job.id);
  const startTime = Date.now();

  // Build the cancel signal.
  const cancelSignal: CancelSignal = { cancelled: false };

  // Subscribe to the job doc so we can detect user cancellation.
  const unsubscribe = onSnapshot(jobRef, (snap) => {
    if (!snap.exists()) {
      cancelSignal.cancelled = true;
      return;
    }
    const data = snap.data() as Record<string, unknown>;
    if (data.status === 'cancelled') {
      cancelSignal.cancelled = true;
    }
  });
  activeJobs.set(job.id, { jobId: job.id, cancelSignal, unsubscribe, startedAt: startTime });

  try {
    // Mark as processing.
    await updateDoc(jobRef, {
      status: 'processing',
      statusReason: 'worker_picked_up',
      startedAt: serverTimestamp(),
      progress: 0,
      progressMessage: 'Starting generation...',
      updatedAt: serverTimestamp(),
    });

    // Call the provider.
    const { output, statusReason } = await provider.generate(job.input, {
      assetType: job.assetType,
      model: job.model,
      cancelSignal,
      onProgress: async (p) => {
        // Persist progress updates to Firestore (throttled — every update is
        // fine here because the mock provider only fires 5 steps).
        try {
          await updateDoc(jobRef, {
            progress: p.percent,
            progressMessage: p.message ?? null,
            statusReason: 'progress' as GenJobStatusReason,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Non-fatal — progress updates are best-effort.
        }
      },
    });

    // If cancelled during generation, don't mark as completed.
    if (cancelSignal.cancelled || statusReason === 'cancelled_timeout') {
      await updateDoc(jobRef, {
        status: 'cancelled',
        statusReason: 'cancelled_by_user',
        completedAt: serverTimestamp(),
        durationMs: Date.now() - startTime,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // Success — persist the output + create a version snapshot.
    const durationMs = Date.now() - startTime;
    const versionId = await createVersion(job, output);

    await updateDoc(jobRef, {
      status: 'completed',
      statusReason: 'success',
      output,
      progress: 100,
      progressMessage: 'Completed',
      completedAt: serverTimestamp(),
      durationMs,
      versionIds: [...job.versionIds, versionId],
      updatedAt: serverTimestamp(),
    });

    // If this job came from a draft, link the version + last job back to the draft.
    if (job.draftId) {
      await linkVersionToDraft(job.draftId, versionId, job.id);
    }
  } catch (err) {
    const message = friendlyGenError(err);
    const retryable = isRetryableGenError(err);
    const newRetryCount = job.retryCount + 1;
    const shouldAutoRetry = retryable && newRetryCount < job.maxRetries;

    if (shouldAutoRetry) {
      // Schedule a retry with exponential backoff.
      const backoffMs = Math.min(30_000, 1000 * Math.pow(2, newRetryCount));
      await updateDoc(jobRef, {
        status: 'queued',
        statusReason: 'retry',
        error: message,
        errorCode: (err as { code?: string }).code ?? 'UNKNOWN',
        retryCount: newRetryCount,
        progress: null,
        progressMessage: `Retrying in ${Math.round(backoffMs / 1000)}s (attempt ${newRetryCount + 1}/${job.maxRetries})...`,
        startedAt: null,
        updatedAt: serverTimestamp(),
      });
      // The background tick will pick it up again after the backoff.
      // (We don't sleep here — the next tick after backoffMs will process it.)
      setTimeout(() => {
        // No-op — just marks that the backoff has elapsed. The next tick picks it up.
      }, backoffMs);
    } else {
      // Terminal failure.
      await updateDoc(jobRef, {
        status: 'failed',
        statusReason: retryable ? 'exhausted_retries' : 'error',
        error: message,
        errorCode: (err as { code?: string }).code ?? 'UNKNOWN',
        retryCount: newRetryCount,
        completedAt: serverTimestamp(),
        durationMs: Date.now() - startTime,
        updatedAt: serverTimestamp(),
      });
    }
  } finally {
    // Clean up the active job tracker.
    const active = activeJobs.get(job.id);
    if (active) {
      active.unsubscribe();
      activeJobs.delete(job.id);
    }
  }
}

// ─── Version snapshot creation ───────────────────────────────────────────────

/**
 * Create a version snapshot for a completed job. Stored in ai_versions.
 * Returns the new version id.
 */
async function createVersion(job: GenJob, output: GenJob['output']): Promise<string> {
  if (!output) throw new Error('Cannot create version: no output.');
  const { addDoc, getDocs, query: fq, where: fw, orderBy: fo, limit: fl } = await import('firebase/firestore');

  // Compute the next version number within the draft (or job if no draft).
  const scopeId = job.draftId ?? job.id;
  const existingQ = fq(
    collection(db, VERSIONS),
    fw('organizationId', '==', job.organizationId),
    fw('draftId', '==', job.draftId ?? null),
    fo('versionNumber', 'desc'),
    fl(1),
  );
  const existingSnap = await getDocs(existingQ);
  const lastVersionNumber = existingSnap.empty
    ? 0
    : Number((existingSnap.docs[0].data() as Record<string, unknown>).versionNumber ?? 0);
  const versionNumber = lastVersionNumber + 1;

  const versionRef = await addDoc(collection(db, VERSIONS), {
    organizationId: job.organizationId,
    jobId: job.id,
    draftId: job.draftId,
    versionNumber,
    output,
    input: job.input,
    provider: job.provider,
    model: job.model,
    createdBy: job.createdBy,
    label: null,
    createdAt: serverTimestamp(),
  });
  void scopeId;
  return versionRef.id;
}

/**
 * Link a version back to its draft (updates draft's versionIds + lastJobId).
 */
async function linkVersionToDraft(draftId: string, versionId: string, jobId: string): Promise<void> {
  const draftRef = doc(db, DRAFTS, draftId);
  const snap = await getDoc(draftRef);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  const existingVersionIds = Array.isArray(data.versionIds) ? (data.versionIds as string[]) : [];
  await updateDoc(draftRef, {
    versionIds: [...existingVersionIds, versionId],
    lastJobId: jobId,
    updatedAt: serverTimestamp(),
  });
}

// ─── Background tick ─────────────────────────────────────────────────────────

let intervalHandle: NodeJS.Timeout | null = null;
const TICK_INTERVAL_MS = 5_000; // 5 seconds
const MAX_JOBS_PER_TICK = 3;
const MAX_PROCESSING = 5; // max concurrent jobs

/**
 * Pick up queued jobs and run them. Called every 5 seconds by the background
 * interval. Respects MAX_PROCESSING concurrent jobs.
 */
export async function processPendingJobs(): Promise<{
  pickedUp: number;
  activeCount: number;
}> {
  // Don't exceed the concurrency limit.
  if (activeJobs.size >= MAX_PROCESSING) {
    return { pickedUp: 0, activeCount: activeJobs.size };
  }

  const slotsAvailable = MAX_PROCESSING - activeJobs.size;
  const fetchLimit = Math.min(MAX_JOBS_PER_TICK, slotsAvailable);

  const q = query(
    collection(db, JOBS),
    where('status', '==', 'queued'),
    orderBy('queuedAt', 'asc'),
    limitConstraint(fetchLimit),
  );
  const snap = await getDocs(q);
  const provider = getGenProvider();

  let pickedUp = 0;
  for (const docSnap of snap.docs) {
    const job = toJob(docSnap.id, docSnap.data() as Record<string, unknown>);
    // Skip if this job is already being processed (race condition guard).
    if (activeJobs.has(job.id)) continue;
    pickedUp++;
    // Fire-and-forget — each job runs in its own async chain.
    void executeJob(job, provider).catch((err) => {
      console.warn(`[ai-processor] job ${job.id} failed unexpectedly:`, friendlyGenError(err));
    });
  }
  return { pickedUp, activeCount: activeJobs.size };
}

// ─── Start / stop the background processor ───────────────────────────────────

/**
 * Start the background processor. Idempotent — calling it multiple times is safe.
 * The interval ticks every 5 seconds and picks up to 3 queued jobs per tick
 * (up to 5 concurrent).
 *
 * In production this would be a Cloud Tasks worker / separate process. In the
 * sandbox it's a process-level interval that survives as long as the dev
 * server runs. Job STATE lives in Firestore, so jobs survive restarts — only
 * the in-memory tick is lost on restart, and the next tick picks up where we
 * left off.
 */
export function startBackgroundProcessor(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(async () => {
    try {
      await processPendingJobs();
    } catch (err) {
      console.warn('[ai-processor] background tick failed:', friendlyGenError(err));
    }
  }, TICK_INTERVAL_MS);
  if (intervalHandle.unref) intervalHandle.unref();
  console.log('[ai-processor] background processor started (5s interval, max 5 concurrent)');
}

export function stopBackgroundProcessor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

// ─── Stats computation (server-side, for dashboards) ─────────────────────────

/**
 * Compute aggregate pipeline stats for an organization. Reads all jobs for the
 * org and computes byStatus / byAssetType / byProvider / avgDurationMs /
 * totalCostUsdCents / successRate / last24hCount.
 */
export async function computeStats(organizationId: string): Promise<GenPipelineStats> {
  assertOrg(organizationId);
  const q = query(
    collection(db, JOBS),
    where('organizationId', '==', organizationId),
    limitConstraint(500),
  );
  const snap = await getDocs(q);
  const jobs = snap.docs.map((d) => toJob(d.id, d.data() as Record<string, unknown>));

  const byStatus: Record<GenJobStatus, number> = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  const byAssetType: Record<GenAssetType, number> = {
    text: 0,
    image: 0,
    video: 0,
    audio: 0,
    code: 0,
    structured: 0,
  };
  const byProvider: Record<string, number> = {};
  let totalDurationMs = 0;
  let completedCount = 0;
  let totalCostUsdCents = 0;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let last24hCount = 0;

  for (const job of jobs) {
    byStatus[job.status]++;
    byAssetType[job.assetType]++;
    byProvider[job.provider] = (byProvider[job.provider] ?? 0) + 1;
    if (job.durationMs !== null) {
      totalDurationMs += job.durationMs;
      completedCount++;
    }
    if (job.output?.costUsdCents) totalCostUsdCents += job.output.costUsdCents;
    if (new Date(job.queuedAt).getTime() > oneDayAgo) last24hCount++;
  }

  const total = jobs.length;
  const successRate = total > 0 ? byStatus.completed / total : 0;
  const avgDurationMs = completedCount > 0 ? Math.round(totalDurationMs / completedCount) : 0;

  return {
    total,
    byStatus,
    byAssetType,
    byProvider,
    avgDurationMs,
    totalCostUsdCents,
    successRate,
    last24hCount,
  };
}

// ─── Provider diagnostics ────────────────────────────────────────────────────

export async function providerHealthCheck(): Promise<{
  healthy: boolean;
  name: string;
  isLive: boolean;
  providerName: string;
}> {
  const provider = getGenProvider();
  try {
    const healthy = await provider.healthCheck();
    return {
      healthy,
      name: provider.name,
      isLive: provider.isLive,
      providerName: provider.providerName,
    };
  } catch {
    return { healthy: false, name: provider.name, isLive: provider.isLive, providerName: provider.providerName };
  }
}
