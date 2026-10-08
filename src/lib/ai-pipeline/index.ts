// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Production Pipeline™ — Barrel Export
//
// The SINGLE import surface for the AI generation pipeline.
//
//   import {
//     type GenJob,
//     useGenerationJobs,        // hook (client)
//     computeStatsFromJobs,     // client-side stats
//     subscribeToJobs,          // client-side real-time sub
//     createJob,                // client-side Firestore write
//     cancelJobClient,          // client-side cancel
//   } from '@/lib/ai-pipeline';
//
// Architecture (mirrors the GSTN + invoice-engine provider pattern):
//
//   ┌─ types.ts         (PURE — safe for client + server)
//   ├─ errors.ts        (PURE — typed error hierarchy)
//   ├─ provider.ts      (PURE — IGenProvider interface)
//   ├─ service.ts       (CLIENT — Firestore CRUD + real-time subs)
//   └─ server/          (SERVER-ONLY — provider impls + processor)
//       ├─ crypto.ts          (AES-256-GCM key encryption)
//       ├─ mock-provider.ts   (deterministic simulated AI — default)
//       ├─ official-provider.ts (placeholder — throws NotImplementedError)
//       ├─ registry.ts        (getGenProvider() — ONE env var switch)
//       └─ processor.ts       (background job executor)
//
// Lifecycle: Queued → Processing → (Completed | Failed | Cancelled)
//
// Multi-tenant: every document carries `organizationId`; every query filters on
// it. Users can never access another organization's AI data.
//
// Switch to production AI later: set AI_PROVIDER=official + configure API keys.
// Zero service, hook, or UI code changes.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types (PURE — safe everywhere) ──────────────────────────────────────────
export type {
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
  UpdateJobInput,
  CreateDraftInput,
  UpdateDraftInput,
  GenPipelineStats,
} from './types';

// ─── Errors (PURE — safe everywhere) ─────────────────────────────────────────
export {
  GenError,
  RateLimitError,
  ProviderUnavailableError,
  TimeoutError,
  InvalidInputError,
  AuthenticationError,
  ValidationError,
  JobCancelledError,
  IllegalStateTransitionError,
  JobNotFoundError,
  NotImplementedError,
  friendlyGenError,
  isRetryableGenError,
} from './errors';

// ─── Provider interface (PURE — safe everywhere) ─────────────────────────────
export type {
  IGenProvider,
  ProgressCallback,
  CancelSignal,
} from './provider';

// ─── Client-safe Firestore service (CLIENT only — imports firebase/firestore) ─
export {
  AI_COLLECTIONS,
  toJob,
  toVersion,
  toDraft,
  subscribeToJobs,
  subscribeToJob,
  getJob,
  listJobs,
  createJob,
  cancelJobClient,
  subscribeToVersions,
  listVersions,
  updateVersionLabel,
  subscribeToDrafts,
  getDraft,
  createDraft,
  updateDraft,
  archiveDraft,
  deleteDraft,
  computeStatsFromJobs,
} from './service';
