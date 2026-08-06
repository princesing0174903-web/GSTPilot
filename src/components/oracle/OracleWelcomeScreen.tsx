'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Welcome Screen — Full-screen premium AI CFO hero (PROMPT 3)
//
// Hero copy (exact):
//   "Good Morning Prince"
//   "I'm Oracle."
//   "Your AI CFO. Your GST Expert. Your Compliance Officer. Your Financial Brain."
//
// Below the hero: 8 premium suggestion cards that fire a prompt on click:
//   💰 Show today's cash position
//   📊 Analyze my business
//   📈 Predict next month's revenue
//   🧾 Find GST mistakes
//   ⚠ Show risky clients
//   📑 Generate business report
//   📤 Draft email
//   📉 Analyze expenses
//
// Live business snapshot powers the "Live data" badge + a slim metrics strip.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  Sparkles, TrendingUp, ShieldCheck, Users, Wallet, IndianRupee,
  FileWarning, AlertTriangle, FileText, Send, PieChart, LineChart,
  Check, Activity, BadgeCheck,
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

// ─── 8 Premium Suggestion Cards (exact set from PROMPT 3) ─────────────────────
const SUGGESTION_CARDS = [
  {
    emoji: '💰',
    icon: Wallet,
    label: "Today's Cash Position",
    question: 'Show today\'s cash position',
    gradient: 'from-emerald-500/15 to-emerald-600/5',
    border: 'border-emerald-500/25',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    glow: 'hover:shadow-[0_0_30px_-6px_rgba(16,185,129,0.4)]',
  },
  {
    emoji: '📊',
    icon: PieChart,
    label: 'Analyze My Business',
    question: 'Analyze my business',
    gradient: 'from-emerald-500/15 to-emerald-600/5',
    border: 'border-emerald-500/25',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    glow: 'hover:shadow-[0_0_30px_-6px_rgba(16,185,129,0.4)]',
  },
  {
    emoji: '📈',
    icon: LineChart,
    label: 'Predict Next Month Revenue',
    question: 'Predict next month revenue',
    gradient: 'from-sky-500/15 to-sky-600/5',
    border: 'border-sky-500/25',
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
    glow: 'hover:shadow-[0_0_30px_-6px_rgba(14,165,233,0.4)]',
  },
  {
    emoji: '🧾',
    icon: ShieldCheck,
    label: 'Find GST Mistakes',
    question: 'Find GST mistakes',
    gradient: 'from-cyan-500/15 to-cyan-600/5',
    border: 'border-cyan-500/25',
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-400',
    glow: 'hover:shadow-[0_0_30px_-6px_rgba(34,211,238,0.4)]',
  },
  {
    emoji: '⚠️',
    icon: AlertTriangle,
    label: 'Show Risky Clients',
    question: 'Show risky clients',
    gradient: 'from-rose-500/15 to-rose-600/5',
    border: 'border-rose-500/25',
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    glow: 'hover:shadow-[0_0_30px_-6px_rgba(244,63,94,0.4)]',
  },
  {
    emoji: '📑',
    icon: FileText,
    label: 'Generate Business Report',
    question: 'Generate business report',
    gradient: 'from-amber-500/15 to-amber-600/5',
    border: 'border-amber-500/25',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    glow: 'hover:shadow-[0_0_30px_-6px_rgba(245,158,11,0.4)]',
  },
  {
    emoji: '📤',
    icon: Send,
    label: 'Draft Email',
    question: 'Draft an email to my clients about overdue invoices',
    gradient: 'from-emerald-500/15 to-emerald-600/5',
    border: 'border-emerald-500/25',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-300',
    glow: 'hover:shadow-[0_0_30px_-6px_rgba(16,185,129,0.4)]',
  },
  {
    emoji: '📉',
    icon: TrendingUp,
    label: 'Analyze Expenses',
    question: 'Analyze expenses',
    gradient: 'from-orange-500/15 to-orange-600/5',
    border: 'border-orange-500/25',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    glow: 'hover:shadow-[0_0_30px_-6px_rgba(249,115,22,0.4)]',
  },
];

const DATA_SOURCES = [
  { label: 'Zoho Books', icon: Wallet },
  { label: 'GST', icon: ShieldCheck },
  { label: 'Banking', icon: IndianRupee },
  { label: 'Customers', icon: Users },
];

