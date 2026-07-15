'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DashboardShell — Heavy dashboard layout (dynamically loaded)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE: Isolate the heavy dashboard layout (top bar, left nav, floating dock,
 * Oracle panel, command palette, notifications sheet) into a lazily-loaded
 * module so the root page.tsx stays tiny.
 *
 * WHY: The layout pulls in framer-motion, 8+ icon barrels, the full Oracle
 * panel + workspace, the command palette (1400 lines), and the notifications
 * sheet. Compiling all of these synchronously in page.tsx blows past the 4 GB
 * sandbox cgroup limit. By moving them here, the initial `/` compile only
 * processes the lightweight AppRouter (landing/login/onboarding routing), and
 * this module is compiled on-demand AFTER the user authenticates.
 */

import React, { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import dynamic from 'next/dynamic'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Zap, LogOut, User, Settings, MailCheck, Search, Bell, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { LeftNav } from '@/components/layout/LeftNav'
import { FloatingDock } from '@/components/layout/FloatingDock'
import { NotificationsSheet } from '@/components/layout/NotificationsSheet'
// NOTE: OraclePanel + OracleDockSidebar removed — Oracle is now a full-page
// experience at /oracle, launched by <OracleLauncher /> (mounted globally in
// providers.tsx). No more docked sidebar popup.
import { BrandLogo } from '@/components/brand'
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import CommandPalette from '@/components/command-palette/CommandPalette'

// DashboardViews is itself a lazy-loaded registry of 150 view components.
// Keeping it dynamic means this shell file only compiles the layout chrome,
// not every dashboard view.
const DashboardViews = dynamic(() => import('@/components/DashboardViews'), {
  loading: () => (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  ),
  ssr: false,
})

// ═══════════════════════════════════════════════════════════════════════════════
// DashboardContent — the authenticated app shell
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardContent() {
  const { currentView, setCurrentView } = useApp()
  const { user, logout } = useAuth()

  // ── Log when the dashboard shell mounts (for the "Dashboard Loaded" step) ──
  useEffect(() => {
    console.log('[Dashboard] Shell mounted — rendering progressive layout')
    console.log('[Dashboard] Dashboard Loaded — shell visible, views lazy-loading')
  }, [])

  // ── Notifications sheet state ──────────────────────────────────────────────
  // Oracle is now a full page (/oracle), not a docked sidebar popup.
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* ═══ V16 Ambient Background — aurora + particles + network lines ═══ */}
      <AmbientBackground />

      {/* ═══ TOP BAR ═══ */}
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-background/60 px-4 backdrop-blur-xl md:px-6">
        {/* Brand + subtitle — official GSTPilot winged logo */}
        <button
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-80"
          aria-label="GSTPilot Infinity — Home"
        >
          <BrandLogo variant="icon" theme="dark" size={28} animated={false} disableGlow />
          <div className="hidden flex-col items-start leading-none sm:flex">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              GSTPilot Infinity<span className="accent-text">™</span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              The Financial Brain of India
            </span>
          </div>
        </button>

        {/* Right cluster: Search · Notifications · Theme · Profile */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="flex h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-semibold sm:inline">⌘K</kbd>
          </button>
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </button>
          <ThemeToggle />
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
              <DropdownMenuItem className="gap-2" onClick={() => setCurrentView('settings')}>
                <User className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => setCurrentView('settings')}>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-500/10">
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ═══ TWO-COLUMN WORKSPACE ═══ */}
      <div className="relative z-10 flex min-h-0 flex-1 gap-3 p-3">
        {/* LEFT NAV */}
        <div className="shrink-0">
          <LeftNav />
        </div>

        {/* MAIN WORKSPACE */}
        <main className="min-w-0 flex-1 overflow-y-auto rounded-3xl pb-24 custom-scrollbar">
          <DashboardViews view={currentView} />
        </main>
      </div>

      {/* ═══ PREMIUM FLOATING DOCK (Notifications · Help) ═══ */}
      {/* Oracle button removed from dock — the canonical Oracle launcher is
          <OracleLauncher /> mounted globally in providers.tsx. */}
      <FloatingDock
        onNotificationsToggle={() => {
          setNotificationsOpen((v) => !v)
        }}
        notificationsOpen={notificationsOpen}
      />

      {/* ═══ NOTIFICATIONS SHEET (wired to /api/notifications) ═══ */}
      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        userId={user?.id}
      />

      {/* ═══ COMMAND PALETTE (⌘K) ═══ */}
      <CommandPalette />
    </div>
  )
}

// ─── Theme Toggle (inline) ─────────────────────────────────────────────────────
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

export function EmailVerificationBanner() {
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
    <div className="bg-cyan-500/10 border-b border-cyan-500/25 px-4 py-3">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <MailCheck className="h-5 w-5 text-cyan-300 shrink-0" />
          <p className="text-sm text-cyan-100">
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
              className="text-xs font-semibold text-cyan-200 hover:text-cyan-100 underline disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Resend email'}
            </button>
          )}
          <button
            onClick={logout}
            className="text-xs text-cyan-300 hover:text-cyan-100 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
