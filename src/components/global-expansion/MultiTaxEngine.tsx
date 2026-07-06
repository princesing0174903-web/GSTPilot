'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: MULTI-TAX ENGINE™
//
// Unified indirect + direct tax engine across every jurisdiction — GST, VAT,
// Sales Tax and Consumption Tax side-by-side with an interactive calculator
// and a country × tax-type comparison matrix. Pure static data layer.
//
//   • 4 tax system cards      — GST / VAT / Sales Tax / Consumption Tax
//   • Interactive calculator  — country × tax type × amount → live breakdown
//   • Comparison matrix       — countries × tax types rates table
//
// Tagline: Every Tax System. One Engine. Zero Surprises.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator, Receipt, Building2, Users, Ship, Plane, Gauge,
  CheckCircle2, Sparkles, ArrowRight, Layers, Coins, Scale,
  TrendingUp, type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  COUNTRIES, TAX_SYSTEMS, calculateTax, fmtUSD, fmtPct, getCountry,
  type Country, type CountryCode, type TaxSystem,
} from '@/lib/global/data';

// ─── Tax system accents (NO indigo/blue) ───────────────────────────────────────

const SYSTEM_ACCENT: Record<TaxSystem['type'], { ring: string; text: string; bg: string; bar: string }> = {
  GST: {
    ring: 'border-emerald-500/30 bg-emerald-500/10',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/5',
    bar: 'bg-emerald-500',
  },
  VAT: {
    ring: 'border-teal-500/30 bg-teal-500/10',
    text: 'text-teal-300',
    bg: 'bg-teal-500/5',
    bar: 'bg-teal-400',
  },
  'Sales Tax': {
    ring: 'border-amber-500/30 bg-amber-500/10',
    text: 'text-amber-300',
    bg: 'bg-amber-500/5',
    bar: 'bg-amber-400',
  },
  'Consumption Tax': {
    ring: 'border-violet-500/30 bg-violet-500/10',
    text: 'text-violet-300',
    bg: 'bg-violet-500/5',
    bar: 'bg-violet-400',
  },
};

// ─── Tax type meta ──────────────────────────────────────────────────────────────

type TaxType = 'indirect' | 'corporate' | 'payroll' | 'import' | 'export';

const TAX_TYPES: { value: TaxType; label: string; icon: LucideIcon }[] = [
  { value: 'indirect', label: 'Indirect Tax (GST/VAT)', icon: Receipt },
  { value: 'corporate', label: 'Corporate Tax', icon: Building2 },
  { value: 'payroll', label: 'Payroll Tax', icon: Users },
  { value: 'import', label: 'Import Duty', icon: Ship },
  { value: 'export', label: 'Export Duty', icon: Plane },
];

function getCountryFlag(code: string): string {
  return getCountry(code as CountryCode)?.flag ?? '🏳️';
}

function getCountryName(code: string): string {
  return getCountry(code as CountryCode)?.name ?? code;
}

// ─── Tax System Card ────────────────────────────────────────────────────────────

