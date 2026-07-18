'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Structured Query Card
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders a StructuredQueryResult as a premium data card INSIDE the Oracle chat
// (above the conversational text answer). Four render modes, picked by the
// `format` field:
//
//   • 'table'  → Invoice/return rows with currency/number/date/badge cells
//   • 'list'   → Label/value list (bank accounts, expense categories)
//   • 'number' → Stat tiles (cash position, GST, profit, health)
//   • 'chart'  → 6-month mini bar chart + trend direction + stats
//
// Styling is hard-coded to the Oracle chat's dark palette (#0c0c0c card, white
// text, emerald accents) — independent of the app theme — so the card always
// looks right inside the chat surface.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  ShieldAlert, Database, type LucideIcon,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type {
  StructuredQueryResult,
  StructuredColumn,
  StructuredStatRow,
  StructuredListRow,
} from '@/lib/oracle/structured-query-types';

// ─── Icons per query type ─────────────────────────────────────────────────────

const TYPE_ICON: Record<string, LucideIcon> = {
  unpaid_invoices: Database,
  overdue_invoices: AlertTriangle,
  top_customers: TrendingUp,
  gst_payable: ShieldAlert,
  cash_position: Database,
  revenue_trend: TrendingUp,
  profit: TrendingUp,
  expenses: Database,
  compliance: CheckCircle2,
  health_score: CheckCircle2,
};

// ─── Cell renderers ───────────────────────────────────────────────────────────

function formatCell(value: unknown, format: StructuredColumn['format']): string {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'currency': {
      const n = Number(value);
      if (!isFinite(n) || isNaN(n)) return '—';
      const abs = Math.abs(n);
      const sign = n < 0 ? '-' : '';
      if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
      if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
      if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
      return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
    }
    case 'number': {
      const n = Number(value);
      if (!isFinite(n) || isNaN(n)) return '—';
      return Math.round(n).toLocaleString('en-IN');
    }
    case 'date': {
      const s = String(value);
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    }
    default:
      return String(value);
  }
}

function badgeToneForStatus(status: string): 'default' | 'warning' | 'success' | 'danger' {
  const s = status.toLowerCase();
  if (s.includes('overdue') || s.includes('critical') || s.includes('error') || s.includes('failed')) {
    return 'danger';
  }
  if (s.includes('partial') || s.includes('pending') || s.includes('unpaid') || s.includes('draft')) {
    return 'warning';
  }
  if (s.includes('paid') || s.includes('filed') || s.includes('matched') || s.includes('completed') || s.includes('success')) {
    return 'success';
  }
  return 'default';
}

function daysOverdueTone(days: number): 'default' | 'warning' | 'danger' {
  if (days <= 0) return 'default';
  if (days <= 30) return 'warning';
  return 'danger';
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ stat }: { stat: StructuredStatRow }) {
  const tone = stat.tone ?? 'default';
  const toneClasses: Record<string, string> = {
    default: 'text-white',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  };
  const ringClasses: Record<string, string> = {
    default: 'border-white/10',
    success: 'border-emerald-500/30',
    warning: 'border-amber-500/30',
    danger: 'border-red-500/30',
  };
  return (
    <div
      className={`rounded-lg border ${ringClasses[tone]} px-3 py-2.5`}
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-white/50">
        {stat.label}
      </div>
      <div className={`mt-1 text-base font-semibold ${toneClasses[tone]}`}>
        {stat.value}
      </div>
      {stat.hint && (
        <div className="mt-0.5 text-[10px] text-white/40">{stat.hint}</div>
      )}
    </div>
  );
}

// ─── Stat grid ────────────────────────────────────────────────────────────────

