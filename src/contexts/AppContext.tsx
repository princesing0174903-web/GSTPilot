'use client';

import { createContext, useContext, useState, useCallback } from 'react';

export type AppView = 'dashboard' | 'gstr-filing' | 'reconciliation' | 'invoices' | 'clients' | 'errors' | 'calendar' | 'reports' | 'audit-logs' | 'settings';

interface AppContextType {
  currentView: AppView;
  selectedClientId: string | null;
  sidebarOpen: boolean;
  setCurrentView: (view: AppView) => void;
  setSelectedClientId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const handleSetCurrentView = useCallback((view: AppView) => {
    setCurrentView(view);
  }, []);

  const handleSetSelectedClientId = useCallback((id: string | null) => {
    setSelectedClientId(id);
  }, []);

  const handleSetSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpen(open);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentView,
        selectedClientId,
        sidebarOpen,
        setCurrentView: handleSetCurrentView,
        setSelectedClientId: handleSetSelectedClientId,
        setSidebarOpen: handleSetSidebarOpen,
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
