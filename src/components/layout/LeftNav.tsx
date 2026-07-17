'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Left Navigation (Unified Design System)
// ═══════════════════════════════════════════════════════════════════════════════
// Minimal, enterprise-grade navigation. Only REAL, working features.
// Icon + hover animation + active indicator + smooth transition.
//
// Design rules:
//   • 8 items max (Home, Oracle, Invoices, Customers, Returns, Google, Zoho, Settings)
//   • Glass surface, 3px active gradient bar, icon + label
//   • Framer Motion stagger on mount + layout animation for active bar
//   • Collapsed on mobile (icons only), expanded on xl (icons + labels)
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useApp, type AppView } from '@/contexts/AppContext';
import { BrandLogo } from '@/components/brand';
import { SIDEBAR_ITEMS, VIEW_REGISTRY } from '@/lib/navigation-registry';

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

  const onOracleRoute = pathname === '/oracle' || pathname.startsWith('/oracle/');
  const activeGroup = onOracleRoute
    ? 'oracle-brain'
    : (NAV_GROUP_MAP[currentView] ?? currentView);

  return (
    <nav
      aria-label="Primary"
      className="glass-surface flex h-full w-[68px] flex-col items-center gap-1.5 rounded-3xl p-2.5 xl:w-[208px] xl:items-stretch xl:gap-1 xl:p-3"
    >
      {/* Brand mark — clicking goes Home */}
      <button
        onClick={() => {
          if (onOracleRoute) {
            router.push('/');
          } else {
            setCurrentView('dashboard');
          }
        }}
        className="mb-2 flex h-10 items-center justify-center rounded-xl px-1 py-2 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-emerald-400/60 xl:mb-3 sidebar-smooth"
        aria-label="GSTPilot Infinity — Home"
      >
        <BrandLogo variant="icon" theme="dark" size={30} animated={false} disableGlow />
      </button>

      {/* Nav items — only REAL features */}
      <div className="flex flex-1 flex-col gap-1">
        {SIDEBAR_ITEMS.map((item, i) => {
          const isActive = activeGroup === item.view;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.view}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.04 * i, ease: 'easeOut' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (item.href) {
                  router.push(item.href);
                } else {
                  setCurrentView(item.view);
                }
              }}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              className={cn(
                'group relative flex items-center justify-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 sidebar-smooth xl:justify-start xl:px-3',
                isActive
                  ? 'accent-gradient-soft text-foreground'
                  : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
              )}
            >
              {/* Active gradient bar (left edge) — layout-animated for smooth slide */}
              {isActive && (
                <motion.span
                  layoutId="nav-active-bar"
                  className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full accent-gradient"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors',
                  isActive
                    ? 'accent-text'
                    : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              <span className="hidden xl:inline truncate">{item.label}</span>
              {item.badge && (
                <span className="hidden xl:inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                  {item.badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Footer mini-brand */}
      <div className="mt-auto hidden px-2 py-1 xl:block">
        <p className="text-[9px] font-medium uppercase leading-tight tracking-wider text-muted-foreground/50">
          The Financial Brain
          <br />
          of India
        </p>
      </div>
    </nav>
  );
}

export default LeftNav;
