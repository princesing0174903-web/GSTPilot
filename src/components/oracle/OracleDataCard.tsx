'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Structured Data Card
//
// Renders the {structured: StructuredQueryResult} event emitted by the backend
// BEFORE the streaming text answer. This is the "executive summary" card that
// appears above Oracle's prose response.
//
// Supports 4 formats:
//   • table  — columns + rows (e.g. unpaid invoices)
//   • list   — key/value pairs (e.g. compliance checklist)
//   • number — stat tiles (e.g. cash position)
//   • chart  — trend sparkline (e.g. revenue trend) — lightweight inline SVG
//
// Perplexity Pro + Harvey AI level data presentation.
// ═══════════════════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Table2, ListOrdered, Hash, TrendingUp, TrendingDown, Minus,
  Database, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import type {
  StructuredQueryResult, StructuredColumn, StructuredStatRow,
} from '@/lib/oracle/structured-query-types';

interface OracleDataCardProps {
  data: StructuredQueryResult;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toneClasses(tone?: 'default' | 'warning' | 'success' | 'danger') {
  switch (tone) {
    case 'success':
      return 'text-emerald-400';
    case 'warning':
      return 'text-amber-400';
    case 'danger':
      return 'text-red-400';
    default:
      return 'text-white/90';
  }
}

function toneIcon(tone?: 'default' | 'warning' | 'success' | 'danger') {
  switch (tone) {
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    case 'danger':
      return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    default:
      return null;
  }
}

function formatCell(value: unknown, col: StructuredColumn): string {
  if (value === null || value === undefined) return '—';
  const str = String(value);
  if (col.format === 'currency') {
    const num = Number(str.replace(/[^0-9.-]/g, ''));
    if (!isNaN(num)) {
      if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
      if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
      if (Math.abs(num) >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
      return `₹${num.toFixed(0)}`;
    }
    return str;
  }
  if (col.format === 'number') {
    const num = Number(str.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? str : num.toLocaleString('en-IN');
  }
  if (col.format === 'date') {
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return str;
}

function alignClass(align?: 'left' | 'right' | 'center') {
  switch (align) {
    case 'right':
      return 'text-right';
    case 'center':
      return 'text-center';
    default:
      return 'text-left';
  }
}

// ─── Lightweight SVG sparkline (avoids recharts bundle weight) ───────────────

function TrendSparkline({
  points, direction,
}: {
  points: { label: string; value: number }[];
  direction: 'up' | 'down' | 'flat';
}) {
  if (!points || points.length < 2) return null;
  const W = 280, H = 64, PAD = 6;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: PAD + i * stepX,
    y: H - PAD - ((p.value - min) / range) * (H - PAD * 2),
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(1)},${H - PAD} L${coords[0].x.toFixed(1)},${H - PAD} Z`;
  const stroke = direction === 'up' ? '#10B981' : direction === 'down' ? '#EF4444' : '#F59E0B';
  const fillId = `spark-fill-${direction}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 320 }}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="2.5" fill={stroke} />
      ))}
    </svg>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ stat }: { stat: StructuredStatRow }) {
  const deltaUp = (stat.delta ?? 0) > 0;
  const deltaDown = (stat.delta ?? 0) < 0;
  const DeltaIcon = deltaUp ? TrendingUp : deltaDown ? TrendingDown : Minus;
  const deltaColor = deltaUp ? 'text-emerald-400' : deltaDown ? 'text-red-400' : 'text-white/40';

  return (
    <div className="rounded-xl border border-[#1F1F1F] bg-[#0E0E0E] p-3.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
        {stat.label}
      </p>
      <p className={`text-[22px] font-bold tabular-nums leading-none ${toneClasses(stat.tone)}`}>
        {stat.value}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        {stat.delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-[11px] font-medium ${deltaColor}`}>
            <DeltaIcon className="h-3 w-3" />
            {Math.abs(stat.delta).toFixed(1)}%
          </span>
        )}
        {stat.hint && (
          <span className="text-[11px] text-white/40">{stat.hint}</span>
        )}
      </div>
    </div>
  );
}

// ─── Format renderers ─────────────────────────────────────────────────────────

function TableFormat({ data }: { data: StructuredQueryResult }) {
  if (!data.columns || !data.rows) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-[#1F1F1F]">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-[#141414]">
            {data.columns.map((col) => (
              <th
                key={col.key}
                className={`border-b border-[#1F1F1F] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-amber-400/90 ${alignClass(col.align)}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-b border-[#161616] transition-colors hover:bg-white/[0.02]">
              {data.columns!.map((col) => (
                <td key={col.key} className={`px-3 py-2 text-white/80 ${alignClass(col.align)}`}>
                  {col.format === 'badge' ? (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      /overdue|unpaid|late|risk|pending/i.test(String(row[col.key] ?? ''))
                        ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                    }`}>
                      {formatCell(row[col.key], col)}
                    </span>
                  ) : (
                    formatCell(row[col.key], col)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.rows.length > 50 && (
        <p className="bg-[#0E0E0E] px-3 py-1.5 text-center text-[11px] text-white/40">
          +{data.rows.length - 50} more rows
        </p>
      )}
    </div>
  );
}

function ListFormat({ data }: { data: StructuredQueryResult }) {
  if (!data.items) return null;
  return (
    <div className="space-y-1.5">
      {data.items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-lg border border-[#1A1A1A] bg-[#0E0E0E] px-3 py-2"
        >
          {toneIcon(item.tone) ?? <span className="h-1 w-1 rounded-full bg-white/30" />}
          <span className="flex-1 text-[13px] text-white/70">{item.label}</span>
          <span className={`text-[13px] font-semibold tabular-nums ${toneClasses(item.tone)}`}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function NumberFormat({ data }: { data: StructuredQueryResult }) {
  if (!data.stats) return null;
  return (
    <div className={`grid gap-2.5 ${data.stats.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {data.stats.map((stat, i) => (
        <StatTile key={i} stat={stat} />
      ))}
    </div>
  );
}

function ChartFormat({ data }: { data: StructuredQueryResult }) {
  if (!data.trend) return null;
  const dir = data.trendDirection ?? 'flat';
  const DirIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const dirColor = dir === 'up' ? 'text-emerald-400' : dir === 'down' ? 'text-red-400' : 'text-amber-400';

  return (
    <div className="rounded-xl border border-[#1F1F1F] bg-[#0E0E0E] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <DirIcon className={`h-4 w-4 ${dirColor}`} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            {dir === 'up' ? 'Upward trend' : dir === 'down' ? 'Downward trend' : 'Stable'}
          </span>
        </div>
      </div>
      <TrendSparkline points={data.trend} direction={dir} />
      <div className="mt-2 flex justify-between">
        {data.trend.slice(0, 6).map((p, i) => (
          <span key={i} className="text-[9.5px] font-medium text-white/35">{p.label}</span>
        ))}
      </div>
      {data.stats && data.stats.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#1A1A1A] pt-3">
          {data.stats.map((stat, i) => (
            <div key={i}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{stat.label}</p>
              <p className={`text-[15px] font-bold tabular-nums ${toneClasses(stat.tone)}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

function OracleDataCardImpl({ data }: OracleDataCardProps) {
  const formatIcon = {
    table: Table2,
    list: ListOrdered,
    number: Hash,
    chart: TrendingUp,
  }[data.format] ?? Database;

  const Icon = formatIcon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-3 overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-br from-[#0F0F0F] to-[#0B0B0B]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1A1A1A] bg-[#101010] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/20">
            <Icon className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-[13px] font-semibold text-white">{data.title}</span>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/20">
          Live Data
        </span>
      </div>

      {/* Summary */}
      <p className="px-4 pt-3 text-[12px] text-white/55">{data.summary}</p>

      {/* Body */}
      <div className="p-4 pt-2">
        {data.format === 'table' && <TableFormat data={data} />}
        {data.format === 'list' && <ListFormat data={data} />}
        {data.format === 'number' && <NumberFormat data={data} />}
        {data.format === 'chart' && <ChartFormat data={data} />}
      </div>
    </motion.div>
  );
}

export const OracleDataCard = memo(OracleDataCardImpl);
export default OracleDataCard;