function TaxSystemCard({ system, index }: { system: TaxSystem; index: number }) {
  const accent = SYSTEM_ACCENT[system.type];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.14] transition-all ${accent.bg}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <Badge variant="outline" className={`text-[9px] uppercase ${accent.ring} ${accent.text}`}>
            <Scale className="mr-1 h-2.5 w-2.5" /> {system.type}
          </Badge>
          <div className="mt-2 text-sm font-semibold text-zinc-100">{system.name}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${accent.ring}`}>
          <Coins className={`h-4 w-4 ${accent.text}`} />
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-zinc-400">{system.description}</p>

      {/* Countries */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {system.countries.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded border border-white/[0.08] bg-black/20 px-1.5 py-0.5 text-[10px] text-zinc-300"
            title={getCountryName(code)}
          >
            <span>{getCountryFlag(code)}</span>
            <span>{code}</span>
          </span>
        ))}
      </div>

      <Separator className="my-3 bg-white/[0.06]" />

      {/* Rates */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-black/30 py-2">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Standard</div>
          <div className={`mt-0.5 text-sm font-semibold ${accent.text}`}>{fmtPct(system.standardRate)}</div>
        </div>
        <div className="rounded-md bg-black/30 py-2">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Reduced</div>
          <div className="mt-0.5 text-sm font-semibold text-zinc-200">{fmtPct(system.reducedRate)}</div>
        </div>
        <div className="rounded-md bg-black/30 py-2">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Zero</div>
          <div className="mt-0.5 text-sm font-semibold text-zinc-400">{fmtPct(system.zeroRate)}</div>
        </div>
      </div>

      {/* Features */}
      <div className="mt-3">
        <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5">Key Features</div>
        <div className="flex flex-wrap gap-1">
          {system.features.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] text-zinc-400"
            >
              <CheckCircle2 className={`h-2.5 w-2.5 ${accent.text}`} /> {f}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Tax Calculator ─────────────────────────────────────────────────────────────

function TaxCalculator() {
  const [country, setCountry] = useState<CountryCode>('IN');
  const [taxType, setTaxType] = useState<TaxType>('indirect');
  const [amount, setAmount] = useState<string>('100000');

  const parsedAmount = Number(amount) || 0;
  const result = useMemo(
    () => calculateTax(parsedAmount, country, taxType),
    [parsedAmount, country, taxType],
  );

  const selectedCountry = getCountry(country);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-emerald-400" />
          Tax Calculator
          <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            Live
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Compute indirect, corporate, payroll & customs tax for any jurisdiction in real time.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Country select */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
              Country
            </label>
            <Select value={country} onValueChange={(v) => setCountry(v as CountryCode)}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="inline-flex items-center gap-2">
                      <span>{c.flag}</span>
                      <span>{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tax type select */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
              Tax Type
            </label>
            <Select value={taxType} onValueChange={(v) => setTaxType(v as TaxType)}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                {TAX_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="inline-flex items-center gap-2">
                      <t.icon className="h-3.5 w-3.5 text-teal-300" />
                      <span>{t.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount input */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
              Amount (USD)
            </label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-white/10 bg-white/[0.02] text-zinc-100 placeholder:text-zinc-600"
              placeholder="Enter amount"
            />
          </div>
        </div>

        {/* Selected country context */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-zinc-300">
            <span className="text-base">{selectedCountry.flag}</span>
            <span className="font-medium">{selectedCountry.name}</span>
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">System: <span className="text-teal-300">{selectedCountry.taxSystem}</span></span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">Currency: <span className="text-cyan-300">{selectedCountry.currency}</span></span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">FY: <span className="text-violet-300">{selectedCountry.fiscalYearStart}</span></span>
        </div>

        {/* Result breakdown */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${country}-${taxType}-${amount}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <div className="text-[9px] uppercase tracking-wide text-zinc-500">Base Amount</div>
              <div className="mt-1 text-base font-semibold text-zinc-100">{fmtUSD(result.baseAmount)}</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <div className="text-[9px] uppercase tracking-wide text-zinc-500">Tax Rate</div>
              <div className="mt-1 text-base font-semibold text-teal-300">{fmtPct(result.rate)}</div>
              <div className="text-[9px] text-zinc-500">{result.taxType}</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3">
              <div className="text-[9px] uppercase tracking-wide text-amber-300/80">Tax Amount</div>
              <div className="mt-1 text-base font-semibold text-amber-300">{fmtUSD(result.taxAmount)}</div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
              <div className="text-[9px] uppercase tracking-wide text-emerald-300/80">Total (Incl.)</div>
              <div className="mt-1 text-base font-semibold text-emerald-300">{fmtUSD(result.totalAmount)}</div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Visual breakdown bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Composition</span>
            <span>Base vs Tax</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-black/40">
            {result.totalAmount > 0 && (
              <>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(result.baseAmount / result.totalAmount) * 100}%` }}
                  transition={{ duration: 0.4 }}
                  className="bg-emerald-500"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(result.taxAmount / result.totalAmount) * 100}%` }}
                  transition={{ duration: 0.4 }}
                  className="bg-amber-400"
                />
              </>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-4 text-[10px]">
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Base {((result.baseAmount / (result.totalAmount || 1)) * 100).toFixed(1)}%
            </span>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <span className="h-2 w-2 rounded-sm bg-amber-400" /> Tax {((result.taxAmount / (result.totalAmount || 1)) * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <Button size="sm" variant="outline" className="border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]">
            <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> File Return
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Comparison Matrix ──────────────────────────────────────────────────────────

function ComparisonMatrix() {
  const taxCols: { key: TaxType; label: string }[] = [
    { key: 'indirect', label: 'Indirect' },
    { key: 'corporate', label: 'Corporate' },
    { key: 'payroll', label: 'Payroll' },
    { key: 'import', label: 'Import' },
    { key: 'export', label: 'Export' },
  ];

  function rateFor(c: Country, type: TaxType): number {
    switch (type) {
      case 'indirect': return c.taxRate;
      case 'corporate': return c.corporateTaxRate;
      case 'payroll': return c.payrollTaxRate;
      case 'import': return c.importDuty;
      case 'export': return c.exportDuty;
      default: return 0;
    }
  }

  function cellColor(rate: number): string {
    if (rate === 0) return 'text-zinc-600';
    if (rate >= 20) return 'text-rose-300';
    if (rate >= 10) return 'text-amber-300';
    return 'text-emerald-300';
  }

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-cyan-400" />
          Country × Tax Type Comparison Matrix
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Side-by-side rate matrix across all jurisdictions — hover to highlight.
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[480px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Country</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">System</TableHead>
                {taxCols.map((col) => (
                  <TableHead key={col.key} className="text-right text-[10px] uppercase tracking-wider text-zinc-500">
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Avg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COUNTRIES.map((c) => {
                const rates = taxCols.map((t) => rateFor(c, t.key));
                const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
                return (
                  <TableRow key={c.code} className="border-white/[0.04] hover:bg-white/[0.02]">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{c.flag}</span>
                        <div>
                          <div className="text-xs font-medium text-zinc-200">{c.name}</div>
                          <div className="text-[9px] text-zinc-500">{c.code} · {c.currency}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${SYSTEM_ACCENT[c.taxSystem].ring} ${SYSTEM_ACCENT[c.taxSystem].text}`}
                      >
                        {c.taxSystem}
                      </Badge>
                    </TableCell>
                    {taxCols.map((col) => {
                      const r = rateFor(c, col.key);
                      return (
                        <TableCell key={col.key} className="text-right">
                          <span className={`text-xs font-mono ${cellColor(r)}`}>
                            {r.toFixed(2)}%
                          </span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                      <span className="text-xs font-semibold text-cyan-300">{avg.toFixed(2)}%</span>
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

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MultiTaxEngine() {
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
          className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-300">
              <Gauge className="h-3 w-3" /> Phase 14 · Global Expansion
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Multi-Tax Engine<span className="text-emerald-400">™</span>
            </h1>
            <p className="text-sm text-zinc-400">
              GST, VAT, Sales Tax & Consumption Tax unified — calculate, compare & file across every jurisdiction.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-300">
              <TrendingUp className="mr-1 h-3 w-3" /> {TAX_SYSTEMS.length} systems
            </Badge>
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <Building2 className="mr-1 h-3 w-3" /> {COUNTRIES.length} jurisdictions
            </Badge>
          </div>
        </motion.header>

        {/* ─── Tax System Cards ──────────────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Scale className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Tax Systems</h2>
            <span className="text-[11px] text-zinc-500">— side-by-side comparison of every indirect tax regime</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TAX_SYSTEMS.map((s, i) => <TaxSystemCard key={s.type} system={s} index={i} />)}
          </div>
        </section>

        {/* ─── Calculator ────────────────────────────────────────────────────── */}
        <section className="mt-6">
          <TaxCalculator />
        </section>

        {/* ─── Comparison Matrix ─────────────────────────────────────────────── */}
        <section className="mt-4">
          <ComparisonMatrix />
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3 text-emerald-400" />
            Multi-Tax Engine™ · Phase 14 · {TAX_SYSTEMS.length} systems · {COUNTRIES.length} jurisdictions
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-teal-400" /> Founder & Owner: Prince Singh
          </div>
        </footer>
      </div>
    </div>
  );
}
