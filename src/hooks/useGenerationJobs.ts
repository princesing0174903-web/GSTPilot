'use client';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — useGenerationJobs() Hook
//
// The SINGLE hook every component uses to interact with the AI generation
// pipeline. Mirrors the useInvoices() pattern:
//   • LIST jobs for the current org (real-time, org-scoped via onSnapshot)
//   • CREATE a new job (writes a 'queued' doc → processor picks it up)
//   • CANCEL an active job (sets status='cancelled'; processor aborts)
//   • RETRY a failed job (resets to 'queued' OR creates a fresh attempt)
//   • LIST drafts + autosave drafts
//   • LIST versions (version history per draft/job)
//   • STATS — recomputed on every jobs change
//
// All tenant scoping is automatic — components never touch `organizationId`.
// If the user has no organization yet, every operation no-ops safely.
//
// OFFLINE FALLBACK: when the Firestore backend is unreachable (e.g. sandbox
// preview without network egress), the hook transparently switches to an
// in-memory simulation that exercises the EXACT same lifecycle (queued →
// processing → completed/failed, with progress, cancel, retry, versions).
// A `previewMode` flag is exposed so the UI can show a subtle badge. This
// fallback NEVER touches localStorage — it's purely in-memory and resets on
// refresh. In production (with Firestore reachable), the real database is used
// exclusively.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToJobs,
  createJob as svcCreateJob,
  cancelJobClient as svcCancelJob,
  subscribeToDrafts,
  createDraft as svcCreateDraft,
  updateDraft as svcUpdateDraft,
  archiveDraft as svcArchiveDraft,
  deleteDraft as svcDeleteDraft,
  subscribeToVersions,
  computeStatsFromJobs,
  type GenJob,
  type GenJobStatus,
  type GenAssetType,
  type GenProviderName,
  type GenJobInput,
  type GenVersion,
  type GenDraft,
  type GenPipelineStats,
  type CreateJobInput,
  type CreateDraftInput,
  type UpdateDraftInput,
} from '@/lib/ai-pipeline';

// ─── Hook return type ────────────────────────────────────────────────────────

export interface UseGenerationJobsResult {
  /** All jobs for the current org (real-time, newest first). */
  jobs: GenJob[];
  /** Drafts (non-archived) for the current org. */
  drafts: GenDraft[];
  /** Versions for the current org (or filtered by draftId). */
  versions: GenVersion[];
  /** Aggregated stats — recomputed whenever jobs change. */
  stats: GenPipelineStats;
  loading: boolean;
  error: string | null;
  /** True while a mutation (create/cancel/retry) is in-flight. */
  saving: boolean;
  /** True when running on the in-memory simulation (Firestore unreachable). */
  previewMode: boolean;

  /** Queue a new generation job. Returns the new job id (or null on failure). */
  createJob: (input: {
    assetType: GenAssetType;
    provider?: GenProviderName;
    model?: string;
    input: GenJobInput;
    draftId?: string | null;
    maxRetries?: number;
  }) => Promise<string | null>;
  /** Cancel a queued or processing job. */
  cancelJob: (jobId: string) => Promise<boolean>;
  /** Retry a failed or cancelled job. freshAttempt=true creates a new job. */
  retryJob: (jobId: string, freshAttempt?: boolean) => Promise<string | null>;
  /** Get a single job by id (from local state). */
  getJob: (jobId: string) => GenJob | undefined;

  /** Drafts: create / autosave / archive / delete */
  createDraft: (input: Omit<CreateDraftInput, 'organizationId' | 'createdBy'>) => Promise<string | null>;
  autosaveDraft: (draftId: string, patch: UpdateDraftInput) => Promise<boolean>;
  archiveDraft: (draftId: string) => Promise<boolean>;
  deleteDraft: (draftId: string) => Promise<boolean>;

  /** Retry the last failed subscription. */
  retry: () => void;
}

// ─── In-memory simulation (offline fallback) ─────────────────────────────────
//
// Activates ONLY when the Firestore onSnapshot subscription errors (e.g. the
// sandbox can't reach Firestore). Exercises the full lifecycle locally so the
// UX is fully demonstrable. NEVER persists — resets on refresh.

const DEFAULT_MODELS: Record<GenAssetType, string> = {
  text: 'mock-text-pro',
  image: 'mock-image-v2',
  video: 'mock-video-1',
  audio: 'mock-audio-v1',
  code: 'mock-code-pro',
  structured: 'mock-structured-v1',
};

