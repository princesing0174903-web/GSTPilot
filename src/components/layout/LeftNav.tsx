'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Minimal Enterprise Sidebar (Vercel / OpenAI Design)
// ═══════════════════════════════════════════════════════════════════════════════
// Width: 240px desktop, collapsible to 64px icon rail.
// Grouped under: Overview, Sales, Finance, Integrations.
// Settings & User Profile pinned at the bottom.
// Active state: subtle grey background (rgba(255,255,255,0.08)) + white text.
// Icons: monochrome 16px, 1.5 stroke, grey.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useApp, type AppView } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/brand';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Home,
  BrainCircuit,
  FileText,
  Users,
  Landmark,
  ClipboardCheck,
  ShieldCheck,
  BarChart3,
  Cloud,
  BookOpen,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface SidebarItem {
  view: AppView;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: string;
}

interface NavSection {
  title: string;
  items: SidebarItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { view: 'dashboard', label: 'Home', icon: Home },
      { view: 'oracle-brain', label: 'Veyro AI', icon: BrainCircuit },
    ],
  },
  {
    title: 'Sales',
    items: [
      { view: 'invoices', label: 'Invoices', icon: FileText },
      { view: 'clients', label: 'Customers', icon: Users },
    ],
  },
  {
    title: 'Finance',
    items: [
      { view: 'banking', label: 'Banking', icon: Landmark, badge: 'Sandbox' },
      { view: 'returns', label: 'Returns', icon: ClipboardCheck },
      { view: 'gst-reconciliation', label: 'GST Reconciliation', icon: ShieldCheck },
      { view: 'reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { view: 'google-workspace', label: 'Google', icon: Cloud },
      { view: 'zoho-books', label: 'Zoho Books', icon: BookOpen },
    ],
  },
];

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
  'gst-reconciliation': 'gst-reconciliation',
  'google-workspace': 'google-workspace',
  'zoho-books': 'zoho-books',
  banking: 'banking',
  reports: 'reports',
  vendors: 'clients',
  expenses: 'invoices',
  payments: 'invoices',
  inventory: 'invoices',
  tasks: 'dashboard',
  timeline: 'dashboard',
  settings: 'settings',
  'firm-command-center': 'dashboard',
  accounting: 'invoices',
};

