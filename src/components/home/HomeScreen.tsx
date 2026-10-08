'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Obsidian Infinity™ Home Screen
//
// Calm. Premium. Uncrowded. Apple + Perplexity quality.
//
// Layout:
//   1. Good Afternoon, {name} 👋
//   2. Large Oracle input box — "Ask VEYRO AI..."
//      4 suggested chips: File GST Return · Generate Report · Predict Revenue · Recover Collections
//   3. Business Health — Revenue · Cash Flow · Compliance (no fake numbers)
//      If no data → "Connect your data sources to activate your Financial Brain."
//
// Obsidian Black #050505 · White text · Mint #00F5D4 accent · minimal glass.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Wallet, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveDashboardMetrics } from '@/hooks/use-firestore';
import { OracleCommandCenter } from '@/components/oracle/OracleCommandCenter';
import { InfinitySymbol } from '@/components/layout/InfinityMark';

// ─── Greeting helper ──────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Business Health cards ────────────────────────────────────────────────────

type HealthKey = 'revenue' | 'cashflow' | 'compliance';

interface HealthCardDef {
  key: HealthKey;
  label: string;
  icon: LucideIcon;
}

const HEALTH_CARDS: HealthCardDef[] = [
  { key: 'revenue', label: 'Revenue', icon: TrendingUp },
  { key: 'cashflow', label: 'Cash Flow', icon: Wallet },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { user } = useAuth();
  const { metrics, loading } = useLiveDashboardMetrics();

  const firstName = user?.name?.split(' ')[0] || 'there';
  const greeting = getGreeting();

  // Honest: only show numbers when real data exists.
  const hasData = !loading && (
    metrics.totalTaxVolume > 0 ||
    metrics.filedReturns > 0 ||
    metrics.pendingReturns > 0 ||
    metrics.overdueReturns > 0 ||
    metrics.totalInvoices > 0
  );

  // ── Map live metrics → honest display values (null when no data) ──
  const healthValues = useMemo<{
    revenue: string | null;
    cashflow: string | null;
    compliance: string | null;
  }>(() => {
    // Revenue — total tax volume across invoices
    const revenue =
      metrics.totalTaxVolume > 0
        ? `\u20B9${(metrics.totalTaxVolume / 100000).toFixed(1)}L`
        : null;

    // Cash Flow — reconciliation match rate (only meaningful when there are invoices)
    const cashflow =
      metrics.totalInvoices > 0
        ? `${metrics.matchPercentage.toFixed(0)}%`
        : null;

    // Compliance — filed vs total returns
    const totalReturns =
      metrics.filedReturns + metrics.pendingReturns + metrics.overdueReturns;
    const compliance =
      totalReturns > 0
        ? `${Math.round((metrics.filedReturns / totalReturns) * 100)}%`
        : null;

    return { revenue, cashflow, compliance };
  }, [metrics]);

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 py-10 md:px-8 md:py-16">
      {/* ═══ 1. Greeting ═══ */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="text-3xl font-semibold tracking-tight text-foreground md:text-[40px]"
      >
        {greeting}, {firstName}{' '}
        <span className="inline-block animate-[wave_2s_ease-in-out_infinite] origin-[70%_70%]">
          👋
        </span>
      </motion.h1>

      {/* ═══ 2. Oracle hero — the heart of the page ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        className="mt-8 flex flex-col items-center"
      >
        <OracleCommandCenter />
      </motion.section>

      {/* ═══ 3. Business Health ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.24, ease: [0.4, 0, 0.2, 1] }}
        className="mt-14"
      >
        <h2 className="mb-4 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Business Health
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {HEALTH_CARDS.map((card, i) => {
            const Icon = card.icon;
            const value = healthValues[card.key];
            return (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 + i * 0.06, ease: [0.4, 0, 0.2, 1] }}
                className="glass-surface rounded-[20px] p-5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl accent-gradient-soft">
                    <Icon className="h-[18px] w-[18px] accent-text" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </span>
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
                  {value ?? '—'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {value ? 'Live' : 'No data yet'}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* ═══ Empty-state line (only when no data) ═══ */}
        {!hasData && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground"
          >
            <InfinitySymbol size={14} />
            Connect your data sources to activate your Financial Brain.
          </motion.p>
        )}
      </motion.section>

      {/* keyframes for the wave emoji */}
      <style>{`
        @keyframes wave {
          0%, 60%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-8deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-4deg); }
          50% { transform: rotate(10deg); }
        }
      `}</style>
    </div>
  );
}

export default HomeScreen;
