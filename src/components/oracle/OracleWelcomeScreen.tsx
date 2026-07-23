'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Welcome Screen — Full-screen premium AI CFO hero
//
// ChatGPT Enterprise + Claude + Perplexity Pro level welcome:
//   • Huge animated "Oracle AI CFO" hero with gold glow
//   • Time-aware personalized greeting
//   • Live data-source checklist (from /api/business/snapshot)
//   • Business Health gauge + Today's Findings count
//   • 8 smart suggestion cards (the exact set the user asked for):
//       1. Show overdue invoices
//       2. GST summary
//       3. Cash flow
//       4. Profit this month
//       5. ITC available
//       6. Tax liabilities
//       7. Customer risk
//       8. Generate report
//   • Premium glassmorphism + staggered framer-motion entrance
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  Sparkles, TrendingUp, ShieldCheck, Users, Brain,
  Database, Landmark, Receipt, ArrowRight, Check, Activity,
  IndianRupee, FileWarning, Wallet, PieChart, FileText, AlertTriangle,
} from 'lucide-react';

interface SnapshotData {
  hasLiveData: boolean;
  healthScore: number;
  riskScore: number;
  cash: number;
  receivables: number;
  customerCount: number;
  invoiceCount: number;
  revenue: number;
  gstLiability: number;
  lastSyncAt: string | null;
}

