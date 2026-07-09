// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Error Hierarchy (CLIENT-SAFE)
//
// A typed error hierarchy so callers can branch on `instanceof` for proper UX.
// All errors are PURE classes (no Firebase / node:crypto imports) — safe for
// client + server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ERPProviderName } from './types';

/** Base class for every ERP error. Carries a code + HTTP-style statusCode. */
export class ERPError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      retryable?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ERPError';
    this.code = options.code ?? 'ERP_ERROR';
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
    // Restore prototype chain (needed when targeting ES5 with extends Error)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Credentials / token rejected by the ERP. */
export class AuthRejectedError extends ERPError {
  constructor(message = 'ERP credentials were rejected.') {
    super(message, { code: 'AUTH_REJECTED', statusCode: 401 });
    this.name = 'AuthRejectedError';
  }
}

/** Access/refresh token expired — user must re-authenticate. */
export class TokenExpiredError extends ERPError {
  constructor(message = 'ERP session has expired. Please reconnect.') {
    super(message, { code: 'TOKEN_EXPIRED', statusCode: 401 });
    this.name = 'TokenExpiredError';
  }
}

/** The ERP server / cloud API is unreachable. */
export class ERPUnavailableError extends ERPError {
  constructor(provider: ERPProviderName, message?: string) {
    super(
      message ?? `${provider} is currently unavailable. Please try again in a moment.`,
      { code: 'ERP_UNAVAILABLE', statusCode: 502, retryable: true },
    );
    this.name = 'ERPUnavailableError';
  }
}

/** Rate limited by the ERP API. */
export class RateLimitError extends ERPError {
  constructor(message = 'ERP rate limit reached. Please slow down.') {
    super(message, { code: 'RATE_LIMIT', statusCode: 429, retryable: true });
    this.name = 'RateLimitError';
  }
}

/** Request timed out. */
export class TimeoutError extends ERPError {
  constructor(message = 'The ERP request timed out.') {
    super(message, { code: 'TIMEOUT', statusCode: 504, retryable: true });
    this.name = 'TimeoutError';
  }
}

/** Missing or invalid input. */
export class ValidationError extends ERPError {
  constructor(message: string) {
    super(message, { code: 'VALIDATION', statusCode: 400 });
    this.name = 'ValidationError';
  }
}

/** No ERP connection exists for this org. */
export class NotConnectedError extends ERPError {
  constructor(message = 'No ERP connection found. Please connect first.') {
    super(message, { code: 'NOT_CONNECTED', statusCode: 409 });
    this.name = 'NotConnectedError';
  }
}

/** Sync failed mid-way (partial data). */
export class SyncFailedError extends ERPError {
  readonly partialResult: unknown;
  constructor(message: string, partialResult?: unknown) {
    super(message, {
      code: 'SYNC_FAILED',
      statusCode: 502,
      retryable: true,
    });
    this.name = 'SyncFailedError';
    this.partialResult = partialResult;
  }
}

/** A conflict was detected during sync (duplicate / modified record). */
export class ConflictError extends ERPError {
  readonly conflictType: 'duplicate' | 'modified' | 'deleted' | 'version';
  readonly entityId: string;
  constructor(
    conflictType: 'duplicate' | 'modified' | 'deleted' | 'version',
    entityId: string,
    message?: string,
  ) {
    super(message ?? `Conflict (${conflictType}) detected for record ${entityId}.`, {
      code: 'CONFLICT',
      statusCode: 409,
    });
    this.name = 'ConflictError';
    this.conflictType = conflictType;
    this.entityId = entityId;
  }
}

/** The provider method is not yet implemented (future providers). */
export class NotImplementedError extends ERPError {
  constructor(provider: string, method: string) {
    super(
      `${provider}.${method} is not implemented yet. This provider is a placeholder — ` +
        `set ERP_PROVIDER to a live provider or implement the real integration.`,
      { code: 'NOT_IMPLEMENTED', statusCode: 501 },
    );
    this.name = 'NotImplementedError';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert any error into a user-friendly message. */
export function friendlyERPError(err: unknown): string {
  if (err instanceof ERPError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred while contacting the ERP.';
}

/** Whether an error is worth retrying (network / rate limit / timeout). */
export function isRetryableERPError(err: unknown): boolean {
  if (err instanceof ERPError) return err.retryable;
  return false;
}