export function OracleWelcomeScreen({ userName, onPick }: WelcomeProps) {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchSnapshot = async () => {
      try {
        // Fall back to the canonical preview org so the welcome screen always
        // shows live metrics (matches OracleWorkspace's orgCtx fallback).
        const orgId = window.localStorage.getItem('gstpilot_org_id') ?? 'preview-org';
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

  const firstName = userName?.split(' ')[0] || 'Prince';
  const greeting = getGreeting();
  const healthScore = snapshot?.healthScore ?? 0;
  const healthColor = healthScore >= 80 ? 'text-emerald-400' : healthScore >= 60 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-5xl">
        {/* ── HERO ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="text-center mb-10 sm:mb-12"
        >
          {/* Animated Oracle orb */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 14 }}
            className="relative mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_60px_-8px_rgba(245,158,11,0.65)] ring-1 ring-amber-400/40"
          >
            <Sparkles className="h-9 w-9 text-white" />
            {/* Pulsing ring */}
            <motion.span
              animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-[1.6rem] ring-2 ring-amber-400/40"
            />
          </motion.div>

          {/* "Good Morning Prince" */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-4xl sm:text-6xl font-bold tracking-tight bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent"
          >
            {greeting}, {firstName}
          </motion.h1>

          {/* "I'm Oracle." */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 text-2xl sm:text-3xl font-semibold text-white/90"
          >
            I&apos;m{' '}
            <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
              Oracle
            </span>
            .
          </motion.p>

          {/* 4 roles */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm sm:text-base text-white/50"
          >
            <span>Your AI CFO.</span>
            <span className="text-amber-500/60">·</span>
            <span>Your GST Expert.</span>
            <span className="text-amber-500/60">·</span>
            <span>Your Compliance Officer.</span>
            <span className="text-amber-500/60">·</span>
            <span>Your Financial Brain.</span>
          </motion.div>

          {/* Live data badge */}
          {snapshot?.hasLiveData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.75 }}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 ring-1 ring-emerald-500/25"
            >
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              />
              <span className="text-[11px] font-medium text-emerald-400">Connected to live business data</span>
            </motion.div>
          )}
        </motion.div>

        {/* ── Live metrics strip (only when data exists) ── */}
        {snapshot?.hasLiveData && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              { label: 'Cash', value: formatINR(snapshot.cash), icon: Wallet, color: 'text-emerald-400' },
              { label: 'Receivables', value: formatINR(snapshot.receivables), icon: TrendingUp, color: 'text-sky-400' },
              { label: 'GST Liability', value: formatINR(snapshot.gstLiability), icon: ShieldCheck, color: 'text-amber-400' },
              { label: 'Health', value: `${healthScore}/100`, icon: Activity, color: healthColor },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.85 + i * 0.06 }}
                  className="rounded-2xl border border-[#1F1F1F] bg-gradient-to-br from-[#111111] to-[#0C0C0C] p-3.5 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/40">
                    <Icon className={`h-3 w-3 ${m.color}`} /> {m.label}
                  </div>
                  <p className={`mt-1.5 text-lg font-bold tabular-nums ${m.color}`}>{m.value}</p>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ── Data sources analyzed (only when connected) ── */}
        {snapshot?.hasLiveData && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mb-7 flex flex-wrap items-center justify-center gap-2"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/35 mr-1">
              I&apos;ve analyzed
            </span>
            {DATA_SOURCES.map((src, i) => {
              const Icon = src.icon;
              return (
                <motion.span
                  key={src.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.05 + i * 0.07 }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] font-medium text-white/70 ring-1 ring-white/10"
                >
                  <Icon className="h-3 w-3 text-amber-400" />
                  {src.label}
                  <Check className="h-3 w-3 text-emerald-400" strokeWidth={3} />
                </motion.span>
              );
            })}
          </motion.div>
        )}

        {/* ── 8 Suggestion Cards ── */}
        <div className="mb-3 px-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            What can I help you with today?
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
        >
          {SUGGESTION_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.button
                key={card.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.15 + i * 0.05 }}
                whileHover={{ scale: 1.035, y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPick(card.question)}
                className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left transition-all duration-300 ${card.gradient} ${card.border} ${card.glow}`}
              >
                {/* shine sweep */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <div className="relative flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{card.emoji}</span>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}>
                      <Icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                  </div>
                  <div>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${card.iconColor}`}>
                      {card.label}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Footer trust line ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="mt-8 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/35"
        >
          <BadgeCheck className="h-3.5 w-3.5 text-amber-500/60" />
          Oracle uses live data from your connected accounts · Always verify critical tax decisions
        </motion.p>
      </div>
    </div>
  );
}

export default OracleWelcomeScreen;