function StatGrid({ stats }: { stats: StructuredStatRow[] }) {
  if (stats.length === 0) return null;
  return (
    <div
      className={`grid gap-2 ${stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}
    >
      {stats.map((s, i) => (
        <StatTile key={i} stat={s} />
      ))}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({ items }: { items: StructuredListRow[] }) {
  return (
    <div className="divide-y divide-white/5 rounded-lg border border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
      {items.map((item, i) => {
        const tone = item.tone ?? 'default';
        const valueClasses: Record<string, string> = {
          default: 'text-white',
          success: 'text-emerald-400',
          warning: 'text-amber-400',
          danger: 'text-red-400',
        };
        return (
          <div key={i} className="flex items-center justify-between px-3 py-2">
            <span className="truncate text-xs text-white/70">{item.label}</span>
            <span className={`ml-3 shrink-0 text-xs font-semibold ${valueClasses[tone]}`}>
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

function TableView({
  columns,
  rows,
}: {
  columns: StructuredColumn[];
  rows: Record<string, unknown>[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 px-4 py-6 text-center text-xs text-white/50" style={{ background: 'rgba(255,255,255,0.02)' }}>
        No matching records.
      </div>
    );
  }
  return (
    <div
      className="max-h-80 overflow-y-auto rounded-lg border border-white/10"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Custom scrollbar */}
      <style>{`
        .structured-card-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .structured-card-scroll::-webkit-scrollbar-track { background: transparent; }
        .structured-card-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .structured-card-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
      `}</style>
      <div className="structured-card-scroll max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={
                    c.align === 'right'
                      ? 'text-right text-[10px] font-medium uppercase tracking-wide text-white/50'
                      : c.align === 'center'
                        ? 'text-center text-[10px] font-medium uppercase tracking-wide text-white/50'
                        : 'text-left text-[10px] font-medium uppercase tracking-wide text-white/50'
                  }
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={i}
                className="border-white/5 hover:bg-white/[0.03]"
                style={{ background: 'transparent' }}
              >
                {columns.map((c) => {
                  const v = row[c.key];
                  const align =
                    c.align === 'right'
                      ? 'text-right'
                      : c.align === 'center'
                        ? 'text-center'
                        : 'text-left';
                  if (c.format === 'badge') {
                    // Special-case "daysOverdue" — render as a colored pill.
                    if (c.key === 'daysOverdue') {
                      const n = Number(v) || 0;
                      if (n <= 0) {
                        return (
                          <TableCell key={c.key} className={`${align} text-xs text-white/60`}>
                            <span className="text-white/40">—</span>
                          </TableCell>
                        );
                      }
                      const tone = daysOverdueTone(n);
                      const cls = tone === 'danger'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30';
                      return (
                        <TableCell key={c.key} className={`${align} text-xs`}>
                          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
                            {n}d
                          </span>
                        </TableCell>
                      );
                    }
                    // General status badge
                    const s = String(v ?? '');
                    const tone = badgeToneForStatus(s);
                    const cls = tone === 'danger'
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : tone === 'warning'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : tone === 'success'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-white/5 text-white/60 border-white/10';
                    return (
                      <TableCell key={c.key} className={`${align} text-xs`}>
                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize ${cls}`}>
                          {s || '—'}
                        </span>
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell
                      key={c.key}
                      className={`${align} whitespace-nowrap text-xs text-white/80`}
                    >
                      {formatCell(v, c.format)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Chart view (6-month mini bar chart) ──────────────────────────────────────

function ChartView({
  trend,
  trendDirection,
}: {
  trend: { label: string; value: number }[];
  trendDirection?: 'up' | 'down' | 'flat';
}) {
  if (!trend || trend.length === 0) return null;
  const max = Math.max(...trend.map((p) => p.value), 1);
  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;
  const trendColor =
    trendDirection === 'up'
      ? 'text-emerald-400'
      : trendDirection === 'down'
        ? 'text-red-400'
        : 'text-white/60';
  const barColor =
    trendDirection === 'up'
      ? 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)'
      : trendDirection === 'down'
        ? 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)'
        : 'linear-gradient(180deg, #6b7280 0%, #4b5563 100%)';

  return (
    <div className="rounded-lg border border-white/10 p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
          Last 6 months
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          {trendDirection === 'up' ? 'Trending up' : trendDirection === 'down' ? 'Trending down' : 'Flat'}
        </span>
      </div>
      <div className="flex h-24 items-end justify-between gap-1.5">
        {trend.map((p, i) => {
          const h = Math.max((p.value / max) * 100, 2);
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{ height: `${h}%`, background: barColor, minHeight: '2px' }}
                title={`₹${Math.round(p.value).toLocaleString('en-IN')}`}
              />
              <span className="text-[9px] text-white/40">{p.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export interface StructuredQueryCardProps {
  result: StructuredQueryResult;
}

export function StructuredQueryCard({ result }: StructuredQueryCardProps) {
  const Icon = TYPE_ICON[result.type] ?? Database;
  const hasRows = (result.rows?.length ?? 0) > 0;
  const hasItems = (result.items?.length ?? 0) > 0;
  const hasStats = (result.stats?.length ?? 0) > 0;
  const hasTrend = (result.trend?.length ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-2"
    >
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          background: 'linear-gradient(180deg, rgba(37,99,235,0.04) 0%, #0c0c0c 60%)',
          borderColor: 'rgba(37,99,235,0.25)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-2 px-4 py-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ background: 'rgba(37,99,235,0.15)' }}
            >
              <Icon className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">{result.title}</div>
              <div className="text-[10px] text-white/40">
                Live data · {new Date(result.generatedAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400"
          >
            Structured
          </Badge>
        </div>

        {/* Body */}
        <div className="space-y-3 p-3">
          {/* Stats grid (always render first when present) */}
          {hasStats && <StatGrid stats={result.stats!} />}

          {/* Trend chart */}
          {hasTrend && (
            <ChartView trend={result.trend!} trendDirection={result.trendDirection} />
          )}

          {/* List payload */}
          {hasItems && <ListView items={result.items!} />}

          {/* Table payload */}
          {hasRows && result.columns && (
            <TableView columns={result.columns} rows={result.rows!} />
          )}

          {/* Summary line */}
          <div className="rounded-md px-2 py-1.5 text-[11px] leading-relaxed text-white/60" style={{ background: 'rgba(255,255,255,0.02)' }}>
            {result.summary}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
