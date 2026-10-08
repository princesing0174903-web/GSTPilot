// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Friendly Auth & Firestore Error Mapping
//
// Firebase error codes are internal implementation details. End users must
// never see `auth/invalid-credential` or `FirebaseError`. This module is the
// single source of truth for translating any auth/firestore error into a
// short, human, actionable message.
//
// Principles (PART 8 of the multi-tenant directive):
//   1. Never crash — always return a string.
//   2. Never expose Firebase error codes / stack traces to the UI.
//   3. Messages are friendly + actionable ("Try again", "Check your network").
//   4. Unknown errors fall back to a generic safe message.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map of Firebase Auth error codes → friendly messages.
 * Keys are matched against `error.code` (e.g. `auth/wrong-password`).
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // ── Sign-in ──
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
  'auth/user-not-found': 'No account found with this email. Try signing up instead.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Email or password is incorrect. Please try again.',
  'auth/invalid-login-credentials': 'Email or password is incorrect. Please try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Contact support.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
  'auth/internal-error': 'Something went wrong on our end. Please try again.',

  // ── Sign-up ──
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters with a mix of letters and numbers.',
  'auth/operation-not-allowed': 'Account creation is currently unavailable. Please try again later.',

  // ── Email verification / password reset ──
  'auth/missing-email': 'Please enter an email address.',
  'auth/invalid-action-code': 'This link has expired or already been used. Request a new one.',
  'auth/expired-action-code': 'This link has expired. Request a new one.',
  'auth/user-not-found': 'If an account exists for this email, a reset link has been sent.',

  // ── Google / popup ──
  'auth/popup-blocked': 'Pop-up was blocked by your browser. Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled. Please try again.',
  'auth/redirect-operation-cancelled': 'Sign-in was cancelled. Please try again.',
  'auth/unauthorized-domain': 'This domain is not authorized for sign-in. Contact support.',
  'auth/operation-not-supported-in-this-environment': 'Sign-in is not supported in this environment.',
  // redirect_uri_mismatch is a Google OAuth error (not a Firebase code), but
  // we handle it here in case it surfaces through the Firebase SDK.
  'auth/redirect-uri-mismatch': 'Google sign-in is not configured for this domain. Please contact support to authorize this domain.',
  'redirect_uri_mismatch': 'Google sign-in configuration error. Please contact support.',

  // ── Session / token ──
  'auth/requires-recent-login': 'For security, please sign in again to complete this action.',
  'auth/no-current-user': 'Your session has ended. Please sign in again.',
  'auth/provider-already-linked': 'This account is already linked to another sign-in method.',
  'auth/credential-already-in-use': 'This credential is already associated with another account.',
  'auth/account-exists-with-different-credential': 'An account exists with this email using a different sign-in method.',
};

/**
 * Map of common Firestore error codes → friendly messages.
 *
 * IMPORTANT: messages here are shown directly to end users. They must NEVER
 * say "Permission denied" or "Contact your organization admin" — those phrases
 * are misleading for the most common case (a brand-new user creating their
 * FIRST workspace, where the Firestore membership row doesn't exist yet). The
 * user IS the admin; the rule just can't see that yet. Use neutral, actionable
 * language instead.
 */
const FIRESTORE_ERROR_MESSAGES: Record<string, string> = {
  'permission-denied': "We couldn't complete that action right now. Please try again, or contact support if the problem continues.",
  'PERMISSION_DENIED': "We couldn't complete that action right now. Please try again, or contact support if the problem continues.",
  'unavailable': 'The service is temporarily unavailable. Please try again.',
  'UNAVAILABLE': 'The service is temporarily unavailable. Please try again.',
  'deadline-exceeded': 'The request timed out. Please try again.',
  'DEADLINE_EXCEEDED': 'The request timed out. Please try again.',
  'not-found': 'The requested item could not be found.',
  'NOT_FOUND': 'The requested item could not be found.',
  'already-exists': 'This item already exists.',
  'ALREADY_EXISTS': 'This item already exists.',
  'resource-exhausted': 'Quota exceeded. Please try again later.',
  'RESOURCE_EXHAUSTED': 'Quota exceeded. Please try again later.',
  'failed-precondition': 'This action cannot be completed right now. Please refresh and try again.',
  'FAILED_PRECONDITION': 'This action cannot be completed right now. Please refresh and try again.',
  'aborted': 'The operation was interrupted. Please try again.',
  'ABORTED': 'The operation was interrupted. Please try again.',
  'out-of-range': 'The request was invalid. Please try again.',
  'OUT_OF_RANGE': 'The request was invalid. Please try again.',
  'unauthenticated': 'Your session has ended. Please sign in again.',
  'UNAUTHENTICATED': 'Your session has ended. Please sign in again.',
  'unknown': 'Something went wrong. Please try again.',
  'UNKNOWN': 'Something went wrong. Please try again.',
  'internal': 'Something went wrong on our end. Please try again.',
  'INTERNAL': 'Something went wrong on our end. Please try again.',
  'invalid-argument': 'The request was invalid. Please check your input and try again.',
  'INVALID_ARGUMENT': 'The request was invalid. Please check your input and try again.',
  'data-loss': 'Data could not be saved. Please try again.',
  'DATA_LOSS': 'Data could not be saved. Please try again.',
  'cancelled': 'The request was cancelled.',
  'CANCELLED': 'The request was cancelled.',
};

