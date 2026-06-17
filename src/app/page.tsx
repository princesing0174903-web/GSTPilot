'use client'

import React, { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Zap, LogOut, User, Settings, MailCheck, ArrowLeft, Sparkles } from 'lucide-react'
import FirmCommandCenterPage from '@/components/firm-command-center/FirmCommandCenterPage'
import MultiFirmPage from '@/components/multi-firm/MultiFirmPage'
import AutopilotPage from '@/components/autopilot/AutopilotPage'
import AICAManagerPage from '@/components/ai-ca-manager/AICAManagerPage'
import AIAccountManagerPage from '@/components/ai-account-manager/AIAccountManagerPage'
import AIDeadlineEnginePage from '@/components/ai-deadline-engine/AIDeadlineEnginePage'
import AIDocumentEmployeePage from '@/components/ai-document-employee/AIDocumentEmployeePage'
import AIVoiceAssistantPage from '@/components/ai-voice-assistant/AIVoiceAssistantPage'
import AIFirmMemoryPage from '@/components/ai-firm-memory/AIFirmMemoryPage'
import AIOperatingRoomPage from '@/components/ai-operating-room/AIOperatingRoomPage'
import AIPredictionsPage from '@/components/ai-predictions/AIPredictionsPage'
import AIPriorityEnginePage from '@/components/ai-priority-engine/AIPriorityEnginePage'
import BusinessGraphPage from '@/components/business-graph/BusinessGraphPage'
import DataMoatPage from '@/components/data-moat/DataMoatPage'
import EmbeddedFinancePage from '@/components/embedded-finance/EmbeddedFinancePage'
import IndustryBenchmarkPage from '@/components/industry-benchmark/IndustryBenchmarkPage'
import WorkingCapitalPage from '@/components/working-capital/WorkingCapitalPage'
import NetworkEffectsPage from '@/components/network-effects/NetworkEffectsPage'
import AIBusinessCopilotPage from '@/components/ai-business-copilot/AIBusinessCopilotPage'
import RunMyBusinessPage from '@/components/run-my-business/RunMyBusinessPage'
import ExecutiveWarRoomPage from '@/components/executive-war-room/ExecutiveWarRoomPage'
import AppStorePage from '@/components/app-store/AppStorePage'
import DigitalTwinPage from '@/components/digital-twin/DigitalTwinPage'
import APIPlatformPage from '@/components/api-platform-v2/APIPlatformPage'
import EventEnginePage from '@/components/event-engine/EventEnginePage'
import AgentOSPage from '@/components/agent-os/AgentOSPage'
import DecisionEnginePage from '@/components/decision-engine/DecisionEnginePage'
import GSTPilotNetworkPage from '@/components/gstpilot-network/GSTPilotNetworkPage'
import DataCloudPage from '@/components/data-cloud/DataCloudPage'
import RunIndiaBusinessPage from '@/components/run-india-business/RunIndiaBusinessPage'
import UniversalBusinessIDPage from '@/components/universal-business-id/UniversalBusinessIDPage'
import CreditScoringEnginePage from '@/components/credit-scoring-engine/CreditScoringEnginePage'
import InvoiceExchangePage from '@/components/invoice-exchange/InvoiceExchangePage'
import FinancingMarketplacePage from '@/components/financing-marketplace/FinancingMarketplacePage'
import EconomicGraphPage from '@/components/economic-graph/EconomicGraphPage'
import EconomicWarRoomPage from '@/components/economic-war-room/EconomicWarRoomPage'
import RunMyCompanyPage from '@/components/run-my-company/RunMyCompanyPage'
import MissionControlPage from '@/components/mission-control/MissionControlPage'
import BusinessDNApage from '@/components/business-dna/BusinessDNApage'

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Mission Control',
  'business-dna': 'Business DNA',
  returns: 'Returns',
  reconcile: 'Reconcile',
  invoices: 'Invoices',
  clients: 'Clients',
  settings: 'Settings',
  'client-workspace': 'Client Workspace',
  'return-prep': 'Return Preparation',
  'firm-command-center': 'AI CEO',
  'multi-firm': 'Multi-Firm',
  autopilot: 'RUN MY FIRM',
  'ai-ca-manager': 'AI CA Manager',
  'ai-account-manager': 'AI Account Manager',
  'ai-deadline-engine': 'AI Deadline Engine',
  'ai-document-employee': 'AI Doc Employee',
  'ai-voice-assistant': 'AI Voice Assistant',
  'ai-firm-memory': 'AI Firm Memory',
  'ai-operating-room': 'AI Operating Room',
  'ai-predictions': 'AI Predictions',
  'ai-priority-engine': 'AI Priority Engine',
  'business-graph': 'Business Graph',
  'data-moat': 'Data Moat',
  'embedded-finance': 'Payments™',
  'industry-benchmark': 'Industry Benchmark',
  'working-capital': 'Working Capital',
  'ai-business-copilot': 'AI Business Copilot',
  'run-my-business': 'RUN MY BUSINESS™',
  'network-effects': 'Network Effects',
  'executive-war-room': 'EXECUTIVE WAR ROOM',
  'api-platform-v2': 'API PLATFORM™',
  'digital-twin': 'BUSINESS DIGITAL TWIN™',
  'event-engine': 'Event Engine',
  'agent-os': 'AI Agent OS',
  'decision-engine': 'AI DECISION ENGINE™',
  'app-store': 'APP STORE™',
  'gstpilot-network': 'GSTPILOT NETWORK™',
  'data-cloud': 'FINANCIAL DATA CLOUD™',
  'run-india-business': "RUN INDIA'S BUSINESS™",
  'universal-business-id': 'UNIVERSAL BUSINESS ID™',
  'credit-scoring-engine': 'CREDIT SCORING ENGINE™',
  'invoice-exchange': 'INVOICE EXCHANGE™',
  'financing-marketplace': 'FINANCING MARKETPLACE™',
  'economic-graph': 'ECONOMIC GRAPH™',
  'economic-war-room': 'ECONOMIC WAR ROOM™',
  'run-my-company': 'RUN MY COMPANY™',
}

