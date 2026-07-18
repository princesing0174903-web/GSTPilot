'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Left Navigation (Premium Enterprise Design)
// ═══════════════════════════════════════════════════════════════════════════════
// Minimal, clean, professional. Matches ChatGPT/Linear/Vercel sidebar language.
//
// Design rules:
//   • 8 items max (Home, Oracle, Invoices, Customers, Returns, Google, Zoho, Settings)
//   • Only the active page has a background — inactive items are transparent
//   • No rounded rectangle wrapper around the entire nav
//   • Blue (#2563EB) as the only accent for active state
//   • Subtle hover, fast transitions, no flashy effects
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
      className="flex h-full w-[60px] flex-col items-stretch gap-0.5 border-r border-[#1F1F1F] bg-[#080808] py-3 xl:w-[220px] xl:px-2"
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
        className="mb-3 flex h-10 items-center justify-center rounded-lg px-2 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#2563EB]/50 xl:justify-start xl:gap-2.5 xl:px-2"
        aria-label="GSTPilot Infinity — Home"
      >
        <BrandLogo variant="icon" theme="dark" size={26} animated={false} disableGlow />
        <div className="hidden flex-col items-start leading-none xl:flex">
          <span className="text-[13px] font-semibold tracking-tight text-white">
            GSTPilot Infinity<span className="text-[#3B82F6]">™</span>
          </span>
          <span className="text-[9px] font-medium text-[#71717A]">
            Financial Brain of India
          </span>
        </div>
      </button>

      {/* Nav items — only REAL features */}
      <div className="flex flex-1 flex-col gap-0.5">
        {SIDEBAR_ITEMS.map((item, i) => {
          const isActive = activeGroup === item.view;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.view}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, delay: 0.03 * i, ease: 'easeOut' }}
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
                'group relative flex h-9 items-center justify-center rounded-md px-2 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/50 xl:justify-start xl:gap-2.5 xl:px-2.5',
                isActive
                  ? 'bg-[#181818] text-white'
                  : 'text-[#A1A1AA] hover:bg-[#111111] hover:text-white',
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  isActive
                    ? 'text-[#3B82F6]'
                    : 'text-[#71717A] group-hover:text-white',
                )}
              />
              <span className="hidden xl:inline truncate">{item.label}</span>
              {item.badge && (
                <span className="ml-auto hidden xl:inline-flex items-center rounded border border-[#2563EB]/30 bg-[#2563EB]/10 px-1 py-0 text-[8px] font-semibold uppercase tracking-wider text-[#3B82F6]">
                  {item.badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Footer mini-brand */}
      <div className="mt-auto hidden px-2 pt-3 xl:block">
        <p className="text-[8px] font-medium uppercase leading-tight tracking-wider text-[#52525B]">
          The Financial Brain
          <br />
          of India
        </p>
      </div>
    </nav>
  );
}

export default LeftNav;