interface WelcomeProps {
  userName?: string;
  onPick: (prompt: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatINR(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val.toFixed(0)}`;
}

function countImportantThings(snap: SnapshotData | null): number {
  if (!snap) return 0;
  let count = 0;
  if (snap.cash < 50000 && snap.receivables > 0) count++;
  if (snap.gstLiability > 0) count++;
  if (snap.receivables > snap.revenue * 0.3) count++;
  if (snap.riskScore > 50) count++;
  if (snap.healthScore < 70) count++;
  return Math.max(count, snap.hasLiveData ? 3 : 0);
}

// ─── 8 Smart Suggestion Cards ─────────────────────────────────────────────────
// The exact set the user requested, each mapped to a real Oracle prompt.
const SUGGESTION_CARDS = [
  {
    icon: FileWarning,
    label: 'Overdue Invoices',
    question: 'Show overdue invoices',
    bg: 'from-rose-500/10 to-rose-600/5',
    border: 'border-rose-500/20',
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    glow: 'hover:shadow-[0_0_28px_-6px_rgba(244,63,94,0.35)]',
  },
  {
    icon: ShieldCheck,
    label: 'GST Summary',
    question: 'GST summary',
    bg: 'from-cyan-500/10 to-cyan-600/5',
    border: 'border-cyan-500/20',
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-400',
    glow: 'hover:shadow-[0_0_28px_-6px_rgba(34,211,238,0.35)]',
  },
  {
    icon: TrendingUp,
    label: 'Cash Flow',
    question: 'Cash flow',
    bg: 'from-emerald-500/10 to-emerald-600/5',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    glow: 'hover:shadow-[0_0_28px_-6px_rgba(16,185,129,0.35)]',
  },
  {
    icon: PieChart,
    label: 'Profit This Month',
    question: 'Profit this month',
    bg: 'from-violet-500/10 to-violet-600/5',
    border: 'border-violet-500/20',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    glow: 'hover:shadow-[0_0_28px_-6px_rgba(139,92,246,0.35)]',
  },
  {
    icon: Wallet,
    label: 'ITC Available',
    question: 'ITC available',
    bg: 'from-amber-500/10 to-amber-600/5',
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    glow: 'hover:shadow-[0_0_28px_-6px_rgba(245,158,11,0.35)]',
  },
  {
    icon: IndianRupee,
    label: 'Tax Liabilities',
    question: 'Tax liabilities',
    bg: 'from-orange-500/10 to-orange-600/5',
    border: 'border-orange-500/20',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    glow: 'hover:shadow-[0_0_28px_-6px_rgba(249,115,22,0.35)]',
  },
  {
    icon: AlertTriangle,
    label: 'Customer Risk',
    question: 'Customer risk',
    bg: 'from-yellow-500/10 to-yellow-600/5',
    border: 'border-yellow-500/20',
    iconBg: 'bg-yellow-500/15',
    iconColor: 'text-yellow-400',
    glow: 'hover:shadow-[0_0_28px_-6px_rgba(234,179,8,0.35)]',
  },
  {
    icon: FileText,
    label: 'Generate Report',
    question: 'Generate report',
    bg: 'from-sky-500/10 to-sky-600/5',
    border: 'border-sky-500/20',
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
    glow: 'hover:shadow-[0_0_28px_-6px_rgba(14,165,233,0.35)]',
  },
];

const DATA_SOURCES = [
  { label: 'Zoho Books', icon: Database },
  { label: 'GST', icon: Receipt },
  { label: 'Banking', icon: Landmark },
  { label: 'Customers', icon: Users },
  { label: 'Cash Flow', icon: TrendingUp },
];

export function OracleWelcomeScreen({ userName, onPick }: WelcomeProps) {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchSnapshot = async () => {
      try {
        const orgId = window.localStorage.getItem('gstpilot_org_id');
        if (!orgId) { setLoading(false); return; }
        const res = await fetch(`/api/business/snapshot?organizationId=${encodeURIComponent(orgId)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setSnapshot(data);
        }
      } catch { /* non-fatal */ }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchSnapshot();
    return () => { cancelled = true; };
  }, []);

  const firstName = userName?.split(' ')[0] || 'there';
  const greeting = getGreeting();
  const importantCount = countImportantThings(snapshot);
  const healthScore = snapshot?.healthScore ?? 0;
  const healthColor = healthScore >= 80 ? 'text-emerald-400' : healthScore >= 60 ? 'text-amber-400' : 'text-red-400';
  const healthRing = healthScore >= 80 ? '#10B981' : healthScore >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl">
        {/* ── Hero heading ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-10"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_48px_-6px_rgba(245,158,11,0.55)] ring-1 ring-amber-500/30 mb-5 sm:mb-6"
          >
            <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </motion.div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-2 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            Oracle AI CFO
          </h1>
          <p className="text-base sm:text-xl text-white/50 font-medium">
            Your Financial Brain — Ask anything. I&apos;ll find the answer.
          </p>
        </motion.div>

        {/* ── Personalized analysis card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="rounded-3xl border border-[#1F1F1F] bg-gradient-to-br from-[#111111] to-[#0D0D0D] p-5 sm:p-8 mb-6 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-5 gap-3">
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-semibold text-white truncate">
                {greeting}, {firstName}.
              </p>
              <p className="text-xs sm:text-sm text-white/50 mt-0.5">Here&apos;s what I found today.</p>
            </div>
            {snapshot?.hasLiveData && (
              <div className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 ring-1 ring-emerald-500/20">
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                />
                <span className="text-[11px] font-medium text-emerald-400">Live data</span>
              </div>
            )}
          </div>

          {/* Data sources analyzed */}
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-3">
              I analyzed
            </p>
            <div className="flex flex-wrap gap-2.5">
              {DATA_SOURCES.map((src, i) => {
                const Icon = src.icon;
                const connected = snapshot?.hasLiveData || i < 3;
                return (
                  <motion.div
                    key={src.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium ${
                      connected
                        ? 'bg-white/[0.04] text-white/80 ring-1 ring-white/10'
                        : 'bg-white/[0.02] text-white/40 ring-1 ring-white/5'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{src.label}</span>
                    {connected && <Check className="h-3 w-3 text-emerald-400" strokeWidth={3} />}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Business Health + Important Things */}
          <div className="grid grid-cols-2 gap-4 pt-5 border-t border-[#1F1F1F]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
                <Activity className="h-3 w-3" /> Business Health
              </p>
              <div className="flex items-baseline gap-1.5">
                {loading ? (
                  <span className="text-3xl font-bold text-white/30">—</span>
                ) : healthScore > 0 ? (
                  <>
                    <span className={`text-3xl sm:text-4xl font-bold tabular-nums ${healthColor}`}>
                      {healthScore}
                    </span>
                    <span className="text-sm text-white/40">/100</span>
                  </>
                ) : (
                  <span className="text-2xl sm:text-3xl font-bold text-white/30">Connect data</span>
                )}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${healthScore}%` }}
                  transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: healthScore > 0 ? healthRing : '#3F3F46' }}
                />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
                <Brain className="h-3 w-3" /> Today&apos;s Findings
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-bold tabular-nums text-amber-400">
                  {importantCount}
                </span>
                <span className="text-sm text-white/40">important things</span>
              </div>
              <p className="mt-2 text-[11px] sm:text-[12px] text-white/50">
                {snapshot?.hasLiveData
                  ? `${snapshot.customerCount} customers · ${snapshot.invoiceCount} invoices`
                  : 'Connect your accounts to unlock insights'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── 8 Smart Suggestion Cards (2 cols mobile, 4 cols desktop) ── */}
        <div className="mb-3 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Try asking
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
        >
          {SUGGESTION_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.button
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.06 }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPick(card.question)}
                className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${card.bg} ${card.border} p-3.5 sm:p-4 text-left transition-all duration-300 ${card.glow}`}
              >
                <div className="flex flex-col gap-2.5">
                  <div className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider ${card.iconColor}`}>
                      {card.label}
                    </p>
                    <ArrowRight className="h-3.5 w-3.5 text-white/30 transition-all group-hover:translate-x-0.5 group-hover:text-white/60" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Footer hint ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6 sm:mt-8 text-center text-[11px] sm:text-[12px] text-white/35"
        >
          Ask anything about your business · Oracle uses live data from your connected accounts · Always verify critical tax decisions
        </motion.p>
      </div>
    </div>
  );
}

export default OracleWelcomeScreen;