function DashboardContent() {
  const { currentView, setCurrentView } = useApp()
  const { user, logout } = useAuth()

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <MissionControlPage />
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
      case 'firm-command-center':
        return <FirmCommandCenterPage />
      case 'multi-firm':
        return <MultiFirmPage />
      case 'autopilot':
        return <AutopilotPage />
      case 'ai-ca-manager':
        return <AICAManagerPage />
      case 'ai-account-manager':
        return <AIAccountManagerPage />
      case 'ai-deadline-engine':
        return <AIDeadlineEnginePage />
      case 'ai-document-employee':
        return <AIDocumentEmployeePage />
      case 'ai-voice-assistant':
        return <AIVoiceAssistantPage />
      case 'ai-firm-memory':
        return <AIFirmMemoryPage />
      case 'ai-operating-room':
        return <AIOperatingRoomPage />
      case 'ai-predictions':
        return <AIPredictionsPage />
      case 'ai-priority-engine':
        return <AIPriorityEnginePage />
      case 'business-graph':
        return <BusinessGraphPage />
      case 'data-moat':
        return <DataMoatPage />
      case 'embedded-finance':
        return <EmbeddedFinancePage />
      case 'working-capital':
        return <WorkingCapitalPage />
      case 'industry-benchmark':
        return <IndustryBenchmarkPage />
      case 'network-effects':
        return <NetworkEffectsPage />
      case 'ai-business-copilot':
        return <AIBusinessCopilotPage />
      case 'run-my-business':
        return <RunMyBusinessPage />
      case 'executive-war-room':
        return <ExecutiveWarRoomPage />
      case 'api-platform-v2':
        return <APIPlatformPage />
      case 'digital-twin':
        return <DigitalTwinPage />
      case 'event-engine':
        return <EventEnginePage />
      case 'agent-os':
        return <AgentOSPage />
      case 'decision-engine':
        return <DecisionEnginePage />
      case 'app-store':
        return <AppStorePage />
      case 'gstpilot-network':
        return <GSTPilotNetworkPage />
      case 'data-cloud':
        return <DataCloudPage />
      case 'run-india-business':
        return <RunIndiaBusinessPage />
      case 'universal-business-id':
        return <UniversalBusinessIDPage />
      case 'credit-scoring-engine':
        return <CreditScoringEnginePage />
      case 'invoice-exchange':
        return <InvoiceExchangePage />
      case 'financing-marketplace':
        return <FinancingMarketplacePage />
      case 'economic-graph':
        return <EconomicGraphPage />
      case 'economic-war-room':
        return <EconomicWarRoomPage />
      case 'run-my-company':
        return <RunMyCompanyPage />
      case 'business-dna':
        return <BusinessDNApage />
      default:
        return <MissionControlPage />
    }
  }

  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  const isHome = currentView === 'dashboard'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ═══ MINIMAL INFINITY TOP BAR ═══ */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-background/80 px-4 backdrop-blur-xl md:px-6">
        {/* Brand — clickable to go home */}
        <button
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-80"
          aria-label="GSTPilot Infinity — Home"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg accent-gradient shadow-lg shadow-emerald-500/20">
            <Zap className="h-4 w-4 text-white" fill="currentColor" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">GSTPilot</span>
          <span className="rounded-md accent-gradient-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider accent-text">
            Infinity
          </span>
        </button>

        {/* Back to Home — only on sub-views */}
        {!isHome && (
          <button
            onClick={() => setCurrentView('dashboard')}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </button>
        )}

        {/* Current view title — subtle, center-left */}
        {!isHome && (
          <span className="hidden text-xs font-medium text-muted-foreground/70 sm:inline">
            {VIEW_TITLES[currentView] || ''}
          </span>
        )}

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2">
          {/* Hint to open AI */}
          <kbd className="hidden items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <Sparkles className="h-3 w-3 accent-text" />
            Ctrl K
          </kbd>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-white/[0.05]">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                <AvatarFallback className="accent-gradient-soft accent-text text-[11px] font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-medium text-foreground sm:inline">
                {user?.name?.split(' ')[0] || 'User'}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                  <AvatarFallback className="accent-gradient-soft accent-text text-xs font-semibold">
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
              <DropdownMenuItem className="gap-2" onClick={() => setCurrentView('settings')}>
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

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>

      {/* ═══ STICKY FOOTER ═══ */}
      <footer className="mt-auto border-t border-white/[0.06] bg-background/80 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-[11px] font-medium text-muted-foreground">
            GSTPilot Infinity<span className="accent-text">™</span> · The Financial Brain of India
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Open GSTPilot. Understand your business in seconds. Run it in one click.
          </p>
        </div>
      </footer>
    </div>
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