/**
 * The fallback message used when we can't classify the error. Deliberately
 * generic — never leaks Firebase internals.
 */
const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Translate ANY error (auth, firestore, or generic) into a friendly string.
 *
 * @param error — the raw error thrown by Firebase or app code
 * @returns a non-empty, user-safe message
 */
export function friendlyAuthError(error: unknown): string {
  if (!error) return FALLBACK_MESSAGE;

  // Firebase errors carry a `code` string (e.g. "auth/wrong-password").
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code;
    if (code) {
      // Try auth-style codes first, then firestore-style.
      if (AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
      // Firestore codes may arrive without the leading slash; check both.
      const bare = code.replace(/^firestore\//i, '');
      if (FIRESTORE_ERROR_MESSAGES[code]) return FIRESTORE_ERROR_MESSAGES[code];
      if (FIRESTORE_ERROR_MESSAGES[bare]) return FIRESTORE_ERROR_MESSAGES[bare];
    }

    // Some Firestore errors use `name` instead of `code`.
    const name = (error as { name?: string }).name;
    if (name && FIRESTORE_ERROR_MESSAGES[name]) return FIRESTORE_ERROR_MESSAGES[name];

    // ── Leak guard ──
    // Previously this branch returned the raw `error.message` for any error
    // with a `code` (i.e. virtually every Firebase error whose code wasn't in
    // our map). That leaked internal Firebase strings like
    // "Firebase: Error (auth/internal-error)." to the UI.
    //
    // New policy: if the error has a `code`, NEVER surface the raw message —
    // the user gets the FALLBACK_MESSAGE. The raw message is still logged
    // server-side / in the console for debugging. Only surface raw messages
    // for plain `Error` instances with NO code (e.g. app-thrown errors with
    // intentionally user-facing text).
    if (code) {
      return FALLBACK_MESSAGE;
    }
    const message = (error as { message?: string }).message;
    if (message && typeof message === 'string' && message.length > 0 && message.length < 200) {
      // No code + short message → safe to surface (app-thrown, intentional).
      if (!/firebase|firestore/i.test(message)) {
        return message;
      }
    }
  }

  // Plain string error.
  if (typeof error === 'string' && error.length > 0 && error.length < 200) {
    return error;
  }

  return FALLBACK_MESSAGE;
}

/**
 * Alias — Firestore errors use the same translation strategy. Kept as a
 * separate export for call-site readability.
 */
export const friendlyFirestoreError = friendlyAuthError;

/**
 * Returns `true` if the error represents a permission / auth failure that
 * should force a re-login.
 */
export function isSessionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code || '';
  return (
    code === 'auth/requires-recent-login' ||
    code === 'auth/no-current-user' ||
    code === 'unauthenticated' ||
    code === 'UNAUTHENTICATED'
  );
}

/**
 * Returns `true` if the error is a network / availability issue (worth retrying).
 */
export function isTransientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code || '';
  return (
    code === 'auth/network-request-failed' ||
    code === 'unavailable' ||
    code === 'UNAVAILABLE' ||
    code === 'deadline-exceeded' ||
    code === 'DEADLINE_EXCEEDED' ||
    code === 'auth/too-many-requests'
  );
}

/**
 * Returns `true` if the error is a Firestore permission-denied error.
 *
 * Callers should use this to trigger a graceful fallback (e.g. switch to local
 * workspace mode) RATHER than surfacing the error to the user. Permission-denied
 * on first-org-create is a known false negative (the membership row doesn't
 * exist yet), and even on subsequent calls it usually means the Firebase project
 * is in locked-down mode — the user is still valid, they just need a fallback.
 */
export function isPermissionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code || '';
  const name = (error as { name?: string }).name || '';
  return (
    code === 'permission-denied' ||
    code === 'PERMISSION_DENIED' ||
    name === 'permission-denied' ||
    name === 'PERMISSION_DENIED'
  );
}
