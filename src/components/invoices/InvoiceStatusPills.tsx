'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Archive,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Invoice Status Pills (Premium Edition)
//
// Beautiful color-coded status badges with icon + dot + subtle animation.
// Each status maps to a semantic group used by the filter bar:
//   • paid      → emerald (success)
//   • pending   → cyan/teal/amber (info/warning)
//   • overdue   → red (danger)
//   • cancelled → zinc (neutral)
//   • draft     → zinc/amber (neutral/warning)
//   • other     → zinc (neutral)
// ═══════════════════════════════════════════════════════════════════════════════

export type StatusGroup =
  | 'paid'
  | 'pending'
  | 'overdue'
  | 'cancelled'
  | 'draft'
  | 'other';

export interface StatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
  dot: string;
  iconColor: string;
  group: StatusGroup;
  pulse?: boolean;
}

export const INVOICE_STATUS_CONFIG: Record<string, StatusConfig> = {
  draft: {
    label: 'Draft',
    icon: FileText,
    className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25',
    dot: 'bg-zinc-400',
    iconColor: 'text-zinc-400',
    group: 'draft',
  },
  sent: {
    label: 'Sent',
    icon: Send,
    className: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    dot: 'bg-blue-400',
    iconColor: 'text-blue-400',
    group: 'pending',
  },
  viewed: {
    label: 'Viewed',
    icon: Eye,
    className: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
    dot: 'bg-sky-400',
    iconColor: 'text-sky-400',
    group: 'pending',
  },
  issued: {
    label: 'Sent',
    icon: Send,
    className: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    dot: 'bg-blue-400',
    iconColor: 'text-blue-400',
    group: 'pending',
  },
  partially_paid: {
    label: 'Partial',
    icon: Clock,
    className: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    dot: 'bg-amber-400',
    iconColor: 'text-amber-400',
    group: 'pending',
    pulse: true,
  },
  paid: {
    label: 'Paid',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-400',
    iconColor: 'text-emerald-400',
    group: 'paid',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-400',
    iconColor: 'text-emerald-400',
    group: 'paid',
  },
  filed: {
    label: 'Filed',
    icon: CheckCircle2,
    className: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
    dot: 'bg-sky-400',
    iconColor: 'text-sky-400',
    group: 'paid',
  },
  overdue: {
    label: 'Overdue',
    icon: AlertCircle,
    className: 'bg-red-500/10 text-red-300 border-red-500/25',
    dot: 'bg-red-400',
    iconColor: 'text-red-400',
    group: 'overdue',
    pulse: true,
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-zinc-700/40 text-zinc-400 border-zinc-700',
    dot: 'bg-zinc-500',
    iconColor: 'text-zinc-500',
    group: 'cancelled',
  },
  archived: {
    label: 'Archived',
    icon: Archive,
    className: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    dot: 'bg-zinc-500',
    iconColor: 'text-zinc-500',
    group: 'other',
  },
};

const FALLBACK_STATUS_CONFIG: StatusConfig = {
  label: 'Unknown',
  icon: Sparkles,
  className: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  dot: 'bg-zinc-500',
  iconColor: 'text-zinc-500',
  group: 'other',
};

export function getInvoiceStatusConfig(status: string): StatusConfig {
  return (
    INVOICE_STATUS_CONFIG[status] ?? {
      ...FALLBACK_STATUS_CONFIG,
      label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown',
    }
  );
}

// ─── Payment Status Pill ──────────────────────────────────────────────────────

export interface PaymentStatusConfig {
  label: string;
  className: string;
  dot: string;
}

const PAYMENT_STATUS_CONFIG: Record<string, PaymentStatusConfig> = {
  paid: { label: 'Paid', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  unpaid: { label: 'Unpaid', className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25', dot: 'bg-zinc-400' },
  partial: { label: 'Partial', className: 'bg-amber-500/10 text-amber-300 border-amber-500/25', dot: 'bg-amber-400' },
  // Backward-compat alias — some legacy rows may still use 'partially_paid'.
  partially_paid: { label: 'Partial', className: 'bg-amber-500/10 text-amber-300 border-amber-500/25', dot: 'bg-amber-400' },
  overdue: { label: 'Overdue', className: 'bg-red-500/10 text-red-300 border-red-500/25', dot: 'bg-red-400' },
};

export function getPaymentStatusConfig(status: string): PaymentStatusConfig {
  return PAYMENT_STATUS_CONFIG[status] ?? PAYMENT_STATUS_CONFIG.unpaid;
}

// ─── Status Pill Component ────────────────────────────────────────────────────

interface StatusPillProps {
  status: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  animate?: boolean;
  className?: string;
}

export function StatusPill({
  status,
  size = 'sm',
  showIcon = true,
  animate = true,
  className = '',
}: StatusPillProps) {
  const config = getInvoiceStatusConfig(status);
  const Icon = config.icon;
  const sizeCls =
    size === 'md'
      ? 'px-3 py-1.5 text-xs gap-1.5'
      : 'px-2.5 py-1 text-[11px] gap-1';

  return (
    <motion.span
      initial={animate ? { opacity: 0, scale: 0.94 } : false}
      animate={animate ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center font-medium border rounded-full ${sizeCls} ${config.className} ${className}`}
    >
      {showIcon && (
        <Icon className={`h-3 w-3 ${config.iconColor} ${config.pulse ? 'animate-pulse' : ''}`} />
      )}
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`} />
      {config.label}
    </motion.span>
  );
}

// ─── Payment Status Pill Component ────────────────────────────────────────────

interface PaymentPillProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function PaymentPill({ status, size = 'sm', className = '' }: PaymentPillProps) {
  const config = getPaymentStatusConfig(status);
  const sizeCls =
    size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-full ${sizeCls} ${config.className} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_BADGE_CONFIG: Record<
  RiskLevel,
  { label: string; className: string; dot: string }
> = {
  low: { label: 'Low', className: 'bg-blue-500/10 text-blue-300 border-blue-500/25', dot: 'bg-blue-400' },
  medium: { label: 'Medium', className: 'bg-amber-500/10 text-amber-300 border-amber-500/25', dot: 'bg-amber-400' },
  high: { label: 'High', className: 'bg-orange-500/10 text-orange-300 border-orange-500/25', dot: 'bg-orange-400' },
  critical: { label: 'Critical', className: 'bg-red-500/10 text-red-300 border-red-500/25', dot: 'bg-red-400' },
};

export function RiskBadge({ level, className = '' }: { level: string; className?: string }) {
  const config = RISK_BADGE_CONFIG[level as RiskLevel] ?? RISK_BADGE_CONFIG.low;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border rounded-full ${config.className} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
