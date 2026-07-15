'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ V15 — Left Navigation
// Maximum 6 items. Glassmorphism. Gradient active state. Large icons.
// Everything else is reachable via Search / AI / Command Palette.
//
// IMPORTANT (Oracle UX Restructure):
//   • "Oracle" is a SEPARATE full-page workspace at /oracle — NOT an in-app
//     view. Clicking "Oracle" navigates via Next.js router to /oracle.
//   • The dashboard (/) NEVER auto-opens Oracle.
//   • There is NO floating Oracle button anywhere in the app — the ONLY entry
//     point to Oracle is this nav item.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { Home, Brain, Zap, Wallet, Network, Settings, Sparkles, Cloud, BrainCircuit, BookOpen, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp, type AppView } from '@/contexts/AppContext';
import { BrandLogo } from '@/components/brand';

interface NavItem {
  id: AppView;
  label: string;
  icon: LucideIcon;
  /** When set, clicking navigates to this URL via Next.js router instead of an in-app view switch. */
  href?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  // Oracle is a separate /oracle workspace — navigates via router, NOT setCurrentView.
  { id: 'oracle-brain', label: 'Oracle', icon: BrainCircuit, href: '/oracle' },
  { id: 'autonomous-finance', label: 'Autonomous', icon: Sparkles },
  { id: 'ai-cfo', label: 'AI CFO', icon: Brain },
  { id: 'run-my-business', label: 'Run Business', icon: Zap },
  { id: 'reconcile', label: 'Finance', icon: Wallet },
  { id: 'business-graph', label: 'Network', icon: Network },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'google-workspace', label: 'Google', icon: Cloud },
  { id: 'zoho-books', label: 'Zoho Books', icon: BookOpen },
];

// Views that belong to each nav group — used to keep the active state correct
// when the user is in a sub-view (e.g. 'returns' highlights Finance).
const NAV_GROUP_MAP: Record<string, AppView> = {
  dashboard: 'dashboard',
  'oracle-brain': 'oracle-brain',
  'oracle-intelligence': 'oracle-brain',
  'autonomous-finance': 'autonomous-finance',
  'workflow-studio': 'autonomous-finance',
  'oracle-actions': 'autonomous-finance',
  'financial-intelligence': 'autonomous-finance',
  'smart-reconciliation': 'autonomous-finance',
  'predictive-compliance': 'autonomous-finance',
  'intelligent-collections': 'autonomous-finance',
  'ai-cfo': 'ai-cfo',
  'business-dna': 'ai-cfo',
  'ai-predictions': 'ai-cfo',
  'ai-business-copilot': 'ai-cfo',
  'run-my-business': 'run-my-business',
  autopilot: 'run-my-business',
  'run-my-company': 'run-my-business',
  'run-india-business': 'run-my-business',
  reconcile: 'reconcile',
  returns: 'reconcile',
  invoices: 'reconcile',
  'invoice-cloud': 'reconcile',
  'embedded-finance': 'reconcile',
  'working-capital': 'reconcile',
  'business-graph': 'business-graph',
  'gstpilot-network': 'business-graph',
  'economic-graph': 'business-graph',
  settings: 'settings',
  'google-workspace': 'google-workspace',
  'zoho-books': 'zoho-books',
};

export function LeftNav() {
  const { currentView, setCurrentView } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  // Oracle is "active" when we're on the /oracle route (separate workspace)
  const onOracleRoute = pathname === '/oracle' || pathname.startsWith('/oracle/');
  const activeGroup = onOracleRoute ? 'oracle-brain' : (NAV_GROUP_MAP[currentView] ?? currentView);

  return (
    <nav
      aria-label="Primary"
      className="glass-surface flex h-full w-[68px] flex-col items-center gap-1.5 rounded-3xl p-2.5 xl:w-[200px] xl:items-stretch xl:gap-1 xl:p-3"
    >
      {/* Brand mark at top — official GSTPilot winged logo */}
      <button
        onClick={() => {
          // If we're on the /oracle route, navigate back to the dashboard via router
          if (onOracleRoute) {
            router.push('/');
          } else {
            setCurrentView('dashboard');
          }
        }}
        className="mb-2 flex h-10 items-center justify-center rounded-xl px-1 py-2 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-emerald-400/60 xl:mb-3"
        aria-label="GSTPilot Infinity — Home"
      >
        <BrandLogo variant="icon" theme="dark" size={30} animated={false} disableGlow />
      </button>

      {/* Nav items */}
      <div className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item, i) => {
          const isActive = activeGroup === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (item.href) {
                  // External route (e.g. /oracle) — use Next.js router
                  router.push(item.href);
                } else {
                  // In-app view switch
                  setCurrentView(item.id);
                }
              }}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center justify-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 xl:justify-start xl:px-3',
                isActive
                  ? 'accent-gradient-soft text-foreground'
                  : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground'
              )}
            >
              {/* Active gradient bar (left edge) */}
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
                  isActive ? 'accent-text' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span className="hidden xl:inline truncate">{item.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Footer mini-brand */}
      <div className="mt-auto hidden px-2 py-1 xl:block">
        <p className="text-[9px] font-medium uppercase leading-tight tracking-wider text-muted-foreground/50">
          The Financial Brain<br />of India
        </p>
      </div>
    </nav>
  );
}

export default LeftNav;
