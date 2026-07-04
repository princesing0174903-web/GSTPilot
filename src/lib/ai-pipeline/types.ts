// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Type Definitions
//
// The single source of truth for the AI generation data model. Every field
// maps 1:1 to a Firestore collection. All types are PURE (no Firebase imports)
// so they are safe to import from both client and server code.
//
// Provider pattern (mirrors the GSTN integration):
//   • IGenProvider (see provider.ts) — the contract every AI backend implements
//   • MockGenProvider — deterministic simulated responses (default)
//   • FutureOfficialGenProvider — placeholder for OpenAI / Anthropic / etc.
//   • Switch to production later by changing ONE env var (AI_PROVIDER=official)
//
// Lifecycle: Queued → Processing → Completed | Failed | Cancelled
//
// Multi-tenant: every document carries `organizationId`. Every query filters
// on it. Users can never access another organization's AI data.
//
// Security: provider API keys are encrypted with AES-256-GCM (server-only key)
// before being stored in Firestore.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Job Status (lifecycle) ──────────────────────────────────────────────────

/**
 * Lifecycle status of a generation job.
 *   queued     — created, waiting for a worker to pick it up
 *   processing — worker is actively generating
 *   completed  — finished successfully, output available
 *   failed     — exhausted retries (or non-retryable error)
 *   cancelled  — user cancelled before completion
 */
export type GenJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Why a job transitioned to its current status (audit trail). */
export type GenJobStatusReason =
  | 'created'           // initial state
  | 'worker_picked_up'  // a worker started processing
  | 'progress'          // progress update from the provider
  | 'success'           // completed successfully
  | 'retry'             // failed but will be retried
  | 'exhausted_retries' // no more retries left
  | 'cancelled_by_user' // user clicked cancel
  | 'cancelled_timeout' // job exceeded max processing time
  | 'error';            // unrecoverable error

// ─── Generation Asset Types ──────────────────────────────────────────────────

/** What kind of content the job generates. Drives provider routing + UI. */
export type GenAssetType =
  | 'text'        // blog post, caption, ad copy, script
  | 'image'       // photo, illustration, graphic
  | 'video'       // short-form video
  | 'audio'       // voiceover, music, podcast intro
  | 'code'        // code snippet, config, schema
  | 'structured'; // JSON / table / structured output

/** The AI provider that will service the job (used for routing). */
export type GenProviderName =
  | 'mock'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'stability'
  | 'runway'
  | 'elevenlabs'
  | 'custom';

// ─── Job Document (ai_jobs collection) ───────────────────────────────────────

/**
 * A single AI generation job.
 * Stored in Firestore `ai_jobs/{jobId}`.
 */
export interface GenJob {
  id: string;
  /** Tenant scope — NEVER null. Every query filters on this. */
  organizationId: string;
  /** User who created the job. */
  createdBy: { uid: string; name: string; email: string };

  status: GenJobStatus;
  statusReason: GenJobStatusReason;

  /** What kind of content to generate. */
  assetType: GenAssetType;
  /** Which provider should service the job. */
  provider: GenProviderName;
  /** The provider's model identifier (e.g. 'gpt-4o', 'claude-3-5-sonnet'). */
  model: string;

  /** The full prompt / input spec sent to the provider. */
  input: GenJobInput;
  /** The generated output (null until the job completes). */
  output: GenJobOutput | null;

  /** Progress 0–100 (null until processing starts). */
  progress: number | null;
  /** Human-readable status message from the provider (e.g. 'Rendering frame 12/30'). */
  progressMessage: string | null;

  /** Error message if status='failed'. */
  error: string | null;
  /** Machine-readable error code for branching. */
  errorCode: string | null;

  /** Number of times this job has been retried. */
  retryCount: number;
  /** Maximum retries allowed (default 3). */
  maxRetries: number;
  /** IDs of previous job attempts (for full audit trail). */
  previousAttemptIds: string[];

  /** ID of the draft this job was generated from (null if created standalone). */
  draftId: string | null;
  /** IDs of versions created from this job's output. */
  versionIds: string[];

  /** ISO timestamp when the job was queued. */
  queuedAt: string;
  /** ISO timestamp when processing started. */
  startedAt: string | null;
  /** ISO timestamp when the job reached a terminal state. */
  completedAt: string | null;
  /** Processing time in milliseconds (null until completed). */
  durationMs: number | null;

  createdAt: string;
  updatedAt: string;
}

/** Input payload sent to the AI provider. */
export interface GenJobInput {
  /** The primary prompt / instruction. */
  prompt: string;
  /** Optional system prompt (sets behavior / persona). */
  systemPrompt?: string;
  /** Negative prompt (for image/video — what to avoid). */
  negativePrompt?: string;
  /** Optional context — previous outputs, brand voice, examples, etc. */
  context?: string;
  /** Generation parameters (temperature, max tokens, dimensions, etc.). */
  parameters?: Record<string, unknown>;
  /** Optional asset references (e.g. reference image for img2img). */
  references?: Array<{
    type: 'image' | 'video' | 'audio' | 'text';
    url: string;
    label?: string;
  }>;
  /** Output format hint (e.g. 'png', 'mp4', 'markdown'). */
  outputFormat?: string;
}