const PROCESSING_MS: Record<GenAssetType, [number, number]> = {
  text: [1200, 2500],
  code: [1500, 3000],
  structured: [1000, 2200],
  image: [2500, 5000],
  audio: [3000, 6000],
  video: [4000, 8000],
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function genMockContent(assetType: GenAssetType, input: GenJobInput): { content: string; contentType: string } {
  const prompt = input.prompt.trim();
  switch (assetType) {
    case 'text': {
      const body = `Here's a take on "${prompt.slice(0, 60)}":\n\nThe fundamentals matter more than the buzz. Strip away the hype and you find a simple truth: consistency beats intensity, every single time.\n\nThe trap is treating this as a one-time decision. It isn't. It's a system — a daily practice of small choices that compound into outsized results.\n\nThat's the playbook. Now go execute.`;
      return { content: body, contentType: 'text/markdown' };
    }
    case 'code':
      return {
        content: `// Generated for: ${prompt}\nexport function solve(input: string): string {\n  return input.split('').reverse().join('');\n}`,
        contentType: 'text/plain',
      };
    case 'structured':
      return {
        content: JSON.stringify({ prompt, generated_at: new Date().toISOString(), items: [{ id: 1, label: 'Alpha', score: 0.92 }] }, null, 2),
        contentType: 'application/json',
      };
    case 'image': {
      const hue1 = randInt(0, 360);
      const hue2 = (hue1 + 80) % 360;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue1},70%,60%)"/><stop offset="100%" stop-color="hsl(${hue2},70%,40%)"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/><text x="256" y="256" font-family="sans-serif" font-size="20" fill="white" text-anchor="middle" opacity="0.85">${prompt.slice(0, 40)}</text></svg>`;
      return { content: `data:image/svg+xml;base64,${btoa(svg)}`, contentType: 'image/svg+xml' };
    }
    case 'audio':
      return { content: 'mock-audio://silent', contentType: 'audio/wav' };
    case 'video':
      return { content: `mock-video://${genId('vid')}`, contentType: 'video/mp4' };
  }
}

interface SimState {
  jobs: GenJob[];
  drafts: GenDraft[];
  versions: GenVersion[];
}

// Module-level simulation store (shared across all hook instances in the session)
const simStore: SimState = { jobs: [], drafts: [], versions: [] };
const simListeners: Set<() => void> = new Set();

function notifySimListeners() {
  simListeners.forEach((fn) => fn());
}

function simCreateJob(
  organizationId: string,
  createdBy: { uid: string; name: string; email: string },
  input: { assetType: GenAssetType; provider?: GenProviderName; model?: string; input: GenJobInput; draftId?: string | null; maxRetries?: number },
): string {
  const id = genId('job');
  const now = new Date().toISOString();
  const job: GenJob = {
    id,
    organizationId,
    createdBy,
    status: 'queued',
    statusReason: 'created',
    assetType: input.assetType,
    provider: input.provider ?? 'mock',
    model: input.model ?? DEFAULT_MODELS[input.assetType],
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
    queuedAt: now,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    createdAt: now,
    updatedAt: now,
  };
  simStore.jobs = [job, ...simStore.jobs];
  notifySimListeners();
  // Kick off simulated processing.
  simulateProcessing(id);
  return id;
}

