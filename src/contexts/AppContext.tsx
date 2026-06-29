'use client';

import { createContext, useContext, useState, useCallback } from 'react';

export type AppView = 
  | 'dashboard' 
  | 'returns' 
  | 'reconcile' 
  | 'invoices' 
  | 'clients' 
  | 'settings'
  | 'client-workspace'
  | 'return-prep'
  | 'analytics'
  | 'notifications'
  | 'billing'
  | 'timeline'
  | 'team'
  | 'tasks'
  | 'autopilot'
  | 'agents'
  | 'automations'
  | 'documents'
  | 'collaboration'
  | 'crm'
  | 'ai-cfo'
  | 'client-portal'
  | 'marketplace'
  | 'white-label'
  | 'audit-trail'
  | 'approvals'
  | 'api-platform'
  | 'version-history'
  | 'esignatures'
  | 'firm-command-center'
  // Business OS Modules
  | 'accounting'
  | 'payroll'
  | 'hrms'
  | 'inventory'
  | 'banking'
  | 'payments'
  | 'e-invoicing'
  | 'tds'
  | 'roc-compliance'
  | 'legal-notices'
  // AI Workforce OS
  | 'ai-ca-manager'
  | 'ai-account-manager'
  | 'ai-document-employee'
  | 'ai-deadline-engine'
  | 'ai-voice-assistant'
  | 'ai-firm-memory'
  | 'multi-firm'
  // AI Executive Layer
  | 'ai-operating-room'
  | 'ai-priority-engine'
  | 'ai-predictions'
  // Financial Infrastructure Layer
  | 'business-graph'
  | 'embedded-finance'
  | 'working-capital'
  | 'data-moat'
  | 'industry-benchmark'
  | 'ai-business-copilot'
  | 'network-effects'
  | 'executive-war-room'
  | 'run-my-business'
  // Financial Network Layer
  | 'api-platform-v2'
  | 'app-store'
  | 'agent-os'
  | 'event-engine'
  | 'digital-twin'
  | 'decision-engine'
  | 'data-cloud'
  | 'gstpilot-network'
  | 'run-india-business'
  // Financial Exchange Layer (GFX)
  | 'universal-business-id'
  | 'credit-scoring-engine'
  | 'invoice-exchange'
  | 'financing-marketplace'
  | 'economic-graph'
  | 'economic-war-room'
  | 'run-my-company'
  // GSTPilot Infinity™ Layer
  | 'business-dna'
  // Phase 8 Step 3 — GSTPilot Real Invoice Engine™
  | 'invoice-cloud'
  // Phase 8 Step 5 — GSTPilot Execution Engine™
  | 'execution-engine'
  // Phase 2 — Real Data Engine™
  | 'connections'
  // ─── Recovered modules (previously disconnected from router) ───
  // Reports & Intelligence
  | 'reports'
  | 'ai-reports'
  | 'ai-compliance'
  | 'ai-risk'
  | 'ai-insights'
  | 'ai-tasks'
  | 'ai-benchmark'
  | 'ai-knowledge'
  | 'ai-doc-chat'
  | 'notices'
  | 'gstr-filing'
  | 'calendar'
  // Business Operations
  | 'accounting'
  | 'payroll'
  | 'hrms'
  | 'inventory'
  | 'banking'
  | 'payments'
  | 'e-invoicing'
  | 'tds'
  | 'roc-compliance'
  | 'legal-notices'
  // Firm & Team
  | 'team'
  | 'team-performance'
  | 'firm-operations'
  | 'workload'
  | 'review'
  | 'deadlines'
  | 'client-health'
  | 'executive-analytics'
  | 'analytics'
  | 'timeline'
  | 'tasks'
  | 'documents'
  | 'collaboration'
  | 'crm'
  | 'approvals'
  | 'automations'
  | 'automation-center'
  | 'audit-resolution'
  | 'audit-trail'
  | 'billing'
  | 'white-label'
  | 'version-history'
  | 'esignatures'
  | 'client-portal'
  | 'marketplace'
  | 'agents'
  // AI Software Factory™ — Self-building software ecosystem
  | 'ai-software-factory'
  // Autonomous Enterprise™ — Self-Running Business OS
  | 'autonomous-enterprise';

export interface ReturnPrepContext {
  clientId: string | null;
  returnType: 'GSTR-1' | 'GSTR-3B';
  period: string;
}

export type AppScreen = 'landing' | 'login' | 'app';

interface AppContextType {
  currentView: AppView;
  selectedClientId: string | null;
  sidebarOpen: boolean;
  currentScreen: AppScreen;
  returnPrepCtx: ReturnPrepContext;
  commandPaletteOpen: boolean;
  setCurrentView: (view: AppView) => void;
  setSelectedClientId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setCurrentScreen: (screen: AppScreen) => void;
  setReturnPrepCtx: (ctx: ReturnPrepContext) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
  const [returnPrepCtx, setReturnPrepCtx] = useState<ReturnPrepContext>({
    clientId: null,
    returnType: 'GSTR-1',
    period: '2025-06',
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);

  const handleSetCurrentView = useCallback((view: AppView) => {
    setCurrentView(view);
  }, []);

  const handleSetSelectedClientId = useCallback((id: string | null) => {
    setSelectedClientId(id);
  }, []);

  const handleSetSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpen(open);
  }, []);

  const handleSetCurrentScreen = useCallback((screen: AppScreen) => {
    setCurrentScreen(screen);
  }, []);

  const handleSetReturnPrepCtx = useCallback((ctx: ReturnPrepContext) => {
    setReturnPrepCtx(ctx);
  }, []);

  const handleSetCommandPaletteOpen = useCallback((open: boolean) => {
    setCommandPaletteOpen(open);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentView,
        selectedClientId,
        sidebarOpen,
        currentScreen,
        returnPrepCtx,
        commandPaletteOpen,
        setCurrentView: handleSetCurrentView,
        setSelectedClientId: handleSetSelectedClientId,
        setSidebarOpen: handleSetSidebarOpen,
        setCurrentScreen: handleSetCurrentScreen,
        setReturnPrepCtx: handleSetReturnPrepCtx,
        setCommandPaletteOpen: handleSetCommandPaletteOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
