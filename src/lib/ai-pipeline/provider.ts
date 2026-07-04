// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Provider Interface
//
// IGenProvider is the SINGLE contract every AI backend must implement.
// Today we ship two implementations:
//   • MockGenProvider          — deterministic simulated responses (default)
//   • FutureOfficialGenProvider — throws NotImplementedError (placeholder)
//
// All existing pages communicate ONLY through this interface (via the service
// layer). Switching to production AI later means changing exactly ONE env var
// (AI_PROVIDER=official) — no UI or service code changes.
//
// IMPORTANT: This interface is PURE (no Firebase, no Node `crypto` imports) so
// it is safe to import from both client and server code. The implementations
// live in `server/` and are only ever imported by API routes / the background
// processor.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  GenAssetType,
  GenJobInput,
  GenJobOutput,
  GenJobStatusReason,
  GenProviderName,
} from './types';

/**
 * Progress callback — called by the provider during long-running generations
 * (image / video). The processor persists each progress update to Firestore
 * so the client sees real-time progress via onSnapshot.
 */
export type ProgressCallback = (progress: {
  /** 0–100. */
  percent: number;
  /** Human-readable status message. */
  message?: string;
  /** Optional partial output (for streaming text generations). */
  partial?: string;
}) => void;

/**
 * A cancellation signal — passed to every provider call. The processor sets
 * `cancelled = true` when a user clicks Cancel; the provider MUST poll this
 * flag and abort the generation promptly.
 */
export interface CancelSignal {
  /** Read by the provider — if true, abort ASAP. */
  cancelled: boolean;
  /** Optional event the provider can listen to (for native fetch abort). */
  onCancel?: () => void;
}

/**
 * The contract every AI provider implements.
 *
 * Every method receives the input + a CancelSignal + a ProgressCallback.
 * Implementations MUST:
 *   • Poll `cancelSignal.cancelled` periodically and abort if true
 *   • Call `onProgress` with meaningful updates for long generations
 *   • Throw the typed errors from `./errors.ts` so callers can branch on
 *     `instanceof` for proper UX
 */
export interface IGenProvider {
  /** Human-readable provider name. */
  readonly name: string;
  /** The GenProviderName enum value. */
  readonly providerName: GenProviderName;
  /** Whether this provider makes real network calls. */
  readonly isLive: boolean;
  /** Asset types this provider supports. */
  readonly supportedAssetTypes: GenAssetType[];
  /** Default models for each supported asset type. */
  readonly defaultModels: Partial<Record<GenAssetType, string>>;

  /**
   * Generate content. The single entry point for all generation work.
   * Returns the final output. Implementations should call `onProgress` for
   * long-running generations.
   *
   * Throws: RateLimitError, ProviderUnavailableError, TimeoutError,
   *         InvalidInputError, AuthenticationError.
   */
  generate(
    input: GenJobInput,
    options: {
      assetType: GenAssetType;
      model: string;
      cancelSignal: CancelSignal;
      onProgress?: ProgressCallback;
    },
  ): Promise<{ output: GenJobOutput; statusReason: GenJobStatusReason }>;

  /**
   * Health check — used by the background processor to verify the provider
   * is reachable before picking up jobs.
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Re-export the result types so consumers can import everything from the
 * provider module without reaching into `./types`.
 */
export type {
  GenAssetType,
  GenJobInput,
  GenJobOutput,
  GenJobStatusReason,
  GenProviderName,
} from './types';
