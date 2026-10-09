'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Auth Context (PART 1, 7, 8)
//
// Responsibilities:
//   • Listen to Firebase Auth state (the single source of truth for identity)
//   • Restore the session on refresh (instant UI from cache, then verify)
//   • Refresh the ID token automatically (Firebase handles this; we listen)
//   • Handle expired sessions (clear state, surface a friendly message)
//   • Surface a friendly error string — never a raw Firebase error
//   • Show a loading state while authentication initializes
//
// NOTE: This context handles AUTHENTICATION ONLY. Organization / role / tenant
// resolution lives in {@link OrgContext} (PART 3) which runs after the user
// is authenticated here.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
// Type-only import — erased at compile time, does NOT pull in the firebase/auth
// runtime module. This keeps AuthContext in a LIGHT webpack chunk so the
// landing page can compile without the ~40 MB Firebase SDK.
import { type User as FirebaseUser } from 'firebase/auth';
// errors.ts is a pure error-code map (no Firebase import) — safe to import statically.
import { friendlyAuthError, isSessionError } from '@/lib/auth/errors';
import { boot } from '@/lib/perf/boot-tracer';

// ── Lazy Firebase loaders ────────────────────────────────────────────────────
// @/lib/firebase and @/lib/auth both pull in the Firebase SDK (~40 MB).
// We import them dynamically so Firebase compiles in its OWN chunk, only when
// a auth function is actually called (e.g. the user clicks "Sign In").
// This keeps the initial `/` compile + provider chunk light enough for the
// 4 GB sandbox.
type FirebaseModule = typeof import('@/lib/firebase');
type AuthModule = typeof import('@/lib/auth');
let firebaseCache: Promise<FirebaseModule> | null = null;
let authCache: Promise<AuthModule> | null = null;
function loadFirebase(): Promise<FirebaseModule> {
  if (!firebaseCache) firebaseCache = import('@/lib/firebase');
  return firebaseCache;
}
function loadAuth(): Promise<AuthModule> {
  if (!authCache) authCache = import('@/lib/auth');
  return authCache;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  provider: 'email' | 'google' | 'demo' | 'github';
  emailVerified: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  needsOnboarding: boolean;
  needsEmailVerification: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  markOnboardingComplete: () => void;
  /** Sign in with a demo account (preview mode — no Firebase backend needed). */
  signInDemo: () => void;
  /** Email/password sign-in. Drives `isLoading` so the login page can show
   *  a "Redirecting…" state until OrgContext resolves. */
  signInWithEmail: (email: string, password: string) => Promise<{ user: AuthUser | null; error: string | null }>;
  /** Email/password sign-up. */
  signUpWithEmail: (name: string, email: string, password: string) => Promise<{ user: AuthUser | null; error: string | null }>;
  /** Google OAuth sign-in. Returns `needsNewTab: true` if the user must
   *  complete sign-in in a new top-level tab (iframe sandbox limitation). */
  signInWithGoogle: () => Promise<{ user: AuthUser | null; error: string | null; errorCode?: string; needsNewTab?: boolean; needsAccountLink?: boolean; linkingEmail?: string }>;
  /** GitHub OAuth sign-in. Redirects the browser to GitHub's consent page.
   *  On success, the callback sets a session cookie + redirects back to
   *  `?github_connected=1`, which AuthContext detects on mount and uses to
   *  hydrate the user from the cookie (NO Firebase Auth required). */
  signInWithGitHub: () => Promise<{ authUrl: string | null; error: string | null; notConfigured?: boolean }>;
  /** Send a password-reset email. */
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Clear the `isLoading` flag (called by OrgContext when the org resolves). */
  clearIsLoading: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'gstpilot_session';

// ── Convert a Firebase User to our lightweight AuthUser ──
function firebaseToAuthUser(fbUser: FirebaseUser): AuthUser {
  const providerId = fbUser.providerData[0]?.providerId;
  const provider: AuthUser['provider'] =
    providerId === 'google.com' ? 'google' :
    providerId === 'github.com' ? 'github' :
    'email';
  return {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    email: fbUser.email || '',
    picture: fbUser.photoURL || undefined,
    provider,
    emailVerified: fbUser.emailVerified,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const cachedUserIdRef = useRef<string | null>(null);
  // ── Track whether the CURRENT session is a demo session. Using a ref (not
  //    state) so onAuthStateChanged can read the latest value without
  //    re-subscribing. This prevents Firebase's null-fire from wiping a demo
  //    user that was set via signInDemo() AFTER the initial page load.
  const isDemoSessionRef = useRef<boolean>(false);

  // ── Core Auth Init ──
  // Strategy: restore from localStorage FIRST for instant UI, then let
  // onAuthStateChanged (Firebase's source of truth) reconcile in the
  // background. A safety timeout guarantees we never hang on init.
  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const markInitialized = () => {
      if (!initialized) {
        initialized = true;
        setIsInitializing(false);
        boot.mark('auth ready');
        console.log('[Auth] Initialization complete — isInitializing=false');
      }
    };

    // ── Restore from localStorage for instant UI ──
    // Declared BEFORE the safety timer so the timer's closure can read it.
    let restoredFromCache = false;

    // Safety timeout — if Firebase doesn't respond in 3s, unblock the UI so
    // the landing page and login form are always reachable, even on slow
    // networks or in restricted sandbox environments.
    //
    // CRITICAL FIX (root cause of the "can't sign back in" failure mode):
    // Previously this timer called `setUser(null)` unconditionally — which
    // WIPED a cached real session restored from localStorage. So any Firebase
    // Auth network blip bounced a real user to the landing page on every
    // reload, and since sign-in itself requires Firebase Auth network, the
    // user couldn't get back in. Now: if a cached session was restored, we
    // keep it as a tentative session (the user can still use the app in
    // local-workspace mode). A longer 15s hard deadline clears it only if
    // Firebase never responds at all.
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialized) {
        console.warn('[Auth] Initialization timeout (3s) — unblocking UI so login is reachable');
        // Only clear the user if we did NOT restore from cache. A cached
        // real session is kept tentative so the user can still navigate
        // (OrgContext will install a local workspace if Firestore is
        // unreachable). Clearing it here would bounce the user to the
        // landing page on every reload when Firebase is slow.
        if (!restoredFromCache) {
          setUser(null);
        }
        setIsInitializing(false);
        boot.mark('auth ready');
        console.log('[Auth] Initialization complete (3s safety) — isInitializing=false');
        initialized = true;
      }
    }, 3000);

    // NOTE: The previous "hard deadline" (15s) that cleared the cached session
    // has been REMOVED. A timeout is NOT an authentication failure — logging
    // the user out because Firebase is slow/unreachable is the wrong behavior.
    // The cached session is kept indefinitely; the user can still use the app
    // in local-workspace mode. The session is ONLY cleared when Firebase
    // explicitly reports that the session is invalid (via onAuthStateChanged
    // firing null for a non-demo user, or via an explicit auth error).

    // ── Restore from localStorage for instant UI ──
    // (restoredFromCache declared above, before the safety timer)
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        if (parsed.id) {
          console.log('[Auth] Restored session from cache for user:', parsed.id);
           
          setUser(parsed);
          cachedUserIdRef.current = parsed.id;
          restoredFromCache = true;
          if (parsed.provider === 'demo') {
            isDemoSessionRef.current = true;
          }
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }

    console.log('[Auth] Subscribing to onAuthStateChanged (lazy Firebase load)…');

    // ── onAuthStateChanged — the single source of truth ──
    // Firebase is loaded dynamically so it compiles in its own chunk. The
    // 3s safety timer above already unblocks the UI if this takes longer.
    let unsubscribe: (() => void) | null = null;
    loadFirebase()
      .then(({ auth, onAuthStateChanged }) => {
        if (!mounted) return;
        unsubscribe = onAuthStateChanged(
          auth,
          (fbUser) => {
            if (!mounted) return;

            if (fbUser) {
              console.log('[Auth] User Loaded — uid:', fbUser.uid, 'email:', fbUser.email);
              const authUser = firebaseToAuthUser(fbUser);

              // A real Firebase user signed in — this is no longer a demo session.
              isDemoSessionRef.current = false;

              // Fast path: cache matched Firebase user → unblock immediately.
              if (restoredFromCache && cachedUserIdRef.current === fbUser.uid) {
                console.log('[Auth] Cache matched — fast path, unblocking immediately');
                setUser(authUser);
                markInitialized();
                return;
              }

              // Full new sign-in (or cache mismatch).
              console.log('[Auth] Session Created — new sign-in detected');
              setUser(authUser);
              cachedUserIdRef.current = authUser.id;
              try {
                localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
              } catch {
                /* storage may be unavailable (private mode) — non-fatal */
              }
              markInitialized();
            } else {
              // No Firebase user. If this is a demo session (set via
              // signInDemo), KEEP the demo user — Firebase firing null is
              // expected because demo users don't have a Firebase Auth session.
              if (isDemoSessionRef.current) {
                console.log('[Auth] No Firebase user — keeping demo session (preview mode)');
                markInitialized();
                return;
              }
              // Genuine sign-out / session expiry — clear everything.
              console.log('[Auth] No Firebase user — session ended or signed out');
              localStorage.removeItem(SESSION_KEY);
              setUser(null);
              cachedUserIdRef.current = null;
              markInitialized();
            }
          },
          (authError) => {
            // onAuthStateChanged error listener — surface a friendly message.
            if (!mounted) return;
            console.warn('[Auth] State listener error:', authError);
            if (isSessionError(authError)) {
              setError('Your session has ended. Please sign in again.');
            } else {
              setError(friendlyAuthError(authError));
            }
            localStorage.removeItem(SESSION_KEY);
            setUser(null);
            cachedUserIdRef.current = null;
            isDemoSessionRef.current = false;
            markInitialized();
          }
        );
      })
      .catch((err) => {
        console.warn('[Auth] Firebase load failed — running in offline/demo mode:', err);
        markInitialized();
      });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // ── Handle Google sign-in redirect result (runs once on mount) ──
  // If signInWithPopup fails (blocked/iframe) and we fall back to
  // signInWithRedirect, the result is delivered here when the page reloads.
  useEffect(() => {
    let active = true;
    loadAuth()
      .then((m) => m.handleRedirectResult())
      .then((result) => {
        if (!active) return;
        if (result.error) {
          console.warn('[Auth] Redirect result error:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else if (result.user) {
          console.log('[Auth] Redirect sign-in completed for:', result.user.uid);
          // onAuthStateChanged will pick this up and set the user.
        }
      })
      .catch((err) => {
        console.warn('[Auth] handleRedirectResult exception:', friendlyAuthError(err));
      });
    return () => {
      active = false;
    };
  }, []);

  // ── Logout ──
  const logout = useCallback(async () => {
    try {
      const { logOut } = await loadAuth();
      await logOut();
    } catch (err) {
      // Even if Firebase signOut fails, clear local state so the user is
      // effectively logged out from the app's perspective.
      console.warn('[Auth] logout error:', friendlyAuthError(err));
    }
    // Also clear the GitHub session cookie if present (server-side logout).
    try {
      await fetch('/api/auth/github/logout', { method: 'POST', cache: 'no-store' });
    } catch {
      // Non-fatal — the cookie expires in 7 days on its own.
    }
    setUser(null);
    setNeedsOnboarding(false);
    setError(null);
    setIsLoading(false);
    cachedUserIdRef.current = null;
    isDemoSessionRef.current = false;
    localStorage.removeItem(SESSION_KEY);
  }, []);

  // ── Refresh user profile ──
  // Note: organization / profile data is owned by OrgContext; here we only
  // refresh the Firebase Auth user's basic info.
  const refreshUserProfile = useCallback(async () => {
    const { auth } = await loadFirebase();
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    // Force a token refresh so custom claims (if any) are up to date.
    try {
      await fbUser.getIdToken(true);
    } catch (err) {
      console.warn('[Auth] token refresh failed:', friendlyAuthError(err));
    }
    const authUser = firebaseToAuthUser(fbUser);
    setUser(authUser);
    cachedUserIdRef.current = authUser.id;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
    } catch {
      /* non-fatal */
    }
  }, []);

  // ── Mark onboarding complete (local, instant) ──
  // The OrgContext.completeOnboarding() handles the Firestore write.
  const markOnboardingComplete = useCallback(() => {
    setNeedsOnboarding(false);
  }, []);

  // ── Sign in with email/password ──
  // Wraps the underlying Firebase call so we can drive `isLoading` (which
  // gates the "Redirecting…" card on the login page).
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    console.log('[Auth] Login Started — email:', email);
    setIsLoading(true);
    try {
      const { signInWithEmail: firebaseSignInWithEmail } = await loadAuth();
              const result = await firebaseSignInWithEmail(email, password);
        if (result.error) {
          console.warn('[Auth] Login failed:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else {
          console.log('[Auth] Login successful — waiting for onAuthStateChanged + OrgContext');
          if (pendingGoogleCredential) {
             const { auth } = await loadAuth();
             const { linkWithCredential } = await import('firebase/auth');
             try {
               await linkWithCredential(auth.currentUser!, pendingGoogleCredential);
               console.log('[Auth] Successfully linked Google account quietly!');
             } catch (linkError) {
               console.warn('[Auth] Failed to link Google credential:', linkError);
             }
             setPendingGoogleCredential(null);
          }
        }
        return {
          user: result.user ? firebaseToAuthUser(result.user) : null,
          error: result.error,
        };
    } catch (err) {
      console.error('[Auth] Login exception:', err);
      setError(friendlyAuthError(err));
      setIsLoading(false);
      throw err;
      }
    }, [pendingGoogleCredential]);

  // ── Sign up with email/password ──
  const signUpWithEmail = useCallback(async (name: string, email: string, password: string) => {
    console.log('[Auth] Sign Up Started — email:', email);
    setIsLoading(true);
    try {
      const { signUpWithEmail: firebaseSignUpWithEmail } = await loadAuth();
      const result = await firebaseSignUpWithEmail(name, email, password);
      if (result.error) {
        console.warn('[Auth] Sign up failed:', result.error);
        setError(result.error);
        setIsLoading(false);
      } else {
        console.log('[Auth] Sign up successful — waiting for onAuthStateChanged');
      }
      return {
        user: result.user ? firebaseToAuthUser(result.user) : null,
        error: result.error,
      };
    } catch (err) {
      console.error('[Auth] Sign up exception:', err);
      setError(friendlyAuthError(err));
      setIsLoading(false);
      throw err;
      }
    }, [pendingGoogleCredential]);

  // ── Sign in with Google ──
  // Detects if we're inside an iframe (e.g. sandbox preview panel) and
  // uses signInWithRedirect instead of signInWithPopup, because popups are
  // frequently blocked inside iframes.
  const signInWithGoogle = useCallback(async () => {
    console.log('[Auth] Google Sign-In Started');
    setIsLoading(true);
    try {
      const { signInWithGoogle: firebaseSignInWithGoogle } = await loadAuth();
      const result = await firebaseSignInWithGoogle();
      if (result.needsNewTab) {
          // OAuth popup/redirect flows cannot reliably run inside an iframe.
          // Release loading state so the UI can offer a top-level tab.
          setIsLoading(false);
        } else if (result.needsAccountLink) {
          console.log('[Auth] Google sign-in requires account linking for:', result.linkingEmail);
          setPendingGoogleCredential(result.credential);
          setIsLoading(false);
        } else if (result.error) {
          console.warn('[Auth] Google sign-in failed:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else {
        console.log('[Auth] Google sign-in successful — waiting for onAuthStateChanged');
      }
      if (result.error) {
        console.warn('[Auth] Google sign-in failed', {
          code: result.errorCode || 'unknown',
          message: result.error,
          // Deliberately omit emails, credentials, tokens, and secret values.
        });
      }
      return {
        user: result.user ? firebaseToAuthUser(result.user) : null,
        error: result.error,
        errorCode: result.errorCode,
        needsNewTab: result.needsNewTab,
        needsAccountLink: result.needsAccountLink,
        linkingEmail: result.linkingEmail,
      };
    } catch (err) {
      console.error('[Auth] Google sign-in exception:', err);
      setError(friendlyAuthError(err));
      setIsLoading(false);
      throw err;
      }
    }, [pendingGoogleCredential]);

  // ── Sign in with GitHub ──
  // Calls /api/auth/github/authorize to get the OAuth consent URL, then
  // redirects the browser there. GitHub redirects back to
  // /api/auth/github/callback, which sets the session cookie + redirects
  // to /?github_connected=1. The restoreGitHubSession effect below picks
  // that up and hydrates the user from the cookie.
  const signInWithGitHub = useCallback(async () => {
    console.log('[Auth] GitHub Sign-In started');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/github/authorize', { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        authUrl?: string;
        error?: string;
        code?: string;
        notConfigured?: boolean;
        requiredEnvVars?: string[];
      };
      if (!res.ok || !body.ok || !body.authUrl) {
        const notConfigured = body.code === 'GITHUB_NOT_CONFIGURED';
        setIsLoading(false);
        return {
          authUrl: null,
          error: body.error ?? 'Failed to start GitHub sign-in.',
          notConfigured,
        };
      }
      // IMPORTANT: redirect the top-level window (NOT a popup). Popups are
      // blocked inside iframes (sandbox preview panel).
      if (typeof window !== 'undefined') {
        window.location.href = body.authUrl;
      }
      // Don't clear isLoading here — the redirect will reload the page.
      // The restoreGitHubSession effect will fire on the new page load.
      return { authUrl: body.authUrl, error: null };
    } catch (err) {
      console.error('[Auth] GitHub sign-in exception:', err);
      setIsLoading(false);
      return {
        authUrl: null,
        error: err instanceof Error ? err.message : 'GitHub sign-in failed.',
      };
    }
  }, []);

  // ── Restore GitHub session from cookie ──
  // Runs once on mount. If the URL has ?github_connected=1 (set by the
  // callback) OR the cached session has provider='github', call
  // /api/auth/github/session to hydrate the user from the cookie.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const githubConnected = url.searchParams.get('github_connected') === '1';
    const githubError = url.searchParams.get('github_error');
    if (githubError) {
      // Clean the URL + surface a friendly error.
      url.searchParams.delete('github_error');
      window.history.replaceState({}, '', url.toString());
      setError('GitHub sign-in failed [' + githubError + ']. Please try again.');
      return;
    }
    if (!githubConnected) return;
    // Clean the URL.
    url.searchParams.delete('github_connected');
    window.history.replaceState({}, '', url.toString());

    let active = true;
    console.log('[Auth] ?github_connected=1 detected — restoring GitHub session from cookie');
    fetch('/api/auth/github/session', { cache: 'no-store' })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 401) {
          console.warn('[Auth] GitHub session cookie missing/expired.');
          setError('GitHub sign-in did not complete. Please try again.');
          setIsLoading(false);
          return;
        }
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          user?: AuthUser;
          error?: string;
        };
        if (!body.ok || !body.user) {
          console.warn('[Auth] GitHub session restore failed:', body.error);
          setError(body.error ?? 'GitHub sign-in failed.');
          setIsLoading(false);
          return;
        }
        console.log('[Auth] GitHub session restored — uid:', body.user.id);
        // Mark as non-demo so onAuthStateChanged's null-fire doesn't wipe us.
        isDemoSessionRef.current = false;
        setUser(body.user);
        cachedUserIdRef.current = body.user.id;
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(body.user));
        } catch {
          /* non-fatal */
        }
        setIsInitializing(false);
        boot.mark('auth ready');
        console.log('[Auth] Initialization complete (GitHub session) — isInitializing=false');
      })
      .catch((err) => {
        if (!active) return;
        console.warn('[Auth] GitHub session fetch exception:', err);
        setError('GitHub sign-in did not complete. Please try again.');
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  // Creates an in-memory demo user + persists to localStorage so the app
  // renders even when Firebase Auth / Firestore are unreachable (e.g. sandbox
  // preview). The OrgContext will create a matching demo org.
  //
  // IMPORTANT: Sets isDemoSessionRef so the onAuthStateChanged listener
  // doesn't wipe the demo user when Firebase fires null (demo users have no
  // Firebase Auth session).
  const signInDemo = useCallback(() => {
    console.log('[Auth] Local workspace sign-in (no Firebase account)');
    // Stable demo user ID so the local workspace (and its Zoho-synced data)
    // persists across sessions. Without this, every demo sign-in creates a
    // fresh org ID and the dashboard shows zeros (orphaned Zoho data).
    // The stable ID `dXKkLqbkIjbwN41dEG4pI6PgiMl2` maps to org
    // `local-dXKkLqbkIjbwN41dEG4pI6PgiMl2` which holds the production Zoho
    // Books sync (customers, invoices, payments, bank accounts).
    const DEMO_UID = 'dXKkLqbkIjbwN41dEG4pI6PgiMl2';
    const demoUser: AuthUser = {
      id: DEMO_UID,
      name: 'Guest User',
      email: 'guest@local.workspace',
      picture: undefined,
      provider: 'demo',
      emailVerified: true,
    };
    isDemoSessionRef.current = true;
    setUser(demoUser);
    cachedUserIdRef.current = demoUser.id;
    setNeedsOnboarding(false);
    setError(null);
    setIsInitializing(false);
    setIsLoading(false);
    console.log('[Auth] Local user set — uid:', demoUser.id);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(demoUser));
    } catch {
      /* non-fatal */
    }
  }, []);

  // ── Reset password (send email) ──
  const resetPassword = useCallback(async (email: string) => {
    console.log('[Auth] Password reset requested for:', email);
    try {
      const { resetPassword: firebaseResetPassword } = await loadAuth();
      const result = await firebaseResetPassword(email);
      if (result.error) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      console.error('[Auth] resetPassword exception:', err);
      setError(friendlyAuthError(err));
      return { error: friendlyAuthError(err) };
    }
  }, []);

  // ── Derived flags ──
  // `needsOnboarding` is now driven by OrgContext's `needsOrganization` flag,
  // but to avoid a circular dependency we expose a setter that page.tsx calls
  // based on the org context state. Default: false until OrgContext says otherwise.
  const needsEmailVerification =
    user !== null && !user.emailVerified && user.provider === 'email';

  // ── Clear isLoading (called by OrgContext when org resolves) ──
  const clearIsLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  // ── Safety: clear isLoading after 5s if OrgContext hasn't ──
  // This prevents the login page from showing "Signing in..." forever if
  // OrgContext stalls. The dashboard will still render because AppRouter
  // switches to 'app' as soon as isAuthenticated becomes true.
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      console.warn('[Auth] isLoading safety timeout (5s) — clearing to prevent stuck spinner');
      setIsLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // ── Session-expired handler ──
  // When any API route returns 401 SESSION_EXPIRED / AUTH_REQUIRED, the
  // apiFetch wrapper (src/hooks/api.ts) and TanStack Query mutation onError
  // (src/components/providers.tsx) dispatch a `gstpilot:session-expired`
  // CustomEvent. We listen for it here and attempt a token refresh; if that
  // fails, we sign the user out so they can re-authenticate cleanly instead
  // of seeing repeated permission-denied errors on every request.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let refreshing = false;
    const handleSessionExpired = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        // Try to refresh the Firebase ID token. If the user is still signed
        // in to Firebase, this succeeds and the next request will work.
        const { auth: fbAuth } = await import('@/lib/firebase');
        const currentUser = fbAuth.currentUser;
        if (currentUser) {
          await currentUser.getIdToken(true);
          console.log('[Auth] Session refreshed after 401');
        } else {
          // No Firebase user — force logout.
          console.warn('[Auth] No Firebase user on 401 — signing out');
          await logout();
        }
      } catch (err) {
        console.warn('[Auth] Token refresh failed on 401 — signing out:', err);
        await logout();
      } finally {
        refreshing = false;
      }
    };
    window.addEventListener('gstpilot:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('gstpilot:session-expired', handleSessionExpired);
    };
     
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isInitializing,
        needsOnboarding,
        needsEmailVerification,
        error,
        setError,
        logout,
        refreshUserProfile,
        markOnboardingComplete,
        signInDemo,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithGitHub,
        resetPassword,
        clearIsLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Exposed so OrgContext / page.tsx can flip the `needsOnboarding` flag based
 * on whether the user has an organization. Kept internal to avoid polluting
 * the public API.
 */
export function useSetNeedsOnboarding() {
  const ctx = useContext(AuthContext);
  return useCallback(
    (value: boolean) => {
      // We mutate via the setter pattern — but since AuthContext doesn't
      // expose a setter, page.tsx uses OrgContext.needsOrganization directly.
      void value;
      void ctx;
    },
    [ctx]
  );
}



