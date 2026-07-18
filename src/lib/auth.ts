// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Firebase Auth Action Wrappers
//
// Thin wrappers around Firebase Auth methods. Each function:
//   - Returns `{ user, error }` (never throws raw Firebase errors)
//   - Uses {@link friendlyAuthError} so the UI never sees internal codes
//   - Defers Firestore writes to the AuthContext `onAuthStateChanged`
//     listener to avoid duplicate writes
//
// UI components import these wrappers (via dynamic import) to perform sign-in,
// sign-up, password reset, Google sign-in, and sign-out.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  User,
} from 'firebase/auth';
import { auth, googleProvider, onAuthStateChanged } from './firebase';
import { friendlyAuthError } from './auth/errors';

// ── Re-export so existing imports keep working ──
export { friendlyAuthError as getAuthErrorMessage } from './auth/errors';
export { onAuthStateChanged, auth };
export type { User };

/**
 * Detects whether the current window is running inside an iframe (e.g. a
 * sandbox preview panel). Popups launched from inside a cross-origin iframe
 * are frequently blocked by browsers, so we prefer `signInWithRedirect` in
 * that case. The redirect result is picked up by `handleRedirectResult()`
 * (called on AuthProvider mount).
 */
function isInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    // cross-origin access to window.top throws → we're in a cross-origin iframe
    return true;
  }
}

/**
 * Google Sign-In. Strategy:
 *   1. If we're inside an iframe → use `signInWithRedirect` directly (popups
 *      are blocked in cross-origin iframes).
 *   2. Otherwise → try `signInWithPopup`; on popup-blocked/cancelled, fall
 *      back to `signInWithRedirect`.
 *
 * The `rememberMe` flag controls persistence:
 *   - `true`  → `browserLocalPersistence` (survives browser restart)
 *   - `false` → `browserSessionPersistence` (cleared when tab closes)
 */
export async function signInWithGoogle(
  rememberMe = true
): Promise<{ user: User | null; error: string | null }> {
  try {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    );

    // Iframe / sandbox preview → redirect is the only reliable path.
    if (isInsideIframe()) {
      console.log('[Auth] Inside iframe — using signInWithRedirect');
      await signInWithRedirect(auth, googleProvider);
      return { user: null, error: null };
    }

    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || '';

    // Popup blocked → fall back to redirect.
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/popup-closed-by-user'
    ) {
      try {
        await signInWithRedirect(auth, googleProvider);
        return { user: null, error: null };
      } catch (redirectError: unknown) {
        return { user: null, error: friendlyAuthError(redirectError) };
      }
    }

    return { user: null, error: friendlyAuthError(error) };
  }
}

/**
 * Handle the redirect result when the page loads after a Google redirect
 * sign-in. Firestore doc creation is handled by `onAuthStateChanged`.
 */
export async function handleRedirectResult(): Promise<{
  user: User | null;
  error: string | null;
}> {
  try {
    const result = await getRedirectResult(auth);
    return { user: result?.user ?? null, error: null };
  } catch (error: unknown) {
    return { user: null, error: friendlyAuthError(error) };
  }
}

/**
 * Email + password sign-in. `rememberMe` toggles persistence.
 */
export async function signInWithEmail(
  email: string,
  password: string,
  rememberMe = true
): Promise<{ user: User | null; error: string | null }> {
  try {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    );
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    return { user: null, error: friendlyAuthError(error) };
  }
}

/**
 * Email + password sign-up. Sends a verification email and lets the
 * `onAuthStateChanged` listener create the Firestore user profile.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    // Best-effort verification email — don't block sign-up on failure.
    try {
      await sendEmailVerification(result.user);
    } catch {
      /* non-fatal */
    }
    return { user: result.user, error: null };
  } catch (error: unknown) {
    return { user: null, error: friendlyAuthError(error) };
  }
}

/**
 * Resend the email verification link to the current user.
 */
export async function sendVerificationEmail(): Promise<{ error: string | null }> {
  try {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
    return { error: null };
  } catch (error: unknown) {
    return { error: friendlyAuthError(error) };
  }
}

/**
 * Send a password-reset email. Always returns a friendly message even on
 * failure (to avoid leaking whether an account exists).
 */
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error: unknown) {
    // For user-not-found, Firebase still errors — but we don't want to leak
    // that the account doesn't exist. Return success.
    const code = (error as { code?: string })?.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
      return { error: null };
    }
    return { error: friendlyAuthError(error) };
  }
}

/**
 * Sign out the current user. Clears Firebase Auth state; the
 * `onAuthStateChanged` listener clears local app state.
 */
export async function logOut(): Promise<void> {
  try {
    // Switch to in-memory persistence so any cached token is dropped.
    await setPersistence(auth, inMemoryPersistence);
    await signOut(auth);
  } catch (error) {
    console.warn('[Auth] signOut failed:', friendlyAuthError(error));
    // Still attempt the raw signOut as a last resort.
    try {
      await signOut(auth);
    } catch {
      /* swallow — UI state is cleared by onAuthStateChanged anyway */
    }
  }
}
