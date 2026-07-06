'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: MULTI-COUNTRY ACCOUNTING™ (ENHANCED)
//
// Unified accounting console spanning every jurisdiction the enterprise operates
// in — country-by-country tax posture, compliance, fiscal-year rules, live
// financial exposure, filing calendar, tax positions, DTAA matrix & regulatory
// change monitor. Pure static data layer (no API, no Math.random).
//
//   • 4 KPI tiles                — countries active, total orgs, avg compliance, tax liability
//   • Country filter             — All + per-country flag chips
//   • Rich country cards         — flag, currency, tax system, rates, revenue, scores
//   • Detail dialog              — fiscal year, payroll tax, import/export duty, language
//   • Country comparison matrix  — 10 countries × 9 metrics, color-coded cells
//   • Filing calendar            — upcoming deadlines w/ days-left countdown badge
//   • Tax position card          — per entity: revenue, taxable income, loss cf, credits, eff rate
//   • DTAA matrix                — country pairs × withholding / dividend / interest tax
//   • Regulatory changes alerts  — red/amber/teal cards w/ days-to-comply countdown
//
// Tagline: One Ledger. Every Country. Total Visibility.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe2, Building2, ShieldCheck, Landmark, Filter,
  Calendar, Languages, Ship, Plane,
  Banknote, Scale, Sparkles, ChevronRight, PieChart, Gauge,
  Table2, AlarmClock, FileText, Network, AlertTriangle, Clock,
  TrendingUp, TrendingDown, ArrowRight, CheckCircle2, Info,
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
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  COUNTRIES, fmtUSD, fmtPct, getCountry, statusColor,
  FILING_DEADLINES, TAX_POSITIONS, DTAA_MATRIX, REGULATORY_CHANGES,
  type Country, type CountryCode, type FilingDeadline, type TaxPosition,
  type DTAAEntry, type RegulatoryChange,
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

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED SECTIONS — Country Comparison Matrix
// ═══════════════════════════════════════════════════════════════════════════════

