'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: MULTI-COUNTRY ACCOUNTING™
//
// Unified accounting console spanning every jurisdiction the enterprise operates
// in — country-by-country tax posture, compliance, fiscal-year rules and live
// financial exposure. Pure static data layer (no API, no Math.random).
//
//   • 4 KPI tiles          — countries active, total orgs, avg compliance, tax liability
//   • Country filter       — All + per-country flag chips
//   • Rich country cards   — flag, currency, tax system, rates, revenue, scores
//   • Detail dialog        — fiscal year, payroll tax, import/export duty, language
//
// Tagline: One Ledger. Every Country. Total Visibility.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe2, Building2, ShieldCheck, Landmark, Filter,
  Calendar, Languages, Ship, Plane,
  Banknote, Scale, Sparkles, ChevronRight, PieChart, Gauge,
  type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  COUNTRIES, fmtUSD, fmtPct, type Country, type CountryCode,
} from '@/lib/global/data';

// ─── Tax system badge palette (NO indigo/blue) ─────────────────────────────────

const TAX_SYSTEM_BADGE: Record<Country['taxSystem'], string> = {
  GST: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  VAT: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  'Sales Tax': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Consumption Tax': 'border-violet-500/30 bg-violet-500/10 text-violet-300',
};

const TAX_SYSTEM_DOT: Record<Country['taxSystem'], string> = {
  GST: 'bg-emerald-400',
  VAT: 'bg-teal-400',
  'Sales Tax': 'bg-amber-400',
  'Consumption Tax': 'bg-violet-400',
};

// ─── KPI Tile ───────────────────────────────────────────────────────────────────

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent: 'emerald' | 'teal' | 'cyan' | 'violet';
}

const ACCENT_RING: Record<KpiTileProps['accent'], string> = {
  emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
};

function KpiTile({ icon: Icon, label, value, sub, accent }: KpiTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.12] transition-colors"
    >
      <div className="flex items-center gap-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${ACCENT_RING[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] uppercase tracking-wider text-zinc-400">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">{value}</div>
      <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>
    </motion.div>
  );
}

// ─── Score Bar ──────────────────────────────────────────────────────────────────

