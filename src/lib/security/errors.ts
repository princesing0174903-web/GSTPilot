// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Enterprise Security Layer: Error Hierarchy
//
// A typed error hierarchy for the security engine. Every error carries:
//   • `code`         — a stable machine-readable string (for client-side
//                       branching + audit logs).
//   • `statusCode`   — the HTTP status to return when the error reaches an
//                       API route handler.
//   • `details`      — an optional bag of structured context (role, resource,
//                       orgId, etc.) for audit logs and debugging.
//
// `friendlySecurityError(err)` maps any error (security or otherwise) to a
// short, human-safe message suitable for surfacing in toasts.
//
// Hierarchy:
//   SecurityError (base)
//     ├── AuthenticationError       (401)  — missing/invalid/expired token
//     ├── AuthorizationError        (403)  — RBAC or ABAC denied
//     ├── OrganizationNotFoundError (404)  — org doc doesn't exist
//     ├── SubscriptionInactiveError (402)  — sub suspended/canceled
//     ├── RateLimitError            (429)  — too many requests
//     └── CSRFError                 (403)  — missing/invalid CSRF token
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Base Class ──────────────────────────────────────────────────────────────

export interface SecurityErrorDetails {
  [key: string]: unknown;
  code?: string;
  resource?: string;
  action?: string;
  role?: string;
  orgId?: string;
  uid?: string;
  retryAfter?: number;
}

/**
 * Base class for all security-engine errors. Subclasses set `statusCode` and
 * a default `code`; callers can override `details` per-instance.
 */