/** Output returned by the AI provider. */
export interface GenJobOutput {
  /** The primary generated content (text, URL to asset, base64, etc.). */
  content: string;
  /** Content type — 'text/plain', 'text/markdown', 'image/png', 'video/mp4', etc. */
  contentType: string;
  /** If the content is binary, where it's stored (Firebase Storage path or URL). */
  assetUrl?: string;
  /** Provider-specific metadata (token counts, seed, generation id, etc.). */
  metadata?: Record<string, unknown>;
  /** Cost of this generation in USD cents (for billing). */
  costUsdCents?: number;
  /** The full provider response (for audit / debugging). */
  rawResponse?: Record<string, unknown>;
}

// ─── Version History (ai_versions collection) ────────────────────────────────

/**
 * A snapshot of a job's output — created every time a job completes or a user
 * manually saves a version. Enables diffing, restoration, and full audit trail.
 * Stored in Firestore `ai_versions/{versionId}`.
 */
export interface GenVersion {
  id: string;
  organizationId: string;
  /** The job that produced this version. */
  jobId: string;
  /** Optional draft this version belongs to (for grouping). */
  draftId: string | null;
  /** Monotonically increasing version number within the draft (1, 2, 3...). */
  versionNumber: number;
  /** Snapshot of the job output at this version. */
  output: GenJobOutput;
  /** The input that produced this output (snapshot for reproducibility). */
  input: GenJobInput;
  /** Provider + model that generated this version. */
  provider: GenProviderName;
  model: string;
  /** User who created this version. */
  createdBy: { uid: string; name: string; email: string };
  /** Optional label (e.g. 'v2 — punchier hook'). */
  label: string | null;
  createdAt: string;
}

// ─── Drafts (ai_drafts collection) ───────────────────────────────────────────

/**
 * A draft — autosaved input state before a job is queued. Lets users resume
 * half-finished prompts across sessions / devices.
 * Stored in Firestore `ai_drafts/{draftId}`.
 */
export interface GenDraft {
  id: string;
  organizationId: string;
  /** User who owns this draft. */
  createdBy: { uid: string; name: string; email: string };
  /** Title (auto-derived from the prompt's first line, or 'Untitled'). */
  title: string;
  /** The draft input state — same shape as GenJobInput. */
  input: GenJobInput;
  /** Asset type for this draft. */
  assetType: GenAssetType;
  /** Provider + model selected for this draft. */
  provider: GenProviderName;
  model: string;
  /** ID of the most recent job queued from this draft (for quick resume). */
  lastJobId: string | null;
  /** IDs of all versions produced from this draft. */
  versionIds: string[];
  /** Whether the draft has been archived (soft delete). */
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Service Input / Result Types ─────────────────────────────────────────────

export interface CreateJobInput {
  organizationId: string;
  createdBy: { uid: string; name: string; email: string };
  assetType: GenAssetType;
  provider: GenProviderName;
  model: string;
  input: GenJobInput;
  draftId?: string | null;
  maxRetries?: number;
}

export interface UpdateJobInput {
  status?: GenJobStatus;
  statusReason?: GenJobStatusReason;
  progress?: number | null;
  progressMessage?: string | null;
  output?: GenJobOutput | null;
  error?: string | null;
  errorCode?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
}

export interface CreateDraftInput {
  organizationId: string;
  createdBy: { uid: string; name: string; email: string };
  title: string;
  input: GenJobInput;
  assetType: GenAssetType;
  provider: GenProviderName;
  model: string;
}

export interface UpdateDraftInput {
  title?: string;
  input?: GenJobInput;
  assetType?: GenAssetType;
  provider?: GenProviderName;
  model?: string;
  lastJobId?: string | null;
  archived?: boolean;
}

// ─── Aggregated Stats ────────────────────────────────────────────────────────

/**
 * Aggregated pipeline stats — computed from real-time Firestore data.
 * Returned by `useGenerationStats()`.
 */
export interface GenPipelineStats {
  total: number;
  byStatus: Record<GenJobStatus, number>;
  byAssetType: Record<GenAssetType, number>;
  byProvider: Record<string, number>;
  /** Average processing time in ms (for completed jobs). */
  avgDurationMs: number;
  /** Total cost in USD cents (sum of completed jobs). */
  totalCostUsdCents: number;
  /** Success rate (0–1). */
  successRate: number;
  /** Number of jobs queued in the last 24h. */
  last24hCount: number;
}
