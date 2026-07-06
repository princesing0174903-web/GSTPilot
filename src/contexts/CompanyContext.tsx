'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { COMPANIES, type Company } from '@/lib/enterprise/data'

interface CompanyContextValue {
  currentCompany: Company | null
  allCompanies: Company[]
  setCurrentCompanyId: (id: string | 'all') => void
  isAllCompanies: boolean
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [currentCompanyId, setCurrentCompanyId] = useState<string | 'all'>('all')

  const currentCompany = currentCompanyId === 'all' ? null : COMPANIES.find(c => c.id === currentCompanyId) ?? null
  const isAllCompanies = currentCompanyId === 'all'

  const handleSet = useCallback((id: string | 'all') => setCurrentCompanyId(id), [])

  return (
    <CompanyContext.Provider value={{ currentCompany, allCompanies: COMPANIES, setCurrentCompanyId: handleSet, isAllCompanies }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider')
  return ctx
}
