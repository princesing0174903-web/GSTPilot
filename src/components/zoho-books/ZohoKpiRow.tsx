'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — ZohoKpiRow
// ═══════════════════════════════════════════════════════════════════════════════
//
// 4 premium KPI cards shown at the top of the connected-mode dashboard.
// Responsive: 1 col mobile → 2 col tablet → 4 col desktop.
//
// KPIs:
//   1. Total Records Imported (sum of all entity counts)
//   2. Modules Synced (X / 8)
//   3. Last Sync Duration (e.g. "12s")
//   4. Sync Health Score (0–100, color: red <40, amber 40–70, blue 70+)
//
// RULE 9: If no sync has happened yet (just connected), every value shows "—"
// with an "Awaiting first sync" subtitle. NO fake numbers.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import {
  Database,
  Layers,
  Timer,
  HeartPulse,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import type { ZohoSyncStatusInfo } from '@/hooks/useZohoBooks';
import { ZOHO_MODULES, ZOHO_MODULE_TOTAL, formatDuration } from './types';

interface ZohoKpiRowProps {
  /** Latest sync status from the hook. Null while loading. */
  syncStatus: ZohoSyncStatusInfo | null;
  /** True if a sync is currently running. */
  syncing: boolean;
}

interface KpiCardData {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  hasData: boolean;
  icon: LucideIcon;
  iconTone: string;
  change: number | null;
  changeLabel: string;
  sparkline: number[];
}

// ─── Inline mini sparkline (60×24 SVG, blue stroke) ──────────────────────────
function MiniSpark({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) {
    return <svg width={60} height={24} aria-hidden="true" />;
  }
  const w = 60;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const d = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiCard({ kpi }: { kpi: KpiCardData }) {
  const { icon: Icon } = kpi;
  const changePositive = kpi.change !== null && kpi.change >= 0;
  const changeColor =
    kpi.change === null
      ? 'text-muted-foreground'
      : changePositive
        ? 'text-[#60A5FA]'
        : 'text-red-400';
  const ChangeIcon =
    kpi.change === null ? null : changePositive ? TrendingUp : TrendingDown;

  return (
    <div
      className="group relative rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-md"
      role="group"
      aria-label={kpi.label}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {kpi.label}
          </span>
        </div>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.iconTone}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span
          className={`text-2xl font-bold tabular-nums ${
            kpi.hasData ? 'text-foreground' : 'text-muted-foreground/60'
          }`}
        >
          {kpi.value}
        </span>
        {kpi.hasData && kpi.sparkline.length >= 2 ? (
          <MiniSpark data={kpi.sparkline} color="#3B82F6" />
        ) : null}
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {kpi.hasData && ChangeIcon ? (
          <span className={`inline-flex items-center gap-0.5 font-semibold ${changeColor}`}>
            <ChangeIcon className="h-3 w-3" />
            {Math.abs(kpi.change!).toFixed(1)}%
          </span>
        ) : null}
        <span className="text-muted-foreground">{kpi.subtitle}</span>
      </div>
    </div>
  );
}

export function ZohoKpiRow({ syncStatus, syncing }: ZohoKpiRowProps) {
  const kpis = useMemo<KpiCardData[]>(() => {
    const recordsImported = syncStatus?.recordsImported ?? {};
    const totalRecords = syncStatus?.totalRecords ?? 0;
    const lastSync = syncStatus?.lastSync ?? null;
    const hasSynced = !!lastSync && totalRecords > 0;

    // Modules synced = count of entities with records > 0
    const modulesSynced = ZOHO_MODULES.filter((m) => {
      const c = recordsImported[m.key];
      return typeof c === 'number' && c > 0;
    }).length;

    // Health score: derived from last sync status + module coverage.
    // 0–100. red <40, amber 40–70, blue 70+.
    let healthScore = 0;
    let healthSubtitle = 'Awaiting first sync';
    if (hasSynced && lastSync) {
      const coverage = modulesSynced / ZOHO_MODULE_TOTAL; // 0–1
      const statusWeight =
        lastSync.status === 'completed'
          ? 1
          : lastSync.status === 'partial'
            ? 0.6
            : lastSync.status === 'failed'
              ? 0.2
              : 0.5;
      healthScore = Math.round(coverage * 60 + statusWeight * 40);
      healthSubtitle =
        healthScore >= 70
          ? 'Excellent'
          : healthScore >= 40
            ? 'Fair'
            : 'Needs attention';
    }

    // Synthesize a small sparkline from per-module counts (just for visual)
    const spark = ZOHO_MODULES.map((m) => recordsImported[m.key] ?? 0);

    const baseSpark = hasSynced && spark.some((v) => v > 0) ? spark : [];

    return [
      {
        id: 'total-records',
        label: 'Total Records Imported',
        value: hasSynced ? totalRecords.toLocaleString('en-IN') : '—',
        subtitle: hasSynced ? `${ZOHO_MODULE_TOTAL} modules available` : 'Awaiting first sync',
        hasData: hasSynced,
        icon: Database,
        iconTone: 'bg-[#2563EB]/12 text-[#60A5FA]',
        change: null,
        changeLabel: '',
        sparkline: baseSpark,
      },
      {
        id: 'modules-synced',
        label: 'Modules Synced',
        value: hasSynced ? `${modulesSynced}/${ZOHO_MODULE_TOTAL}` : `0/${ZOHO_MODULE_TOTAL}`,
        subtitle: hasSynced
          ? modulesSynced === ZOHO_MODULE_TOTAL
            ? 'All modules active'
            : 'Partial coverage'
          : 'Awaiting first sync',
        hasData: hasSynced,
        icon: Layers,
        iconTone: 'bg-[#3B82F6]/12 text-[#93C5FD]',
        change: null,
        changeLabel: '',
        sparkline: [],
      },
      {
        id: 'last-duration',
        label: 'Last Sync Duration',
        value: hasSynced ? formatDuration(lastSync?.durationMs ?? null) : '—',
        subtitle: hasSynced ? (syncing ? 'Running now…' : 'Completed') : 'Awaiting first sync',
        hasData: hasSynced,
        icon: Timer,
        iconTone: 'bg-[#2563EB]/12 text-[#60A5FA]',
        change: null,
        changeLabel: '',
        sparkline: [],
      },
      {
        id: 'health',
        label: 'Sync Health Score',
        value: hasSynced ? String(healthScore) : '—',
        subtitle: healthSubtitle,
        hasData: hasSynced,
        icon: HeartPulse,
        iconTone:
          healthScore >= 70
            ? 'bg-[#2563EB]/12 text-[#60A5FA]'
            : healthScore >= 40
              ? 'bg-amber-400/12 text-amber-400'
              : 'bg-red-400/12 text-red-400',
        change: null,
        changeLabel: '',
        sparkline: [],
      },
    ];
  }, [syncStatus, syncing]);

  return (
    <section
      aria-label="Sync KPIs"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </section>
  );
}

export default ZohoKpiRow;
