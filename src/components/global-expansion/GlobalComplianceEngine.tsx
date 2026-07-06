'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: GLOBAL COMPLIANCE ENGINE™
//
// Multi-jurisdiction compliance orchestration across 10 countries — automated
// framework tracking, audit scheduling, regional filtering & risk alerts.
// All values derived from static data layer (@/lib/global/data). No API calls.
//
//   • Header with 91% Compliant badge
//   • 4 KPI tiles: Total Frameworks, Compliant, In Progress, Need Attention
//   • Region filter tabs: All / India / USA / EU / UK / APAC / Middle East
//   • Framework grid: cards w/ requirements, deadlines, audit dates, status
//   • Status legend
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, RefreshCw, FileCheck, CheckCircle2,
  Globe2, Sparkles, CalendarClock, ClipboardList, type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  COMPLIANCE_FRAMEWORKS, getCountry, statusColor,
  type ComplianceFramework, type CountryCode,
} from '@/lib/global/data';

// ─── Region Filter ─────────────────────────────────────────────────────────────

const REGION_TABS = ['All', 'India', 'USA', 'EU', 'UK', 'APAC', 'Middle East'] as const;
type RegionTab = typeof REGION_TABS[number];

function regionMatches(fw: ComplianceFramework, region: RegionTab): boolean {
  if (region === 'All') return true;
  switch (region) {
    case 'India': return fw.region === 'India';
    case 'USA': return fw.region === 'United States';
    case 'EU': return fw.region === 'European Union';
    case 'UK': return fw.region === 'United Kingdom';
    case 'APAC': return ['Singapore', 'Australia', 'Japan'].includes(fw.region);
    case 'Middle East': return fw.region === 'UAE';
    default: return false;
  }
}

// ─── Style Maps ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  slate: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};

const STATUS_DOT: Record<string, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  slate: 'bg-slate-400',
};

const ACCENT_RING: Record<'emerald' | 'teal' | 'cyan' | 'amber', string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
};

// ─── Framework Card ────────────────────────────────────────────────────────────

function FrameworkCard({ fw, index }: { fw: ComplianceFramework; index: number }) {
  const color = statusColor(fw.status);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.14] transition-all flex flex-col"
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <FileCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100 leading-tight">{fw.name}</h3>
            <p className="mt-1 text-[11px] text-zinc-400 leading-snug line-clamp-2">{fw.description}</p>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] uppercase ${STATUS_BADGE[color]}`}>
          {fw.status}
        </Badge>
      </div>

      {/* badges */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className="text-[10px] border-teal-500/30 bg-teal-500/10 text-teal-300">
          <Globe2 className="h-3 w-3" />{fw.region}
        </Badge>
        <Badge variant="outline" className="text-[10px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
          {fw.category}
        </Badge>
        <div className="flex items-center gap-0.5 ml-auto">
          {fw.countries.map((cc) => {
            const c = getCountry(cc as CountryCode);
            return (
              <span key={cc} title={c?.name ?? cc} className="text-sm leading-none">
                {c?.flag ?? '🏳️'}
              </span>
            );
          })}
        </div>
      </div>

      {/* requirements */}
      <div className="mt-3 flex-1">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
          <ClipboardList className="h-3 w-3" />Requirements
        </div>
        <ul className="space-y-1">
          {fw.requirements.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-300">
              <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <Separator className="my-3 bg-white/[0.06]" />

      {/* footer */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="uppercase tracking-wider text-zinc-500 flex items-center gap-0.5">
            <CalendarClock className="h-2.5 w-2.5" />Deadline
          </div>
          <div className="text-zinc-200 mt-0.5 font-medium">{fw.deadline}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-zinc-500">Last Audit</div>
          <div className="text-zinc-200 mt-0.5 font-medium">{fw.lastAudit}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-zinc-500">Next Audit</div>
          <div className="text-zinc-200 mt-0.5 font-medium">{fw.nextAudit}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function GlobalComplianceEngine() {
  const [region, setRegion] = useState<RegionTab>('All');

  const kpis = useMemo(() => {
    const total = COMPLIANCE_FRAMEWORKS.length;
    const compliant = COMPLIANCE_FRAMEWORKS.filter((f) => f.status === 'compliant').length;
    const inProgress = COMPLIANCE_FRAMEWORKS.filter((f) => f.status === 'in-progress').length;
    const attention = COMPLIANCE_FRAMEWORKS.filter(
      (f) => f.status === 'attention' || f.status === 'upcoming',
    ).length;
    return { total, compliant, inProgress, attention };
  }, []);

  const filtered = useMemo(
    () => COMPLIANCE_FRAMEWORKS.filter((f) => regionMatches(f, region)),
    [region],
  );

  const KPI_TILES: {
    icon: LucideIcon;
    label: string;
    value: number;
    accent: 'emerald' | 'teal' | 'cyan' | 'amber';
    sub: string;
  }[] = [
    { icon: FileCheck, label: 'Total Frameworks', value: kpis.total, accent: 'teal', sub: 'Active jurisdictions' },
    { icon: CheckCircle2, label: 'Compliant', value: kpis.compliant, accent: 'emerald', sub: 'Fully met' },
    { icon: RefreshCw, label: 'In Progress', value: kpis.inProgress, accent: 'amber', sub: 'Remediation underway' },
    { icon: AlertTriangle, label: 'Need Attention', value: kpis.attention, accent: 'cyan', sub: 'Action required' },
  ];

  const LEGEND = [
    { k: 'compliant', c: 'emerald', d: 'Fully met — all requirements satisfied' },
    { k: 'in-progress', c: 'amber', d: 'Remediation in progress' },
    { k: 'attention', c: 'rose', d: 'Action required — risk of non-compliance' },
    { k: 'upcoming', c: 'slate', d: 'Future deadline — scheduled' },
  ];

  return (
    <div className="space-y-6">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h1 className="text-xl font-semibold text-zinc-50">
              Global Compliance Engine
              <sup className="text-[10px] text-emerald-400 ml-0.5">™</sup>
            </h1>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px]">
              <Sparkles className="h-3 w-3" />91% Compliant
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-zinc-400 max-w-2xl">
            Multi-jurisdiction compliance orchestration across 10 countries — automated framework
            tracking, audit scheduling, and real-time risk alerts.
          </p>
        </div>
      </motion.div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPI_TILES.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.12] transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${ACCENT_RING[k.accent]}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">{k.label}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{k.value}</div>
            <div className="text-[10px] text-zinc-500">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Region filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {REGION_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setRegion(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${
              region === t
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.14]'
            }`}
          >
            {t}
            <span className="ml-1.5 text-[10px] text-zinc-500">
              {t === 'All'
                ? COMPLIANCE_FRAMEWORKS.length
                : COMPLIANCE_FRAMEWORKS.filter((f) => regionMatches(f, t)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Framework grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((f, i) => (
            <FrameworkCard key={f.id} fw={f} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {/* Status legend */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2.5">Status Legend</div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px]">
          {LEGEND.map((s) => (
            <div key={s.k} className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[s.c]}`} />
              <span className="capitalize text-zinc-200 font-medium">{s.k}</span>
              <span className="text-zinc-500">— {s.d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
