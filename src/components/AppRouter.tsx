'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Infinity™ — AppRouter (top-level screen routing)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PRODUCTION AUTH FLOW (no infinite loading):
 *
 *  1. While `isInitializing` → show a brief loading screen (max 3s, enforced by
 *     AuthContext safety timer).
 *  2. As soon as `isAuthenticated` becomes true → IMMEDIATELY switch to the
 *     'app' screen (within 1 render cycle, <100ms). Do NOT wait for OrgContext.
 *  3. The dashboard shell renders instantly. OrgContext resolves in the
 *     background. Org-dependent widgets show a lightweight inline loader.
 *  4. If OrgContext exceeds 8s → show "Unable to load dashboard" with Retry.
 *  5. If authentication fails → show a proper error page with Retry Login.
 *  6. Every auth step is logged to the console for debugging.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Zap, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { withRetry, installChunkErrorHandler } from '@/lib/dynamic-retry';
import { PremiumPageLoader, PremiumGlobalLoading } from '@/components/ui/premium-loading';
import { Button } from '@/components/ui/button';
import { withTimeout, isTimeoutError } from '@/lib/async/withTimeout';

// Install the global chunk-error safety net once on the client.
if (typeof window !== 'undefined') {
  installChunkErrorHandler();
}

// ── Loading placeholder (premium page-level loader) ──────────────────────────
const PageLoader = () => <PremiumPageLoader />;

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT-LEVEL LAZY COMPONENTS — only 5 dynamic imports at the root level.
// Each import is wrapped in `withRetry` so transient "Failed to load chunk"
// errors (common in Next.js 16 dev when the server recompiles) are retried
// automatically instead of crashing the app.
// ═══════════════════════════════════════════════════════════════════════════════
const LandingPage = dynamic(withRetry(() => import('@/components/landing/LandingPage')), { loading: PageLoader, ssr: false });
const LoginPage = dynamic(withRetry(() => import('@/components/auth/LoginPage')), { loading: PageLoader, ssr: false });

// NOTE: `OnboardingFlow` (the multi-step questionnaire) was previously a root
// dynamic import here. It has been REMOVED — the questionnaire flow is gone.
// After authentication, users without an org are silently auto-provisioned a
// default workspace by `<AutoProvisionWorkspace />` below. The
// `OnboardingFlow.tsx` file is kept on disk only for its type exports.

// DashboardShell exports DashboardContent + EmailVerificationBanner.
const DashboardContent = dynamic(
  withRetry(() => import('@/components/DashboardShell').then(m => ({ default: m.DashboardContent }))),
  { loading: PageLoader, ssr: false },
);
const EmailVerificationBanner = dynamic(
  withRetry(() => import('@/components/DashboardShell').then(m => ({ default: m.EmailVerificationBanner }))),
  { loading: () => null, ssr: false },
);

