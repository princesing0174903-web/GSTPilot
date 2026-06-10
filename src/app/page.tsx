'use client'

import React, { useEffect } from 'react'
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import DashboardPage from '@/components/dashboard/DashboardPage'
import GSTRFilingPage from '@/components/gstr/GSTRFilingPage'
import ReconciliationPage from '@/components/reconciliation/ReconciliationPage'
import ClientRegistryPage from '@/components/clients/ClientRegistryPage'
import InvoiceWorkspacePage from '@/components/invoices/InvoiceWorkspacePage'
import ErrorResolutionPage from '@/components/audit/ErrorResolutionPage'
import FilingCalendarPage from '@/components/calendar/FilingCalendarPage'
import ReportsPage from '@/components/reports/ReportsPage'
import AuditLogsPage from '@/components/audit-logs/AuditLogsPage'
import TeamManagementPage from '@/components/team/TeamManagementPage'
import LandingPage from '@/components/landing/LandingPage'
import LoginPage from '@/components/auth/LoginPage'
import ClientHealthPage from '@/components/client-health/ClientHealthPage'
import DocumentVaultPage from '@/components/documents/DocumentVaultPage'
import ExecutiveAnalyticsPage from '@/components/executive-analytics/ExecutiveAnalyticsPage'
import DeadlineCenterPage from '@/components/deadlines/DeadlineCenterPage'
import FirmOperationsPage from '@/components/firm-operations/FirmOperationsPage'
import TeamPerformancePage from '@/components/team-performance/TeamPerformancePage'
import WhiteLabelPage from '@/components/white-label/WhiteLabelPage'
import AutomationCenterPage from '@/components/automation/AutomationCenterPage'
import WorkloadPage from '@/components/workload/WorkloadPage'
import NoticeCenterPage from '@/components/notices/NoticeCenterPage'
import ClientPortalPage from '@/components/client-portal/ClientPortalPage'
import AICopilot from '@/components/copilot/AICopilot'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Zap, LogOut, User, Settings } from 'lucide-react'

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'GST Command Center',
  'gstr-filing': 'GSTR Filing Center',
  reconciliation: 'GST Reconciliation',
  invoices: 'Invoice Workspace',
  clients: 'Client Registry',
  'client-health': 'Client Health Center',
  deadlines: 'Deadline Center',
  documents: 'Document Vault',
  'executive-analytics': 'Executive Analytics',
  'firm-operations': 'Firm Operations Center',
  'team-performance': 'Team Performance Center',
  errors: 'Error Resolution Center',
  calendar: 'Filing Calendar',
  reports: 'Reports & Export',
  'audit-logs': 'Audit Logs',
  settings: 'Settings & Team',
  'white-label': 'White Label Settings',
  automation: 'Automation Center',
  workload: 'Workload Distribution',
  notices: 'Notice Center',
  'client-portal': 'Client Portal',
}

function DashboardContent() {
  const { currentView } = useApp()
  const { user, logout } = useAuth()

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardPage />
      case 'gstr-filing':
        return <GSTRFilingPage />
      case 'reconciliation':
        return <ReconciliationPage />
      case 'invoices':
        return <InvoiceWorkspacePage />
      case 'clients':
        return <ClientRegistryPage />
      case 'client-health':
        return <ClientHealthPage />
      case 'deadlines':
        return <DeadlineCenterPage />
      case 'documents':
        return <DocumentVaultPage />
      case 'executive-analytics':
        return <ExecutiveAnalyticsPage />
      case 'firm-operations':
        return <FirmOperationsPage />
      case 'team-performance':
        return <TeamPerformancePage />
      case 'errors':
        return <ErrorResolutionPage />
      case 'calendar':
        return <FilingCalendarPage />
      case 'reports':
        return <ReportsPage />
      case 'audit-logs':
        return <AuditLogsPage />
      case 'settings':
        return <TeamManagementPage />
      case 'white-label':
        return <WhiteLabelPage />
      case 'automation':
        return <AutomationCenterPage />
      case 'workload':
        return <WorkloadPage />
      case 'notices':
        return <NoticeCenterPage />
      case 'client-portal':
        return <ClientPortalPage />
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
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950">
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              AI Powered
            </Badge>
            <Separator orientation="vertical" className="h-5" />
            {/* User Profile Dropdown */}
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
        <main className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-950/50">
          {renderView()}
        </main>
        <AICopilot />
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppRouter() {
  const { currentScreen, setCurrentScreen } = useApp()
  const { isAuthenticated, isInitializing } = useAuth()
  const hasSeededRef = React.useRef(false)

  // Seed database on first load
  useEffect(() => {
    if (!hasSeededRef.current) {
      hasSeededRef.current = true
      fetch('/api/seed', { method: 'POST' })
        .then(res => res.json())
        .then(() => {})
        .catch(() => {})
    }
  }, [])

  // ── Sync auth state with screen state ──
  // When user is authenticated (via any method), switch to app screen
  useEffect(() => {
    if (isInitializing) return
    if (isAuthenticated && currentScreen !== 'app') {
      setCurrentScreen('app')
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen])

  // When user logs out, go back to landing
  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated && currentScreen === 'app') {
      setCurrentScreen('landing')
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen])

  const handleGetStarted = () => {
    setCurrentScreen('login')
  }

  const handleBookDemo = () => {
    setCurrentScreen('login')
  }

  const handleBackToLanding = () => {
    setCurrentScreen('landing')
  }

  // Show loading during auth initialization (includes redirect processing)
  if (isInitializing) {
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

  if (currentScreen === 'app' && isAuthenticated) {
    return <DashboardContent />
  }

  if (currentScreen === 'login') {
    return <LoginPage onBack={handleBackToLanding} onGetStarted={handleGetStarted} />
  }

  return <LandingPage onGetStarted={handleGetStarted} onBookDemo={handleBookDemo} />
}

export default function Home() {
  return <AppRouter />
}
