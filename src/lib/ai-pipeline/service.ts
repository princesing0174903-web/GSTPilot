// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Production Pipeline™ — Client-Safe Firestore Service
//
// The single entry point for all AI pipeline Firestore operations on the
// CLIENT side. Mirrors the invoice-engine + GSTN service patterns:
//   • Real-time subscriptions via onSnapshot (org-scoped)
//   • CRUD writes via the Firebase client SDK (rules enforce org isolation)
//   • Multi-tenant — every function filters on `organizationId`
//
// This module is CLIENT-SAFE — it only imports from `firebase/firestore` and
// `@/lib/firebase` (the client SDK). It NEVER imports the provider, crypto, or
// any server-only code.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
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
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  GenJob,
  GenJobStatus,
  GenJobStatusReason,
  GenAssetType,
  GenProviderName,
  GenJobInput,
  GenJobOutput,
  GenVersion,
  GenDraft,
  CreateJobInput,
  CreateDraftInput,
  UpdateDraftInput,
  GenPipelineStats,
} from './types';

// ─── Collection names ────────────────────────────────────────────────────────

export const AI_COLLECTIONS = {
  JOBS: 'ai_jobs',
  VERSIONS: 'ai_versions',
  DRAFTS: 'ai_drafts',
} as const;

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new Error('You must belong to an organization to manage AI data.');
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

// ─── Job conversion ──────────────────────────────────────────────────────────

export function toJob(id: string, raw: Record<string, unknown>): GenJob {
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

// ─── Job: real-time subscriptions ────────────────────────────────────────────

/**
 * Subscribe to ALL jobs for the current org in real time.
 * Returns the unsubscribe function — callers MUST call it on unmount.
 */
export function subscribeToJobs(
  organizationId: string,
  callback: (jobs: GenJob[]) => void,
  options?: {
    status?: GenJobStatus;
    assetType?: GenAssetType;
    limitCount?: number;
    onError?: (err: Error) => void;
  },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('queuedAt', 'desc'),
  ];
  if (options?.status) constraints.push(where('status', '==', options.status));
  if (options?.assetType) constraints.push(where('assetType', '==', options.assetType));
  if (options?.limitCount) constraints.push(limitConstraint(options.limitCount));

  const q = query(collection(db, AI_COLLECTIONS.JOBS), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const jobs = snap.docs.map((d) => toJob(d.id, d.data() as Record<string, unknown>));
      callback(jobs);
    },
    (err) => options?.onError?.(err as Error),
  );
}

/**
 * Subscribe to a SINGLE job in real time (for the job-detail / progress view).
 */
export function subscribeToJob(
  organizationId: string,
  jobId: string,
  callback: (job: GenJob | null) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const ref = doc(db, AI_COLLECTIONS.JOBS, jobId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(toJob(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => options?.onError?.(err as Error),
  );
}

// ─── Job: one-shot reads ─────────────────────────────────────────────────────

export async function getJob(organizationId: string, jobId: string): Promise<GenJob | null> {
  assertOrg(organizationId);
  const ref = doc(db, AI_COLLECTIONS.JOBS, jobId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toJob(snap.id, snap.data() as Record<string, unknown>);
}

export async function listJobs(
  organizationId: string,
  options?: { status?: GenJobStatus; limitCount?: number },
): Promise<GenJob[]> {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('queuedAt', 'desc'),
  ];
  if (options?.status) constraints.push(where('status', '==', options.status));
  if (options?.limitCount) constraints.push(limitConstraint(options.limitCount));
  const q = query(collection(db, AI_COLLECTIONS.JOBS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => toJob(d.id, d.data() as Record<string, unknown>));
}

// ─── Job: create (client-side — writes the queued doc directly) ──────────────

/**
 * Create a new job directly from the client (no API route needed for the
 * create itself — the background processor picks it up). The processor runs
 * server-side and calls the provider.
 *
 * This mirrors the invoice-engine pattern: client writes the doc, server
 * processes it.
 */
export async function createJob(
  organizationId: string,
  input: CreateJobInput,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, AI_COLLECTIONS.JOBS), {
    organizationId,
    createdBy: input.createdBy,
    status: 'queued',
    statusReason: 'created',
    assetType: input.assetType,
    provider: input.provider,
    model: input.model,
    input: input.input,
    output: null,
    progress: null,
    progressMessage: null,
    error: null,
    errorCode: null,
    retryCount: 0,
    maxRetries: input.maxRetries ?? 3,
    previousAttemptIds: [],
    draftId: input.draftId ?? null,
    versionIds: [],
    queuedAt: serverTimestamp(),
    startedAt: null,
    completedAt: null,
    durationMs: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // If this job came from a draft, link the draft's lastJobId.
  if (input.draftId) {
    try {
      await updateDraft(organizationId, input.draftId, { lastJobId: ref.id });
    } catch {
      // Non-fatal — the draft may have been deleted.
    }
  }
  return ref.id;
}

// ─── Job: cancel (client-side — marks the doc, processor detects + aborts) ───

/**
 * Cancel a job from the client. Sets status='cancelled'. If the job is
 * currently processing, the server-side processor's onSnapshot listener
 * detects the change and flips the CancelSignal, aborting the provider call.
 */
export async function cancelJobClient(organizationId: string, jobId: string): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, AI_COLLECTIONS.JOBS, jobId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  const currentStatus = data.status as GenJobStatus;
  // Only queued or processing jobs can be cancelled.
  if (currentStatus !== 'queued' && currentStatus !== 'processing') return;
  const startedAt = data.startedAt ? ts(data.startedAt) : null;
  await updateDoc(ref, {
    status: 'cancelled',
    statusReason: 'cancelled_by_user',
    completedAt: serverTimestamp(),
    durationMs: startedAt ? Date.now() - new Date(startedAt).getTime() : null,
    updatedAt: serverTimestamp(),
  });
}

// ─── Version: real-time subscriptions + reads ────────────────────────────────

export function toVersion(id: string, raw: Record<string, unknown>): GenVersion {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    jobId: String(raw.jobId ?? ''),
    draftId: (raw.draftId as string | null) ?? null,
    versionNumber: Number(raw.versionNumber ?? 0),
    output: (raw.output as GenVersion['output']) ?? { content: '', contentType: 'text/plain' },
    input: (raw.input as GenJobInput) ?? { prompt: '' },
    provider: (raw.provider as GenProviderName) ?? 'mock',
    model: String(raw.model ?? ''),
    createdBy: raw.createdBy as GenVersion['createdBy'],
    label: (raw.label as string | null) ?? null,
    createdAt: ts(raw.createdAt),
  };
}

/**
 * Subscribe to all versions for a draft (or a standalone job if no draft).
 */
export function subscribeToVersions(
  organizationId: string,
  draftId: string | null,
  callback: (versions: GenVersion[]) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('versionNumber', 'desc'),
  ];
  if (draftId) {
    constraints.push(where('draftId', '==', draftId));
  }
  const q = query(collection(db, AI_COLLECTIONS.VERSIONS), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const versions = snap.docs.map((d) => toVersion(d.id, d.data() as Record<string, unknown>));
      callback(versions);
    },
    (err) => options?.onError?.(err as Error),
  );
}