function simulateProcessing(jobId: string) {
  const job = simStore.jobs.find((j) => j.id === jobId);
  if (!job) return;
  const startTime = Date.now();
  const [minMs, maxMs] = PROCESSING_MS[job.assetType];
  const totalMs = randInt(minMs, maxMs);
  const steps = job.assetType === 'text' || job.assetType === 'code' || job.assetType === 'structured' ? 1 : 4;
  const stepMs = totalMs / steps;

  // Mark processing.
  const updateJob = (patch: Partial<GenJob>) => {
    simStore.jobs = simStore.jobs.map((j) => (j.id === jobId ? { ...j, ...patch, updatedAt: new Date().toISOString() } : j));
    notifySimListeners();
  };

  updateJob({ status: 'processing', statusReason: 'worker_picked_up', startedAt: new Date().toISOString(), progress: 0, progressMessage: 'Starting generation...' });

  let step = 0;
  const tick = () => {
    const current = simStore.jobs.find((j) => j.id === jobId);
    if (!current || current.status === 'cancelled') return;
    step++;
    if (step <= steps) {
      const percent = Math.round((step / steps) * 100);
      const messages = ['Initializing model...', 'Processing prompt...', 'Generating content...', 'Refining output...', 'Finalizing...'];
      updateJob({ progress: percent, progressMessage: messages[Math.min(step - 1, messages.length - 1)], statusReason: 'progress' });
      setTimeout(tick, stepMs);
    } else {
      // Complete.
      const { content, contentType } = genMockContent(current.assetType, current.input);
      const versionId = genId('ver');
      const version: GenVersion = {
        id: versionId,
        organizationId: current.organizationId,
        jobId: current.id,
        draftId: current.draftId,
        versionNumber: simStore.versions.filter((v) => v.draftId === current.draftId).length + 1,
        output: { content, contentType, metadata: { provider: 'mock', model: current.model } },
        input: current.input,
        provider: current.provider,
        model: current.model,
        createdBy: current.createdBy,
        label: null,
        createdAt: new Date().toISOString(),
      };
      simStore.versions = [version, ...simStore.versions];
      updateJob({
        status: 'completed',
        statusReason: 'success',
        progress: 100,
        progressMessage: 'Completed',
        output: version.output,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        versionIds: [...current.versionIds, versionId],
      });
    }
  };
  setTimeout(tick, stepMs);
}

function simCancelJob(jobId: string): boolean {
  const job = simStore.jobs.find((j) => j.id === jobId);
  if (!job || (job.status !== 'queued' && job.status !== 'processing')) return false;
  simStore.jobs = simStore.jobs.map((j) =>
    j.id === jobId
      ? { ...j, status: 'cancelled', statusReason: 'cancelled_by_user', completedAt: new Date().toISOString(), durationMs: j.startedAt ? Date.now() - new Date(j.startedAt).getTime() : null, updatedAt: new Date().toISOString() }
      : j,
  );
  notifySimListeners();
  return true;
}

function simRetryJob(jobId: string, freshAttempt: boolean): string | null {
  const job = simStore.jobs.find((j) => j.id === jobId);
  if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) return null;
  if (freshAttempt) {
    return simCreateJob(job.organizationId, job.createdBy, {
      assetType: job.assetType,
      provider: job.provider,
      model: job.model,
      input: job.input,
      draftId: job.draftId,
      maxRetries: job.maxRetries,
    });
  }
  // Reset existing.
  simStore.jobs = simStore.jobs.map((j) =>
    j.id === jobId
      ? { ...j, status: 'queued', statusReason: 'retry', error: null, errorCode: null, progress: null, progressMessage: null, startedAt: null, completedAt: null, durationMs: null, retryCount: j.retryCount + 1, updatedAt: new Date().toISOString() }
      : j,
  );
  notifySimListeners();
  simulateProcessing(jobId);
  return jobId;
}