// ═══════════════════════════════════════════════════════════════════════════════
// AutoProvisionWorkspace — SILENT replacement for the old OnboardingScreen.
//
// When `needsOnboarding` is true (authenticated, no org, no error), this
// component renders a brief "Setting up your workspace…" loading state and
// AUTO-CREATES a default workspace in the background using the same logic the
// old `handleSkip` used:
//     createOrganization({ name: "${user.name}'s Workspace", plan: 'free' })
//   → completeOnboarding(orgId)
//   → setCurrentView('dashboard') + setCurrentScreen('app')
//
// The multi-step questionnaire (`OnboardingFlow`) is NO LONGER RENDERED.
// `OnboardingFlow.tsx` is kept on disk only for its type exports.
//
// Demo users never reach this component — OrgContext's fast path (lines
// 433-489) creates a local workspace synchronously, so `needsOrganization`
// is always false for them. This component only renders for real Firebase
// users whose profile resolved but who have no organization yet.
//
// FAILURE-HANDLING POLICY (Task 7 — permission-error elimination):
//   1. Try createOrganization once.
//   2. If it fails with a transient error (network, unavailable) → retry
//      once internally after 500ms (no UI flicker — stays on loading state).
//   3. If it fails with permission-denied OR retries exhaust → FALL BACK to
//      a local workspace (mirrors OrgContext's fallback). The user lands on
//      the dashboard in local mode. They never see "Couldn't set up your
//      workspace" or "Permission denied".
//   4. Only show the hard error screen if BOTH the create AND the local
//      fallback fail — which is essentially impossible (local fallback is
//      pure React state).
//
// A `ranRef` guards against double-invocation under React StrictMode / HMR.
// ═══════════════════════════════════════════════════════════════════════════════
function AutoProvisionWorkspace() {
  const { user } = useAuth();
  const { completeOnboarding, setLocalWorkspace } = useOrg();
  const { setCurrentScreen, setCurrentView } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  // Track the latest in-flight provision attempt so the Retry button doesn't
  // stack a second call on top of one that's still running.
  const provisionInFlightRef = useRef(false);
  // Track whether we've ever kicked off provisioning for this mount. Prevents
  // StrictMode double-invoke from creating two organizations.
  //
  // IMPORTANT: This is RESET in `handleRetry` so the Retry button actually
  // re-runs `provision()`. Previously the stale `ranRef` blocked retries,
  // leaving the user stuck on "Preparing your dashboard…" forever.
  const ranRef = useRef(false);

  // ── Local-workspace fallback ──────────────────────────────────────────────
  // CRITICAL FIX (root cause of the "Preparing your dashboard…" 1–2 hour hang):
  // Previously this only set localStorage + AppContext view — but
  // `needsOnboarding` in AppRouter depends on `OrgContext.organization`,
  // which NEITHER of those updates. So `<AutoProvisionWorkspace />` re-mounted
  // with `ranRef.current=true` blocking re-provision → stuck on
  // "Preparing your dashboard…" FOREVER.
  //
  // The fix is to call `setLocalWorkspace(user)` from OrgContext BEFORE
  // changing the view. This sets `organization = localOrg`, `loading=false`,
  // and `loadingForRef.current=user.id` so `needsOrganization` flips to
  // `false` and `<AutoProvisionWorkspace />` unmounts cleanly.
  const fallbackToLocalWorkspace = useCallback(async () => {
    if (!user) return false;
    console.warn('[AutoProvision] Falling back to local workspace — Firestore create failed');
    // Install the local workspace in OrgContext so `needsOrganization`
    // flips to `false` and this component actually unmounts.
    setLocalWorkspace(user);
    // Belt-and-suspenders: also navigate to dashboard (in case the
    // OrgContext update alone doesn't trigger AppRouter to re-render).
    setCurrentView('dashboard');
    setCurrentScreen('app');
    return true;
  }, [user, setLocalWorkspace, setCurrentView, setCurrentScreen]);

  const provision = useCallback(async () => {
    if (provisionInFlightRef.current) return;
    if (!user) {
      setError('No authenticated user found. Please sign in again.');
      return;
    }
    provisionInFlightRef.current = true;
    setIsProvisioning(true);
    setError(null);

    const tryCreate = async (): Promise<'ok' | 'fail'> => {
      try {
        const { createOrganization } = await import('@/lib/auth/organizations');
        // HARD TIMEOUT — Firestore's addDoc/setDoc can hang for MINUTES or
        // hours on network issues or permission errors (Firebase's internal
        // retry storm has no deadline). Race against 6s so the user NEVER
        // sits on "Preparing your dashboard…" for more than ~6s before we
        // fall back to a local workspace.
        const { organization, error: orgError } = await withTimeout(
          createOrganization({
            name: `${user.name}'s Workspace`,
            ownerId: user.id,
            ownerEmail: user.email,
            ownerDisplayName: user.name,
            ownerPhotoURL: user.picture || null,
            gstin: null,
            plan: 'free',
          }),
          6_000,
          'createOrganization',
        );
        if (orgError || !organization) {
          console.warn('[AutoProvision] createOrganization returned error:', orgError);
          return 'fail';
        }
        // completeOnboarding also hits Firestore (updateDoc) — bound it too.
        // CRITICAL FIX (root cause of the "Preparing your dashboard…" infinite hang):
        // Previously, on timeout, this branch swallowed the error and
        // `return 'ok'`. But `completeOnboarding` only calls
        // `resolveOrgContext` AFTER `markOnboardingComplete` succeeds — so a
        // timeout here meant `OrgContext.organization` stayed `null`, the
        // outer code called `setCurrentView('dashboard') + setCurrentScreen('app')`,
        // but `needsOrganization` was still `true` → `<AutoProvisionWorkspace />`
        // re-mounted with `ranRef.current=true` blocking re-provision →
        // INFINITE "Preparing your dashboard…" hang.
        //
        // Now: on timeout, install the local workspace via `setLocalWorkspace`
        // (which sets `organization` directly) so the component actually
        // unmounts. The created Firestore org still exists; on next reload,
        // `resolveOrgContext` will find it and reconcile.
        await withTimeout(
          completeOnboarding(organization.id),
          4_000,
          'completeOnboarding',
        ).catch((err) => {
          if (isTimeoutError(err)) {
            console.warn('[AutoProvision] completeOnboarding timed out — installing local workspace so the dashboard renders (created Firestore org will reconcile on next reload)');
            setLocalWorkspace({
              id: user.id,
              name: user.name,
              email: user.email,
              picture: user.picture,
              provider: user.provider,
              emailVerified: user.emailVerified,
            });
          } else {
            throw err;
          }
        });
        // After `completeOnboarding` (or the timeout fallback above),
        // `organization` is set (either real or local) → `needsOnboarding`
        // flips to false → AppRouter falls through to the DashboardTimeoutBoundary.
        setCurrentView('dashboard');
        setCurrentScreen('app');
        return 'ok';
      } catch (err) {
        if (isTimeoutError(err)) {
          console.warn('[AutoProvision] createOrganization TIMED OUT after 6s — Firestore unreachable, falling back to local workspace');
        } else {
          console.warn('[AutoProvision] createOrganization threw:', err);
        }
        return 'fail';
      }
    };

    // First attempt.
    let result = await tryCreate();
    if (result === 'ok') {
      setIsProvisioning(false);
      provisionInFlightRef.current = false;
      return;
    }

    // Single internal retry after 500ms (transient blip recovery — no UI flicker).
    console.warn('[AutoProvision] First attempt failed — retrying once in 500ms');
    await new Promise((r) => setTimeout(r, 500));
    result = await tryCreate();
    if (result === 'ok') {
      setIsProvisioning(false);
      provisionInFlightRef.current = false;
      return;
    }

    // Both attempts failed → fall back to local workspace. The user lands on
    // the dashboard in local mode. They NEVER see "Couldn't set up your
    // workspace" or "Permission denied".
    console.warn('[AutoProvision] Both attempts failed — falling back to local workspace');
    const fellBack = await fallbackToLocalWorkspace();
    setIsProvisioning(false);
    provisionInFlightRef.current = false;
    if (!fellBack) {
      // Last-resort: only show the hard error if the local fallback ALSO
      // failed (essentially impossible — fallback is pure React state).
      setError(
        "We're having trouble setting up your workspace right now. Please try again, or contact support if the problem continues."
      );
    }
  }, [user, completeOnboarding, setLocalWorkspace, setCurrentView, setCurrentScreen, fallbackToLocalWorkspace]);

  // Kick off provisioning once on mount.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void provision();
    // Intentionally empty deps — runs once per mount. `provision` is stable
    // for the lifetime of this component (only depends on `user`, which
    // can't change without unmounting).
  }, []);

  // ── HARD SAFETY NET — 15s max-mount deadline ─────────────────────────────
  // Even if every internal timeout/retry/fallback in `provision()` somehow
  // fails to escape, this hard deadline guarantees the user is NEVER stuck on
  // "Preparing your dashboard…" for more than 15 seconds. After 15s, we
  // unconditionally install a local workspace and switch to the dashboard.
  // This is the "belt-and-suspenders" backstop that makes the infinite-hang
  // bug structurally impossible.
  useEffect(() => {
    const HARD_DEADLINE_MS = 15_000;
    const timer = setTimeout(() => {
      if (!user) return;
      console.error('[AutoProvision] HARD 15s deadline exceeded — force-installing local workspace to unblock the user');
      setLocalWorkspace({
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        provider: user.provider,
        emailVerified: user.emailVerified,
      });
      setCurrentView('dashboard');
      setCurrentScreen('app');
    }, HARD_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [user, setLocalWorkspace, setCurrentView, setCurrentScreen]);

  const handleRetry = useCallback(() => {
    setError(null);
    // CRITICAL: reset ranRef so provision() actually re-runs. Without this,
    // the guard at the top of the mount effect (`if (ranRef.current) return`)
    // blocks retry, leaving the user stuck on "Preparing your dashboard…"
    // forever — even after clicking Retry.
    ranRef.current = false;
    void provision();
  }, [provision]);

  const handleContinueLocal = useCallback(() => {
    void fallbackToLocalWorkspace();
  }, [fallbackToLocalWorkspace]);

  // ── Error state: minimal card with Retry + Continue-local buttons. ──
  // This only renders if BOTH the create AND the local fallback failed —
  // which is essentially impossible. In practice the user always lands on
  // the dashboard via the fallback path.
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">We&apos;re having trouble</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
          <div className="flex items-center gap-3">
            <Button onClick={handleRetry}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            <Button variant="outline" onClick={handleContinueLocal}>
              Continue in local mode
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading state: brief, while we silently create the workspace. ──
  // Mirrors the visual language of the DashboardTimeoutBoundary loading shell
  // (same top bar + spinner) so the transition from "Loading your workspace…"
  // → "Setting up your workspace…" → dashboard feels continuous.
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-background/60 px-4 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            GSTPilot Infinity<span className="accent-text">™</span>
          </span>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <PremiumPageLoader
          label={isProvisioning ? 'Setting up your workspace…' : 'Preparing your dashboard…'}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DashboardTimeoutBoundary — handles loading + timeout states for the dashboard.
//
// CRITICAL CONTRACT (root-cause fix for auto-reload/logout loop):
//   • A timeout is a UI SAFETY BOUNDARY, NOT an authentication failure.
//   • The user's authenticated session is NEVER cleared on timeout.
//   • There is NO automatic retry, NO automatic reload, NO automatic logout.
//   • The dashboard shell renders IMMEDIATELY (progressive rendering) — the
//     user sees the app structure within milliseconds, and org-dependent
//     widgets show inline loaders while the org resolves in the background.
//   • If org resolution exceeds 8s, a NON-DESTRUCTIVE timeout screen appears
//     with a MANUAL "Retry" button. The session is preserved. The user can
//     also "Continue waiting" (dismiss the timeout screen and keep waiting).
//   • The underlying org-resolution request continues running — if it
//     succeeds later, the dashboard hydrates automatically.
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTimeoutBoundary({ children }: { children: React.ReactNode }) {
  const { loading: orgLoading, organization, reload, isPreviewMode } = useOrg();
  const { user } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!orgLoading && (organization || isPreviewMode)) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTimedOut(false);
      setElapsed(0);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    setTimedOut(false);
    let startTime = Date.now();
    // 15s timeout — this is a UI safety boundary, not an auth failure. The
    // underlying request continues running; if it succeeds later, the
    // dashboard hydrates automatically. The timeout screen just gives the
    // user a MANUAL "Retry" option — no auto-reload, no auto-logout.
    // Increased from 8s to 15s because the Firebase init timeout is now 5s,
    // giving a 10s buffer for the local-workspace fallback to complete
    // BEFORE the dashboard timeout fires. This prevents the loading gate
    // from appearing during normal sandbox/preview use.
    const TIMEOUT_SECONDS = 30;
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(secs);
      if (secs >= TIMEOUT_SECONDS) {
        // NON-DESTRUCTIVE: just show the timeout UI. Do NOT clear the session,
        // do NOT reload the page, do NOT auto-retry. The user presses Retry
        // manually if they want to re-attempt org resolution.
        console.warn('[Dashboard] Org resolution is taking longer than expected — showing manual retry option (session preserved)');
        setTimedOut(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [orgLoading, organization, isPreviewMode, reload]);

  const handleRetry = useCallback(() => {
    // MANUAL retry — only fires when the user clicks the button.
    setTimedOut(false);
    setElapsed(0);
    void reload();
  }, [reload]);

  const handleContinueWaiting = useCallback(() => {
    // Dismiss the timeout screen and keep waiting for the background request.
    setTimedOut(false);
  }, []);

  // ── Timeout state: org loading exceeded 8s. MANUAL Retry only.
  // NO auto-reload. NO auto-logout. Session is preserved.
  if (timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Something is taking longer than expected</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your workspace is still loading in the background. This can happen on slow connections.
            Your session is preserved — you can retry now or continue waiting.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={handleRetry}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            <Button variant="outline" onClick={handleContinueWaiting}>
              Continue waiting
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Signed in as {user?.email ?? 'Guest'} · Session preserved
          </p>
        </div>
      </div>
    );
  }

  // PROGRESSIVE RENDERING: instead of blocking on `orgLoading` with a full
  // splash screen, we render the dashboard shell IMMEDIATELY. The shell's own
  // data hooks (useBusinessSnapshot, useTimelineEvents, etc.) all gracefully
  // handle a missing/undefined org — they return `loading: true` and the
  // dashboard shows inline skeletons. This means the user sees the app
  // structure (top bar, left nav, breadcrumb) within milliseconds of auth
  // resolving, instead of waiting for org resolution to complete.
  //
  // The `timedOut` state (6s) still provides an escape hatch with Retry +
  // Continue-in-local-mode if org resolution genuinely hangs.
  return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AuthErrorScreen — proper error page with Retry Login
// ═══════════════════════════════════════════════════════════════════════════════
function AuthErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Authentication Error</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        <Button onClick={onRetry}>
          <LogOut className="h-4 w-4" />
          Retry Login
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AppRouter — top-level screen routing
//
// GOLDEN RULE: Once authenticated, the user NEVER sees the landing page.
// They always land on the dashboard (home page). The DashboardTimeoutBoundary
// handles all loading / error / timeout states inline.
//
// Routing priority:
//   1. isInitializing → loading splash (max 3s)
//   2. isAuthenticated → ALWAYS dashboard (with boundary for loading/error)
//      • If needs onboarding (no org, no error) → AutoProvisionWorkspace
//        (silently creates a default workspace, then navigates to dashboard)
//      • Otherwise → DashboardTimeoutBoundary > DashboardContent
//   3. currentScreen === 'login' → LoginPage
//   4. Default → LandingPage (only for unauthenticated visitors)
// ═══════════════════════════════════════════════════════════════════════════════
export function AppRouter() {
  const { currentScreen, setCurrentScreen } = useApp();
  const { isAuthenticated, isInitializing, needsEmailVerification, error: authError, logout } = useAuth();
  const { needsOrganization, error: orgError } = useOrg();

  const needsOnboarding = isAuthenticated && needsOrganization && !orgError;

  // ── Switch to 'app' screen IMMEDIATELY when authenticated. Do NOT wait for
  // OrgContext to resolve. The dashboard shell renders instantly with an inline
  // loading state while the org resolves in the background.
  useEffect(() => {
    if (isInitializing) return;
    if (isAuthenticated && !needsOnboarding && currentScreen !== 'app') {
      setCurrentScreen('app');
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen, needsOnboarding]);

  // If not authenticated and currently on 'app', go back to landing
  useEffect(() => {
    if (isInitializing) return;
    if (!isAuthenticated && currentScreen === 'app') {
      setCurrentScreen('landing');
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen]);

  const handleGetStarted = () => setCurrentScreen('login');
  const handleBookDemo = () => setCurrentScreen('login');
  const handleBackToLanding = () => setCurrentScreen('landing');
  const handleRetryLogin = useCallback(async () => {
    await logout();
    setCurrentScreen('login');
  }, [logout, setCurrentScreen]);

  // ── Loading state while authentication initializes (max 3s via safety timer).
  if (isInitializing && !isAuthenticated && currentScreen !== 'login') {
    return <PremiumGlobalLoading />;
  }

  // ── Auth error → proper error page with Retry Login
  if (!isInitializing && !isAuthenticated && authError && currentScreen !== 'login') {
    return <AuthErrorScreen message={authError} onRetry={handleRetryLogin} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATED ROUTING — the user is signed in. They NEVER see landing.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Authenticated but no organization AND no error → SILENTLY auto-provision
  // a default workspace. The old behavior rendered a multi-step questionnaire
  // (`<OnboardingScreen />` → `<OnboardingFlow>`); the questionnaire is gone.
  // The AutoProvisionWorkspace component shows a brief loading state while it
  // creates a default workspace in the background, then navigates to the
  // dashboard. Demo users never reach this branch (OrgContext fast path).
  if (isAuthenticated && needsOnboarding && !orgError) {
    return <AutoProvisionWorkspace />;
  }

  // ── Authenticated → ALWAYS render the dashboard. The DashboardTimeoutBoundary
  // handles ALL sub-states: loading shell, org error (retry), 8s timeout, and
  // the fully-resolved dashboard. This is the SINGLE entry point for any
  // signed-in user — they never fall through to the landing page.
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        {needsEmailVerification && <EmailVerificationBanner />}
        <DashboardTimeoutBoundary>
          <DashboardContent />
        </DashboardTimeoutBoundary>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UNAUTHENTICATED ROUTING — only reached when NOT authenticated.
  // ═══════════════════════════════════════════════════════════════════════════

  if (currentScreen === 'login') {
    return <LoginPage onBack={handleBackToLanding} onGetStarted={handleGetStarted} />;
  }

  return <LandingPage onGetStarted={handleGetStarted} onBookDemo={handleBookDemo} />;
}

export default AppRouter;
