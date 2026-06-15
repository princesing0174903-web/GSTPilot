'use client'

import React, { useEffect, useState } from 'react'
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import DashboardPage from '@/components/dashboard/DashboardPage'
import ReturnsPage from '@/components/returns/ReturnsPage'
import ReconciliationPage from '@/components/reconciliation/ReconciliationPage'
import InvoiceWorkspacePage from '@/components/invoices/InvoiceWorkspacePage'
import ClientRegistryPage from '@/components/clients/ClientRegistryPage'
import ClientWorkspacePage from '@/components/clients/ClientWorkspacePage'
import ReturnPrepWorkspace from '@/components/returns/ReturnPrepWorkspace'
import SettingsPage from '@/components/settings/SettingsPage'
import LandingPage from '@/components/landing/LandingPage'
import LoginPage from '@/components/auth/LoginPage'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Zap, LogOut, User, Settings, MailCheck } from 'lucide-react'
import WorkflowTracker from '@/components/workflow/WorkflowTracker'

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  returns: 'Returns',
  reconcile: 'Reconcile',
  invoices: 'Invoices',
  clients: 'Clients',
  settings: 'Settings',
  'client-workspace': 'Client Workspace',
  'return-prep': 'Return Preparation',
}

function DashboardContent() {
  const { currentView } = useApp()
  const { user, logout } = useAuth()

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardPage />
      case 'returns':
        return <ReturnsPage />
      case 'reconcile':
        return <ReconciliationPage />
      case 'invoices':
        return <InvoiceWorkspacePage />
      case 'clients':
        return <ClientRegistryPage />
      case 'client-workspace':
        return <ClientWorkspacePage />
      case 'return-prep':
        return <ReturnPrepWorkspace />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage />
    }
  }

  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-13 items-center gap-3 border-b bg-white/80 backdrop-blur-sm px-4 sticky top-0 z-10 dark:bg-sidebar/80">
          <SidebarTrigger className="-ml-1 h-7 w-7" />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">
              {VIEW_TITLES[currentView] || 'Dashboard'}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Separator orientation="vertical" className="h-5" />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors outline-none">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-xs font-medium text-foreground leading-tight">{user?.name || 'User'}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{user?.email || ''}</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {/* Persistent Workflow Tracker Bar */}
        <div className="border-b border-border/30 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm px-4">
          <WorkflowTracker compact />
        </div>
        <main className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-950/50">
          {renderView()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function EmailVerificationBanner() {
  const { user, logout } = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleResend = async () => {
    setSending(true)
    try {
      const { sendVerificationEmail } = await import('@/lib/auth')
      const { error } = await sendVerificationEmail()
      if (!error) setSent(true)
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <MailCheck className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            {sent
              ? 'Verification email sent! Check your inbox.'
              : 'Please verify your email address to access all features.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!sent && (
            <button
              onClick={handleResend}
              disabled={sending}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Resend email'}
            </button>
          )}
          <button
            onClick={logout}
            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

function OnboardingScreen() {
  const { user, markOnboardingComplete } = useAuth()
  const { setCurrentScreen, setCurrentView } = useApp()
  const [saveError, setSaveError] = React.useState<string | null>(null)

  // ── Fire-and-forget: save onboarding data to Firestore in the background ──
  const saveOnboardingToFirestore = async (
    data: import('@/components/onboarding/OnboardingFlow').OnboardingData,
    firmId: string
  ) => {
    try {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('@/lib/firebase')

      if (!user) return

      // Update user document
      await setDoc(doc(db, 'users', user.id), {
        uid: user.id,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        ageGroup: data.ageGroup,
        profession: data.profession,
        experience: data.experience,
        firmId: firmId || null,
        firmName: data.firmName,
        onboardingCompleted: true,
        clientCount: data.clientCount,
        monthlyReturns: data.monthlyReturns,
        gstServices: data.gstServices,
        painPoints: data.painPoints,
        referralSource: data.referralSource,
        trialReasons: data.trialReasons,
        wantsUpdates: data.wantsUpdates,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      console.log('[Onboarding] ✅ User document saved to Firestore')

      // Save onboarding record
      await setDoc(doc(db, 'onboarding', user.id), {
        ...data,
        firmId: firmId || null,
        completedAt: serverTimestamp(),
      })
      console.log('[Onboarding] ✅ Onboarding record saved to Firestore')
    } catch (error) {
      console.warn('[Onboarding] ⚠️ Background Firestore save failed:', error)
    }
  }

  const handleOnboardingComplete = (
    data: import('@/components/onboarding/OnboardingFlow').OnboardingData,
    destination?: import('@/components/onboarding/OnboardingFlow').OnboardingDestination
  ) => {
    setSaveError(null)

    if (!user) {
      setSaveError('No authenticated user found. Please sign in again.')
      return
    }

    // ── INSTANT: Mark onboarding complete locally & navigate ──
    // This happens synchronously — user sees dashboard immediately
    console.log('[Onboarding] 🚀 Navigating to', destination || 'dashboard', '(optimistic)')
    markOnboardingComplete(undefined, data.firmName)
    setCurrentView(destination || 'dashboard')
    setCurrentScreen('app')

    // ── BACKGROUND: Create firm doc + save everything to Firestore ──
    // These happen async — user is already in the dashboard
    console.log('[Onboarding] 📝 Starting background Firestore writes...')
    ;(async () => {
      try {
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
        const { db } = await import('@/lib/firebase')

        // Create firm document
        let firmId = ''
        try {
          const firmRef = await addDoc(collection(db, 'firms'), {
            ownerId: user.id,
            firmName: data.firmName,
            gstin: data.gstin || null,
            state: data.state,
            stateCode: data.stateCode,
            organizationType: data.organizationType,
            icaiMembershipNo: data.icaiMembershipNo || null,
            officeAddress: data.officeAddress || null,
            createdAt: serverTimestamp(),
          })
          firmId = firmRef.id
          console.log('[Onboarding] ✅ Firm created:', firmId)

          // Update the local user with firmId
          markOnboardingComplete(firmId, data.firmName)
        } catch (firmError) {
          console.warn('[Onboarding] ⚠️ Firm creation failed:', firmError)
        }

        // Save remaining data
        await saveOnboardingToFirestore(data, firmId)
      } catch (error) {
        console.warn('[Onboarding] ⚠️ Background save error:', error)
      }
    })()
  }

  const handleSkip = () => {
    setSaveError(null)

    if (!user) {
      setSaveError('No authenticated user found. Please sign in again.')
      return
    }

    // ── INSTANT: Navigate immediately ──
    console.log('[Onboarding] 🚀 Skipping onboarding (optimistic)')
    markOnboardingComplete()
    setCurrentView('dashboard')
    setCurrentScreen('app')

    // ── BACKGROUND: Mark as completed in Firestore ──
    ;(async () => {
      try {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
        const { db } = await import('@/lib/firebase')
        await setDoc(doc(db, 'users', user.id), {
          onboardingCompleted: true,
          updatedAt: serverTimestamp(),
        }, { merge: true })
        console.log('[Onboarding] ✅ Skip saved to Firestore')
      } catch (error) {
        console.warn('[Onboarding] ⚠️ Background skip save failed:', error)
      }
    })()
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

function AppRouter() {
  const { currentScreen, setCurrentScreen } = useApp()
  const { isAuthenticated, isInitializing, needsOnboarding, needsEmailVerification } = useAuth()

  useEffect(() => {
    if (isInitializing) return
    // Only auto-redirect to app if authenticated AND onboarding is complete
    // Don't redirect if user still needs onboarding — the OnboardingScreen handles its own navigation
    if (isAuthenticated && !needsOnboarding && currentScreen !== 'app') {
      setCurrentScreen('app')
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen, needsOnboarding])

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated && currentScreen === 'app') {
      setCurrentScreen('landing')
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen])

  const handleGetStarted = () => setCurrentScreen('login')
  const handleBookDemo = () => setCurrentScreen('login')
  const handleBackToLanding = () => setCurrentScreen('landing')

  if (isInitializing && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/20">
            <Zap className="h-6 w-6 text-white animate-pulse" />
          </div>
          <span className="text-sm text-slate-500 font-medium">Loading GSTPilot...</span>
        </div>
      </div>
    )
  }

  // Show onboarding if user hasn't completed it
  if (isAuthenticated && needsOnboarding) {
    return <OnboardingScreen />
  }

  if (currentScreen === 'app' && isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        {needsEmailVerification && <EmailVerificationBanner />}
        <div className="flex-1 flex">
          <DashboardContent />
        </div>
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
