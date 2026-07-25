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

// Install the global chunk-error safety net once on the client.
if (typeof window !== 'undefined') {
  installChunkErrorHandler();
}

// ── Loading placeholder ───────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex h-full min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT-LEVEL LAZY COMPONENTS — only 5 dynamic imports at the root level.
// Each import is wrapped in `withRetry` so transient "Failed to load chunk"
// errors (common in Next.js 16 dev when the server recompiles) are retried
// automatically instead of crashing the app.
// ═══════════════════════════════════════════════════════════════════════════════
const LandingPage = dynamic(withRetry(() => import('@/components/landing/LandingPage')), { loading: PageLoader, ssr: false });
const LoginPage = dynamic(withRetry(() => import('@/components/auth/LoginPage')), { loading: PageLoader, ssr: false });
const OnboardingFlow = dynamic(withRetry(() => import('@/components/onboarding/OnboardingFlow').then(m => ({ default: m.OnboardingFlow }))), { loading: PageLoader, ssr: false });

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
// OnboardingScreen — uses OnboardingFlow (dynamic) + lazy firebase imports
// ═══════════════════════════════════════════════════════════════════════════════
function OnboardingScreen() {
  const { user } = useAuth();
  const { completeOnboarding } = useOrg();
  const { setCurrentScreen, setCurrentView } = useApp();
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const createOrganizationForUser = async (
    data: import('@/components/onboarding/OnboardingFlow').OnboardingData
  ): Promise<{ orgId: string | null; error: string | null }> => {
    if (!user) return { orgId: null, error: 'No authenticated user found.' };

    const { createOrganization, updateUserProfile } = await import('@/lib/auth/organizations');
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');

    const { organization, error: orgError } = await createOrganization({
      name: data.firmName,
      ownerId: user.id,
      ownerEmail: user.email,
      ownerDisplayName: data.fullName || user.name,
      ownerPhotoURL: user.picture || null,
      gstin: data.gstin || null,
      plan: 'free',
    });
    if (orgError || !organization) {
      return { orgId: null, error: orgError || 'Could not create your organization.' };
    }

    try {
      await updateUserProfile(user.id, {
        displayName: data.fullName,
        phone: data.phone,
        company: data.firmName,
        gstin: data.gstin || null,
      });
      await setDoc(doc(db, 'onboarding', user.id), {
        ...data,
        organizationId: organization.id,
        completedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('[Onboarding] Profile enrichment failed:', err);
    }

    return { orgId: organization.id, error: null };
  };

  const handleOnboardingComplete = async (
    data: import('@/components/onboarding/OnboardingFlow').OnboardingData,
    destination?: import('@/components/onboarding/OnboardingFlow').OnboardingDestination
  ) => {
    setSaveError(null);
    if (!user) {
      setSaveError('No authenticated user found. Please sign in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { orgId, error: createError } = await createOrganizationForUser(data);
      if (createError || !orgId) {
        setSaveError(createError || 'Could not create your organization. Please try again.');
        setIsSubmitting(false);
        return;
      }

      await completeOnboarding(orgId);
      setCurrentView(destination || 'dashboard');
      setCurrentScreen('app');
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while setting up your workspace.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSaveError(null);
    if (!user) {
      setSaveError('No authenticated user found. Please sign in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { createOrganization } = await import('@/lib/auth/organizations');
      const { organization, error: orgError } = await createOrganization({
        name: `${user.name}'s Workspace`,
        ownerId: user.id,
        ownerEmail: user.email,
        ownerDisplayName: user.name,
        ownerPhotoURL: user.picture || null,
        gstin: null,
        plan: 'free',
      });
      if (orgError || !organization) {
        setSaveError(orgError || 'Could not create your workspace. Please try again.');
        setIsSubmitting(false);
        return;
      }
      await completeOnboarding(organization.id);
      setCurrentView('dashboard');
      setCurrentScreen('app');
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while setting up your workspace.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingFlow
      onComplete={handleOnboardingComplete}
      onSkip={handleSkip}
      userEmail={user?.email}
      userName={user?.name}
      error={saveError}
      onDismissError={() => setSaveError(null)}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DashboardTimeoutBoundary — handles loading + timeout states for the dashboard.
// Once authenticated, the user ALWAYS sees this boundary (never the landing
// page). It shows:
//   • Inline loading shell while org resolves (up to 8s)
//   • Timeout screen with Retry if org takes >8s (rare — only on very slow
//     networks; Firestore failure falls back to a local workspace, not an error)
//   • The dashboard children once org is resolved
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTimeoutBoundary({ children }: { children: React.ReactNode }) {
  const { loading: orgLoading, organization, reload, isPreviewMode } = useOrg();
  const [timedOut, setTimedOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const autoRetriedRef = useRef(false);

  useEffect(() => {
    if (!orgLoading && (organization || isPreviewMode)) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTimedOut(false);
      setElapsed(0);
      autoRetriedRef.current = false;
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    setTimedOut(false);
    // `let` (not `const`) so the auto-retry path below can reset it — otherwise
    // the second attempt inherits the first attempt's elapsed time and trips
    // the timeout almost immediately, defeating the purpose of the retry.
    let startTime = Date.now();
    // Increased from 8s → 15s. The previous 8s threshold was too aggressive on
    // slow connections / cold Firebase lazy-loads. Demo users now resolve
    // synchronously (see OrgContext fast path), so this only affects real
    // Firebase users on genuinely slow networks.
    const TIMEOUT_SECONDS = 15;
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(secs);
      if (secs >= TIMEOUT_SECONDS) {
        // Auto-retry once before showing the error screen. Many "timeouts" are
        // just transient blips that a single reload() resolves instantly.
        if (!autoRetriedRef.current) {
          autoRetriedRef.current = true;
          console.warn('[Dashboard] Initialization slow — auto-retrying org context once');
          void reload();
          // Reset the timer for the second attempt so the user gets the FULL
          // 15s grace period again (not just ~1s before the next tick trips
          // the timeout). Without this reset, `secs` stays >= 15 on the next
          // tick and the error screen fires almost immediately.
          startTime = Date.now();
          setElapsed(0);
          return;
        }
        console.error('[Dashboard] Initialization exceeded 15s — showing timeout screen');
        setTimedOut(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [orgLoading, organization, isPreviewMode, reload]);

  const handleRetry = useCallback(() => {
    console.log('[Dashboard] Retry clicked — reloading org context');
    setTimedOut(false);
    setElapsed(0);
    autoRetriedRef.current = false;
    void reload();
  }, [reload]);

  // ── Timeout state: org loading exceeded 8s. This is rare because Firestore
  // failures fall back to a local workspace. This only triggers on genuinely
  // slow networks where the Firestore request is still pending after 8s.
  if (timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Taking longer than usual</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your workspace is still loading. This can happen on slow connections.
            Give it a moment, or retry now.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity press-scale"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // While org is loading, render the dashboard shell immediately with an
  // inline loading indicator. This is the "progressive loading" requirement:
  // the shell (top bar, left nav) appears instantly, and only the
  // org-dependent content area shows a loader.
  if (orgLoading && !organization && !isPreviewMode) {
    return (
      <div className="relative flex h-screen flex-col overflow-hidden bg-background">
        {/* Minimal top bar so the shell is visible */}
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
        {/* Loading workspace */}
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium text-foreground">Loading your workspace…</span>
              <span className="text-xs text-muted-foreground">
                {elapsed > 0 ? `${elapsed}s elapsed` : 'Resolving organization'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
        >
          <LogOut className="h-4 w-4" />
          Retry Login
        </button>
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
//      • If needs onboarding (no org, no error) → OnboardingScreen
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
      console.log('[AppRouter] Authenticated → switching to app screen immediately');
      setCurrentScreen('app');
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen, needsOnboarding]);

  // If not authenticated and currently on 'app', go back to landing
  useEffect(() => {
    if (isInitializing) return;
    if (!isAuthenticated && currentScreen === 'app') {
      console.log('[AppRouter] Not authenticated → switching to landing');
      setCurrentScreen('landing');
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen]);

  const handleGetStarted = () => setCurrentScreen('login');
  const handleBookDemo = () => setCurrentScreen('login');
  const handleBackToLanding = () => setCurrentScreen('landing');
  const handleRetryLogin = useCallback(async () => {
    console.log('[AppRouter] Retry login — logging out and returning to login screen');
    await logout();
    setCurrentScreen('login');
  }, [logout, setCurrentScreen]);

  // ── Loading state while authentication initializes (max 3s via safety timer).
  if (isInitializing && !isAuthenticated && currentScreen !== 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-surface motion-pulse">
            <Zap className="h-5 w-5 accent-text" />
          </div>
          <span className="text-sm text-muted-foreground font-medium">Loading GSTPilot…</span>
        </div>
      </div>
    );
  }

  // ── Auth error → proper error page with Retry Login
  if (!isInitializing && !isAuthenticated && authError && currentScreen !== 'login') {
    return <AuthErrorScreen message={authError} onRetry={handleRetryLogin} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATED ROUTING — the user is signed in. They NEVER see landing.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Authenticated but no organization AND no error → onboarding creates one.
  if (isAuthenticated && needsOnboarding && !orgError) {
    return <OnboardingScreen />;
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
