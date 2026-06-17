'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ V15 — Left Navigation
// Maximum 6 items. Glassmorphism. Gradient active state. Large icons.
// Everything else is reachable via Search / AI / Command Palette.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { Home, Brain, Zap, Wallet, Network, Settings, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp, type AppView } from '@/contexts/AppContext';
import { InfinitySymbol } from '@/components/layout/InfinityMark';

interface NavItem {
  id: AppView;
  label: string;
  icon: LucideIcon;
  emoji: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: Home, emoji: '🏠' },
  { id: 'business-dna', label: 'Intelligence', icon: Brain, emoji: '🧠' },
  { id: 'run-my-business', label: 'Autopilot', icon: Zap, emoji: '⚡' },
  { id: 'reconcile', label: 'Finance', icon: Wallet, emoji: '💰' },
  { id: 'business-graph', label: 'Network', icon: Network, emoji: '🌐' },
  { id: 'settings', label: 'Settings', icon: Settings, emoji: '⚙️' },
];

// Views that belong to each nav group — used to keep the active state correct
// when the user is in a sub-view (e.g. 'returns' highlights Finance).
const NAV_GROUP_MAP: Record<string, AppView> = {
  dashboard: 'dashboard',
  'business-dna': 'business-dna',
  'ai-predictions': 'business-dna',
  'ai-business-copilot': 'business-dna',
  'run-my-business': 'run-my-business',
  autopilot: 'run-my-business',
  'run-my-company': 'run-my-business',
  'run-india-business': 'run-my-business',
  reconcile: 'reconcile',
  returns: 'reconcile',
  invoices: 'reconcile',
  'embedded-finance': 'reconcile',
  'working-capital': 'reconcile',
  'business-graph': 'business-graph',
  'gstpilot-network': 'business-graph',
  'economic-graph': 'business-graph',
  settings: 'settings',
};

export function LeftNav() {
  const { currentView, setCurrentView } = useApp();
  const activeGroup = NAV_GROUP_MAP[currentView] ?? currentView;

  return (
    <nav
      aria-label="Primary"
      className="glass-surface flex h-full w-[68px] flex-col items-center gap-1.5 rounded-3xl p-2.5 xl:w-[200px] xl:items-stretch xl:gap-1 xl:p-3"
    >
      {/* Brand mark at top — V16 InfinityMark™ */}
      <div className="mb-2 flex items-center justify-center gap-2 px-1 py-2 xl:mb-3">
        <InfinitySymbol size={32} />
        <div className="hidden xl:block">
          <p className="text-[13px] font-semibold leading-tight tracking-tight text-foreground">
            GSTPilot
          </p>
          <p className="accent-text text-[10px] font-bold uppercase leading-tight tracking-wider">
            Infinity
          </p>
        </div>
      </div>

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
              onClick={() => setCurrentView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center justify-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200 xl:justify-start xl:px-3',
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
        <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50">
          The Financial Brain
        </p>
        <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50">
          of India
        </p>
      </div>
    </nav>
  );
}

export default LeftNav;
