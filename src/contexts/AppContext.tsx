'use client';

import { createContext, useContext, useState, useCallback } from 'react';

export type AppView = 
  | 'dashboard' 
  | 'gstr-filing' 
  | 'reconciliation' 
  | 'invoices' 
  | 'clients' 
  | 'errors' 
  | 'calendar' 
  | 'reports' 
  | 'audit-logs' 
  | 'settings' 
  | 'client-health' 
  | 'deadlines'
  | 'firm-operations'
  | 'team-performance'
  | 'workload'
  | 'notices'
  | 'documents'
  | 'executive-analytics'
  | 'white-label'
  | 'automation'
  | 'client-portal';

export type AppScreen = 'landing' | 'login' | 'app';

interface AppContextType {
  currentView: AppView;
  selectedClientId: string | null;
  sidebarOpen: boolean;
  currentScreen: AppScreen;
  setCurrentView: (view: AppView) => void;
  setSelectedClientId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setCurrentScreen: (screen: AppScreen) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');

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

  return (
    <AppContext.Provider
      value={{
        currentView,
        selectedClientId,
        sidebarOpen,
        currentScreen,
        setCurrentView: handleSetCurrentView,
        setSelectedClientId: handleSetSelectedClientId,
        setSidebarOpen: handleSetSidebarOpen,
        setCurrentScreen: handleSetCurrentScreen,
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