export async function listVersions(organizationId: string, draftId?: string | null): Promise<GenVersion[]> {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('versionNumber', 'desc'),
  ];
  if (draftId !== undefined) {
    constraints.push(where('draftId', '==', draftId ?? null));
  }
  const q = query(collection(db, AI_COLLECTIONS.VERSIONS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => toVersion(d.id, d.data() as Record<string, unknown>));
}

/**
 * Update a version's label (for user-facing annotations like 'v2 — punchier hook').
 */
export async function updateVersionLabel(
  organizationId: string,
  versionId: string,
  label: string,
): Promise<void> {
  assertOrg(organizationId);
  await updateDoc(doc(db, AI_COLLECTIONS.VERSIONS, versionId), { label, updatedAt: serverTimestamp() });
}

// ─── Draft: CRUD + real-time ─────────────────────────────────────────────────

export function toDraft(id: string, raw: Record<string, unknown>): GenDraft {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    createdBy: raw.createdBy as GenDraft['createdBy'],
    title: String(raw.title ?? 'Untitled'),
    input: (raw.input as GenJobInput) ?? { prompt: '' },
    assetType: (raw.assetType as GenAssetType) ?? 'text',
    provider: (raw.provider as GenProviderName) ?? 'mock',
    model: String(raw.model ?? ''),
    lastJobId: (raw.lastJobId as string | null) ?? null,
    versionIds: Array.isArray(raw.versionIds) ? (raw.versionIds as string[]) : [],
    archived: Boolean(raw.archived ?? false),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

/**
 * Subscribe to all non-archived drafts for the current org.
 */
export function subscribeToDrafts(
  organizationId: string,
  callback: (drafts: GenDraft[]) => void,
  options?: { includeArchived?: boolean; onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('updatedAt', 'desc'),
  ];
  if (!options?.includeArchived) {
    constraints.push(where('archived', '==', false));
  }
  const q = query(collection(db, AI_COLLECTIONS.DRAFTS), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const drafts = snap.docs.map((d) => toDraft(d.id, d.data() as Record<string, unknown>));
      callback(drafts);
    },
    (err) => options?.onError?.(err as Error),
  );
}

export async function getDraft(organizationId: string, draftId: string): Promise<GenDraft | null> {
  assertOrg(organizationId);
  const snap = await getDoc(doc(db, AI_COLLECTIONS.DRAFTS, draftId));
  if (!snap.exists()) return null;
  return toDraft(snap.id, snap.data() as Record<string, unknown>);
}

export async function createDraft(
  organizationId: string,
  input: CreateDraftInput,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, AI_COLLECTIONS.DRAFTS), {
    organizationId,
    createdBy: input.createdBy,
    title: input.title,
    input: input.input,
    assetType: input.assetType,
    provider: input.provider,
    model: input.model,
    lastJobId: null,
    versionIds: [],
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDraft(
  organizationId: string,
  draftId: string,
  patch: UpdateDraftInput,
): Promise<void> {
  assertOrg(organizationId);
  const { id: _id, organizationId: _orgId, createdAt: _ca, createdBy: _cb, ...rest } = patch as Record<string, unknown>;
  void _id; void _orgId; void _ca; void _cb;
  await updateDoc(doc(db, AI_COLLECTIONS.DRAFTS, draftId), {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveDraft(organizationId: string, draftId: string): Promise<void> {
  assertOrg(organizationId);
  await updateDraft(organizationId, draftId, { archived: true });
}

export async function deleteDraft(organizationId: string, draftId: string): Promise<void> {
  assertOrg(organizationId);
  await deleteDoc(doc(db, AI_COLLECTIONS.DRAFTS, draftId));
}

// ─── Client-side stats computation (for dashboards) ──────────────────────────

/**
 * Compute aggregate pipeline stats from a list of jobs (already fetched via
 * real-time subscription). Recomputed on every jobs change.
 */
export function computeStatsFromJobs(jobs: GenJob[]): GenPipelineStats {
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
    const queuedTime = new Date(job.queuedAt).getTime();
    if (!isNaN(queuedTime) && queuedTime > oneDayAgo) last24hCount++;
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
