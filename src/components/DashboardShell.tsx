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
import { getViewMeta } from '@/lib/navigation-registry'
import { ChevronRight, Menu } from 'lucide-react'
import { sendVerificationEmail } from '@/lib/auth'
import { boot } from '@/lib/perf/boot-tracer'

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
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
// NOTE: OraclePanel + OracleDockSidebar removed — Oracle is now a full-page
// experience at /oracle, launched by <OracleLauncher /> (mounted globally in
// providers.tsx). No more docked sidebar popup.
// NOTE (Task 9): BrandLogo import removed — the duplicate brand mark that
// lived in the top bar has been removed. Branding now lives ONLY in the
// sidebar (LeftNav.tsx), so the content area starts with the breadcrumb.
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import { ViewErrorBoundary } from '@/components/error/ViewErrorBoundary'
import { PremiumPageLoader } from '@/components/ui/premium-loading'

// ── LAZY-LOADED SHELL COMPONENTS ─────────────────────────────────────────
// CommandPalette (1400 lines) + NotificationsSheet are heavy and only used
// on demand (⌘K press / bell click). Loading them eagerly adds ~2–4s to the
// dashboard shell compile on a cold dev server. By deferring them to their
// own chunks, the shell renders faster and the palette/sheet compile in the
// background after the user is already interactive.
//
// Both are gated by user interaction (open state), so they're never rendered
// until the user actually needs them — and by then the chunk is almost
// certainly already cached from the background compile.
const CommandPalette = dynamic(
  () => import('@/components/command-palette/CommandPalette').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => null },
)
const NotificationsSheet = dynamic(
  () => import('@/components/layout/NotificationsSheet').then((m) => ({ default: m.NotificationsSheet })),
  { ssr: false, loading: () => null },
)

// DashboardViews is a lazy-loaded registry of ~21 real view components.
// Keeping it dynamic means this shell file only compiles the layout chrome,
// not every dashboard view. (Product Mode · Step 0: fakes are feature-flagged
// off and no longer in the build graph.)
const DashboardViews = dynamic(() => import('@/components/DashboardViews'), {
  loading: () => <PremiumPageLoader />,
  ssr: false,
})

