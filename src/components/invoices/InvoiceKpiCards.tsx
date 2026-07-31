'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';
import type { ApiInvoice } from '@/hooks/useInvoicesApi';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Invoice KPI Cards (Premium)
//
// 7 KPI cards: Total Invoices, Paid, Pending, Overdue, Total Value,
// Outstanding, Avg Invoice Value. Each card has icon, trend, subtitle,
// mini sparkline graph, and hover animation.
// ═══════════════════════════════════════════════════════════════════════════════

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  trend?: { value: number; label: string };
  subtitle?: string;
  sparkline?: number[];
  sparkColor: string;
  delay?: number;
}

// ─── Mini Sparkline (SVG) ─────────────────────────────────────────────────────

function MiniSparkline({
  data,
  color,
  width = 64,
  height = 24,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} />;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  // Area path
  const areaPath = `M 0,${height} L ${points
    .split(' ')
    .map((p) => p)
    .join(' L ')} L ${width},${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient
          id={`spark-${color.replace(/[^a-z0-9]/gi, '')}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, '')})`} className={color} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
      />
    </svg>
  );
}

const KpiCard = memo(function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  subtitle,
  sparkline,
  sparkColor,
  delay = 0,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      <Card className="glass-surface rounded-2xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-all duration-300 group">
        <div className="flex items-start justify-between mb-3">
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
              {value}
            </div>
          </div>
          <div
            className={`flex items-center justify-center h-9 w-9 rounded-xl ${iconBg} shrink-0 group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div className="space-y-0.5">
            {trend && (
              <div className="flex items-center gap-1">
                {trend.value >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                <span
                  className={`text-[11px] font-medium ${
                    trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {trend.value >= 0 ? '+' : ''}
                  {trend.value}%
                </span>
                <span className="text-[10px] text-muted-foreground">{trend.label}</span>
              </div>
            )}
            {subtitle && !trend && (
              <div className="text-[11px] text-muted-foreground">{subtitle}</div>
            )}
          </div>
          {sparkline && sparkline.length > 1 && (
            <MiniSparkline data={sparkline} color={sparkColor} />
          )}
        </div>
      </Card>
    </motion.div>
  );
});

// ─── Build KPI data from invoices ─────────────────────────────────────────────

export interface InvoiceKpis {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  totalValue: number;
  outstanding: number;
  avgValue: number;
  // For sparklines — last 8 periods
  totalSpark: number[];
  paidSpark: number[];
  pendingSpark: number[];
  overdueSpark: number[];
  valueSpark: number[];
  outstandingSpark: number[];
  avgSpark: number[];
}

export function computeInvoiceKpis(invoices: ApiInvoice[]): InvoiceKpis {
  const now = new Date();
  const total = invoices.length;
  const paid = invoices.filter((i) => i.status === 'paid' || i.paymentStatus === 'paid').length;
  const pending = invoices.filter(
    (i) =>
      i.status === 'sent' ||
      i.status === 'viewed' ||
      i.status === 'issued' ||
      i.paymentStatus === 'partially_paid' ||
      i.status === 'partially_paid',
  ).length;
  const overdue = invoices.filter((i) => i.status === 'overdue').length;
  const totalValue = invoices.reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);
  const outstanding = invoices.reduce((sum, i) => sum + (i.balanceAmount ?? 0), 0);
  const avgValue = total > 0 ? totalValue / total : 0;

  // Sparkline: group by month for last 8 months
  const months: Array<{ key: string; total: number; paid: number; pending: number; overdue: number; value: number; outstanding: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    months.push({ key, total: 0, paid: 0, pending: 0, overdue: 0, value: 0, outstanding: 0 });
  }

  for (const inv of invoices) {
    const d = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date(inv.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = months.find((mm) => mm.key === key);
    if (!m) continue;
    m.total += 1;
    m.value += inv.totalAmount ?? 0;
    m.outstanding += inv.balanceAmount ?? 0;
    if (inv.status === 'paid' || inv.paymentStatus === 'paid') m.paid += 1;
    if (
      inv.status === 'sent' ||
      inv.status === 'viewed' ||
      inv.status === 'issued' ||
      inv.paymentStatus === 'partially_paid'
    )
      m.pending += 1;
    if (inv.status === 'overdue') m.overdue += 1;
  }

  return {
    total,
    paid,
    pending,
    overdue,
    totalValue,
    outstanding,
    avgValue,
    totalSpark: months.map((m) => m.total),
    paidSpark: months.map((m) => m.paid),
    pendingSpark: months.map((m) => m.pending),
    overdueSpark: months.map((m) => m.overdue),
    valueSpark: months.map((m) => m.value),
    outstandingSpark: months.map((m) => m.outstanding),
    avgSpark: months.map((m) => (m.total > 0 ? m.value / m.total : 0)),
  };
}

// ─── KPI Cards Grid ───────────────────────────────────────────────────────────

interface InvoiceKpiCardsProps {
  kpis: InvoiceKpis;
}

export function InvoiceKpiCards({ kpis }: InvoiceKpiCardsProps) {
  const cards: KpiCardProps[] = [
    {
      label: 'Total Invoices',
      value: formatNumber(kpis.total),
      icon: FileText,
      iconColor: 'text-zinc-300',
      iconBg: 'bg-zinc-500/15',
      sparkline: kpis.totalSpark,
      sparkColor: 'text-zinc-400',
      delay: 0,
      subtitle: `${kpis.total} all-time`,
    },
    {
      label: 'Paid',
      value: formatNumber(kpis.paid),
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15',
      sparkline: kpis.paidSpark,
      sparkColor: 'text-emerald-400',
      delay: 0.05,
      subtitle: `${kpis.total > 0 ? Math.round((kpis.paid / kpis.total) * 100) : 0}% collected`,
    },
    {
      label: 'Pending',
      value: formatNumber(kpis.pending),
      icon: Clock,
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/15',
      sparkline: kpis.pendingSpark,
      sparkColor: 'text-cyan-400',
      delay: 0.1,
      subtitle: 'Awaiting payment',
    },
    {
      label: 'Overdue',
      value: formatNumber(kpis.overdue),
      icon: AlertCircle,
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/15',
      sparkline: kpis.overdueSpark,
      sparkColor: 'text-red-400',
      delay: 0.15,
      subtitle: kpis.overdue > 0 ? 'Needs attention' : 'All on track',
    },
    {
      label: 'Total Value',
      value: formatCurrency(kpis.totalValue),
      icon: IndianRupee,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15',
      sparkline: kpis.valueSpark,
      sparkColor: 'text-emerald-400',
      delay: 0.2,
      subtitle: 'Lifetime billed',
    },
    {
      label: 'Outstanding',
      value: formatCurrency(kpis.outstanding),
      icon: Wallet,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15',
      sparkline: kpis.outstandingSpark,
      sparkColor: 'text-amber-400',
      delay: 0.25,
      subtitle: 'To be collected',
    },
    {
      label: 'Avg Invoice',
      value: formatCurrency(kpis.avgValue),
      icon: TrendingUp,
      iconColor: 'text-teal-400',
      iconBg: 'bg-teal-500/15',
      sparkline: kpis.avgSpark,
      sparkColor: 'text-teal-400',
      delay: 0.3,
      subtitle: 'Per invoice',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 md:gap-4">
      {cards.map((card, i) => (
        <KpiCard key={card.label} {...card} delay={i * 0.05} />
      ))}
    </div>
  );
}