function ScoreBar({
  label, value, color, inverted = false,
}: { label: string; value: number; color: string; inverted?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="text-zinc-400">{label}</span>
        <span className={inverted ? 'text-rose-300' : 'text-zinc-300'}>{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}

// ─── Country Accounting Card ────────────────────────────────────────────────────

function CountryAccountingCard({
  country, index, onOpen,
}: { country: Country; index: number; onOpen: (c: Country) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      onClick={() => onOpen(country)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(country); }}
      className="group cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-xl">
            {country.flag}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100">{country.name}</div>
            <div className="text-[10px] font-mono text-zinc-500">
              {country.code} · {country.currency} · {country.timezone}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[9px] uppercase ${TAX_SYSTEM_BADGE[country.taxSystem]}`}>
          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${TAX_SYSTEM_DOT[country.taxSystem]}`} />
          {country.taxSystem}
        </Badge>
      </div>

      {/* Tax rates */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">{country.primaryTaxName}</div>
          <div className="text-sm font-semibold text-emerald-300">{fmtPct(country.taxRate)}</div>
        </div>
        <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Corporate Tax</div>
          <div className="text-sm font-semibold text-teal-300">{fmtPct(country.corporateTaxRate)}</div>
        </div>
      </div>

      {/* Financials */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Revenue</span>
          <span className="font-medium text-zinc-200">{fmtUSD(country.revenue)}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Expenses</span>
          <span className="font-medium text-zinc-300">{fmtUSD(country.expenses)}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Tax Liability</span>
          <span className="font-medium text-amber-300">{fmtUSD(country.taxLiability)}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Organizations</span>
          <span className="font-medium text-cyan-300">{country.organizations.toLocaleString()}</span>
        </div>
      </div>

      <Separator className="my-3 bg-white/[0.06]" />

      {/* Scores */}
      <div className="space-y-2">
        <ScoreBar label="Compliance" value={country.complianceScore} color="bg-emerald-500" />
        <ScoreBar label="Growth" value={country.growthScore} color="bg-teal-400" />
        <ScoreBar label="Risk" value={country.riskScore} color="bg-rose-400" inverted />
      </div>

      {/* Compliance bodies */}
      <div className="mt-3 flex flex-wrap gap-1">
        {country.complianceBodies.slice(0, 4).map((body) => (
          <span
            key={body}
            className="rounded border border-white/[0.08] bg-black/20 px-1.5 py-0.5 text-[9px] text-zinc-400"
          >
            {body}
          </span>
        ))}
        {country.complianceBodies.length > 4 && (
          <span className="rounded border border-white/[0.08] bg-black/20 px-1.5 py-0.5 text-[9px] text-zinc-500">
            +{country.complianceBodies.length - 4}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" /> FY: {country.fiscalYearStart}
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-300/80 group-hover:text-emerald-300 transition-colors">
          View rules <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </motion.div>
  );
}

// ─── Country Detail Dialog ──────────────────────────────────────────────────────

function CountryDetailDialog({
  country, onClose,
}: { country: Country | null; onClose: () => void }) {
  return (
    <Dialog open={!!country} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl text-zinc-100">
        <AnimatePresence>
          {country && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-2xl">
                    {country.flag}
                  </div>
                  <div>
                    <DialogTitle className="text-lg text-zinc-50 flex items-center gap-2">
                      {country.name}
                      <Badge variant="outline" className={`text-[9px] uppercase ${TAX_SYSTEM_BADGE[country.taxSystem]}`}>
                        {country.taxSystem}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-[11px] text-zinc-500">
                      {country.code} · {country.currency} · {country.timezone}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {/* Accounting rules grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <RuleTile icon={Calendar} label="Fiscal Year" value={country.fiscalYearStart} accent="emerald" />
                  <RuleTile icon={Banknote} label="Payroll Tax" value={fmtPct(country.payrollTaxRate)} accent="teal" />
                  <RuleTile icon={Ship} label="Import Duty" value={fmtPct(country.importDuty)} accent="cyan" />
                  <RuleTile icon={Plane} label="Export Duty" value={fmtPct(country.exportDuty)} accent="violet" />
                </div>

                {/* Language + primary tax */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                      <Languages className="h-3.5 w-3.5" /> Language
                    </div>
                    <div className="mt-1 text-sm font-medium text-zinc-200">{country.language}</div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                      <Scale className="h-3.5 w-3.5" /> Primary Tax
                    </div>
                    <div className="mt-1 text-sm font-medium text-zinc-200">
                      {country.primaryTaxName} · {fmtPct(country.taxRate)}
                    </div>
                  </div>
                </div>

                {/* Tax structure */}
                <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Tax Structure</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-center">
                    <TaxCell label="Indirect" value={fmtPct(country.taxRate)} color="text-emerald-300" />
                    <TaxCell label="Corporate" value={fmtPct(country.corporateTaxRate)} color="text-teal-300" />
                    <TaxCell label="Payroll" value={fmtPct(country.payrollTaxRate)} color="text-cyan-300" />
                    <TaxCell label="Import" value={fmtPct(country.importDuty)} color="text-amber-300" />
                    <TaxCell label="Export" value={fmtPct(country.exportDuty)} color="text-violet-300" />
                  </div>
                </div>

                {/* Compliance bodies */}
                <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                    Compliance Bodies ({country.complianceBodies.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {country.complianceBodies.map((body) => (
                      <Badge
                        key={body}
                        variant="outline"
                        className="text-[10px] border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                      >
                        <ShieldCheck className="h-2.5 w-2.5 mr-1" /> {body}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Financial snapshot */}
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 mb-2">
                    Financial Snapshot
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <FinCell label="Revenue" value={fmtUSD(country.revenue)} color="text-emerald-300" />
                    <FinCell label="Expenses" value={fmtUSD(country.expenses)} color="text-zinc-300" />
                    <FinCell label="Tax Liability" value={fmtUSD(country.taxLiability)} color="text-amber-300" />
                    <FinCell label="Organizations" value={country.organizations.toLocaleString()} color="text-cyan-300" />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                >
                  Close
                </Button>
                <Button size="sm" className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                  <PieChart className="mr-1.5 h-3.5 w-3.5" /> Open Country Ledger
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function RuleTile({
  icon: Icon, label, value, accent,
}: { icon: LucideIcon; label: string; value: string; accent: KpiTileProps['accent'] }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3 text-center">
      <Icon className={`mx-auto mb-1.5 h-4 w-4 ${ACCENT_RING[accent].split(' ')[0]}`} />
      <div className="text-[9px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function TaxCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-md bg-white/[0.02] py-2">
      <div className="text-[9px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-xs font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function FinCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MultiCountryAccounting() {
  const [filter, setFilter] = useState<'ALL' | CountryCode>('ALL');
  const [selected, setSelected] = useState<Country | null>(null);

  const filtered = useMemo(
    () => (filter === 'ALL' ? COUNTRIES : COUNTRIES.filter((c) => c.code === filter)),
    [filter],
  );

  const totals = useMemo(() => {
    const totalOrgs = COUNTRIES.reduce((sum, c) => sum + c.organizations, 0);
    const avgCompliance = COUNTRIES.reduce((sum, c) => sum + c.complianceScore, 0) / COUNTRIES.length;
    const combinedTax = COUNTRIES.reduce((sum, c) => sum + c.taxLiability, 0);
    return {
      countriesActive: COUNTRIES.length,
      totalOrgs,
      avgCompliance,
      combinedTax,
    };
  }, []);

  const KPI_TILES: KpiTileProps[] = [
    {
      icon: Globe2, label: 'Countries Active', value: String(totals.countriesActive),
      sub: 'Across 4 continents · 9 currencies',
      accent: 'emerald',
    },
    {
      icon: Building2, label: 'Total Orgs', value: totals.totalOrgs.toLocaleString(),
      sub: 'Subsidiaries, branches & divisions',
      accent: 'teal',
    },
    {
      icon: ShieldCheck, label: 'Avg Compliance', value: `${totals.avgCompliance.toFixed(1)}%`,
      sub: 'Weighted across all jurisdictions',
      accent: 'cyan',
    },
    {
      icon: Landmark, label: 'Combined Tax Liability', value: fmtUSD(totals.combinedTax),
      sub: 'Indirect + corporate + payroll',
      accent: 'violet',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-300">
              <Gauge className="h-3 w-3" /> Phase 14 · Global Expansion
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Multi-Country Accounting<span className="text-emerald-400">™</span>
            </h1>
            <p className="text-sm text-zinc-400">
              One unified ledger across every jurisdiction — country-by-country accounting rules, tax posture & compliance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            <Select value={filter} onValueChange={(v) => setFilter(v as 'ALL' | CountryCode)}>
              <SelectTrigger className="w-[200px] border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue placeholder="Filter country" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                <SelectItem value="ALL">
                  <span className="inline-flex items-center gap-2">
                    <Globe2 className="h-3.5 w-3.5 text-emerald-400" /> All Countries ({COUNTRIES.length})
                  </span>
                </SelectItem>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="inline-flex items-center gap-2">
                      <span>{c.flag}</span>
                      <span>{c.name}</span>
                      <span className="text-zinc-500">· {c.currency}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.header>

        {/* ─── KPI Row ────────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_TILES.map((t) => <KpiTile key={t.label} {...t} />)}
        </section>

        {/* ─── Country Cards Grid ─────────────────────────────────────────────── */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-200">
                Country Accounting Cards
              </h2>
              <Badge variant="outline" className="text-[10px] border-white/10 bg-white/[0.02] text-zinc-400">
                {filtered.length} shown
              </Badge>
            </div>
            <div className="text-[11px] text-zinc-500">Click any card to view accounting rules</div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((c, i) => (
                <CountryAccountingCard key={c.code} country={c} index={i} onOpen={setSelected} />
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3 text-emerald-400" />
            Multi-Country Accounting™ · Phase 14 · {COUNTRIES.length} jurisdictions consolidated
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-teal-400" /> Founder & Owner: Prince Singh
          </div>
        </footer>
      </div>

      {/* Detail Dialog */}
      <CountryDetailDialog country={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
