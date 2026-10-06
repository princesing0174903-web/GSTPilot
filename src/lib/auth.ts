// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Firebase Auth Action Wrappers
//
// Thin wrappers around Firebase Auth methods. Each function:
//   - Returns `{ user, error }` (never throws raw Firebase errors)
//   - Uses {@link friendlyAuthError} so the UI never sees internal codes
//   - Defers Firestore writes to the AuthContext `onAuthStateChanged`
//     listener to avoid duplicate writes
//
// IFrames / Sandbox Preview:
//   Google OAuth CANNOT run inside a cross-origin iframe — Google's OAuth
//   pages set X-Frame-Options: DENY, so signInWithRedirect gets stuck on
//   "refused to connect" and signInWithPopup is blocked. Our strategy:
//     1. If inside an iframe → return `needsNewTab: true` so the UI can show
//        an "Open in new tab" button that opens the app at top-level.
//     2. The top-level page reads ?googleSignIn=1 and auto-triggers popup.
//   Email/password works in iframes (no OAuth redirect), so it stays inline.
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
  linkWithPopup,
  User,
} from 'firebase/auth';
import { auth, googleProvider, onAuthStateChanged } from './firebase';
import { friendlyAuthError } from './auth/errors';

// ── Re-export so existing imports keep working ──
export { friendlyAuthError as getAuthErrorMessage } from './auth/errors';
export { onAuthStateChanged, auth };
export type { User };

/**
 * Detects whether the current window is running inside an iframe (same-origin
 * OR cross-origin). In either case, popup-based OAuth is unreliable.
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
 * Returns the URL the top-level window should open to complete Google OAuth.
 * Used by the iframe → "Open in new tab" flow.
 */
export function getGoogleSignInUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?googleSignIn=1`;
}

/**
 * Safely set persistence — wrapped in try/catch because some sandboxed
 * iframe environments throw on setPersistence. We never want this to block
 * the actual sign-in call.
 */
async function safeSetPersistence(rememberMe: boolean): Promise<void> {
  try {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    );
  } catch {
    console.warn('[Auth] setPersistence failed (non-fatal) — continuing with default persistence');
  }
}

/**
 * Google Sign-In. Strategy:
 *   1. If we're inside an iframe → return `needsNewTab: true` so the UI
 *      shows an "Open in new tab" button. We do NOT attempt signInWithRedirect
 *      because Google blocks OAuth inside cross-origin iframes.
 *   2. Otherwise (top-level window) → try `signInWithPopup`; on
 *      popup-blocked/cancelled, fall back to `signInWithRedirect`.
 */
export async function signInWithGoogle(
  rememberMe = true
): Promise<{ user: User | null; error: string | null; needsNewTab?: boolean }> {
  // Iframe / sandbox preview → cannot do OAuth. Tell the UI to open a new tab.
  if (isInsideIframe()) {
    console.log('[Auth] Inside iframe — Google OAuth requires a new tab');
    return {
      user: null,
      error: null,
      needsNewTab: true,
    };
  }

  try {
    await safeSetPersistence(rememberMe);

    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/account-exists-with-different-credential') {
      return { user: null, error: 'This email already has a GSTPilot account. Sign in with your existing method to link Google.' };
    }
    const code = (error as { code?: string })?.code || '';

    // Popup blocked → fall back to redirect (only works at top-level).
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
 *
 * Also handles the case where the page is opened at top-level with
 * `?googleSignIn=1` (from the iframe "Open in new tab" flow). In that case
 * we trigger signInWithPopup automatically.
 */
export async function handleRedirectResult(): Promise<{
  user: User | null;
  error: string | null;
}> {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      return { user: result.user, error: null };
    }

    // If the page was opened with ?googleSignIn=1 (from the iframe new-tab
    // flow) AND there's no redirect result AND no current user, trigger
    // signInWithPopup automatically. This runs at top-level so it works.
    if (
      typeof window !== 'undefined' &&
      typeof window.location !== 'undefined' &&
      new URLSearchParams(window.location.search).get('googleSignIn') === '1' &&
      !auth.currentUser
    ) {
      console.log('[Auth] Detected ?googleSignIn=1 — triggering popup at top-level');
      await safeSetPersistence(true);
      try {
        const popupResult = await signInWithPopup(auth, googleProvider);
        return { user: popupResult.user, error: null };
      } catch (error: unknown) {
        return { user: null, error: friendlyAuthError(error) };
      }
    }

    return { user: null, error: null };
  } catch (error: unknown) {
    return { user: null, error: friendlyAuthError(error) };
  }
}

/**
 * Email + password sign-in. `rememberMe` toggles persistence.
 * Persistence is wrapped in try/catch — see safeSetPersistence.
 */
export async function signInWithEmail(
  email: string,
  password: string,
  rememberMe = true
): Promise<{ user: User | null; error: string | null }> {
  try {
    await safeSetPersistence(rememberMe);
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    return { user: null, error: friendlyAuthError(error) };
  }
}

/**
 * Email + password sign-up. Sends a verification email and lets the
 * `onAuthStateChanged` listener create the Firestore user profile.
 *
 * Parameter order is (name, email, password) to match the AuthContext
 * signature `signUpWithEmail(name, email, password)`. This was previously
 * (email, password, name) which caused sign-up to silently fail because
 * the name was passed as the email and the email as the password.
 */
export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    await safeSetPersistence(true);
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

/**
 * Link Google account to the currently signed-in user.
 */
export async function linkGoogleAccount(): Promise<{ user: User | null; error: string | null }> {
  if (!auth.currentUser) {
    return { user: null, error: 'You must be signed in to link an account.' };
  }
  try {
    const result = await linkWithPopup(auth.currentUser, googleProvider);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    return { user: null, error: friendlyAuthError(error) };
  }
}