function simCreateDraft(
  organizationId: string,
  createdBy: { uid: string; name: string; email: string },
  input: { title: string; input: GenJobInput; assetType: GenAssetType; provider: GenProviderName; model: string },
): string {
  const id = genId('draft');
  const now = new Date().toISOString();
  const draft: GenDraft = {
    id,
    organizationId,
    createdBy,
    title: input.title,
    input: input.input,
    assetType: input.assetType,
    provider: input.provider,
    model: input.model,
    lastJobId: null,
    versionIds: [],
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  simStore.drafts = [draft, ...simStore.drafts];
  notifySimListeners();
  return id;
}

function simUpdateDraft(draftId: string, patch: UpdateDraftInput): boolean {
  simStore.drafts = simStore.drafts.map((d) => (d.id === draftId ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d));
  notifySimListeners();
  return true;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useGenerationJobs(draftIdFilter?: string | null): UseGenerationJobsResult {
  const { organization, profile, isPreviewMode } = useOrg();
  const { user } = useAuth();
  const orgId = organization?.id ?? null;

  const [jobs, setJobs] = useState<GenJob[]>([]);
  const [drafts, setDrafts] = useState<GenDraft[]>([]);
  const [versions, setVersions] = useState<GenVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const unsubJobsRef = useRef<(() => void) | null>(null);
  const unsubDraftsRef = useRef<(() => void) | null>(null);
  const unsubVersionsRef = useRef<(() => void) | null>(null);
  const simUnsubRef = useRef<(() => void) | null>(null);

  // ─── Subscribe to jobs (real Firestore, with offline fallback) ──────────────
  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setJobs([]);
      setDrafts([]);
      setVersions([]);
      setLoading(false);
      setPreviewMode(true);
      return;
    }

    let cancelled = false;
    let fellBack = false;

    const createdBy = {
      uid: user?.id ?? profile?.uid ?? '',
      name: profile?.displayName ?? user?.name ?? 'Unknown',
      email: profile?.email ?? user?.email ?? '',
    };

    // Try real Firestore first.
    try {
      unsubJobsRef.current = subscribeToJobs(
        orgId,
        (nextJobs) => {
          if (cancelled) return;
          setJobs(nextJobs);
          setPreviewMode(false);
          setLoading(false);
          setError(null);
        },
        {
          onError: (err) => {
            if (cancelled || fellBack) return;
            fellBack = true;
            // Firestore unreachable — switch to in-memory simulation.
            console.warn('[useGenerationJobs] Firestore unreachable, switching to preview simulation:', err.message);
            setPreviewMode(true);
            setError(null);
            setLoading(false);
            // Clean up the failed Firestore sub.
            try { unsubJobsRef.current?.(); } catch { /* ignore */ }
            unsubJobsRef.current = null;
            // Subscribe to the sim store.
            const syncFromSim = () => {
              setJobs([...simStore.jobs].filter((j) => j.organizationId === orgId));
            };
            syncFromSim();
            simListeners.add(syncFromSim);
            simUnsubRef.current = () => simListeners.delete(syncFromSim);
          },
        },
      );
    } catch (err) {
      // Synchronous failure (e.g. no Firebase config) — fallback immediately.
      fellBack = true;
      setPreviewMode(true);
      setLoading(false);
      const syncFromSim = () => setJobs([...simStore.jobs].filter((j) => j.organizationId === orgId));
      syncFromSim();
      simListeners.add(syncFromSim);
      simUnsubRef.current = () => simListeners.delete(syncFromSim);
    }

    return () => {
      cancelled = true;
      try { unsubJobsRef.current?.(); } catch { /* ignore */ }
      try { simUnsubRef.current?.(); } catch { /* ignore */ }
      unsubJobsRef.current = null;
      simUnsubRef.current = null;
    };
  }, [orgId, isPreviewMode, retryNonce]);

  // ─── Subscribe to drafts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setDrafts([]);
      return;
    }
    if (previewMode) {
      const sync = () => setDrafts([...simStore.drafts].filter((d) => d.organizationId === orgId && !d.archived));
      sync();
      simListeners.add(sync);
      return () => { simListeners.delete(sync); };
    }
    try {
      unsubDraftsRef.current = subscribeToDrafts(orgId, (next) => setDrafts(next), {
        onError: () => setDrafts([]),
      });
      return () => { try { unsubDraftsRef.current?.(); } catch { /* ignore */ } };
    } catch {
      setDrafts([]);
      return;
    }
  }, [orgId, isPreviewMode, previewMode, retryNonce]);

  // ─── Subscribe to versions ──────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setVersions([]);
      return;
    }
    if (previewMode) {
      const sync = () => setVersions([...simStore.versions].filter((v) => v.organizationId === orgId && (draftIdFilter === undefined || draftIdFilter === null || v.draftId === draftIdFilter)));
      sync();
      simListeners.add(sync);
      return () => { simListeners.delete(sync); };
    }
    try {
      unsubVersionsRef.current = subscribeToVersions(orgId, draftIdFilter ?? null, (next) => setVersions(next), {
        onError: () => setVersions([]),
      });
      return () => { try { unsubVersionsRef.current?.(); } catch { /* ignore */ } };
    } catch {
      setVersions([]);
      return;
    }
  }, [orgId, isPreviewMode, previewMode, draftIdFilter, retryNonce]);

  // ─── Stats (recomputed on every jobs change) ────────────────────────────────
  const stats = useMemo(() => computeStatsFromJobs(jobs), [jobs]);

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const createdBy = useMemo(() => ({
    uid: user?.id ?? profile?.uid ?? '',
    name: profile?.displayName ?? user?.name ?? 'Unknown',
    email: profile?.email ?? user?.email ?? '',
  }), [user, profile]);

  const createJob = useCallback(
    async (input: {
      assetType: GenAssetType;
      provider?: GenProviderName;
      model?: string;
      input: GenJobInput;
      draftId?: string | null;
      maxRetries?: number;
    }): Promise<string | null> => {
      if (!orgId) return null;
      setSaving(true);
      try {
        if (previewMode) {
          return simCreateJob(orgId, createdBy, input);
        }
        const jobInput: CreateJobInput = {
          organizationId: orgId,
          createdBy,
          assetType: input.assetType,
          provider: input.provider ?? 'mock',
          model: input.model ?? DEFAULT_MODELS[input.assetType],
          input: input.input,
          draftId: input.draftId ?? null,
          maxRetries: input.maxRetries,
        };
        const id = await svcCreateJob(orgId, jobInput);
        // Fire-and-forget: nudge the server processor to pick it up immediately.
        try {
          await fetch('/api/ai/jobs/process', { method: 'POST' });
        } catch { /* non-fatal — the background tick will catch it */ }
        return id;
      } catch (err) {
        console.error('[useGenerationJobs] createJob failed:', err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId, createdBy, previewMode],
  );

  const cancelJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      try {
        if (previewMode) {
          return simCancelJob(jobId);
        }
        await svcCancelJob(orgId, jobId);
        return true;
      } catch (err) {
        console.error('[useGenerationJobs] cancelJob failed:', err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, previewMode],
  );

  const retryJob = useCallback(
    async (jobId: string, freshAttempt = false): Promise<string | null> => {
      if (!orgId) return null;
      setSaving(true);
      try {
        if (previewMode) {
          return simRetryJob(jobId, freshAttempt);
        }
        const res = await fetch(`/api/ai/jobs/${jobId}/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freshAttempt }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.jobId ?? null;
      } catch (err) {
        console.error('[useGenerationJobs] retryJob failed:', err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId, previewMode],
  );

  const getJob = useCallback((jobId: string) => jobs.find((j) => j.id === jobId), [jobs]);

  const createDraft = useCallback(
    async (input: Omit<CreateDraftInput, 'organizationId' | 'createdBy'>): Promise<string | null> => {
      if (!orgId) return null;
      setSaving(true);
      try {
        if (previewMode) {
          return simCreateDraft(orgId, createdBy, input);
        }
        return await svcCreateDraft(orgId, { ...input, organizationId: orgId, createdBy });
      } catch (err) {
        console.error('[useGenerationJobs] createDraft failed:', err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId, createdBy, previewMode],
  );

  const autosaveDraft = useCallback(
    async (draftId: string, patch: UpdateDraftInput): Promise<boolean> => {
      if (!orgId) return false;
      if (previewMode) {
        return simUpdateDraft(draftId, patch);
      }
      try {
        await svcUpdateDraft(orgId, draftId, patch);
        return true;
      } catch (err) {
        console.error('[useGenerationJobs] autosaveDraft failed:', err);
        return false;
      }
    },
    [orgId, previewMode],
  );

  const archiveDraft = useCallback(
    async (draftId: string): Promise<boolean> => {
      if (!orgId) return false;
      if (previewMode) {
        return simUpdateDraft(draftId, { archived: true });
      }
      try {
        await svcArchiveDraft(orgId, draftId);
        return true;
      } catch {
        return false;
      }
    },
    [orgId, previewMode],
  );

  const deleteDraft = useCallback(
    async (draftId: string): Promise<boolean> => {
      if (!orgId) return false;
      if (previewMode) {
        simStore.drafts = simStore.drafts.filter((d) => d.id !== draftId);
        notifySimListeners();
        return true;
      }
      try {
        await svcDeleteDraft(orgId, draftId);
        return true;
      } catch {
        return false;
      }
    },
    [orgId, previewMode],
  );

  const retry = useCallback(() => setRetryNonce((n) => n + 1), []);

  return {
    jobs,
    drafts,
    versions,
    stats,
    loading,
    error,
    saving,
    previewMode,
    createJob,
    cancelJob,
    retryJob,
    getJob,
    createDraft,
    autosaveDraft,
    archiveDraft,
    deleteDraft,
    retry,
  };
}

// ─── Helper: format job status for display ───────────────────────────────────

export function statusLabel(status: GenJobStatus): string {
  switch (status) {
    case 'queued': return 'Queued';
    case 'processing': return 'Processing';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
  }
}

export function statusColor(status: GenJobStatus): string {
  switch (status) {
    case 'queued': return 'text-amber-400';
    case 'processing': return 'text-sky-400';
    case 'completed': return 'text-emerald-400';
    case 'failed': return 'text-red-400';
    case 'cancelled': return 'text-zinc-400';
  }
}
