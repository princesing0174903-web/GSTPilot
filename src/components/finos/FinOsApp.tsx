'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FinOsApp — root shell for the GSTPilot FinOS product.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Layout: sticky sidebar (collapsible on mobile) + main content area + sticky
 * footer. Theme toggle (light/dark) via next-themes. Module routing is local
 * state — no Next.js routes. The 12 modules are statically imported so all
 * compile work happens up-front (avoids OOM-killing the dev server with
 * on-demand chunk compilation).
 */

import * as React from 'react'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, Brain, Calculator, Receipt, Landmark, TrendingUp,
  ShoppingCart, Package, Users, ShieldCheck, Sparkles, Workflow,
  Menu, X, Search, Bell, Sun, Moon, ChevronRight, Zap, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { modules, company, auditLog } from '@/lib/finos/data'

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Brain, Calculator, Receipt, Landmark, TrendingUp,
  ShoppingCart, Package, Users, ShieldCheck, Sparkles, Workflow,
}

// ── Static imports for all 12 modules ─────────────────────────────────────────
// We use static imports (not dynamic) because the sandbox cgroup OOM-kills the
// Turbopack dev server when lazy chunks are compiled on-demand. With static
// imports, everything compiles up-front during the initial page load (which
// succeeds with a 1500 MB heap), and module switching is instant with zero
// additional compile work.
import { ExecutiveDashboard } from './modules/ExecutiveDashboard'
import { AICFO } from './modules/AICFO'
import { AIAccountant } from './modules/AIAccountant'
import { GSTIntelligence } from './modules/GSTIntelligence'
import { Banking } from './modules/Banking'
import { Sales } from './modules/Sales'
import { Purchases } from './modules/Purchases'
import { Inventory } from './modules/Inventory'
import { Payroll } from './modules/Payroll'
import { ComplianceCenter } from './modules/ComplianceCenter'
import { OracleAI } from './modules/OracleAI'
import { AutomationBuilder } from './modules/AutomationBuilder'

const moduleRegistry: Record<string, React.ComponentType> = {
  dashboard: ExecutiveDashboard,
  'ai-cfo': AICFO,
  'ai-accountant': AIAccountant,
  gst: GSTIntelligence,
  banking: Banking,
  sales: Sales,
  purchases: Purchases,
  inventory: Inventory,
  payroll: Payroll,
  compliance: ComplianceCenter,
  oracle: OracleAI,
  automation: AutomationBuilder,
}

// ─── Theme hook (light/dark) via next-themes ──────────────────────────────────
function useFinOsTheme() {
  const { theme, setTheme } = useTheme()
  const toggle = React.useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])
  return { theme: (theme as 'light' | 'dark') || 'dark', toggle }
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  active, onSelect, mobileOpen, onCloseMobile,
}: {
  active: string
  onSelect: (id: string) => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const grouped = React.useMemo(() => {
    const groups: Record<string, typeof modules> = {
      Core: [], Intelligence: [], Operations: [], Compliance: [],
    }
    for (const m of modules) groups[m.category].push(m)
    return groups
  }, [])

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/60 bg-card/95 backdrop-blur transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border/60 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
              <Zap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-foreground">GSTPilot FinOS</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Financial OS</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <div className="space-y-1">
                {items.map((m) => {
                  const Icon = ICONS[m.icon] || LayoutDashboard
                  const isActive = active === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => onSelect(m.id)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : '')} />
                      <span className="flex-1 text-left truncate">{m.shortName}</span>
                      {m.badge && (
                        <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold uppercase">
                          {m.badge}
                        </Badge>
                      )}
                      {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Company card */}
        <div className="border-t border-border/60 p-3">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs font-semibold text-foreground truncate">{company.name || 'No company profile'}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">GSTIN {company.gstin || '—'}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-muted-foreground">{company.financialYear || 'No FY set'} · {company.taxRegime || 'No regime'}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({
  activeModule, onMenuClick, theme, onToggleTheme,
}: {
  activeModule: string
  onMenuClick: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  const mod = modules.find((m) => m.id === activeModule)
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden md:block">
        <h1 className="text-base font-semibold text-foreground tracking-tight">{mod?.name || 'Dashboard'}</h1>
        <p className="text-[11px] text-muted-foreground">{today}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search invoices, vendors, GSTIN…"
            className="h-9 w-56 pl-9 text-sm lg:w-72"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-emerald-600 text-xs font-semibold text-white">
          RK
        </div>
      </div>
    </header>
  )
}

// ─── Footer (sticky to bottom) ─────────────────────────────────────────────────
function Footer() {
  const lastAudit = auditLog[0]
  return (
    <footer className="mt-auto border-t border-border/60 bg-card/50 px-4 py-3 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>System operational · Last activity: <span className="font-medium text-foreground/80">{lastAudit.action}</span> at {new Date(lastAudit.timestamp).toLocaleTimeString('en-IN')}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>v2.4.0 · FinOS</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">© 2025 GSTPilot Technologies Pvt. Ltd.</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Main FinOsApp component ───────────────────────────────────────────────────
export function FinOsApp() {
  const [activeModule, setActiveModule] = React.useState('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const { theme, toggle } = useFinOsTheme()

  const handleSelect = (id: string) => {
    setActiveModule(id)
    setMobileNavOpen(false)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }

  const Mod = moduleRegistry[activeModule]

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={activeModule}
          onSelect={handleSelect}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            activeModule={activeModule}
            onMenuClick={() => setMobileNavOpen(true)}
            theme={theme}
            onToggleTheme={toggle}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
              {Mod ? <Mod /> : null}
            </div>
            <Footer />
          </main>
        </div>
      </div>
    </div>
  )
}