export class SecurityError extends Error {
  /** Stable machine-readable code (e.g. `AUTHENTICATION_REQUIRED`). */
  readonly code: string;
  /** HTTP status to return from API route handlers. */
  readonly statusCode: number;
  /** Structured context for audit logs / debugging. */
  readonly details: SecurityErrorDetails;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      details?: SecurityErrorDetails;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code ?? 'SECURITY_ERROR';
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details ?? {};
    // Preserve the stack trace on V8 (Node).
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Serialize to a plain JSON-safe object (for API responses / audit logs). */
  toJSON(): {
    name: string;
    code: string;
    message: string;
    statusCode: number;
    details: SecurityErrorDetails;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ─── Subclasses ──────────────────────────────────────────────────────────────

/**
 * Thrown when a request is missing an auth token, the token is malformed, or
 * Firebase Admin verification fails (expired, revoked, invalid signature).
 *
 * HTTP 401.
 */
export class AuthenticationError extends SecurityError {
  constructor(
    message: string = 'Authentication required.',
    details: SecurityErrorDetails = {},
  ) {
    super(message, {
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
      details,
    });
  }
}

/**
 * Thrown when an authenticated caller lacks the RBAC or ABAC permission to
 * perform the requested action. The caller is known but not allowed.
 *
 * HTTP 403.
 */
export class AuthorizationError extends SecurityError {
  constructor(
    message: string = 'You do not have permission to perform this action.',
    details: SecurityErrorDetails = {},
  ) {
    super(message, {
      code: 'AUTHORIZATION_DENIED',
      statusCode: 403,
      details,
    });
  }
}

/**
 * Thrown when the referenced organization does not exist (or has been
 * soft-deleted).
 *
 * HTTP 404.
 */
export class OrganizationNotFoundError extends SecurityError {
  constructor(
    message: string = 'Organization not found.',
    details: SecurityErrorDetails = {},
  ) {
    super(message, {
      code: 'ORGANIZATION_NOT_FOUND',
      statusCode: 404,
      details,
    });
  }
}

/**
 * Thrown when the caller's organization subscription is not in an active
 * state (suspended, canceled, incomplete, or past_due beyond grace period).
 *
 * HTTP 402 (Payment Required).
 */
export class SubscriptionInactiveError extends SecurityError {
  constructor(
    message: string = 'Your subscription is not active. Please renew to continue.',
    details: SecurityErrorDetails = {},
  ) {
    super(message, {
      code: 'SUBSCRIPTION_INACTIVE',
      statusCode: 402,
      details,
    });
  }
}

/**
 * Thrown when a caller has exceeded the rate limit for a given identifier
 * (IP, uid, or orgId). `details.retryAfter` is the seconds-until-reset value.
 *
 * HTTP 429.
 */
export class RateLimitError extends SecurityError {
  constructor(
    message: string = 'Too many requests. Please slow down.',
    details: SecurityErrorDetails = {},
  ) {
    super(message, {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details,
    });
  }
}

/**
 * Thrown when a state-mutating request (POST/PUT/PATCH/DELETE) is missing a
 * valid `X-CSRF-Token` header, or the header doesn't match the expected
 * signed-token value derived from the caller's auth ID token.
 *
 * HTTP 403.
 */
export class CSRFError extends SecurityError {
  constructor(
    message: string = 'CSRF validation failed. Please refresh the page and try again.',
    details: SecurityErrorDetails = {},
  ) {
    super(message, {
      code: 'CSRF_VALIDATION_FAILED',
      statusCode: 403,
      details,
    });
  }
}

// ─── Friendly Message Mapper ─────────────────────────────────────────────────

/**
 * Map any error (security, Firebase, or generic) to a short, user-safe
 * message suitable for toast notifications.
 *
 * Never leaks internal codes or stack traces. Falls back to a generic
 * safe message for unrecognized errors.
 */
export function friendlySecurityError(err: unknown): string {
  if (!err) return 'Something went wrong. Please try again.';

  // SecurityError subclasses — use their `message` (already user-safe).
  if (err instanceof SecurityError) {
    return err.message;
  }

  if (typeof err === 'object' && err !== null) {
    // Firebase auth error codes.
    const code = (err as { code?: string }).code;
    if (code) {
      const firebaseMap: Record<string, string> = {
        'auth/id-token-expired': 'Your session has expired. Please sign in again.',
        'auth/id-token-revoked': 'Your session was revoked. Please sign in again.',
        'auth/argument-error': 'Invalid authentication token. Please sign in again.',
        'auth/invalid-id-token': 'Invalid authentication token. Please sign in again.',
        'auth/credential-too-old-login-again':
          'For security, please sign in again to complete this action.',
        'auth/no-current-user': 'Your session has ended. Please sign in again.',
        'auth/network-request-failed':
          'Network error. Check your internet connection and try again.',
        'auth/too-many-requests':
          'Too many attempts. Please wait a few minutes and try again.',
        'auth/user-disabled':
          'This account has been disabled. Contact your administrator.',
        'permission-denied':
          "You don't have permission to do this. Contact your organization admin.",
        'UNAUTHENTICATED': 'Your session has ended. Please sign in again.',
        'UNAVAILABLE':
          'The service is temporarily unavailable. Please try again.',
      };
      if (firebaseMap[code]) return firebaseMap[code];
    }

    // Fall back to the message if it's short and doesn't look like a stack.
    const message = (err as { message?: string }).message;
    if (
      message &&
      typeof message === 'string' &&
      message.length > 0 &&
      message.length < 200 &&
      !/stack|trace|at \//i.test(message)
    ) {
      return message;
    }
  }

  // Plain string error.
  if (typeof err === 'string' && err.length > 0 && err.length < 200) {
    return err;
  }

  return 'Something went wrong. Please try again.';
}

/**
 * Returns `true` if the error is a security-engine error of the given class
 * (or any subclass). Useful for guard clauses in route handlers.
 */
export function isSecurityError(err: unknown): err is SecurityError {
  return err instanceof SecurityError;
}

/**
 * Returns `true` if the error represents an authentication failure that
 * should force a re-login on the client.
 */
export function isAuthenticationFailure(err: unknown): boolean {
  if (err instanceof AuthenticationError) return true;
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: string }).code || '';
  return (
    code === 'auth/id-token-expired' ||
    code === 'auth/id-token-revoked' ||
    code === 'auth/invalid-id-token' ||
    code === 'auth/no-current-user' ||
    code === 'UNAUTHENTICATED'
  );
}