export function LeftNav({
  forceExpanded = false,
  onNavigate,
}: {
  forceExpanded?: boolean;
  onNavigate?: () => void;
} = {}) {
  const { currentView, setCurrentView } = useApp();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigate = (view: AppView, href?: string) => {
    if (href && view !== 'oracle-brain') {
      router.push(href);
    } else {
      setCurrentView(view);
    }
    onNavigate?.();
  };

  const onOracleRoute = pathname === '/oracle' || pathname.startsWith('/oracle/');
  const activeGroup = onOracleRoute
    ? 'oracle-brain'
    : (NAV_GROUP_MAP[currentView] ?? currentView);

  // Width: 240px when expanded, 64px when collapsed
  const expandedCls = forceExpanded
    ? 'w-[240px] px-3 py-4'
    : 'w-[64px] px-2 py-4 xl:w-[240px] xl:px-3';

  const labelShow = forceExpanded ? 'flex' : 'hidden xl:flex';
  const labelInline = forceExpanded ? 'inline' : 'hidden xl:inline';
  const labelBlock = forceExpanded ? 'block' : 'hidden xl:block';
  const tooltipHide = forceExpanded ? 'hidden' : 'xl:hidden';
  const expandedBtn = forceExpanded
    ? 'w-full justify-start gap-2.5 px-2.5'
    : 'justify-center w-10 xl:w-full xl:justify-start xl:gap-2.5 xl:px-2.5';

  const rawName = ((user?.name || user?.email?.split('@')[0] || 'User'))
    .replace(/@.*$/, '')
    .replace(/\d+$/, '')
    .replace(/[._-]/g, ' ')
    .trim();
  const displayName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : 'User';
  const userInitial = displayName.charAt(0).toUpperCase() || 'U';

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Primary"
        className={cn(
          'flex h-full flex-col overflow-hidden border-r border-white/[0.08] bg-[#0A0A0A]',
          expandedCls,
        )}
      >
        {/* ─── Brand Header ─── */}
        <button
          onClick={() => {
            if (onOracleRoute) {
              router.push('/');
            } else {
              setCurrentView('dashboard');
            }
          }}
          className={cn(
            'group/brand mb-4 flex h-10 shrink-0 items-center gap-2.5 rounded-lg px-2 outline-none',
            'transition-colors duration-150 hover:bg-white/[0.04]',
            forceExpanded ? 'justify-start px-2.5' : 'xl:justify-start xl:px-2.5 justify-center',
          )}
          aria-label="VEYRO Home"
        >
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#111111] border border-white/[0.08]">
            <BrandLogo variant="icon" theme="dark" size={16} animated={false} disableGlow />
          </div>
          <div className={cn('flex-col items-start leading-none', labelShow)}>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold tracking-[-0.01em] text-[#EDEDED]">
                VEYRO
              </span>
            </div>
            <span className="mt-1 text-[11px] font-normal text-[#666666]">
              Financial OS
            </span>
          </div>
        </button>

        {/* ─── Scrollable Nav Sections ─── */}
        <div className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pt-1">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-0.5">
              <div
                className={cn(
                  'px-2.5 pb-1 text-[11px] font-normal text-[#666666]',
                  labelBlock,
                )}
              >
                {section.title}
              </div>

              {section.items.map((item) => {
                const isActive = activeGroup === item.view;
                const Icon = item.icon;

                const navButton = (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => handleNavigate(item.view, item.href)}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                    className={cn(
                      'group relative flex h-8 items-center rounded-md text-[13px] outline-none',
                      'transition-colors duration-150',
                      expandedBtn,
                      isActive
                        ? 'bg-white/[0.08] text-[#EDEDED] font-medium'
                        : 'text-[#A1A1A1] hover:bg-white/[0.04] hover:text-[#EDEDED]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive ? 'text-[#EDEDED]' : 'text-[#888888] group-hover:text-[#EDEDED]',
                      )}
                      strokeWidth={1.5}
                    />

                    <span className={cn('truncate ml-0.5', labelInline)}>
                      {item.label}
                    </span>

                    {item.badge && (
                      <span
                        className={cn(
                          'ml-auto text-[10px] font-medium px-1.5 py-0.2 rounded border border-white/[0.08] bg-white/[0.04] text-[#888888]',
                          forceExpanded ? 'inline-flex' : 'hidden xl:inline-flex',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );

                return (
                  <Tooltip key={item.view}>
                    <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                    <TooltipContent side="right" className={tooltipHide} sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>

        {/* ─── Bottom Pinned: Settings & User Profile ─── */}
        <div className="shrink-0 border-t border-white/[0.08] pt-2 mt-2 space-y-1">
          {/* Settings button */}
          {(() => {
            const isSettingsActive = currentView === 'settings';
            const settingsBtn = (
              <button
                type="button"
                onClick={() => handleNavigate('settings')}
                aria-current={isSettingsActive ? 'page' : undefined}
                className={cn(
                  'group relative flex h-8 items-center rounded-md text-[13px] outline-none transition-colors duration-150',
                  expandedBtn,
                  isSettingsActive
                    ? 'bg-white/[0.08] text-[#EDEDED] font-medium'
                    : 'text-[#A1A1A1] hover:bg-white/[0.04] hover:text-[#EDEDED]',
                )}
              >
                <Settings
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isSettingsActive ? 'text-[#EDEDED]' : 'text-[#888888] group-hover:text-[#EDEDED]',
                  )}
                  strokeWidth={1.5}
                />
                <span className={cn('truncate ml-0.5', labelInline)}>Settings</span>
              </button>
            );

            return (
              <Tooltip>
                <TooltipTrigger asChild>{settingsBtn}</TooltipTrigger>
                <TooltipContent side="right" className={tooltipHide} sideOffset={8}>
                  Settings
                </TooltipContent>
              </Tooltip>
            );
          })()}

          {/* User profile row */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-md p-1.5 transition-colors',
              forceExpanded ? 'justify-between' : 'xl:justify-between justify-center',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-medium text-[#EDEDED] border border-white/[0.1]">
                {userInitial}
              </div>
              <div className={cn('min-w-0 flex-col', labelShow)}>
                <span className="truncate text-xs font-medium text-[#EDEDED] leading-tight">
                  {displayName}
                </span>
                <span className="truncate text-[10px] text-[#666666] leading-tight">
                  {user?.email || ''}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              title="Sign out"
              className={cn(
                'text-[#666666] hover:text-[#EDEDED] p-1 rounded hover:bg-white/[0.06] transition-colors',
                labelInline,
              )}
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );
}

export default LeftNav;
