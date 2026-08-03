'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Pause,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  Copy,
  TrendingUp,
  TrendingDown,
  FileWarning,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Status Pills (Premium Edition)
//
// Beautiful color-coded badges for account status, transaction type,
// reconciliation match type, and transaction status. Each maps to a semantic
// tone (emerald=success, amber=warning, red=danger, cyan=info, zinc=neutral).
// ═══════════════════════════════════════════════════════════════════════════════

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  danger: 'bg-red-500/10 text-red-300 border-red-500/25',
  info: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
  neutral: 'bg-white/[0.04] text-zinc-300 border-white/[0.08]',
  gold: 'bg-amber-400/10 text-amber-200 border-amber-400/25',
};

const TONE_DOTS: Record<Tone, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
  info: 'bg-cyan-400',
  neutral: 'bg-white/40',
  gold: 'bg-amber-300',
};

interface PillProps {
  label: string;
  tone: Tone;
  icon?: LucideIcon;
  dot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

function Pill({ label, tone, icon: Icon, dot, pulse, size = 'sm', className }: PillProps) {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${TONE_CLASSES[tone]} ${sizeClasses} ${className ?? ''}`}
    >
      {dot && (
        <span className={`relative flex h-1.5 w-1.5 ${pulse ? 'animate-pulse' : ''}`}>
          {pulse && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${TONE_DOTS[tone]}`}
            />
          )}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${TONE_DOTS[tone]}`} />
        </span>
      )}
      {Icon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

// ─── Account Status ───────────────────────────────────────────────────────────

const ACCOUNT_STATUS_CONFIG: Record<string, { label: string; tone: Tone; icon: LucideIcon; pulse?: boolean }> = {
  active: { label: 'Active', tone: 'success', icon: CheckCircle2 },
  syncing: { label: 'Syncing', tone: 'info', icon: RefreshCw, pulse: true },
  paused: { label: 'Paused', tone: 'neutral', icon: Pause },
  error: { label: 'Error', tone: 'danger', icon: AlertCircle, pulse: true },
  disconnected: { label: 'Disconnected', tone: 'neutral', icon: XCircle },
};

export function AccountStatusPill({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg = ACCOUNT_STATUS_CONFIG[status] || ACCOUNT_STATUS_CONFIG.disconnected;
  return <Pill label={cfg.label} tone={cfg.tone} icon={cfg.icon} dot pulse={cfg.pulse} size={size} />;
}

// ─── Transaction Type ─────────────────────────────────────────────────────────

export function TransactionTypePill({ type, size = 'sm' }: { type: 'credit' | 'debit'; size?: 'sm' | 'md' }) {
  if (type === 'credit') {
    return <Pill label="Credit" tone="success" icon={ArrowDownLeft} size={size} />;
  }
  return <Pill label="Debit" tone="danger" icon={ArrowUpRight} size={size} />;
}

// ─── Transaction Status ───────────────────────────────────────────────────────

const TXN_STATUS_CONFIG: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  posted: { label: 'Posted', tone: 'neutral', icon: CheckCircle2 },
  pending: { label: 'Pending', tone: 'warning', icon: Clock },
  reconciled: { label: 'Reconciled', tone: 'success', icon: ShieldCheck },
  disputed: { label: 'Disputed', tone: 'danger', icon: AlertCircle },
};

export function TransactionStatusPill({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg = TXN_STATUS_CONFIG[status] || TXN_STATUS_CONFIG.posted;
  return <Pill label={cfg.label} tone={cfg.tone} icon={cfg.icon} size={size} />;
}

// ─── Reconciliation Match Type ────────────────────────────────────────────────

const MATCH_TYPE_CONFIG: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  exact: { label: 'Exact Match', tone: 'success', icon: ShieldCheck },
  partial: { label: 'Partial Match', tone: 'warning', icon: Clock },
  duplicate: { label: 'Duplicate', tone: 'danger', icon: Copy },
  overpayment: { label: 'Overpayment', tone: 'info', icon: TrendingUp },
  underpayment: { label: 'Underpayment', tone: 'warning', icon: TrendingDown },
  missing: { label: 'Missing Payment', tone: 'danger', icon: FileWarning },
  suspicious: { label: 'Suspicious', tone: 'danger', icon: ShieldAlert },
};

export function MatchTypePill({ matchType, size = 'sm' }: { matchType: string | null; size?: 'sm' | 'md' }) {
  if (!matchType) return <Pill label="Unmatched" tone="neutral" icon={Search} size={size} />;
  const cfg = MATCH_TYPE_CONFIG[matchType] || MATCH_TYPE_CONFIG.exact;
  return <Pill label={cfg.label} tone={cfg.tone} icon={cfg.icon} size={size} />;
}

// ─── Bank Health Score Badge ──────────────────────────────────────────────────

export function HealthScoreBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const tone: Tone = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';
  return <Pill label={`${label} · ${Math.round(score)}`} tone={tone} icon={Zap} size={size} />;
}

// ─── Provider Badge ───────────────────────────────────────────────────────────

export function ProviderBadge({ provider, isLive }: { provider: string; isLive: boolean }) {
  // Premium, honest labelling: a non-live provider is a "Sandbox Environment"
  // (not "Mock Provider"). It is real software running on seeded test data.
  const label = isLive
    ? `${provider} (live)`
    : 'Sandbox Environment';
  const tone: Tone = isLive ? 'success' : 'gold';
  return <Pill label={label} tone={tone} icon={ShieldCheck} dot pulse={!isLive} size="sm" />;
}

// ─── Motion wrapper for staggered entrance ────────────────────────────────────

export function StaggeredItem({
  index,
  children,
  className,
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
