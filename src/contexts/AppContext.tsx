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
  | 'return-prep';

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
  setCurrentView: (view: AppView) => void;
  setSelectedClientId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setCurrentScreen: (screen: AppScreen) => void;
  setReturnPrepCtx: (ctx: ReturnPrepContext) => void;
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

  return (
    <AppContext.Provider
      value={{
        currentView,
        selectedClientId,
        sidebarOpen,
        currentScreen,
        returnPrepCtx,
        setCurrentView: handleSetCurrentView,
        setSelectedClientId: handleSetSelectedClientId,
        setSidebarOpen: handleSetSidebarOpen,
        setCurrentScreen: handleSetCurrentScreen,
        setReturnPrepCtx: handleSetReturnPrepCtx,
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
