'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Premium Enterprise Sidebar
// ═══════════════════════════════════════════════════════════════════════════════
// Redesigned (Task 9) to match the enterprise polish of Linear / Stripe / Vercel.
//
// Design principles:
//   • Wider on desktop (248px → was 220px) — gives labels room to breathe.
//   • Generous vertical spacing — items don't feel cramped.
//   • Typography: 13px medium labels, 9px uppercase group headings.
//   • Active state: subtle blue accent bar (3px) on the left edge + soft
//     gradient background + brighter text. Mirrors Linear's selected state.
//   • Hover: gentle background fade-in (120ms), icon color shift.
//   • Collapse: < xl breakpoint collapses to icon rail (60px), with tooltips.
//   • Brand mark: prominent header with logo + product name + tagline.
//   • Footer: minimal copyright/brand line + tooltip.
//
// Every navigation item continues to use the existing `SIDEBAR_ITEMS` from
// the navigation registry — no items added, removed, or reordered.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useApp, type AppView } from '@/contexts/AppContext';
import { BrandLogo } from '@/components/brand';
import { SIDEBAR_ITEMS } from '@/lib/navigation-registry';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Views that belong to each nav group — keeps active state correct in sub-views.
const NAV_GROUP_MAP: Partial<Record<string, AppView>> = {
  dashboard: 'dashboard',
  'oracle-brain': 'oracle-brain',
  'oracle-intelligence': 'oracle-brain',
  'ai-business-copilot': 'oracle-brain',
  invoices: 'invoices',
  'invoice-cloud': 'invoices',
  clients: 'clients',
  'client-workspace': 'clients',
  crm: 'clients',
  returns: 'returns',
  'return-prep': 'returns',
  'gstr-filing': 'returns',
  calendar: 'returns',
  reconcile: 'returns',
  'google-workspace': 'google-workspace',
  'zoho-books': 'zoho-books',
  vendors: 'clients',
  expenses: 'invoices',
  payments: 'invoices',
  inventory: 'invoices',
  tasks: 'dashboard',
  timeline: 'dashboard',
  settings: 'settings',
  'firm-command-center': 'dashboard',
  reports: 'invoices',
  accounting: 'invoices',
};

