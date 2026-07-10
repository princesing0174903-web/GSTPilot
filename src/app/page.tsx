'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Infinity™ — Root Page (lightweight router)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This file is INTENTIONALLY minimal. It contains only the AppRouter logic that
 * decides which top-level screen to show (Landing / Login / Onboarding /
 * Dashboard). All heavy modules are lazy-loaded:
 *
 *   • LandingPage        — dynamic import
 *   • LoginPage          — dynamic import
 *   • OnboardingFlow     — dynamic import
 *   • DashboardShell     — dynamic import (contains the full app shell:
 *                          top bar, left nav, Oracle panel, command palette,
 *                          notifications sheet, + DashboardViews registry)
 *
 * WHY: The 4 GB sandbox cgroup OOM-kills the dev server when the root route
 * pulls in 150+ view components and their dependency trees synchronously.
 * By keeping page.tsx to ~250 lines of pure routing logic, the initial `/`
 * compile only processes this file + the lightweight auth/org contexts.
 * The heavy dashboard shell is compiled on-demand AFTER authentication.
 */

import React, { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useOrg } from '@/contexts/OrgContext'
import dynamic from 'next/dynamic'
import { Zap } from 'lucide-react'

// ── Loading placeholder ───────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex h-full min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT-LEVEL LAZY COMPONENTS — only 5 dynamic imports at the root level.
// The 150 dashboard views + heavy layout chrome are isolated inside
// <DashboardShell /> (which itself lazy-loads <DashboardViews />), so Turbopack
// never has to compile the full app graph during the initial `/` compile.
// ═══════════════════════════════════════════════════════════════════════════════
const LandingPage = dynamic(() => import('@/components/landing/LandingPage'), { loading: PageLoader, ssr: false })
const LoginPage = dynamic(() => import('@/components/auth/LoginPage'), { loading: PageLoader, ssr: false })
const OnboardingFlow = dynamic(() => import('@/components/onboarding/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })), { loading: PageLoader, ssr: false })

// DashboardShell exports DashboardContent + EmailVerificationBanner.
// Both are lazy so the 150-view dashboard graph stays out of the initial compile.
const DashboardContent = dynamic(
  () => import('@/components/DashboardShell').then(m => ({ default: m.DashboardContent })),
  { loading: PageLoader, ssr: false },
)
const EmailVerificationBanner = dynamic(
  () => import('@/components/DashboardShell').then(m => ({ default: m.EmailVerificationBanner })),
  { loading: () => null, ssr: false },
)

// ═══════════════════════════════════════════════════════════════════════════════
// OnboardingScreen — uses OnboardingFlow (dynamic) + lazy firebase imports
// ═══════════════════════════════════════════════════════════════════════════════
function OnboardingScreen() {
  const { user } = useAuth()
  const { completeOnboarding } = useOrg()
  const { setCurrentScreen, setCurrentView } = useApp()
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // ── Create the organization + owner membership via the org service ──
  const createOrganizationForUser = async (
    data: import('@/components/onboarding/OnboardingFlow').OnboardingData
  ): Promise<{ orgId: string | null; error: string | null }> => {
    if (!user) return { orgId: null, error: 'No authenticated user found.' }

    const { createOrganization, updateUserProfile } = await import('@/lib/auth/organizations')
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
    const { db } = await import('@/lib/firebase')

    // 1. Create the organization + owner membership + set currentOrganizationId.
    const { organization, error: orgError } = await createOrganization({
      name: data.firmName,
      ownerId: user.id,
      ownerEmail: user.email,
      ownerDisplayName: data.fullName || user.name,
      ownerPhotoURL: user.picture || null,
      gstin: data.gstin || null,
      plan: 'free',
    })
    if (orgError || !organization) {
      return { orgId: null, error: orgError || 'Could not create your organization.' }
    }

    // 2. Enrich the user profile with onboarding metadata (best-effort).
    try {
      await updateUserProfile(user.id, {
        displayName: data.fullName,
        phone: data.phone,
        company: data.firmName,
        gstin: data.gstin || null,
      })
      // Persist the extended onboarding questionnaire for analytics.
      await setDoc(doc(db, 'onboarding', user.id), {
        ...data,
        organizationId: organization.id,
        completedAt: serverTimestamp(),
      }, { merge: true })
    } catch (err) {
      console.warn('[Onboarding] Profile enrichment failed:', err)
    }

    return { orgId: organization.id, error: null }
  }

  const handleOnboardingComplete = async (
    data: import('@/components/onboarding/OnboardingFlow').OnboardingData,
    destination?: import('@/components/onboarding/OnboardingFlow').OnboardingDestination
  ) => {
    setSaveError(null)
    if (!user) {
      setSaveError('No authenticated user found. Please sign in again.')
      return
    }

    setIsSubmitting(true)
    try {
      const { orgId, error: createError } = await createOrganizationForUser(data)
      if (createError || !orgId) {
        setSaveError(createError || 'Could not create your organization. Please try again.')
        setIsSubmitting(false)
        return
      }

      // Reload the org context so the rest of the app sees the new org.
      await completeOnboarding(orgId)

      // Navigate to the chosen destination.
      setCurrentView(destination || 'dashboard')
      setCurrentScreen('app')
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while setting up your workspace.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = async () => {
    setSaveError(null)
    if (!user) {
      setSaveError('No authenticated user found. Please sign in again.')
      return
    }

    setIsSubmitting(true)
    try {
      // Skipping still requires an organization — create a default one
      // using the user's name so the app is fully functional.
      const { createOrganization } = await import('@/lib/auth/organizations')
      const { organization, error: orgError } = await createOrganization({
        name: `${user.name}'s Workspace`,
        ownerId: user.id,
        ownerEmail: user.email,
        ownerDisplayName: user.name,
        ownerPhotoURL: user.picture || null,
        gstin: null,
        plan: 'free',
      })
      if (orgError || !organization) {
        setSaveError(orgError || 'Could not create your workspace. Please try again.')
        setIsSubmitting(false)
        return
      }
      await completeOnboarding(organization.id)
      setCurrentView('dashboard')
      setCurrentScreen('app')
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while setting up your workspace.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <OnboardingFlow
      onComplete={handleOnboardingComplete}
      onSkip={handleSkip}
      userEmail={user?.email}
      userName={user?.name}
      error={saveError}
      onDismissError={() => setSaveError(null)}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AppRouter — top-level screen routing
// ═══════════════════════════════════════════════════════════════════════════════
function AppRouter() {
  const { currentScreen, setCurrentScreen } = useApp()
  const { isAuthenticated, isInitializing, needsEmailVerification } = useAuth()
  // ── PART 3 / PART 5 ── The org context is the source of truth for whether
  // the user has an organization. `needsOrganization` becomes the new
  // "needs onboarding" gate. `orgLoading` lets us hold the protected routes
  // until the tenant context is fully resolved so no page ever renders with a
  // null organizationId.
  const { needsOrganization, loading: orgLoading, organization, error: orgError, reload: reloadOrg } = useOrg()

  // Derived: a user needs onboarding when authenticated but without an org.
  const needsOnboarding = isAuthenticated && needsOrganization

  useEffect(() => {
    if (isInitializing) return
    // Only auto-redirect to the app when: authenticated, org context resolved,
    // and the user actually has an organization. Otherwise the OnboardingScreen
    // handles its own navigation.
    if (isAuthenticated && !needsOnboarding && !orgLoading && currentScreen !== 'app') {
      setCurrentScreen('app')
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen, needsOnboarding, orgLoading])

  useEffect(() => {
    if (isInitializing) return
    // ── PART 5 ── Protected routes: kick unauthenticated users back to landing.
    if (!isAuthenticated && currentScreen === 'app') {
      setCurrentScreen('landing')
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen])

  const handleGetStarted = () => setCurrentScreen('login')
  const handleBookDemo = () => setCurrentScreen('login')
  const handleBackToLanding = () => setCurrentScreen('landing')

  // ── PART 7 ── Loading state while authentication initializes.
  // Only show the full-screen loader on the INITIAL landing/app load — never
  // when the user has explicitly navigated to the login screen. This guarantees
  // the login form is always reachable even if Firebase auth init is slow, so
  // the user can sign in with demo mode or email without waiting on the network.
  if (isInitializing && !isAuthenticated && currentScreen !== 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-surface motion-pulse">
            <Zap className="h-5 w-5 accent-text" />
          </div>
          <span className="text-sm text-white/55 font-medium">Loading GSTPilot…</span>
        </div>
      </div>
    )
  }

  // ── PART 7 ── While the org context is resolving after auth, show a brief
  // loader so protected pages never mount with a null organization.
  if (isAuthenticated && orgLoading && !needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-surface motion-pulse">
            <Zap className="h-5 w-5 accent-text" />
          </div>
          <span className="text-sm text-white/55 font-medium">Loading your workspace…</span>
        </div>
      </div>
    )
  }

  // ── PART 2 ── Authenticated but no organization → onboarding creates one.
  // BUT: if there was a load error (e.g. Firestore unreachable), show a retry
  // screen instead of onboarding — onboarding would also fail to write.
  if (needsOnboarding && !orgError) {
    return <OnboardingScreen />
  }

  // ── PART 8 ── Org context failed to load after retries. Show a friendly
  // error with a retry button — BUT never for permission errors. Permission
  // errors mean the user is in preview/offline mode; OrgContext already falls
  // back to a demo org in that case, so we treat any residual permission error
  // as "preview mode" and render the app shell with empty states.
  const isOrgPermissionError = !!orgError && (
    /permission|insufficient|unauthenticated|not authorized|missing or/i.test(orgError)
  )
  if (isAuthenticated && !orgLoading && orgError && !organization && !isOrgPermissionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="flex flex-col items-center gap-5 max-w-md text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
            <Zap className="h-6 w-6 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Couldn&apos;t load your workspace</h2>
          <p className="text-sm text-white/55 leading-relaxed">
            {orgError}
          </p>
          <button
            onClick={() => reloadOrg()}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── PART 5 ── Protected route: render the app shell when authenticated AND
  // (the organization is loaded OR we're in preview/permission-error mode).
  // This guarantees the user never gets stuck behind a wall when Firestore is
  // unreachable — they see the dashboard with premium empty states instead.
  if (currentScreen === 'app' && isAuthenticated && (organization || isOrgPermissionError)) {
    return (
      <div className="flex min-h-screen flex-col">
        {needsEmailVerification && <EmailVerificationBanner />}
        <DashboardContent />
      </div>
    )
  }

  if (currentScreen === 'login') {
    return <LoginPage onBack={handleBackToLanding} onGetStarted={handleGetStarted} />
  }

  return <LandingPage onGetStarted={handleGetStarted} onBookDemo={handleBookDemo} />
}

export default function Home() {
  return <AppRouter />
}