// ═══════════════════════════════════════════════════════════════════════════════
// DashboardContent — the authenticated app shell
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardContent() {
  const { currentView, setCurrentView } = useApp()
  const { user, logout } = useAuth()

  // Dashboard shell mounted — log the milestone once.
  useEffect(() => {
    boot.mark('dashboard shell rendered')
  }, [])

  // ── Notifications sheet state ──────────────────────────────────────────────
  // Oracle is now a full page (/oracle), not a docked sidebar popup.
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  // ── Mobile sidebar (Sheet) state — visible only below the md breakpoint,
  // where the persistent 64px rail would eat too much of the screen. ──
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // ── SCROLL LOCK (POLISH-04) ───────────────────────────────────────────────
  // While the dashboard shell is mounted, lock the document scroll. Only the
  // inner panels (LeftNav nav list, <main> workspace, sheets/dialogs) scroll —
  // never the body. This prevents the "random page scroll" / "double scroll"
  // bug where flung scroll inside a panel chains to the document.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.add('gst-app-shell')
    return () => {
      document.body.classList.remove('gst-app-shell')
    }
  }, [])

  // ── Command Palette bridge (Phase 2) ──────────────────────────────────────
  // The CommandPalette lives in a different component subtree and can't reach
  // `setNotificationsOpen` directly. It dispatches window events; we listen
  // here and toggle the relevant sheet. This makes cmd-open-notifications +
  // cmd-open-ai-copilot actually do something (previously they just closed
  // the palette without opening their target).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onOpenNotifications = () => setNotificationsOpen(true)
    const onOpenCopilot = () => {
      // Copilot lives at /oracle?view=oracle — navigate there. The Oracle
      // page itself focuses its input on mount, so a simple view switch is
      // enough to "open" it.
      setCurrentView('oracle')
    }
    window.addEventListener('gstpilot:open-notifications', onOpenNotifications as EventListener)
    window.addEventListener('gstpilot:open-copilot', onOpenCopilot as EventListener)
    return () => {
      window.removeEventListener('gstpilot:open-notifications', onOpenNotifications as EventListener)
      window.removeEventListener('gstpilot:open-copilot', onOpenCopilot as EventListener)
    }
  }, [setCurrentView])


  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* ═══ Ambient Background — pure flat black (no decorations) ═══ */}
      <AmbientBackground />

      {/* ═══ Skip-to-content link (a11y) — visible only when focused ═══ */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#2563EB] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* ═══ TOP BAR ═══ */}
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-[#1F1F1F] bg-[#000000] px-4 md:px-6">
        {/* Mobile sidebar toggle (visible below lg). The desktop rail is
            rendered in the two-column workspace below. */}
        <button
          onClick={() => setMobileNavOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#A1A1AA] transition-colors hover:bg-[#181818] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb — content area starts directly here.
            NOTE (Task 9): The duplicate GSTPilot brand mark that used to live
            in the top bar has been removed. Branding now appears ONLY inside
            the sidebar (LeftNav.tsx), so the content area begins cleanly with
            the breadcrumb. On the dashboard view the breadcrumb shows just
            "Home"; on sub-pages it shows "Home / {View Label}". */}
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60"
            aria-label="Go to home"
          >
            Home
          </button>
          {currentView !== 'dashboard' && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" aria-hidden="true" />
              <span className="truncate rounded-md px-1.5 py-1 font-medium text-foreground">
                {getViewMeta(currentView).label}
              </span>
            </>
          )}
        </div>

        {/* Right cluster: Search · Notifications · Theme · Profile */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="flex h-8 items-center gap-2 rounded-lg border border-[#222222] bg-[#111111] px-2.5 text-xs text-[#A1A1AA] transition-colors hover:bg-[#181818] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60"
            aria-label="Search (Cmd+K)"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded bg-[#1A1A1A] px-1 py-0.5 text-[9px] font-semibold sm:inline">⌘K</kbd>
          </button>
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#A1A1AA] transition-colors hover:bg-[#181818] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
          </button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-[#181818] focus-visible:ring-2 focus-visible:ring-[#2563EB]/60"
              aria-label="Account menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.picture} alt={user?.name || 'User avatar'} />
                <AvatarFallback className="bg-[#2563EB]/15 text-[#3B82F6] border border-[#2563EB]/25 text-[11px] font-semibold">
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
                  <AvatarImage src={user?.picture} alt={user?.name || 'User avatar'} />
                  <AvatarFallback className="bg-[#2563EB]/15 text-[#3B82F6] border border-[#2563EB]/25 text-xs font-semibold">
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
                <User className="h-4 w-4" aria-hidden="true" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => setCurrentView('settings')}>
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-500/10">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ═══ TWO-COLUMN WORKSPACE ═══ */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* LEFT NAV — LeftNav itself manages h-full; no extra scroll wrapper here.
            The sidebar's own <nav> has overflow-hidden, and its primary-nav
            <div> handles its own overflow-y-auto (see LeftNav.tsx).
            Hidden below lg — the mobile Sheet (rendered below) takes over. */}
        <div className="hidden shrink-0 lg:block">
          <LeftNav />
        </div>

        {/* MAIN WORKSPACE — own independent vertical scroll. No pb-24 (that was
            compensating for body scroll, which we now prevent via
            overflow-hidden on the root). The custom-scrollbar class keeps the
            rail thin + dark. */}
        <main id="main-content" role="main" className="min-w-0 flex-1 overflow-y-auto custom-scrollbar">
          {/* DEMO WORKSPACE BANNER — shown when user signed in via "Explore the
              platform" (provider === 'demo'). Makes it unambiguously clear that
              all data visible is sample/demo data, NOT real financial records. */}
          {user?.provider === 'demo' && (
            <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 backdrop-blur-sm">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold">D</span>
              <span>
                <strong>DEMO WORKSPACE</strong> — All data shown is sample data for exploration only.
                This is not a real financial account.
              </span>
            </div>
          )}
          <ViewErrorBoundary
            key={currentView}
            viewName={getViewMeta(currentView)?.label || currentView}
          >
            <DashboardViews view={currentView} />
          </ViewErrorBoundary>
        </main>
      </div>

      {/* ═══ MOBILE NAV SHEET — renders the same LeftNav in expanded mode ═══ */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-[280px] max-w-[85vw] gap-0 border-r border-[#1A1A1A] bg-[#0A0A0A] p-0"
        >
          {/* SheetTitle is required by Radix Dialog for a11y — visually hidden
              because the sidebar's own brand header serves as the visible label. */}
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="h-full">
            <LeftNav forceExpanded onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ PREMIUM FLOATING DOCK (Notifications · Help) ═══ */}
      {/* Oracle button removed from dock — the canonical Oracle launcher is
          <OracleLauncher /> mounted globally in providers.tsx.
          The dock is also hidden on the Oracle view — the floating
          Notification bell + Help buttons were overlapping the Oracle
          composer/conversation area at the bottom of the screen, making it
          feel cluttered and obstructing the send button on mobile. The
          underlying functionality is NOT removed — Notifications remain
          accessible via the top-bar Bell (Header) and Help via ⌘K. */}
      {currentView !== 'oracle-brain' && (
        <FloatingDock
          onNotificationsToggle={() => {
            setNotificationsOpen((v) => !v)
          }}
          notificationsOpen={notificationsOpen}
        />
      )}

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
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#A1A1AA] transition-colors hover:bg-[#181818] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60"
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
      const { error } = await sendVerificationEmail()
      if (!error) setSent(true)
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-[#2563EB]/10 border-b border-[#2563EB]/25 px-4 py-3">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <MailCheck className="h-5 w-5 text-[#3B82F6] shrink-0" />
          <p className="text-sm text-[#93C5FD]">
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
              className="text-xs font-semibold text-[#3B82F6] hover:text-[#60A5FA] underline disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Resend email'}
            </button>
          )}
          <button
            onClick={logout}
            className="text-xs text-[#3B82F6] hover:text-[#60A5FA] font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
