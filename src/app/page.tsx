'use client'

import React, { useEffect, useState } from 'react'
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useApp } from '@/contexts/AppContext'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Zap, Menu } from 'lucide-react'

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  'gstr-filing': 'GSTR Filing Center',
  reconciliation: 'GST Reconciliation',
  invoices: 'Invoice Workspace',
  clients: 'Client Registry',
  errors: 'Error Resolution Center',
  calendar: 'Filing Calendar',
  reports: 'Reports & Export',
  'audit-logs': 'Audit Logs',
  settings: 'Settings & Team',
}

function AppContent() {
  const { currentView } = useApp()
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
      default:
        return <DashboardPage />
    }
  }

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
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950">
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              AI Powered
            </Badge>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-950/50">
          {renderView()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function Home() {
  return <AppContent />
}
