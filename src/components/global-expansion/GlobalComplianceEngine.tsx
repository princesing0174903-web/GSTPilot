'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: GLOBAL COMPLIANCE ENGINE™ (BILLION-DOLLAR GRADE)
//
// Multi-jurisdiction compliance orchestration across 10 countries — automated
// framework tracking, audit scheduling, regional filtering & risk alerts.
// All values derived from static data layer (@/lib/global/data). No API calls.
//
//   • Header with 91% Compliant badge
//   • 4 KPI tiles: Total Frameworks, Compliant, In Progress, Need Attention
//   • Region filter tabs: All / India / USA / EU / UK / APAC / Middle East
//   • Framework grid: cards w/ requirements, deadlines, audit dates, status
//   • Compliance Calendar (FILING_DEADLINES): timeline sorted by daysLeft
//   • Compliance Score Breakdown: per-country with sub-metrics + progress bars
//   • Regulatory Changes Monitor (REGULATORY_CHANGES): impact + action required
//   • Penalty Calculator: interactive country/form/days-late penalty estimator
//   • Audit Trail: timeline of recent compliance actions
//   • Document Checklist: expandable per-framework accordion w/ checkboxes
//   • Status legend
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, RefreshCw, FileCheck, CheckCircle2,
  Globe2, Sparkles, CalendarClock, ClipboardList, type LucideIcon,
  CalendarDays, Gavel, ScrollText, Calculator, Clock, Bell,
  History, Hourglass, TrendingDown, CircleDot,
  CalendarRange, Umbrella, Scale, Landmark, ShieldAlert, Map,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  COMPLIANCE_FRAMEWORKS, FILING_DEADLINES, REGULATORY_CHANGES,
  getCountry, statusColor, fmtUSD,
  type ComplianceFramework, type CountryCode, type FilingDeadline,
  type RegulatoryChange,
} from '@/lib/global/data';
import {
  REGULATORY_REPORTS, COUNTRY_RISKS, INSURANCE_POLICIES,
  type RegulatoryReport, type CountryRisk, type InsurancePolicy,
} from '@/lib/global/data-enterprise';

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

const ACCENT_RING: Record<'emerald' | 'teal' | 'cyan' | 'amber' | 'violet' | 'rose', string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  rose: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
};