function ComparisonMatrix() {
  // Color-coded cell helper
  function numColor(v: number, opts: { low?: number; mid?: number; high?: number; invert?: boolean }): string {
    const { low = 0, mid = 25, high = 50, invert = false } = opts;
    if (v === 0) return 'text-zinc-600';
    const isHigh = v >= high;
    const isMid = v >= mid && v < high;
    if (invert) {
      // For risk: high=rose
      if (isHigh) return 'text-rose-300';
      if (isMid) return 'text-amber-300';
      return 'text-emerald-300';
    }
    // For positive metrics: high=emerald, mid=teal, low=zinc
    if (isHigh) return 'text-emerald-300';
    if (isMid) return 'text-teal-300';
    return 'text-zinc-400';
  }

  function bgCell(v: number, opts: { mid?: number; high?: number; invert?: boolean }): string {
    const { mid = 25, high = 50, invert = false } = opts;
    if (v === 0) return '';
    if (invert) {
      if (v >= high) return 'bg-rose-500/10';
      if (v >= mid) return 'bg-amber-500/10';
      return 'bg-emerald-500/5';
    }
    if (v >= high) return 'bg-emerald-500/10';
    if (v >= mid) return 'bg-teal-500/10';
    return '';
  }

  function fmtCompact(n: number): string {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Table2 className="h-4 w-4 text-emerald-400" />
          Country Comparison Matrix
          <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            {COUNTRIES.length} × 9 metrics
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Side-by-side financial & tax posture across every jurisdiction — cells color-coded by intensity.
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[520px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 sticky left-0 bg-zinc-950/95 backdrop-blur z-10">
                  Country
                </TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Revenue</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Expenses</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Tax Liab.</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Corp. Tax</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">GST/VAT</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Payroll</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Growth</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Compliance</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COUNTRIES.map((c) => (
                <TableRow key={c.code} className="border-white/[0.04] hover:bg-white/[0.03]">
                  <TableCell className="py-2.5 sticky left-0 bg-zinc-950/95 backdrop-blur z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{c.flag}</span>
                      <div>
                        <div className="text-xs font-medium text-zinc-200">{c.name}</div>
                        <div className="text-[9px] text-zinc-500">{c.code} · {c.currency}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={`text-right ${bgCell(c.revenue, { mid: 500000, high: 5000000 })}`}>
                    <span className="text-[11px] font-mono text-emerald-300">{fmtCompact(c.revenue)}</span>
                  </TableCell>
                  <TableCell className={`text-right ${bgCell(c.expenses, { mid: 350000, high: 3500000 })}`}>
                    <span className="text-[11px] font-mono text-zinc-300">{fmtCompact(c.expenses)}</span>
                  </TableCell>
                  <TableCell className={`text-right ${bgCell(c.taxLiability, { mid: 80000, high: 500000 })}`}>
                    <span className="text-[11px] font-mono text-amber-300">{fmtCompact(c.taxLiability)}</span>
                  </TableCell>
                  <TableCell className={`text-right ${bgCell(c.corporateTaxRate, { mid: 15, high: 25 })}`}>
                    <span className={`text-[11px] font-mono ${numColor(c.corporateTaxRate, { mid: 15, high: 25 })}`}>
                      {fmtPct(c.corporateTaxRate)}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${bgCell(c.taxRate, { mid: 10, high: 18 })}`}>
                    <span className={`text-[11px] font-mono ${numColor(c.taxRate, { mid: 10, high: 18 })}`}>
                      {fmtPct(c.taxRate)}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${bgCell(c.payrollTaxRate, { mid: 12, high: 18 })}`}>
                    <span className={`text-[11px] font-mono ${numColor(c.payrollTaxRate, { mid: 12, high: 18 })}`}>
                      {fmtPct(c.payrollTaxRate)}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${bgCell(c.growthScore, { mid: 75, high: 85 })}`}>
                    <span className={`text-[11px] font-mono ${numColor(c.growthScore, { mid: 75, high: 85 })}`}>
                      {c.growthScore}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${bgCell(c.complianceScore, { mid: 90, high: 95 })}`}>
                    <span className={`text-[11px] font-mono ${numColor(c.complianceScore, { mid: 90, high: 95 })}`}>
                      {c.complianceScore}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${bgCell(c.riskScore, { mid: 20, high: 30, invert: true })}`}>
                    <span className={`text-[11px] font-mono ${numColor(c.riskScore, { mid: 20, high: 30, invert: true })}`}>
                      {c.riskScore}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-emerald-500/30" /> High
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-teal-500/30" /> Medium
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-amber-500/30" /> Caution
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-rose-500/30" /> Risk Flag
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED SECTIONS — Filing Calendar
// ═══════════════════════════════════════════════════════════════════════════════

const PRIORITY_BADGE: Record<FilingDeadline['priority'], string> = {
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  high: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  medium: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  low: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
};

const STATUS_BADGE_FD: Record<FilingDeadline['status'], string> = {
  filed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  upcoming: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  overdue: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  'in-progress': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
};

function daysLeftBadgeClass(daysLeft: number): string {
  if (daysLeft <= 7) return 'border-rose-500/50 bg-rose-500/20 text-rose-200';
  if (daysLeft <= 21) return 'border-amber-500/50 bg-amber-500/20 text-amber-200';
  if (daysLeft <= 45) return 'border-cyan-500/50 bg-cyan-500/20 text-cyan-200';
  return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
}

function FilingCalendar() {
  const sorted = useMemo(
    () => [...FILING_DEADLINES].sort((a, b) => a.daysLeft - b.daysLeft),
    [],
  );

  const critical = sorted.filter((f) => f.priority === 'critical' && f.status !== 'filed').length;
  const high = sorted.filter((f) => f.priority === 'high' && f.status !== 'filed').length;
  const filed = sorted.filter((f) => f.status === 'filed').length;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlarmClock className="h-4 w-4 text-amber-400" />
              Filing Calendar
              <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
                {sorted.length} deadlines
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Upcoming regulatory & tax filings sorted by days remaining — countdown badges flag urgency.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-rose-500/30 bg-rose-500/10 text-rose-300">
              <AlertTriangle className="mr-1 h-2.5 w-2.5" /> {critical} critical
            </Badge>
            <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
              {high} high
            </Badge>
            <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> {filed} filed
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[480px] pr-2">
          <div className="space-y-2">
            <AnimatePresence>
              {sorted.map((f, i) => {
                const country = getCountry(f.country);
                return (
                  <motion.div
                    key={f.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.03] transition-colors ${
                      f.status === 'filed'
                        ? 'border-white/[0.04] bg-white/[0.01]'
                        : f.priority === 'critical'
                        ? 'border-rose-500/20 bg-rose-500/[0.03]'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    }`}
                  >
                    {/* Left: country flag + form info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-lg">
                        {country?.flag ?? '🏳️'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-100">{f.form}</span>
                          <Badge variant="outline" className={`text-[9px] ${PRIORITY_BADGE[f.priority]}`}>
                            {f.priority}
                          </Badge>
                        </div>
                        <div className="truncate text-[11px] text-zinc-400">{f.description}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {f.dueDate}
                          </span>
                          <span>·</span>
                          <span>{f.frequency}</span>
                          <span>·</span>
                          <span className="font-mono">{f.country}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: countdown + status */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${daysLeftBadgeClass(f.daysLeft)}`}
                      >
                        <Clock className="mr-1 h-2.5 w-2.5" />
                        {f.status === 'filed' ? 'Filed' : `${f.daysLeft}d left`}
                      </Badge>
                      <Badge variant="outline" className={`text-[9px] uppercase ${STATUS_BADGE_FD[f.status]}`}>
                        {f.status}
                      </Badge>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED SECTIONS — Tax Position Cards (per entity)
// ═══════════════════════════════════════════════════════════════════════════════

function TaxPositionCard({ pos, index }: { pos: TaxPosition; index: number }) {
  const country = getCountry(pos.country);
  const statutoryRate = country.corporateTaxRate;
  const rateDelta = statutoryRate - pos.effectiveRate;
  const savingsPositive = rateDelta > 0;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/30 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-base">
            {country.flag}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100">{pos.entity}</div>
            <div className="text-[10px] font-mono text-zinc-500">{pos.country} · {country.currency}</div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[9px] shrink-0 ${savingsPositive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}
        >
          {savingsPositive ? (
            <TrendingDown className="mr-1 h-2.5 w-2.5" />
          ) : (
            <TrendingUp className="mr-1 h-2.5 w-2.5" />
          )}
          {savingsPositive ? `-${rateDelta.toFixed(1)}pp` : `+${Math.abs(rateDelta).toFixed(1)}pp`}
        </Badge>
      </div>

      {/* Financials */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Revenue</div>
          <div className="text-xs font-semibold text-emerald-300">{fmtUSD(pos.revenue)}</div>
        </div>
        <div className="rounded-md bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Taxable Income</div>
          <div className="text-xs font-semibold text-teal-300">{fmtUSD(pos.taxableIncome)}</div>
        </div>
        <div className="rounded-md bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Loss Carry-fwd</div>
          <div className="text-xs font-semibold text-amber-300">{fmtUSD(pos.lossCarryforward)}</div>
        </div>
        <div className="rounded-md bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Tax Credits</div>
          <div className="text-xs font-semibold text-cyan-300">{fmtUSD(pos.taxCredits)}</div>
        </div>
      </div>

      <Separator className="my-3 bg-white/[0.06]" />

      {/* Effective rate progress */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="text-zinc-400">Effective vs Statutory Rate</span>
          <span className="text-zinc-300">
            <span className="text-emerald-300">{fmtPct(pos.effectiveRate)}</span>
            <span className="mx-1 text-zinc-600">/</span>
            <span className="text-zinc-400">{fmtPct(statutoryRate)}</span>
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(pos.effectiveRate, 100)}%` }}
            transition={{ duration: 0.6 }}
            className="h-full bg-emerald-500"
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-amber-400"
            style={{ left: `${Math.min(statutoryRate, 100)}%` }}
            aria-label="statutory rate marker"
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500">
          <span>Gross Corp Tax: <span className="text-zinc-300 font-mono">{fmtUSD(pos.corporateTax)}</span></span>
          <span className="text-emerald-300 font-medium">Net Tax: {fmtUSD(pos.netTax)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function TaxPositionsGrid() {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-teal-400" />
          Tax Position by Entity
          <Badge variant="outline" className="text-[9px] border-teal-500/30 bg-teal-500/10 text-teal-300">
            {TAX_POSITIONS.length} entities
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Per-entity taxable income, loss carry-forward, tax credits &amp; effective tax rate vs statutory rate.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TAX_POSITIONS.map((p, i) => (
            <TaxPositionCard key={p.country} pos={p} index={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED SECTIONS — DTAA Matrix
// ═══════════════════════════════════════════════════════════════════════════════

const DTAA_STATUS_BADGE: Record<DTAAEntry['status'], string> = {
  active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  negotiating: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  none: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

function rateCell(rate: number): { text: string; bg: string } {
  if (rate === 0) return { text: 'text-emerald-300', bg: 'bg-emerald-500/15' };
  if (rate <= 5) return { text: 'text-teal-300', bg: 'bg-teal-500/10' };
  if (rate <= 10) return { text: 'text-amber-300', bg: 'bg-amber-500/10' };
  return { text: 'text-rose-300', bg: 'bg-rose-500/10' };
}

function DTAAMatrix() {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="h-4 w-4 text-cyan-400" />
          DTAA Matrix — Double Tax Avoidance
          <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            {DTAA_MATRIX.length} pairs
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Withholding, dividend &amp; interest tax rates between country pairs under bilateral/multilateral treaties.
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[420px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Country Pair</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Withholding</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Dividend</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Interest</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">FTA Type</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DTAA_MATRIX.map((d, i) => {
                const c1 = getCountry(d.country1);
                const c2 = getCountry(d.country2);
                const wh = rateCell(d.withholdingTax);
                const dv = rateCell(d.dividendTax);
                const it = rateCell(d.interestTax);
                return (
                  <TableRow key={`${d.country1}-${d.country2}-${i}`} className="border-white/[0.04] hover:bg-white/[0.03]">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{c1.flag}</span>
                        <ArrowRight className="h-3 w-3 text-zinc-500" />
                        <span className="text-base">{c2.flag}</span>
                        <div className="ml-1">
                          <div className="text-xs font-medium text-zinc-200">{d.country1} ↔ {d.country2}</div>
                          <div className="text-[9px] text-zinc-500">{c1.name} · {c2.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right ${wh.bg}`}>
                      <span className={`text-[11px] font-mono ${wh.text}`}>{d.withholdingTax}%</span>
                    </TableCell>
                    <TableCell className={`text-right ${dv.bg}`}>
                      <span className={`text-[11px] font-mono ${dv.text}`}>{d.dividendTax}%</span>
                    </TableCell>
                    <TableCell className={`text-right ${it.bg}`}>
                      <span className={`text-[11px] font-mono ${it.text}`}>{d.interestTax}%</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
                        {d.ftaType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] uppercase ${DTAA_STATUS_BADGE[d.status]}`}>
                        {d.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED SECTIONS — Regulatory Changes
// ═══════════════════════════════════════════════════════════════════════════════

const IMPACT_STYLE: Record<RegulatoryChange['impact'], { ring: string; text: string; bg: string; icon: LucideIcon }> = {
  high: {
    ring: 'border-rose-500/40',
    text: 'text-rose-300',
    bg: 'bg-rose-500/[0.06]',
    icon: AlertTriangle,
  },
  medium: {
    ring: 'border-amber-500/40',
    text: 'text-amber-300',
    bg: 'bg-amber-500/[0.06]',
    icon: Info,
  },
  low: {
    ring: 'border-teal-500/40',
    text: 'text-teal-300',
    bg: 'bg-teal-500/[0.06]',
    icon: Info,
  },
};

function complyBadge(days: number): { cls: string; label: string } {
  if (days === 0) return { cls: 'border-rose-500/50 bg-rose-500/20 text-rose-200', label: 'Effective now' };
  if (days <= 7) return { cls: 'border-rose-500/50 bg-rose-500/20 text-rose-200', label: `${days}d to comply` };
  if (days <= 30) return { cls: 'border-amber-500/50 bg-amber-500/20 text-amber-200', label: `${days}d to comply` };
  if (days <= 90) return { cls: 'border-cyan-500/50 bg-cyan-500/20 text-cyan-200', label: `${days}d to comply` };
  return { cls: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300', label: `${days}d to comply` };
}

function RegulatoryChanges() {
  const sorted = useMemo(
    () => [...REGULATORY_CHANGES].sort((a, b) => a.daysToComply - b.daysToComply),
    [],
  );
  const high = sorted.filter((r) => r.impact === 'high').length;
  const actionReq = sorted.filter((r) => r.actionRequired).length;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              Regulatory Changes Monitor
              <Badge variant="outline" className="text-[9px] border-rose-500/30 bg-rose-500/10 text-rose-300">
                {sorted.length} changes
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Upcoming regulatory changes by jurisdiction — color-coded by impact with days-to-comply countdown.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-rose-500/30 bg-rose-500/10 text-rose-300">
              {high} high-impact
            </Badge>
            <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
              {actionReq} action req.
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[460px] pr-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sorted.map((r, i) => {
              const style = IMPACT_STYLE[r.impact];
              const Icon = style.icon;
              const country = getCountry(r.country as CountryCode);
              const cb = complyBadge(r.daysToComply);
              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className={`rounded-xl border p-3 ${style.ring} ${style.bg}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${style.ring} ${style.bg}`}>
                        <Icon className={`h-4 w-4 ${style.text}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{country?.flag ?? '🏳️'}</span>
                          <span className="text-[10px] font-mono text-zinc-500">{r.country}</span>
                          <Badge variant="outline" className={`text-[9px] uppercase ${style.ring} ${style.text}`}>
                            {r.impact}
                          </Badge>
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{r.title}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[9px] font-mono shrink-0 ${cb.cls}`}>
                      <Clock className="mr-1 h-2.5 w-2.5" /> {cb.label}
                    </Badge>
                  </div>

                  <p className="mt-2 text-[11px] leading-snug text-zinc-400">{r.description}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                    <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-300">
                      {r.category}
                    </Badge>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Effective: {r.effectiveDate}
                    </span>
                    {r.actionRequired && (
                      <span className={`inline-flex items-center gap-1 ${style.text}`}>
                        <AlertTriangle className="h-3 w-3" /> Action required
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MultiCountryAccounting() {
  const [filter, setFilter] = useState<'ALL' | CountryCode>('ALL');
  const [selected, setSelected] = useState<Country | null>(null);
  const [sectionTab, setSectionTab] = useState<'matrix' | 'calendar' | 'positions' | 'dtaa' | 'regulatory'>('matrix');

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
              One unified ledger across every jurisdiction — comparison matrix, filing calendar, tax positions, DTAA &amp; regulatory monitor.
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

        {/* ─── Deep Dives: tabbed enterprise sections ─────────────────────────── */}
        <section className="mt-6">
          <TooltipProvider delayDuration={200}>
            <Tabs value={sectionTab} onValueChange={(v) => setSectionTab(v as typeof sectionTab)}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal-400" />
                  <h2 className="text-sm font-semibold text-zinc-200">Enterprise Deep Dives</h2>
                </div>
                <TabsList className="bg-white/[0.03] h-9 overflow-x-auto">
                  <TabsTrigger value="matrix" className="text-[11px]">
                    <Table2 className="mr-1 h-3 w-3" /> Comparison Matrix
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="text-[11px]">
                    <AlarmClock className="mr-1 h-3 w-3" /> Filing Calendar
                  </TabsTrigger>
                  <TabsTrigger value="positions" className="text-[11px]">
                    <Scale className="mr-1 h-3 w-3" /> Tax Positions
                  </TabsTrigger>
                  <TabsTrigger value="dtaa" className="text-[11px]">
                    <Network className="mr-1 h-3 w-3" /> DTAA Matrix
                  </TabsTrigger>
                  <TabsTrigger value="regulatory" className="text-[11px]">
                    <AlertTriangle className="mr-1 h-3 w-3" /> Regulatory
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="matrix" className="mt-0">
                <ComparisonMatrix />
              </TabsContent>
              <TabsContent value="calendar" className="mt-0">
                <FilingCalendar />
              </TabsContent>
              <TabsContent value="positions" className="mt-0">
                <TaxPositionsGrid />
              </TabsContent>
              <TabsContent value="dtaa" className="mt-0">
                <DTAAMatrix />
              </TabsContent>
              <TabsContent value="regulatory" className="mt-0">
                <RegulatoryChanges />
              </TabsContent>
            </Tabs>
          </TooltipProvider>
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3 text-emerald-400" />
            Multi-Country Accounting™ · Phase 14 · {COUNTRIES.length} jurisdictions · {FILING_DEADLINES.length} filings · {DTAA_MATRIX.length} DTAA pairs
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-teal-400" /> Founder &amp; Owner: Prince Singh
          </div>
        </footer>
      </div>

      {/* Detail Dialog */}
      <CountryDetailDialog country={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