export function LeftNav() {
  const { currentView, setCurrentView } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);

  const onOracleRoute = pathname === '/oracle' || pathname.startsWith('/oracle/');
  const activeGroup = onOracleRoute
    ? 'oracle-brain'
    : (NAV_GROUP_MAP[currentView] ?? currentView);

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Primary"
        className={cn(
          'flex h-full flex-col border-r border-[#1A1A1A] bg-[#0A0A0A]',
          'w-[64px] px-2 py-4',
          // Expand on xl breakpoint — wider rail with labels
          'xl:w-[248px] xl:px-3',
        )}
      >
        {/* ─── Brand Header ──────────────────────────────────────────────── */}
        <button
          onClick={() => {
            if (onOracleRoute) {
              router.push('/');
            } else {
              setCurrentView('dashboard');
            }
          }}
          className={cn(
            'group/brand mb-5 flex h-11 items-center gap-2.5 rounded-xl px-2 outline-none',
            'transition-all duration-200 hover:bg-white/[0.03]',
            'focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40',
            'xl:justify-start xl:px-2.5',
            'justify-center',
          )}
          aria-label="GSTPilot Infinity — Home"
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E3A8A]/30 to-[#0F172A] ring-1 ring-[#3B82F6]/15 transition-all duration-300 group-hover/brand:ring-[#3B82F6]/30">
            <BrandLogo variant="icon" theme="dark" size={20} animated={false} disableGlow />
          </div>
          <div className="hidden flex-col items-start leading-none xl:flex">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-semibold tracking-tight text-white">
                GSTPilot
              </span>
              <span className="rounded-[5px] bg-[#3B82F6]/12 px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-[0.08em] text-[#60A5FA] ring-1 ring-[#3B82F6]/20">
                Infinity
              </span>
            </div>
            <span className="mt-[3px] text-[10px] font-medium text-[#71717A]">
              Financial Brain of India
            </span>
          </div>
        </button>

        {/* ─── Primary Nav ──────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-0.5">
          {/* Section label — visible only on expanded sidebar */}
          <div className="hidden px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#52525B] xl:block">
            Workspace
          </div>

          {SIDEBAR_ITEMS.map((item, i) => {
            const isActive = activeGroup === item.view;
            const Icon = item.icon;
            const isHovered = hovered === item.view;

            const button = (
              <motion.button
                key={item.view}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.03 * i, ease: 'easeOut' }}
                onHoverStart={() => setHovered(item.view)}
                onHoverEnd={() => setHovered(null)}
                onFocus={() => setHovered(item.view)}
                onBlur={() => setHovered(null)}
                onClick={() => {
                  if (item.href) {
                    router.push(item.href);
                  } else {
                    setCurrentView(item.view);
                  }
                }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex h-10 items-center rounded-lg text-[13px] font-medium outline-none',
                  'transition-all duration-[180ms] ease-out',
                  'focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40',
                  // Collapsed rail (below xl)
                  'justify-center w-10',
                  // Expanded rail (xl+)
                  'xl:w-full xl:justify-start xl:gap-2.5 xl:px-2.5',
                  isActive
                    ? 'bg-gradient-to-r from-[#3B82F6]/[0.10] to-[#3B82F6]/[0.04] text-white ring-1 ring-inset ring-[#3B82F6]/20'
                    : 'text-[#A1A1AA] hover:bg-white/[0.04] hover:text-white',
                )}
              >
                {/* Active accent bar — left edge, slides in on activation */}
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-bar"
                      initial={{ opacity: 0, scaleY: 0.4 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0.4 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute left-[-8px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#3B82F6] shadow-[0_0_10px_rgba(59,130,246,0.5)] xl:left-[-10px]"
                    />
                  )}
                </AnimatePresence>

                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
                    isActive
                      ? 'text-[#60A5FA]'
                      : isHovered
                        ? 'text-white'
                        : 'text-[#71717A]',
                  )}
                  strokeWidth={isActive ? 2.25 : 2}
                />

                {/* Label — hidden when collapsed */}
                <span className="hidden truncate xl:inline">{item.label}</span>

                {/* Badge — hidden when collapsed */}
                {item.badge && (
                  <span className="ml-auto hidden items-center rounded-[5px] border border-[#3B82F6]/25 bg-[#3B82F6]/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-[0.08em] text-[#60A5FA] xl:inline-flex">
                    {item.badge}
                  </span>
                )}

                {/* Hover tooltip on collapsed rail */}
                <span className="pointer-events-none absolute left-[110%] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-[#18181B] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100 xl:hidden">
                  {item.label}
                </span>
              </motion.button>
            );

            // Wrap each nav item in a proper Tooltip (only renders on the
            // collapsed rail — `xl:hidden` on the content hides it when the
            // sidebar is expanded).
            return (
              <Tooltip key={item.view}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="xl:hidden"
                  sideOffset={8}
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* ─── Footer ──────────────────────────────────────────────────── */}
        <div className="mt-3 hidden border-t border-[#1A1A1A] pt-3 xl:block">
          <div className="flex items-center justify-between px-2.5">
            <span className="text-[10px] font-medium text-[#52525B]">
              v2.0 · Infinity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              <span className="text-[10px] font-medium text-[#71717A]">Live</span>
            </span>
          </div>
          <p className="mt-1.5 px-2.5 text-[9px] font-medium uppercase leading-tight tracking-[0.12em] text-[#3F3F46]">
            The Financial Brain
            <br />
            of India
          </p>
        </div>
      </nav>
    </TooltipProvider>
  );
}

export default LeftNav;