const PRIORITY_STYLE: Record<FilingDeadline['priority'], { badge: string; ring: string; dot: string }> = {
  critical: {
    badge: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
    ring: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
    dot: 'bg-rose-400',
  },
  high: {
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    ring: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  medium: {
    badge: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    ring: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  low: {
    badge: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
    ring: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
    dot: 'bg-slate-400',
  },
};

const IMPACT_STYLE: Record<RegulatoryChange['impact'], string> = {
  high: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  low: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
};

// ─── Per-Country Compliance Score Sub-Metrics ──────────────────────────────────

interface CountryScore {
  code: CountryCode;
  name: string;
  flag: string;
  overall: number;
  filingTimeliness: number;
  docCompleteness: number;
  auditReadiness: number;
  penaltyHistory: number;
}

// Deterministic derivation of per-country compliance sub-metrics from existing data.
// No Math.random — uses a stable hashing function based on country code + indices.
function deriveCountryScores(): CountryScore[] {
  const codes: CountryCode[] = ['IN', 'US', 'GB', 'DE', 'FR', 'AE', 'SG', 'AU', 'CA', 'JP'];
  const hashStr = (s: string): number => {
    let h = 7;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return h;
  };
  return codes.map((code) => {
    const c = getCountry(code);
    const base = c.complianceScore;
    const filingTimeliness = Math.min(100, base + (hashStr(`${code}-fil`) % 9) - 4);
    const docCompleteness = Math.min(100, base + (hashStr(`${code}-doc`) % 7) - 3);
    const auditReadiness = Math.min(100, base + (hashStr(`${code}-aud`) % 6) - 3);
    const penaltyHistory = Math.min(100, base - (hashStr(`${code}-pen`) % 14));
    const overall = Math.round((filingTimeliness + docCompleteness + auditReadiness + penaltyHistory) / 4);
    return {
      code, name: c.name, flag: c.flag,
      overall, filingTimeliness, docCompleteness, auditReadiness, penaltyHistory,
    };
  }).sort((a, b) => b.overall - a.overall);
}

// ─── Penalty Calculator ────────────────────────────────────────────────────────

interface PenaltyRule {
  basePenalty: number;   // USD base
  perDay: number;        // USD per day late
  maxPct: number;        // cap as % of filing liability
  interestAnnualPct: number;
}

const PENALTY_RULES: Record<string, PenaltyRule> = {
  IN: { basePenalty: 50, perDay: 10, maxPct: 100, interestAnnualPct: 18 },
  US: { basePenalty: 195, perDay: 5, maxPct: 25, interestAnnualPct: 8 },
  GB: { basePenalty: 200, perDay: 7, maxPct: 100, interestAnnualPct: 7.5 },
  DE: { basePenalty: 25, perDay: 0.25, maxPct: 25, interestAnnualPct: 6 },
  FR: { basePenalty: 110, perDay: 4, maxPct: 80, interestAnnualPct: 9.6 },
  AE: { basePenalty: 272, perDay: 14, maxPct: 300, interestAnnualPct: 14 },
  SG: { basePenalty: 200, perDay: 8, maxPct: 100, interestAnnualPct: 8 },
  AU: { basePenalty: 222, perDay: 6, maxPct: 100, interestAnnualPct: 11 },
  CA: { basePenalty: 150, perDay: 5, maxPct: 50, interestAnnualPct: 9 },
  JP: { basePenalty: 50, perDay: 1, maxPct: 35, interestAnnualPct: 7.8 },
};

const FILING_TYPES_BY_COUNTRY: Record<string, { id: string; name: string; liability: number }[]> = {
  IN: [
    { id: 'gstr1', name: 'GSTR-1 (Outward Supplies)', liability: 12000 },
    { id: 'gstr3b', name: 'GSTR-3B (Summary + Tax)', liability: 18000 },
    { id: 'tds', name: 'TDS Return 24Q', liability: 8500 },
    { id: 'gstr9', name: 'GSTR-9 (Annual Return)', liability: 25000 },
  ],
  US: [
    { id: '941', name: 'Form 941 (Quarterly Federal)', liability: 15000 },
    { id: 'sales-tax', name: 'State Sales Tax Filing', liability: 9200 },
    { id: 'boi', name: 'BOI Report (FinCEN)', liability: 5000 },
    { id: '1120', name: 'Form 1120 (Corporate)', liability: 42000 },
  ],
  GB: [
    { id: 'vat100', name: 'VAT 100 (MTD)', liability: 12000 },
    { id: 'ct600', name: 'CT600 (Corporation Tax)', liability: 38000 },
    { id: 'p11d', name: 'P11D (Benefits)', liability: 4200 },
  ],
  DE: [
    { id: 'umsatz', name: 'Umsatzsteuervoranmeldung (VAT)', liability: 14000 },
    { id: 'korporate', name: 'Körperschaftsteuer', liability: 41000 },
  ],
  FR: [
    { id: 'ca3', name: 'CA3 (TVA)', liability: 11000 },
    { id: 'is', name: 'IS (Impôt sur les sociétés)', liability: 32000 },
  ],
  AE: [
    { id: 'vat201', name: 'VAT 201 (FTA)', liability: 8000 },
    { id: 'ct', name: 'Corporate Tax Return', liability: 18000 },
  ],
  SG: [
    { id: 'gstf5', name: 'GST F5 (IRAS)', liability: 9500 },
    { id: 'ec', name: 'Form C-S (Corp Income)', liability: 22000 },
  ],
  AU: [
    { id: 'bas', name: 'BAS (Activity Statement)', liability: 8800 },
    { id: 'ctr', name: 'Company Tax Return', liability: 19000 },
  ],
  CA: [
    { id: 'gst-hst', name: 'GST/HST Return', liability: 7200 },
    { id: 't2', name: 'T2 (Corp Income)', liability: 21000 },
  ],
  JP: [
    { id: 'ct-jp', name: 'Consumption Tax Return', liability: 9800 },
    { id: 'hojin', name: 'Hojin Tozei (Corp Tax)', liability: 28000 },
  ],
};

// ─── Audit Trail (deterministic entries) ───────────────────────────────────────

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  country?: CountryCode;
  status: 'success' | 'warning' | 'pending';
}

const AUDIT_TRAIL: AuditEntry[] = [
  { id: 'at-1', timestamp: '2024-10-03 14:22', actor: 'System (auto-file)', action: 'GSTR-1 filed for August 2024', country: 'IN', status: 'success' },
  { id: 'at-2', timestamp: '2024-10-03 11:08', actor: 'Priya Menon (CFO)', action: 'VAT 100 return submitted to HMRC via MTD', country: 'GB', status: 'success' },
  { id: 'at-3', timestamp: '2024-10-02 17:45', actor: 'System (auto-file)', action: 'BOI report filed for US Delaware entity', country: 'US', status: 'success' },
  { id: 'at-4', timestamp: '2024-10-02 10:13', actor: 'Marcus Webb (Tax Mgr)', action: 'Umsatzsteuervoranmeldung submitted — pending Bundesbank confirmation', country: 'DE', status: 'pending' },
  { id: 'at-5', timestamp: '2024-10-01 18:02', actor: 'System (auto-file)', action: 'GST F5 return filed with IRAS', country: 'SG', status: 'success' },
  { id: 'at-6', timestamp: '2024-10-01 09:30', actor: 'Aisha Al-Rashid (Controller)', action: 'FTA VAT 201 return submitted for Q3', country: 'AE', status: 'success' },
  { id: 'at-7', timestamp: '2024-09-30 22:11', actor: 'System (auto-file)', action: 'BAS submitted to ATO via STP', country: 'AU', status: 'success' },
  { id: 'at-8', timestamp: '2024-09-30 16:48', actor: 'Jean Dubois (Accountant)', action: 'CA3 TVA return submitted — late by 2 days', country: 'FR', status: 'warning' },
  { id: 'at-9', timestamp: '2024-09-29 13:20', actor: 'System (auto-file)', action: 'Consumption tax interim return filed with NTA', country: 'JP', status: 'success' },
  { id: 'at-10', timestamp: '2024-09-28 11:55', actor: 'Yuki Tanaka (Finance)', action: 'CRA GST/HST annual return submitted', country: 'CA', status: 'success' },
  { id: 'at-11', timestamp: '2024-09-27 19:33', actor: 'System (auto-file)', action: 'Form 941 (Q3) filed with IRS', country: 'US', status: 'success' },
  { id: 'at-12', timestamp: '2024-09-27 09:14', actor: 'Priya Menon (CFO)', action: 'TDS return 24Q filed — pending confirmation', country: 'IN', status: 'pending' },
];

// ─── Document Checklist (deterministic) ───────────────────────────────────────

interface DocItem {
  id: string;
  name: string;
  required: boolean;
  defaultChecked: boolean;
}

function getDocsForFramework(fw: ComplianceFramework): DocItem[] {
  const docs: DocItem[] = fw.requirements.map((r, i) => ({
    id: `${fw.id}-doc-${i + 1}`,
    name: r,
    required: true,
    defaultChecked: fw.status === 'compliant',
  }));
  // Common supporting docs
  docs.push({ id: `${fw.id}-sup-1`, name: 'Supporting calculation worksheet', required: false, defaultChecked: fw.status === 'compliant' });
  docs.push({ id: `${fw.id}-sup-2`, name: 'Reconciliation statement', required: false, defaultChecked: fw.status === 'compliant' });
  docs.push({ id: `${fw.id}-sup-3`, name: 'Authorization letter (DSC/E-sign)', required: true, defaultChecked: fw.status === 'compliant' });
  return docs;
}

// ─── Framework Card ────────────────────────────────────────────────────────────

function FrameworkCard({ fw, index }: { fw: ComplianceFramework; index: number }) {
  const color = statusColor(fw.status);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' as const }}
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

// ─── Compliance Calendar (Filing Deadlines) ────────────────────────────────────

function ComplianceCalendar() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'upcoming'>('all');

  const sorted = useMemo(() => {
    const list = [...FILING_DEADLINES].sort((a, b) => a.daysLeft - b.daysLeft);
    if (filter === 'critical') return list.filter((f) => f.priority === 'critical');
    if (filter === 'upcoming') return list.filter((f) => f.status === 'upcoming' || f.status === 'in-progress');
    return list;
  }, [filter]);

  const stats = useMemo(() => {
    const critical = FILING_DEADLINES.filter((f) => f.priority === 'critical').length;
    const overdue = FILING_DEADLINES.filter((f) => f.daysLeft <= 7 && f.status !== 'filed').length;
    const filed = FILING_DEADLINES.filter((f) => f.status === 'filed').length;
    return { critical, overdue, filed };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-300">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Compliance Calendar</h2>
            <p className="text-[11px] text-zinc-500">
              {FILING_DEADLINES.length} upcoming filings · {stats.critical} critical · {stats.overdue} due ≤7d · {stats.filed} filed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'critical', 'upcoming'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider transition-all ${
                filter === f
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/[0.02] text-zinc-400 border border-white/[0.06] hover:text-zinc-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="max-h-[440px] pr-2">
        <div className="relative pl-4">
          {/* vertical timeline line */}
          <div className="absolute left-[5px] top-1 bottom-1 w-px bg-gradient-to-b from-emerald-500/40 via-amber-500/30 to-transparent" />
          <div className="space-y-1.5">
            {sorted.map((f, i) => {
              const c = getCountry(f.country);
              const color = statusColor(f.status);
              const pStyle = PRIORITY_STYLE[f.priority];
              const isCritical = f.daysLeft <= 7 && f.status !== 'filed';
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  className={`relative flex items-start gap-3 rounded-lg border p-2.5 ${
                    isCritical
                      ? 'border-rose-500/30 bg-rose-500/[0.04]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  {/* timeline dot */}
                  <span
                    className={`absolute -left-[14px] top-3.5 h-2.5 w-2.5 rounded-full ring-2 ring-black/60 ${pStyle.dot}`}
                  />
                  {/* country flag + form */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-lg leading-none shrink-0">{c?.flag}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-100 truncate">{f.form}</span>
                        <Badge variant="outline" className={`text-[9px] ${pStyle.badge}`}>
                          {f.priority}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">{f.description}</div>
                    </div>
                  </div>
                  {/* right: dates + countdown */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">Due</div>
                      <div className="text-[11px] font-mono text-zinc-200">{f.dueDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">Days Left</div>
                      <div
                        className={`text-sm font-bold tabular-nums ${
                          f.status === 'filed'
                            ? 'text-emerald-400'
                            : f.daysLeft <= 7
                            ? 'text-rose-400'
                            : f.daysLeft <= 30
                            ? 'text-amber-300'
                            : 'text-zinc-100'
                        }`}
                      >
                        {f.status === 'filed' ? '✓ Filed' : `${f.daysLeft}d`}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[9px] capitalize ${STATUS_BADGE[color]}`}>
                      {f.status}
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  );
}

// ─── Compliance Score Breakdown ────────────────────────────────────────────────

const SUB_METRIC_LABELS: { key: keyof Omit<CountryScore, 'code' | 'name' | 'flag' | 'overall'>; label: string; icon: LucideIcon }[] = [
  { key: 'filingTimeliness', label: 'Filing Timeliness', icon: CalendarClock },
  { key: 'docCompleteness', label: 'Documentation', icon: ClipboardList },
  { key: 'auditReadiness', label: 'Audit Readiness', icon: ShieldCheck },
  { key: 'penaltyHistory', label: 'Penalty History', icon: Gavel },
];

function ComplianceScoreBreakdown() {
  const scores = useMemo(() => deriveCountryScores(), []);
  const [selected, setSelected] = useState<CountryScore>(scores[0]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-teal-500/20 bg-teal-500/10 text-teal-300">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Compliance Score Breakdown</h2>
          <p className="text-[11px] text-zinc-500">Per-country composite scores with sub-metric drill-down</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Country list */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Select Country</div>
          <ScrollArea className="max-h-[300px] pr-2">
            <div className="space-y-1.5">
              {scores.map((s, i) => {
                const isActive = s.code === selected.code;
                const barColor = s.overall >= 90 ? 'bg-emerald-500' : s.overall >= 80 ? 'bg-teal-400' : 'bg-amber-400';
                return (
                  <motion.button
                    key={s.code}
                    type="button"
                    onClick={() => setSelected(s)}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                      isActive
                        ? 'border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base leading-none">{s.flag}</span>
                      <span className="text-xs font-semibold text-zinc-100 flex-1 truncate">{s.name}</span>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          s.overall >= 90 ? 'text-emerald-300' : s.overall >= 80 ? 'text-teal-300' : 'text-amber-300'
                        }`}
                      >
                        {s.overall}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${s.overall}%` }}
                        transition={{ duration: 0.5, delay: i * 0.04 }}
                        className={`h-full ${barColor}`}
                      />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Selected country drill-down */}
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl leading-none">{selected.flag}</span>
            <div>
              <div className="text-sm font-semibold text-zinc-100">{selected.name}</div>
              <div className="text-[10px] text-zinc-500">Overall Compliance Score</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-bold text-emerald-300 tabular-nums">{selected.overall}</div>
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">/ 100</div>
            </div>
          </div>

          <div className="space-y-3">
            {SUB_METRIC_LABELS.map((m, i) => {
              const value = selected[m.key];
              const Icon = m.icon;
              const barColor = value >= 90 ? 'bg-emerald-500' : value >= 80 ? 'bg-teal-400' : value >= 70 ? 'bg-amber-400' : 'bg-rose-500';
              return (
                <div key={m.key}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-3 w-3 text-zinc-400" />
                    <span className="text-[11px] text-zinc-300 flex-1">{m.label}</span>
                    <span className="text-[11px] font-semibold text-zinc-100 tabular-nums">{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' as const }}
                      className={`h-full ${barColor}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Separator className="my-4 bg-white/[0.06]" />

          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Grade</div>
              <div className={`text-base font-bold ${
                selected.overall >= 90 ? 'text-emerald-400' :
                selected.overall >= 80 ? 'text-teal-300' : 'text-amber-300'
              }`}>
                {selected.overall >= 90 ? 'A+' : selected.overall >= 80 ? 'A' : selected.overall >= 70 ? 'B' : 'C'}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Risk</div>
              <div className={`text-base font-bold ${
                selected.overall >= 90 ? 'text-emerald-400' :
                selected.overall >= 80 ? 'text-teal-300' : 'text-rose-400'
              }`}>
                {selected.overall >= 90 ? 'Low' : selected.overall >= 80 ? 'Medium' : 'High'}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-zinc-500">Trend</div>
              <div className="text-base font-bold text-emerald-400">↑ +2.4</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Regulatory Changes Monitor ────────────────────────────────────────────────

function RegulatoryMonitor() {
  const sorted = useMemo(
    () => [...REGULATORY_CHANGES].sort((a, b) => a.daysToComply - b.daysToComply),
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-300">
          <Bell className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Regulatory Changes Monitor</h2>
          <p className="text-[11px] text-zinc-500">
            {REGULATORY_CHANGES.length} active changes · {REGULATORY_CHANGES.filter((r) => r.actionRequired).length} require action
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map((r, i) => {
          const c = getCountry(r.country as CountryCode);
          const isUrgent = r.daysToComply <= 12 && r.actionRequired;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className={`rounded-lg border p-3 ${
                isUrgent
                  ? 'border-rose-500/30 bg-rose-500/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg leading-none">{c?.flag}</span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-zinc-100 leading-tight truncate">{r.title}</h3>
                    <div className="text-[10px] text-zinc-500">{r.category}</div>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[9px] capitalize ${IMPACT_STYLE[r.impact]}`}>
                  {r.impact} impact
                </Badge>
              </div>

              <p className="text-[11px] text-zinc-300 leading-relaxed mb-2">{r.description}</p>

              <div className="flex items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-1 text-zinc-500">
                  <CalendarDays className="h-3 w-3" />
                  <span>Effective {r.effectiveDate}</span>
                </div>
                {r.actionRequired ? (
                  <Badge variant="outline" className="text-[9px] border-rose-500/40 bg-rose-500/10 text-rose-300">
                    <AlertTriangle className="h-2.5 w-2.5" />Action Required
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
                    <CircleDot className="h-2.5 w-2.5" />Monitor
                  </Badge>
                )}
              </div>

              <Separator className="my-2 bg-white/[0.06]" />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <Hourglass className="h-3 w-3" />
                  <span>Days to comply</span>
                </div>
                <div
                  className={`text-sm font-bold tabular-nums ${
                    r.daysToComply === 0 ? 'text-rose-400' :
                    r.daysToComply <= 12 ? 'text-amber-300' : 'text-zinc-100'
                  }`}
                >
                  {r.daysToComply === 0 ? 'Overdue' : `${r.daysToComply}d`}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Penalty Calculator ────────────────────────────────────────────────────────

function PenaltyCalculator() {
  const [country, setCountry] = useState<CountryCode>('IN');
  const [filingId, setFilingId] = useState<string>('gstr1');
  const [daysLate, setDaysLate] = useState<number>(15);

  const filings = FILING_TYPES_BY_COUNTRY[country] ?? [];
  const currentFiling = filings.find((f) => f.id === filingId) ?? filings[0];

  // Reset filing selection when country changes
  const handleCountryChange = (cc: CountryCode) => {
    setCountry(cc);
    const newFilings = FILING_TYPES_BY_COUNTRY[cc] ?? [];
    if (newFilings.length > 0) setFilingId(newFilings[0].id);
  };

  const rule = PENALTY_RULES[country] ?? PENALTY_RULES.IN;
  const liability = currentFiling?.liability ?? 10000;
  const safeDays = Math.max(0, daysLate);

  const basePenalty = rule.basePenalty;
  const perDayPenalty = safeDays * rule.perDay;
  const interestPenalty = Math.round((liability * rule.interestAnnualPct / 100 / 365) * safeDays);
  const subTotal = basePenalty + perDayPenalty + interestPenalty;
  const cap = (liability * rule.maxPct) / 100;
  const totalPenalty = Math.min(subTotal, cap);
  const capped = subTotal > cap;
  const totalWithLiability = liability + totalPenalty;
  const pctOfLiability = liability > 0 ? (totalPenalty / liability) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/20 bg-violet-500/10 text-violet-300">
          <Calculator className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Penalty Calculator</h2>
          <p className="text-[11px] text-zinc-500">Estimate late-filing penalties across jurisdictions (deterministic)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inputs */}
        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Country</label>
              <Select value={country} onValueChange={(v) => handleCountryChange(v as CountryCode)}>
                <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/[0.08]">
                  {Object.keys(FILING_TYPES_BY_COUNTRY).map((cc) => {
                    const c = getCountry(cc as CountryCode);
                    return (
                      <SelectItem key={cc} value={cc} className="text-zinc-100 text-xs">
                        {c.flag} {c.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Filing Type</label>
              <Select value={filingId} onValueChange={setFilingId}>
                <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/[0.08]">
                  {filings.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-zinc-100 text-xs">
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Days Late</label>
              <span className="text-xs font-semibold text-amber-300 tabular-nums">{daysLate}d</span>
            </div>
            <Input
              type="number"
              min={0}
              max={365}
              value={daysLate}
              onChange={(e) => setDaysLate(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
              className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9 tabular-nums"
            />
            <div className="flex items-center gap-1 mt-2">
              {[7, 15, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysLate(d)}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                    daysLate === d
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                      : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Rule reference */}
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
              {getCountry(country).flag} {getCountry(country).name} Penalty Rules
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div>
                <div className="text-zinc-500">Base</div>
                <div className="text-zinc-200 font-semibold">{fmtUSD(rule.basePenalty)}</div>
              </div>
              <div>
                <div className="text-zinc-500">Per Day</div>
                <div className="text-zinc-200 font-semibold">{fmtUSD(rule.perDay)}</div>
              </div>
              <div>
                <div className="text-zinc-500">Max Cap</div>
                <div className="text-zinc-200 font-semibold">{rule.maxPct}% of liability</div>
              </div>
              <div>
                <div className="text-zinc-500">Interest</div>
                <div className="text-zinc-200 font-semibold">{rule.interestAnnualPct}% p.a.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="rounded-lg border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.06] to-transparent p-4 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-rose-300 mb-2">
            <TrendingDown className="h-3 w-3" />Estimated Penalty
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Base penalty</span>
              <span className="text-zinc-100 tabular-nums">{fmtUSD(basePenalty)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Per-day ({safeDays} × {fmtUSD(rule.perDay)})</span>
              <span className="text-zinc-100 tabular-nums">{fmtUSD(perDayPenalty)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Interest ({rule.interestAnnualPct}% p.a.)</span>
              <span className="text-zinc-100 tabular-nums">{fmtUSD(interestPenalty)}</span>
            </div>
            <Separator className="bg-white/[0.06] my-1.5" />
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Subtotal</span>
              <span className="text-zinc-200 tabular-nums">{fmtUSD(subTotal)}</span>
            </div>
            {capped && (
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-[10px]">Capped at {rule.maxPct}% of liability</span>
                <span className="text-[10px] tabular-nums">−{fmtUSD(subTotal - cap)}</span>
              </div>
            )}
          </div>

          <Separator className="bg-white/[0.06] my-3" />

          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total Penalty</div>
            <div className="text-2xl font-bold text-rose-400 tabular-nums">{fmtUSD(totalPenalty)}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{pctOfLiability.toFixed(1)}% of liability</div>
          </div>

          <Separator className="bg-white/[0.06] my-3" />

          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total Outflow</div>
            <div className="text-lg font-bold text-zinc-100 tabular-nums">{fmtUSD(totalWithLiability)}</div>
            <div className="text-[10px] text-zinc-500">Liability + Penalty</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Audit Trail ───────────────────────────────────────────────────────────────

const AUDIT_STATUS_STYLE: Record<AuditEntry['status'], { dot: string; badge: string; icon: LucideIcon }> = {
  success: { dot: 'bg-emerald-400', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', icon: CheckCircle2 },
  warning: { dot: 'bg-amber-400', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300', icon: AlertTriangle },
  pending: { dot: 'bg-cyan-400', badge: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300', icon: Clock },
};

function AuditTrail() {
  const [filter, setFilter] = useState<'all' | AuditEntry['status']>('all');
  const filtered = useMemo(
    () => filter === 'all' ? AUDIT_TRAIL : AUDIT_TRAIL.filter((e) => e.status === filter),
    [filter],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Audit Trail</h2>
            <p className="text-[11px] text-zinc-500">Recent compliance actions across all jurisdictions</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'success', 'warning', 'pending'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider transition-all ${
                filter === f
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/[0.02] text-zinc-400 border border-white/[0.06] hover:text-zinc-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="max-h-[400px] pr-2">
        <div className="relative pl-4">
          <div className="absolute left-[5px] top-1 bottom-1 w-px bg-gradient-to-b from-emerald-500/40 via-cyan-500/30 to-transparent" />
          <div className="space-y-1.5">
            {filtered.map((entry, i) => {
              const sty = AUDIT_STATUS_STYLE[entry.status];
              const Icon = sty.icon;
              const c = entry.country ? getCountry(entry.country) : null;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  className="relative flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 hover:bg-white/[0.04]"
                >
                  <span className={`absolute -left-[14px] top-3.5 h-2.5 w-2.5 rounded-full ring-2 ring-black/60 ${sty.dot}`} />
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${sty.badge}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] text-zinc-100 leading-snug">{entry.action}</span>
                      {c && <span className="text-sm leading-none">{c.flag}</span>}
                      <Badge variant="outline" className={`text-[9px] capitalize ${sty.badge}`}>{entry.status}</Badge>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">{entry.timestamp}</span>
                      <span>·</span>
                      <span>{entry.actor}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  );
}

// ─── Document Checklist (per framework, accordion + checkboxes) ────────────────

function DocumentChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const frameworks = useMemo(() => COMPLIANCE_FRAMEWORKS.slice(0, 6), []);

  const toggle = (id: string, defaultValue: boolean) => {
    const current = checked[id] ?? defaultValue;
    setChecked((p) => ({ ...p, [id]: !current }));
  };

  const isChecked = (id: string, defaultValue: boolean) => checked[id] ?? defaultValue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-300">
          <ScrollText className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Document Checklist</h2>
          <p className="text-[11px] text-zinc-500">Per-framework required & supporting documents — click to toggle</p>
        </div>
      </div>

      <Accordion type="single" collapsible defaultValue={frameworks[0]?.id}>
        {frameworks.map((fw) => {
          const docs = getDocsForFramework(fw);
          const requiredCount = docs.filter((d) => d.required).length;
          const completed = docs.filter((d) => isChecked(d.id, d.defaultChecked)).length;
          const pct = Math.round((completed / docs.length) * 100);
          const color = statusColor(fw.status);
          return (
            <AccordionItem key={fw.id} value={fw.id} className="border-white/[0.06]">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <FileCheck className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-zinc-100 truncate">{fw.name}</span>
                      <Badge variant="outline" className={`text-[9px] uppercase ${STATUS_BADGE[color]}`}>{fw.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1 flex-1 max-w-[180px] rounded-full bg-black/40 overflow-hidden">
                        <div
                          className={`h-full ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-teal-400' : 'bg-amber-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-500 tabular-nums">
                        {completed}/{docs.length} docs
                      </span>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pt-1 pb-2">
                  {docs.map((doc) => {
                    const checked2 = isChecked(doc.id, doc.defaultChecked);
                    return (
                      <label
                        key={doc.id}
                        htmlFor={doc.id}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all ${
                          checked2
                            ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'
                        }`}
                      >
                        <Checkbox
                          id={doc.id}
                          checked={checked2}
                          onCheckedChange={() => toggle(doc.id, doc.defaultChecked)}
                          className={checked2 ? 'border-emerald-500 bg-emerald-500 text-black' : ''}
                        />
                        <span className={`text-[11px] truncate ${checked2 ? 'text-zinc-100' : 'text-zinc-400'}`}>
                          {doc.name}
                        </span>
                        {doc.required ? (
                          <Badge variant="outline" className="ml-auto text-[8px] border-rose-500/30 bg-rose-500/10 text-rose-300">
                            Required
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="ml-auto text-[8px] border-slate-500/30 bg-slate-500/10 text-slate-400">
                            Optional
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1 pb-1">
                  <span>{requiredCount} required · {docs.length - requiredCount} supporting</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    {pct}% complete
                  </span>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </motion.div>
  );
}

// ─── Section Heading ───────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-emerald-400" />
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        <p className="text-[11px] text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE — Regulatory Report Calendar
// ═══════════════════════════════════════════════════════════════════════════════

const REPORT_STATUS_BADGE: Record<RegulatoryReport['status'], string> = {
  filed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  'in-progress': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'not-started': 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  overdue: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

const COMPLEXITY_BADGE: Record<RegulatoryReport['complexity'], string> = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

function countdownBadge(days: number): { cls: string; label: string } {
  if (days > 30) return { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', label: `${days}d left` };
  if (days >= 7) return { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', label: `${days}d left` };
  return { cls: 'border-rose-500/30 bg-rose-500/10 text-rose-400', label: `${days}d left` };
}

function RegulatoryReportCalendar() {
  const sorted = useMemo(
    () => [...REGULATORY_REPORTS].sort((a, b) => a.daysRemaining - b.daysRemaining),
    [],
  );

  const stats = useMemo(() => {
    const total = REGULATORY_REPORTS.length;
    const filed = REGULATORY_REPORTS.filter((r) => r.status === 'filed').length;
    const inProgress = REGULATORY_REPORTS.filter((r) => r.status === 'in-progress').length;
    const overdue = REGULATORY_REPORTS.filter((r) => r.status === 'overdue').length;
    return { total, filed, inProgress, overdue };
  }, []);

  const kpiTiles: { icon: LucideIcon; label: string; value: number; accent: 'emerald' | 'teal' | 'cyan' | 'amber' | 'violet' | 'rose'; sub: string }[] = [
    { icon: CalendarRange, label: 'Total Reports', value: stats.total, accent: 'teal', sub: 'Across 10 jurisdictions' },
    { icon: CheckCircle2, label: 'Filed', value: stats.filed, accent: 'emerald', sub: 'Submitted & confirmed' },
    { icon: RefreshCw, label: 'In Progress', value: stats.inProgress, accent: 'amber', sub: 'Preparation underway' },
    { icon: AlertTriangle, label: 'Overdue', value: stats.overdue, accent: 'rose', sub: 'Action required' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <SectionHeading
        icon={CalendarRange}
        title="Regulatory Report Calendar"
        subtitle={`${REGULATORY_REPORTS.length} statutory reports across 10 jurisdictions — sorted by days remaining`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiTiles.map((k, i) => (
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
            <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 tabular-nums">{k.value}</div>
            <div className="text-[10px] text-zinc-500">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <ScrollArea className="max-h-[560px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Report</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Jurisdiction</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Frequency</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Next Due</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Countdown</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Owner</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Complexity</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Penalty Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {sorted.map((r, i) => {
                  const cd = countdownBadge(r.daysRemaining);
                  const country = getCountry(r.countryCode);
                  return (
                    <motion.tr
                      key={r.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className={`border-white/[0.04] hover:bg-white/[0.03] ${
                        r.daysRemaining < 7 && r.status !== 'filed' ? 'bg-rose-500/[0.04]' : ''
                      }`}
                    >
                      <TableCell className="py-2.5">
                        <span className="text-[12px] font-medium text-zinc-100">{r.name}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                          <span className="text-base leading-none">{country?.flag ?? '🏳️'}</span>
                          <span>{r.jurisdiction}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-400">
                          {r.frequency}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-mono text-zinc-300">{r.nextDue}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${cd.cls}`}>
                          <Clock className="h-2.5 w-2.5" />
                          {cd.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${REPORT_STATUS_BADGE[r.status]}`}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] text-zinc-300">{r.responsible}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] capitalize ${COMPLEXITY_BADGE[r.complexity]}`}>
                          {r.complexity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-mono text-amber-300">{r.penaltyRisk}</span>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE — Country Risk Assessment Matrix
// ═══════════════════════════════════════════════════════════════════════════════

const RATING_COLOR: Record<string, string> = {
  AAA: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  'AA+': 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  AA: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  'AA-': 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  'A+': 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  A: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  'A-': 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  'BBB+': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  BBB: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'BBB-': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

function ratingBadge(rating: string): string {
  return RATING_COLOR[rating] ?? 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

function riskBarColor(score: number): string {
  if (score <= 15) return 'bg-emerald-500';
  if (score <= 25) return 'bg-teal-400';
  if (score <= 35) return 'bg-amber-400';
  return 'bg-rose-500';
}

const CONTROLS_BADGE: Record<CountryRisk['capitalControls'], string> = {
  None: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Low: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  Moderate: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  High: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

const SANCTIONS_BADGE: Record<CountryRisk['sanctionsStatus'], string> = {
  Clear: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Monitored: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Restricted: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

const RISK_DIMENSIONS: { key: keyof Pick<CountryRisk, 'politicalRisk' | 'economicRisk' | 'currencyRisk' | 'complianceRisk' | 'operationalRisk'>; label: string }[] = [
  { key: 'politicalRisk', label: 'Political' },
  { key: 'economicRisk', label: 'Economic' },
  { key: 'currencyRisk', label: 'Currency' },
  { key: 'complianceRisk', label: 'Compliance' },
  { key: 'operationalRisk', label: 'Operational' },
];

function CountryRiskMatrix() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <SectionHeading
        icon={Map}
        title="Country Risk Assessment Matrix"
        subtitle={`${COUNTRY_RISKS.length} jurisdictions — sovereign ratings, 5-dimension risk profile, capital controls & sanctions`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {COUNTRY_RISKS.map((c, i) => {
          const country = getCountry(c.countryCode);
          const avg = (c.politicalRisk + c.economicRisk + c.currencyRisk + c.complianceRisk + c.operationalRisk) / 5;
          return (
            <motion.div
              key={c.countryCode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.14] transition-all flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl leading-none">{country?.flag ?? '🏳️'}</span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{country?.name ?? c.countryCode}</h3>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Peg: {c.currencyPeg}</div>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] font-mono ${ratingBadge(c.sovereignRating)}`}>
                  {c.sovereignRating}
                </Badge>
              </div>

              <Separator className="my-3 bg-white/[0.06]" />

              <div className="space-y-1.5">
                {RISK_DIMENSIONS.map((dim) => (
                  <div key={dim.key} className="flex items-center gap-2">
                    <span className="w-20 text-[10px] text-zinc-400 shrink-0">{dim.label}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-black/40 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${c[dim.key]}%` }}
                        transition={{ duration: 0.5, delay: i * 0.04 + 0.1 }}
                        className={`h-full ${riskBarColor(c[dim.key])}`}
                      />
                    </div>
                    <span className="w-7 text-right text-[10px] font-mono text-zinc-300 tabular-nums">{c[dim.key]}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">Avg Risk</span>
                <span className={`font-mono font-semibold tabular-nums ${
                  avg <= 15 ? 'text-emerald-300' : avg <= 25 ? 'text-teal-300' : avg <= 35 ? 'text-amber-300' : 'text-rose-300'
                }`}>
                  {avg.toFixed(1)}
                </span>
              </div>

              <Separator className="my-3 bg-white/[0.06]" />

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={`text-[9px] ${CONTROLS_BADGE[c.capitalControls]}`}>
                  <Scale className="h-2.5 w-2.5" /> {c.capitalControls} controls
                </Badge>
                <Badge variant="outline" className={`text-[9px] ${SANCTIONS_BADGE[c.sanctionsStatus]}`}>
                  <ShieldAlert className="h-2.5 w-2.5" /> {c.sanctionsStatus}
                </Badge>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE — Insurance & Risk Transfer
// ═══════════════════════════════════════════════════════════════════════════════

const INSURANCE_TYPE_BADGE: Record<InsurancePolicy['type'], string> = {
  'D&O': 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  Cyber: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  Property: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Business Interruption': 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  'Trade Credit': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  'Professional Indemnity': 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
};

const INSURANCE_STATUS_BADGE: Record<InsurancePolicy['status'], string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  renewing: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  expiring: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

function InsuranceRiskTransfer() {
  const stats = useMemo(() => {
    const totalCoverage = INSURANCE_POLICIES.reduce((s, p) => s + p.coverage, 0);
    const totalPremium = INSURANCE_POLICIES.reduce((s, p) => s + p.premium, 0);
    const expiring = INSURANCE_POLICIES.filter((p) => p.status === 'expiring' || p.status === 'renewing').length;
    return { totalCoverage, totalPremium, expiring };
  }, []);

  const kpiTiles: { icon: LucideIcon; label: string; value: number; accent: 'emerald' | 'teal' | 'cyan' | 'amber' | 'violet' | 'rose'; sub: string }[] = [
    { icon: Umbrella, label: 'Total Coverage', value: stats.totalCoverage, accent: 'emerald', sub: fmtUSD(stats.totalCoverage) },
    { icon: Landmark, label: 'Total Premium', value: stats.totalPremium, accent: 'amber', sub: fmtUSD(stats.totalPremium) },
    { icon: RefreshCw, label: 'Expiring/Renewing', value: stats.expiring, accent: 'rose', sub: 'Action required soon' },
    { icon: ShieldCheck, label: 'Active Policies', value: INSURANCE_POLICIES.filter((p) => p.status === 'active').length, accent: 'teal', sub: 'In-force' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <SectionHeading
        icon={Umbrella}
        title="Insurance & Risk Transfer"
        subtitle={`${INSURANCE_POLICIES.length} enterprise policies — D&O, Cyber, Property, BI, Trade Credit & Professional Indemnity`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiTiles.map((k, i) => (
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
            <div className="mt-2 text-lg font-semibold tracking-tight text-zinc-50 tabular-nums">
              {k.label === 'Total Coverage' || k.label === 'Total Premium' ? k.sub : k.value}
            </div>
            <div className="text-[10px] text-zinc-500">
              {k.label === 'Total Coverage' || k.label === 'Total Premium' ? `${k.value.toLocaleString('en-US')} policies` : k.sub}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <ScrollArea className="max-h-[520px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Policy</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Type</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Coverage (USD)</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Premium (USD)</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Deductible</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Insurer</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Renewal</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Regions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {INSURANCE_POLICIES.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className="border-white/[0.04] hover:bg-white/[0.03]"
                  >
                    <TableCell className="py-2.5">
                      <span className="text-[12px] font-medium text-zinc-100">{p.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] ${INSURANCE_TYPE_BADGE[p.type]}`}>
                        {p.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono font-semibold text-emerald-300">{fmtUSD(p.coverage)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono text-amber-300">{fmtUSD(p.premium)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono text-zinc-400">{fmtUSD(p.deductible)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] text-zinc-300">{p.insurer}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-mono text-zinc-400">{p.renewalDate}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] capitalize ${INSURANCE_STATUS_BADGE[p.status]}`}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.regions.slice(0, 3).map((r) => (
                          <Badge key={r} variant="outline" className="text-[8px] border-white/10 bg-white/[0.02] text-zinc-400">
                            {r}
                          </Badge>
                        ))}
                        {p.regions.length > 3 && (
                          <span className="text-[9px] text-zinc-500">+{p.regions.length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </ScrollArea>
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
    accent: 'emerald' | 'teal' | 'cyan' | 'amber' | 'violet' | 'rose';
    sub: string;
  }[] = [
    { icon: FileCheck, label: 'Total Frameworks', value: kpis.total, accent: 'teal', sub: 'Active jurisdictions' },
    { icon: CheckCircle2, label: 'Compliant', value: kpis.compliant, accent: 'emerald', sub: 'Fully met' },
    { icon: RefreshCw, label: 'In Progress', value: kpis.inProgress, accent: 'amber', sub: 'Remediation underway' },
    { icon: AlertTriangle, label: 'Need Attention', value: kpis.attention, accent: 'rose', sub: 'Action required' },
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
            tracking, audit scheduling, real-time risk alerts, penalty estimation & document workflows.
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

      {/* Compliance Calendar (top — most actionable) */}
      <ComplianceCalendar />

      {/* Compliance Score Breakdown */}
      <ComplianceScoreBreakdown />

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
      <div>
        <SectionHeading icon={FileCheck} title="Compliance Frameworks" subtitle={`${filtered.length} framework${filtered.length === 1 ? '' : 's'} in ${region === 'All' ? 'all jurisdictions' : region}`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((f, i) => (
            <FrameworkCard key={f.id} fw={f} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {/* Regulatory Changes Monitor */}
      <RegulatoryMonitor />

      {/* Penalty Calculator */}
      <PenaltyCalculator />

      {/* Audit Trail + Document Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AuditTrail />
        <DocumentChecklist />
      </div>

      {/* Regulatory Report Calendar (enterprise) */}
      <RegulatoryReportCalendar />

      {/* Country Risk Assessment Matrix (enterprise) */}
      <CountryRiskMatrix />

      {/* Insurance & Risk Transfer (enterprise) */}
      <InsuranceRiskTransfer />

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

      {/* Footer note */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 pt-2">
        <ShieldCheck className="h-3 w-3" />
        <span>VEYRO™ Global Compliance Engine — {FILING_DEADLINES.length} tracked filings across 10 jurisdictions</span>
      </div>
    </div>
  );
}
