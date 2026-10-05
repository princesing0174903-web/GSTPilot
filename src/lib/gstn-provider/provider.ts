// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Provider Interface
//
// IGSTProvider is the SINGLE contract every GSTN backend must implement.
// Today we ship two implementations:
//   • MockGSTProvider          — deterministic simulated responses (default)
//   • FutureOfficialGSTProvider — throws NotImplementedError (placeholder)
//
// All existing pages communicate ONLY through this interface (via the service
// layer). Switching to the official production GST APIs later means changing
// exactly ONE line in registry.ts — no UI or service code changes.
//
// IMPORTANT: This interface is PURE (no Firebase, no Node `crypto` imports) so
// it is safe to import from both client and server code. The implementations
// live in `server/` and are only ever imported by API routes.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ConnectResult,
  GSTNotice,
  GSTProfile,
  GSTReturn,
  GSTReturnType,
  GSTLedger,
  RefreshSessionResult,
  SyncResult,
  VerifyGSTINResult,
  VerifyOTPResult,
} from './types';

/**
 * The decrypted session object passed between the provider and the service layer.
 * The service encrypts this with AES-256-GCM before persisting to Firestore.
 * This type is intentionally NOT exported to client code — only the server
 * sees decrypted sessions.
 */
export interface GSTSession {
  /** The auth token returned by GSTN after OTP verification. */
  authToken: string;
  /** Optional refresh token for session renewal. */
  refreshToken?: string;
  /** The GSTIN this session belongs to. */
  gstin: string;
  /** The GST portal username. */
  username: string;
  /** ISO timestamp when the session expires. */
  expiresAt: string;
  /** Optional session metadata (client id, scope, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * The contract every GSTN backend implements.
 *
 * Every method receives a `GSTSession` (except requestOTP / verifyOTP / verifyGSTIN
 * which initiate or don't require a session) and returns plain data — never
 * Firestore documents. The SERVICE layer is responsible for persisting results
 * to Firestore and encrypting sessions.
 *
 * Implementations MUST throw the typed errors from `./errors.ts` so callers can
 * branch on `instanceof` for proper UX.
 */
export interface IGSTProvider {
  /** Human-readable provider name (e.g. 'Mock', 'Official GSTN'). */
  readonly name: string;
  /** Whether this provider makes real network calls to GSTN. */
  readonly isLive: boolean;

  /**
   * Initiate an OTP flow for a GSTIN + username.
   * Does NOT require a session.
   * Throws: ValidationError, RateLimitError, GSTUnavailableError, TimeoutError.
   */
  requestOTP(gstin: string, username: string): Promise<ConnectResult>;

  /**
   * Verify the OTP and establish a session.
   * Does NOT require a session.
   * Throws: OTPExpiredError, OTPInvalidError, AuthenticationError.
   */
  verifyOTP(gstin: string, username: string, otp: string): Promise<{
    session: GSTSession;
    profile: Partial<GSTProfile>;
  }>;

  /**
   * Refresh an existing session using a refresh token.
   * Throws: SessionExpiredError (if refresh token also expired), AuthenticationError.
   */
  refreshSession(session: GSTSession): Promise<{ session: GSTSession }>;

  /**
   * Disconnect — invalidate the session server-side.
   * Idempotent: should not throw if the session is already invalid.
   */
  disconnect(session: GSTSession): Promise<void>;

  /**
   * Public GSTIN verification — does NOT require a session.
   * Returns the legal name, trade name, status, etc. for any GSTIN.
   * Throws: ValidationError (invalid format), GSTUnavailableError.
   */
  verifyGSTIN(gstin: string): Promise<VerifyGSTINResult>;

  /**
   * Fetch the full GST profile for the authenticated taxpayer.
   * Throws: SessionExpiredError, GSTUnavailableError.
   */
  getProfile(session: GSTSession): Promise<GSTProfile>;

  /**
   * Sync GST returns for a period (default: current + previous).
   * Returns the list of returns fetched (the service persists them).
   * Throws: SessionExpiredError, GSTUnavailableError, TimeoutError.
   */
  syncReturns(
    session: GSTSession,
    options?: { period?: string; returnTypes?: GSTReturnType[] },
  ): Promise<{ returns: GSTReturn[] }>;

  /**
   * Sync GST notices / orders / communications.
   * Throws: SessionExpiredError, GSTUnavailableError.
   */
  syncNotices(session: GSTSession): Promise<{ notices: GSTNotice[] }>;

  /**
   * Sync GST ledgers (Electronic Cash / Credit / Liability).
   * Throws: SessionExpiredError, GSTUnavailableError.
   */
  syncLedgers(session: GSTSession): Promise<{
    cash: GSTLedger;
    credit: GSTLedger;
    liability: GSTLedger;
  }>;

  /**
   * Health check — used by the scheduler to verify the provider is reachable.
   * Returns true if the provider is operational.
   */
  healthCheck(): Promise<boolean>;

  /**
   * File a GST return with GSTN.
   *
   * CRITICAL: This method MUST return a real acknowledgment number (ARN) from
   * GSTN. It must NEVER generate a fake/simulated ARN. If the filing fails for
   * any reason (network, validation, GSTN error), it must throw — the caller
   * must NOT mark the return as "filed" without a real ARN.
   *
   * The Mock provider throws NotImplementedError — you cannot file returns
   * without an official GSTN connection.
   *
   * Throws: SessionExpiredError, GSTUnavailableError, ValidationError, TimeoutError.
   */
  fileReturn(
    session: GSTSession,
    input: FileReturnInput,
  ): Promise<FileReturnResult>;
}

/**
 * Input for filing a return with GSTN.
 */
export interface FileReturnInput {
  /** The return type (GSTR-1, GSTR-3B, etc.) */
  returnType: GSTReturnType;
  /** Financial year, e.g. '2025-26' */
  financialYear: string;
  /** Tax period, e.g. '042025' (MMYYYY) monthly, 'Q1-2025-26' quarterly */
  period: string;
  /** The JSON payload to submit to GSTN */
  payload: Record<string, unknown>;
}

/**
 * Result of a successful return filing — contains the REAL ARN from GSTN.
 */
export interface FileReturnResult {
  /** The acknowledgment reference number (ARN) returned by GSTN. */
  arn: string;
  /** ISO timestamp when GSTN acknowledged the filing. */
  acknowledgedAt: string;
  /** GSTN's status for the filing (e.g. 'Processed', 'Under Processing'). */
  status: string;
}

/**
 * Re-export the result types so consumers can import everything from the
 * provider module without reaching into `./types`.
 */
export type {
  ConnectResult,
  GSTNotice,
  GSTProfile,
  GSTReturn,
  GSTReturnType,
  GSTLedger,
  RefreshSessionResult,
  SyncResult,
  VerifyGSTINResult,
  VerifyOTPResult,
} from './types';
