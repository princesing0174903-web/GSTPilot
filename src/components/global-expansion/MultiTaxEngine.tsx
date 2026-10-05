'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: MULTI-TAX ENGINE™ (ENHANCED)
//
// Unified indirect + direct tax engine across every jurisdiction — GST, VAT,
// Sales Tax, Consumption Tax, transfer pricing, loss carry-forward tracking,
// AI-style optimization recommendations. Pure static data layer.
//
//   • 4 tax system cards             — GST / VAT / Sales Tax / Consumption Tax
//   • Interactive calculator         — country × tax type × amount → live breakdown
//   • Comparison matrix              — countries × tax types rates table
//   • Tax Scenario Simulator         — multi-input + deduction toggles + step-by-step
//   • Transfer Pricing Calculator    — arm's length range + DTAA withholding
//   • Tax Loss Carryforward Tracker  — per entity savings vs statutory
//   • Tax Calendar                   — filtered filing deadlines
//   • Tax Optimization Recommendations — AI-style suggestions per country
//
// Tagline: Every Tax System. One Engine. Zero Surprises.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator, Receipt, Building2, Users, Ship, Plane, Gauge,
  CheckCircle2, Sparkles, ArrowRight, Layers, Coins, Scale,
  TrendingUp, TrendingDown, Lightbulb, FileText, AlarmClock,
  Network, Brain, Percent, PiggyBank, Workflow,
  Award, Banknote, Briefcase, BarChart3, Globe2,
  type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  COUNTRIES, TAX_SYSTEMS, calculateTax, fmtUSD, fmtPct, getCountry,
  TAX_POSITIONS, FILING_DEADLINES, DTAA_MATRIX,
  type Country, type CountryCode, type TaxSystem,
} from '@/lib/global/data';
import {
  TAX_CREDITS, GLOBAL_PAYROLL,
  CONSOLIDATED_ASSETS, CONSOLIDATED_LIABILITIES,
  type TaxCredit, type GlobalPayrollEntry, type ConsolidatedBalance,
} from '@/lib/global/data-enterprise';

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
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' as const }}
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
          Compute indirect, corporate, payroll &amp; customs tax for any jurisdiction in real time.
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

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Tax Scenario Simulator
// ═══════════════════════════════════════════════════════════════════════════════

function TaxScenarioSimulator() {
  const [country, setCountry] = useState<CountryCode>('IN');
  const [amount, setAmount] = useState<string>('500000');
  const [applyLossCf, setApplyLossCf] = useState(true);
  const [applyCredits, setApplyCredits] = useState(true);
  const [applySpecialDep, setApplySpecialDep] = useState(false);

  const selected = getCountry(country);
  const parsed = Number(amount) || 0;
  const position = TAX_POSITIONS.find((p) => p.country === country);

  const scenario = useMemo(() => {
    const baseTax = (parsed * selected.corporateTaxRate) / 100;
    let taxable = parsed;
    let lossUsed = 0;
    let creditUsed = 0;
    let specialDep = 0;
    const steps: { label: string; detail: string; amount: number; kind: 'info' | 'minus' | 'plus' }[] = [];

    steps.push({
      label: 'Gross Taxable Income',
      detail: `Pre-tax income in ${selected.name}`,
      amount: parsed,
      kind: 'info',
    });

    if (applyLossCf && position && position.lossCarryforward > 0) {
      lossUsed = Math.min(position.lossCarryforward, taxable);
      taxable -= lossUsed;
      steps.push({
        label: 'Apply Loss Carry-forward',
        detail: `Utilize ${fmtUSD(lossUsed)} of ${fmtUSD(position.lossCarryforward)} available`,
        amount: -lossUsed,
        kind: 'minus',
      });
    }

    if (applySpecialDep) {
      specialDep = (taxable * 0.2);
      taxable -= specialDep;
      steps.push({
        label: 'Additional Depreciation (Sec 32AD)',
        detail: '20% additional depreciation on plant & machinery',
        amount: -specialDep,
        kind: 'minus',
      });
    }

    steps.push({
      label: 'Net Taxable Income',
      detail: 'After deductions',
      amount: taxable,
      kind: 'info',
    });

    const grossTax = (taxable * selected.corporateTaxRate) / 100;
    steps.push({
      label: `Gross Corporate Tax @ ${fmtPct(selected.corporateTaxRate)}`,
      detail: `${selected.name} statutory rate`,
      amount: grossTax,
      kind: 'info',
    });

    if (applyCredits && position && position.taxCredits > 0) {
      creditUsed = Math.min(position.taxCredits, grossTax);
      steps.push({
        label: 'Apply Tax Credits',
        detail: `Withholding & foreign tax credits: ${fmtUSD(creditUsed)} of ${fmtUSD(position.taxCredits)}`,
        amount: -creditUsed,
        kind: 'minus',
      });
    }

    const netTax = Math.max(0, grossTax - creditUsed);
    const effectiveRate = parsed > 0 ? (netTax / parsed) * 100 : 0;
    const statutoryTax = (parsed * selected.corporateTaxRate) / 100;
    const savings = statutoryTax - netTax;

    return {
      steps,
      netTax,
      effectiveRate,
      statutoryRate: selected.corporateTaxRate,
      savings,
      lossUsed,
      creditUsed,
      specialDep,
    };
  }, [parsed, selected, position, applyLossCf, applyCredits, applySpecialDep]);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Workflow className="h-4 w-4 text-violet-400" />
          Tax Scenario Simulator
          <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
            Step-by-step
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Build complex scenarios with loss carry-forward, tax credits &amp; additional depreciation — see each calculation step.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left: inputs */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Country</label>
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
                        <span className="text-zinc-500">· {fmtPct(c.corporateTaxRate)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
                Taxable Income (USD)
              </label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-white/10 bg-white/[0.02] text-zinc-100"
                placeholder="Enter income"
              />
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Deductions &amp; Adjustments</div>
              <div className="space-y-2.5">
                <ToggleRow
                  label="Apply loss carry-forward"
                  detail={position ? `${fmtUSD(position.lossCarryforward)} available` : 'No position data'}
                  enabled={applyLossCf}
                  onChange={setApplyLossCf}
                  disabled={!position || position.lossCarryforward === 0}
                  accent="amber"
                />
                <ToggleRow
                  label="Apply tax credits"
                  detail={position ? `${fmtUSD(position.taxCredits)} available` : 'No position data'}
                  enabled={applyCredits}
                  onChange={setApplyCredits}
                  disabled={!position || position.taxCredits === 0}
                  accent="cyan"
                />
                <ToggleRow
                  label="Additional depreciation (Sec 32AD)"
                  detail="20% extra on plant & machinery"
                  enabled={applySpecialDep}
                  onChange={setApplySpecialDep}
                  accent="violet"
                />
              </div>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
                <div className="text-[9px] uppercase tracking-wide text-emerald-300/80">Net Tax</div>
                <div className="mt-0.5 text-sm font-semibold text-emerald-300">{fmtUSD(scenario.netTax)}</div>
              </div>
              <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.05] p-2.5">
                <div className="text-[9px] uppercase tracking-wide text-teal-300/80">Effective Rate</div>
                <div className="mt-0.5 text-sm font-semibold text-teal-300">{fmtPct(scenario.effectiveRate)}</div>
              </div>
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.05] p-2.5">
                <div className="text-[9px] uppercase tracking-wide text-violet-300/80">Savings</div>
                <div className="mt-0.5 text-sm font-semibold text-violet-300">{fmtUSD(scenario.savings)}</div>
              </div>
            </div>
          </div>

          {/* Right: step-by-step */}
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Calculation Breakdown</div>
              <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-400">
                {scenario.steps.length} steps
              </Badge>
            </div>
            <ScrollArea className="max-h-[380px] pr-2">
              <div className="space-y-2">
                <AnimatePresence>
                  {scenario.steps.map((step, i) => (
                    <motion.div
                      key={`${step.label}-${i}`}
                      layout
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                      className={`flex items-start gap-2.5 rounded-md border p-2.5 ${
                        step.kind === 'minus'
                          ? 'border-amber-500/20 bg-amber-500/[0.04]'
                          : step.label.includes('Net Tax')
                          ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                          : 'border-white/[0.06] bg-white/[0.02]'
                      }`}
                    >
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-mono font-semibold ${
                        step.kind === 'minus'
                          ? 'bg-amber-500/15 text-amber-300'
                          : step.kind === 'plus'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-white/[0.06] text-zinc-400'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-200">{step.label}</span>
                          <span className={`font-mono text-xs font-semibold ${
                            step.kind === 'minus'
                              ? 'text-amber-300'
                              : step.label.includes('Net Tax')
                              ? 'text-emerald-300'
                              : 'text-zinc-300'
                          }`}>
                            {step.amount < 0 ? '-' : ''}{fmtUSD(Math.abs(step.amount))}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500">{step.detail}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>

            <Separator className="my-3 bg-white/[0.06]" />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">Statutory vs Effective</span>
              <span className="text-[11px] text-zinc-300">
                <span className="text-zinc-500">{fmtPct(scenario.statutoryRate)}</span>
                <ArrowRight className="mx-1 inline h-3 w-3 text-zinc-600" />
                <span className="font-semibold text-emerald-300">{fmtPct(scenario.effectiveRate)}</span>
                <span className="ml-2 inline-flex items-center gap-0.5 text-violet-300">
                  <TrendingDown className="h-3 w-3" />
                  {(scenario.statutoryRate - scenario.effectiveRate).toFixed(1)}pp saved
                </span>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label, detail, enabled, onChange, disabled, accent,
}: {
  label: string;
  detail: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  accent: 'amber' | 'cyan' | 'violet';
}) {
  const accentText: Record<typeof accent, string> = {
    amber: 'text-amber-300',
    cyan: 'text-cyan-300',
    violet: 'text-violet-300',
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-zinc-200">{label}</div>
        <div className={`text-[10px] ${disabled ? 'text-zinc-600' : accentText[accent]}`}>{detail}</div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={disabled}
        className="data-[state=checked]:bg-emerald-500"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Transfer Pricing Calculator
// ═══════════════════════════════════════════════════════════════════════════════

function TransferPricingCalculator() {
  const [country1, setCountry1] = useState<CountryCode>('IN');
  const [country2, setCountry2] = useState<CountryCode>('SG');
  const [transactionValue, setTransactionValue] = useState<string>('500000');
  const [markup, setMarkup] = useState<string>('15');

  const parsed = Number(transactionValue) || 0;
  const markupPct = Number(markup) || 0;

  const dtaa = useMemo(
    () => DTAA_MATRIX.find(
      (d) =>
        (d.country1 === country1 && d.country2 === country2) ||
        (d.country1 === country2 && d.country2 === country1),
    ),
    [country1, country2],
  );

  const armsLength = useMemo(() => {
    // OECD-style arm's length range: median ± 5pp tolerance band
    const low = markupPct - 5;
    const mid = markupPct;
    const high = markupPct + 5;
    const baseCost = parsed / (1 + markupPct / 100);
    const armLow = baseCost * (1 + Math.max(0, low) / 100);
    const armMid = baseCost * (1 + mid / 100);
    const armHigh = baseCost * (1 + high / 100);
    return { low, mid, high, armLow, armMid, armHigh, baseCost };
  }, [parsed, markupPct]);

  const withholding = dtaa ? dtaa.withholdingTax : 0;
  const whAmount = (parsed * withholding) / 100;
  const c1 = getCountry(country1);
  const c2 = getCountry(country2);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="h-4 w-4 text-cyan-400" />
          Transfer Pricing Calculator
          <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            OECD-aligned
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Compute arm&apos;s length range &amp; DTAA withholding implications for inter-company transactions.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">From Country</label>
            <Select value={country1} onValueChange={(v) => setCountry1(v as CountryCode)}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="inline-flex items-center gap-2">
                      <span>{c.flag}</span><span>{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">To Country</label>
            <Select value={country2} onValueChange={(v) => setCountry2(v as CountryCode)}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="inline-flex items-center gap-2">
                      <span>{c.flag}</span><span>{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Transaction Value (USD)</label>
            <Input
              type="number"
              min={0}
              value={transactionValue}
              onChange={(e) => setTransactionValue(e.target.value)}
              className="border-white/10 bg-white/[0.02] text-zinc-100"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Markup %</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              className="border-white/10 bg-white/[0.02] text-zinc-100"
              placeholder="15"
            />
          </div>
        </div>

        {/* Country pair banner */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xl">{c1.flag}</span>
            <span className="font-medium text-zinc-200">{c1.name}</span>
            <ArrowRight className="h-4 w-4 text-zinc-500" />
            <span className="text-xl">{c2.flag}</span>
            <span className="font-medium text-zinc-200">{c2.name}</span>
          </div>
          {dtaa ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
                {dtaa.ftaType}
              </Badge>
              <span className="text-zinc-400">Withholding: <span className="text-rose-300 font-mono">{dtaa.withholdingTax}%</span></span>
              <span className="text-zinc-400">Dividend: <span className="text-amber-300 font-mono">{dtaa.dividendTax}%</span></span>
              <span className="text-zinc-400">Interest: <span className="text-cyan-300 font-mono">{dtaa.interestTax}%</span></span>
            </div>
          ) : (
            <Badge variant="outline" className="text-[9px] border-rose-500/30 bg-rose-500/10 text-rose-300">
              No DTAA between these countries
            </Badge>
          )}
        </div>

        {/* Arm's length range */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3">
            <div className="text-[9px] uppercase tracking-wide text-amber-300/80">Quartile 1 (Low)</div>
            <div className="mt-1 text-base font-semibold text-amber-300">{fmtUSD(armsLength.armLow)}</div>
            <div className="text-[9px] text-zinc-500">markup {Math.max(0, armsLength.low).toFixed(1)}%</div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
            <div className="text-[9px] uppercase tracking-wide text-emerald-300/80">Median (Target)</div>
            <div className="mt-1 text-base font-semibold text-emerald-300">{fmtUSD(armsLength.armMid)}</div>
            <div className="text-[9px] text-zinc-500">markup {armsLength.mid.toFixed(1)}%</div>
          </div>
          <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.05] p-3">
            <div className="text-[9px] uppercase tracking-wide text-teal-300/80">Quartile 3 (High)</div>
            <div className="mt-1 text-base font-semibold text-teal-300">{fmtUSD(armsLength.armHigh)}</div>
            <div className="text-[9px] text-zinc-500">markup {armsLength.high.toFixed(1)}%</div>
          </div>
        </div>

        {/* Range visualization */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Arm&apos;s Length Range</span>
            <span>Tolerance band ±5pp</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-black/40">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '60%' }}
              transition={{ duration: 0.6 }}
              className="absolute left-[20%] h-full bg-gradient-to-r from-amber-500/60 via-emerald-500/60 to-teal-500/60"
            />
            <div
              className="absolute top-0 h-full w-0.5 bg-emerald-300"
              style={{ left: '50%' }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500">
            <span>{fmtUSD(armsLength.armLow)}</span>
            <span className="text-emerald-300">{fmtUSD(armsLength.armMid)} (your price)</span>
            <span>{fmtUSD(armsLength.armHigh)}</span>
          </div>
        </div>

        {/* Withholding impact */}
        <Separator className="my-3 bg-white/[0.06]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Base Cost</div>
            <div className="mt-0.5 text-xs font-semibold text-zinc-200">{fmtUSD(armsLength.baseCost)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Markup Earned</div>
            <div className="mt-0.5 text-xs font-semibold text-emerald-300">{fmtUSD(parsed - armsLength.baseCost)}</div>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-rose-300/80">Withholding @ {withholding}%</div>
            <div className="mt-0.5 text-xs font-semibold text-rose-300">{fmtUSD(whAmount)}</div>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.05] p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-violet-300/80">Net Receivable</div>
            <div className="mt-0.5 text-xs font-semibold text-violet-300">{fmtUSD(parsed - whAmount)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Tax Loss Carryforward Tracker
// ═══════════════════════════════════════════════════════════════════════════════

function LossCarryforwardTracker() {
  const totals = useMemo(() => {
    const totalLoss = TAX_POSITIONS.reduce((s, p) => s + p.lossCarryforward, 0);
    const totalCredits = TAX_POSITIONS.reduce((s, p) => s + p.taxCredits, 0);
    const totalSavings = TAX_POSITIONS.reduce((s, p) => {
      const country = getCountry(p.country);
      const statutory = (p.taxableIncome * country.corporateTaxRate) / 100;
      return s + (statutory - p.netTax);
    }, 0);
    return { totalLoss, totalCredits, totalSavings };
  }, []);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-4 w-4 text-amber-400" />
              Tax Loss Carry-forward Tracker
              <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
                {TAX_POSITIONS.length} entities
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Track loss carry-forwards &amp; tax credits per entity — see effective rate vs statutory &amp; cumulative savings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
              Loss CF: {fmtUSD(totals.totalLoss)}
            </Badge>
            <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              Credits: {fmtUSD(totals.totalCredits)}
            </Badge>
            <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Total Saved: {fmtUSD(totals.totalSavings)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[440px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Entity</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Taxable Income</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Loss Carry-fwd</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Tax Credits</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Eff. Rate</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Stat. Rate</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Savings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TAX_POSITIONS.map((p) => {
                const country = getCountry(p.country);
                const statutory = (p.taxableIncome * country.corporateTaxRate) / 100;
                const savings = statutory - p.netTax;
                const deltaPp = country.corporateTaxRate - p.effectiveRate;
                return (
                  <TableRow key={p.country} className="border-white/[0.04] hover:bg-white/[0.02]">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{country.flag}</span>
                        <div>
                          <div className="text-xs font-medium text-zinc-200">{p.entity}</div>
                          <div className="text-[9px] text-zinc-500">{p.country} · {country.currency}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono text-zinc-300">{fmtUSD(p.taxableIncome)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-[11px] font-mono ${p.lossCarryforward > 0 ? 'text-amber-300' : 'text-zinc-600'}`}>
                        {fmtUSD(p.lossCarryforward)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-[11px] font-mono ${p.taxCredits > 0 ? 'text-cyan-300' : 'text-zinc-600'}`}>
                        {fmtUSD(p.taxCredits)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono text-emerald-300">{fmtPct(p.effectiveRate)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono text-zinc-400">{fmtPct(country.corporateTaxRate)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-[11px] font-mono text-violet-300">{fmtUSD(savings)}</span>
                        <Badge variant="outline" className="text-[9px] border-emerald-500/20 bg-emerald-500/5 text-emerald-300">
                          <TrendingDown className="mr-0.5 h-2 w-2" />
                          {deltaPp.toFixed(1)}pp
                        </Badge>
                      </div>
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
// ENHANCED — Tax Calendar (filtered to tax-related)
// ═══════════════════════════════════════════════════════════════════════════════

const PRIORITY_BADGE: Record<'critical' | 'high' | 'medium' | 'low', string> = {
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  high: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  medium: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  low: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
};

function daysLeftBadgeClass(daysLeft: number): string {
  if (daysLeft <= 7) return 'border-rose-500/50 bg-rose-500/20 text-rose-200';
  if (daysLeft <= 21) return 'border-amber-500/50 bg-amber-500/20 text-amber-200';
  if (daysLeft <= 45) return 'border-cyan-500/50 bg-cyan-500/20 text-cyan-200';
  return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
}

function TaxCalendar() {
  const taxFilings = useMemo(
    () => [...FILING_DEADLINES].sort((a, b) => a.daysLeft - b.daysLeft),
    [],
  );

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlarmClock className="h-4 w-4 text-rose-400" />
          Tax Filing Calendar
          <Badge variant="outline" className="text-[9px] border-rose-500/30 bg-rose-500/10 text-rose-300">
            {taxFilings.length} filings
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          All tax-related regulatory filings sorted by days remaining.
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[440px] pr-2">
          <div className="space-y-2">
            {taxFilings.map((f, i) => {
              const country = getCountry(f.country);
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.02 }}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 hover:bg-white/[0.03] ${
                    f.priority === 'critical' ? 'border-rose-500/20 bg-rose-500/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-black/30 text-sm">
                    {country?.flag ?? '🏳️'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-100">{f.form}</span>
                      <Badge variant="outline" className={`text-[9px] ${PRIORITY_BADGE[f.priority]}`}>{f.priority}</Badge>
                    </div>
                    <div className="truncate text-[10px] text-zinc-500">{f.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-[10px] font-mono ${daysLeftBadgeClass(f.daysLeft)}`}>
                      {f.status === 'filed' ? 'Filed' : `${f.daysLeft}d`}
                    </Badge>
                    <span className="text-[10px] text-zinc-500 hidden sm:inline">{f.dueDate}</span>
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

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Tax Optimization Recommendations
// ═══════════════════════════════════════════════════════════════════════════════

interface TaxRec {
  country: CountryCode;
  title: string;
  body: string;
  impact: 'high' | 'medium' | 'low';
  saving: string;
  icon: LucideIcon;
  section?: string;
}

const TAX_RECS: TaxRec[] = [
  { country: 'IN', title: 'Claim Additional Depreciation (Section 32AD)', body: 'Acquire new plant & machinery before FY end to claim 20% additional depreciation under Section 32AD of the Income Tax Act.', impact: 'high', saving: '₹2.4Cr/yr', icon: TrendingDown, section: 'Sec 32AD' },
  { country: 'IN', title: 'Set off losses against capital gains', body: 'Carry-forward of STCG losses (2-year) and LTCG losses (8-year) — file ITR within due date to preserve entitlement.', impact: 'medium', saving: '₹84L', icon: PiggyBank, section: 'Sec 74' },
  { country: 'SG', title: 'Utilize Pioneer Industry Incentive', body: 'Qualifying pioneer activities receive up to 15% tax exemption for 5 years — apply via EDB before fiscal year end.', impact: 'high', saving: 'S$420K/yr', icon: Lightbulb, section: 'Pioneer Scheme' },
  { country: 'SG', title: 'R&D Tax Deduction (Section 14D)', body: '250% deduction on qualifying R&D expenditure — including staff costs, consumables & outsourced R&D.', impact: 'high', saving: 'S$310K', icon: Brain, section: 'Sec 14D' },
  { country: 'AE', title: 'Small Business Relief (9% CT)', body: 'First AED 375,000 of taxable income is taxed at 0% — structure profits to maximize relief across entities.', impact: 'medium', saving: 'AED 33,750', icon: Percent, section: 'CT Law Art. 4' },
  { country: 'GB', title: 'UK R&D SME Tax Credit', body: '186% enhancement on qualifying R&D expenditure for SMEs — payable credit at 10% if loss-making.', impact: 'high', saving: '£78K', icon: Lightbulb, section: 'R&D SME' },
  { country: 'GB', title: 'Patent Box (10% rate)', body: 'Elect into Patent Box regime to apply 10% corporation tax to profits attributable to patented inventions.', impact: 'high', saving: '£42K/yr', icon: Scale, section: 'Patent Box' },
  { country: 'US', title: 'R&D Tax Credit (IRC §41)', body: '20% credit on qualified research expenditures above base amount — alternatively 14% simplified credit.', impact: 'high', saving: '$94K', icon: Brain, section: 'IRC §41' },
  { country: 'US', title: 'Section 179 Expensing', body: 'Deduct full cost of qualifying equipment (up to $1.16M) in year of purchase rather than depreciating over time.', impact: 'medium', saving: '$38K', icon: TrendingDown, section: 'IRC §179' },
  { country: 'DE', title: 'Investitionsabzugsbetrag (IAB)', body: 'Tax-reserved deduction up to €200K for planned investments in movable assets — SME benefit under §7g EStG.', impact: 'medium', saving: '€58K', icon: PiggyBank, section: '§7g EStG' },
  { country: 'FR', title: 'Crédit d&apos;Impôt Recherche (CIR)', body: '30% credit on R&D up to €100M, 5% above — refundable for SMEs and young innovative companies.', impact: 'high', saving: '€72K', icon: Lightbulb, section: 'CIR' },
  { country: 'AU', title: 'Instant Asset Write-off', body: 'Deduct full cost of eligible depreciating assets below threshold immediately — currently $20K per asset.', impact: 'medium', saving: 'A$24K', icon: TrendingDown, section: 'ITAA 1997' },
  { country: 'JP', title: 'SME Tax Reduction (中堅企業)', body: 'Reduced corporate tax rate (15%) on first ¥8M of income for SMEs with capital ≤ ¥100M.', impact: 'medium', saving: '¥2.4M', icon: Percent, section: '法人税法' },
  { country: 'CA', title: 'SR&ED Tax Credit', body: '35% refundable credit on qualifying R&D for CCPCs (Canadian-Controlled Private Corps), 15% non-refundable for others.', impact: 'high', saving: 'C$48K', icon: Brain, section: 'SR&ED' },
];

const REC_IMPACT_STYLE: Record<TaxRec['impact'], { ring: string; text: string; dot: string }> = {
  high: { ring: 'border-rose-500/30 bg-rose-500/[0.06]', text: 'text-rose-300', dot: 'bg-rose-400' },
  medium: { ring: 'border-amber-500/30 bg-amber-500/[0.06]', text: 'text-amber-300', dot: 'bg-amber-400' },
  low: { ring: 'border-teal-500/30 bg-teal-500/[0.06]', text: 'text-teal-300', dot: 'bg-teal-400' },
};

function OptimizationRecommendations() {
  const [filter, setFilter] = useState<'ALL' | CountryCode>('ALL');
  const filtered = filter === 'ALL' ? TAX_RECS : TAX_RECS.filter((r) => r.country === filter);
  const totalSavingsCount = filtered.length;
  const highImpact = filtered.filter((r) => r.impact === 'high').length;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-violet-400" />
              Tax Optimization Recommendations
              <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
                AI-driven · {totalSavingsCount}
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Country-specific tax incentives, deductions &amp; credits — ranked by potential impact.
            </p>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as 'ALL' | CountryCode)}>
            <SelectTrigger className="w-[180px] border-white/10 bg-white/[0.02] text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
              <SelectItem value="ALL">All Countries</SelectItem>
              {[...new Set(TAX_RECS.map((r) => r.country))].map((cc) => {
                const c = getCountry(cc);
                return (
                  <SelectItem key={cc} value={cc}>
                    <span className="inline-flex items-center gap-2">
                      <span>{c.flag}</span><span>{c.name}</span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[520px] pr-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((r, i) => {
                const style = REC_IMPACT_STYLE[r.impact];
                const country = getCountry(r.country);
                const Icon = r.icon;
                return (
                  <motion.div
                    key={`${r.country}-${r.title}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                    className={`rounded-xl border p-3 ${style.ring}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-base">
                          {country.flag}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[9px] uppercase ${style.ring} ${style.text}`}>
                              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
                              {r.impact}
                            </Badge>
                            {r.section && (
                              <span className="font-mono text-[9px] text-zinc-500">{r.section}</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-zinc-100">{r.title}</div>
                        </div>
                      </div>
                      <Icon className={`h-4 w-4 shrink-0 ${style.text}`} />
                    </div>
                    <p className="mt-2 text-[11px] leading-snug text-zinc-400">{r.body}</p>
                    <Separator className="my-2 bg-white/[0.06]" />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500">{country.name}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${style.text}`}>
                        <TrendingDown className="h-3 w-3" /> {r.saving}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
        <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3 text-violet-400" />
            {highImpact} high-impact recommendations across {filter === 'ALL' ? COUNTRIES.length : 1} {filter === 'ALL' ? 'jurisdictions' : 'jurisdiction'}
          </span>
          <span className="text-zinc-500">Oracle™ AI Advisor</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE — Tax Credits & Incentives Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

const CREDIT_TYPE_STYLE: Record<TaxCredit['type'], { ring: string; text: string; bar: string }> = {
  'R&D Credit': { ring: 'border-emerald-500/30 bg-emerald-500/10', text: 'text-emerald-300', bar: 'bg-emerald-500' },
  'Investment Allowance': { ring: 'border-teal-500/30 bg-teal-500/10', text: 'text-teal-300', bar: 'bg-teal-400' },
  'Export Incentive': { ring: 'border-cyan-500/30 bg-cyan-500/10', text: 'text-cyan-300', bar: 'bg-cyan-400' },
  'SEZ Benefit': { ring: 'border-violet-500/30 bg-violet-500/10', text: 'text-violet-300', bar: 'bg-violet-400' },
  'Regional Benefit': { ring: 'border-amber-500/30 bg-amber-500/10', text: 'text-amber-300', bar: 'bg-amber-400' },
};

const CREDIT_STATUS_BADGE: Record<TaxCredit['status'], string> = {
  claimed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  expiring: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  expired: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
};

function fmtCompactUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function TaxCreditsDashboard() {
  const totalEligible = TAX_CREDITS.reduce((s, c) => s + c.eligibleAmount, 0);
  const totalClaimed = TAX_CREDITS.reduce((s, c) => s + c.claimedAmount, 0);
  const totalRemaining = TAX_CREDITS.reduce((s, c) => s + c.remaining, 0);
  const totalSavings = TAX_CREDITS.reduce((s, c) => s + c.savingUSD, 0);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-amber-400" />
              Tax Credits &amp; Incentives Dashboard
              <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
                {TAX_CREDITS.length} credits
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              R&amp;D credits, investment allowances, export incentives &amp; SEZ benefits — eligibility, claims &amp; realized savings.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary KPIs */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Eligible</div>
            <div className="text-sm font-semibold text-emerald-300">{fmtCompactUSD(totalEligible)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Claimed</div>
            <div className="text-sm font-semibold text-teal-300">{fmtCompactUSD(totalClaimed)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Remaining</div>
            <div className="text-sm font-semibold text-amber-300">{fmtCompactUSD(totalRemaining)}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Total Savings</div>
            <div className="text-sm font-semibold text-emerald-300">{fmtCompactUSD(totalSavings)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TAX_CREDITS.map((c, i) => {
            const country = getCountry(c.countryCode);
            const style = CREDIT_TYPE_STYLE[c.type];
            const utilization = (c.claimedAmount / c.eligibleAmount) * 100;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className={`rounded-xl border p-3 ${style.ring}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-black/30 text-sm">
                      {country?.flag ?? '🏳️'}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-zinc-100">{c.name}</div>
                      <div className="text-[9px] text-zinc-500">{c.countryCode} · {c.type}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[9px] uppercase shrink-0 ${CREDIT_STATUS_BADGE[c.status]}`}>
                    {c.status}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-black/30 py-1.5">
                    <div className="text-[8px] uppercase tracking-wide text-zinc-500">Eligible</div>
                    <div className={`mt-0.5 text-[11px] font-semibold ${style.text}`}>{fmtCompactUSD(c.eligibleAmount)}</div>
                  </div>
                  <div className="rounded-md bg-black/30 py-1.5">
                    <div className="text-[8px] uppercase tracking-wide text-zinc-500">Claimed</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-zinc-200">{fmtCompactUSD(c.claimedAmount)}</div>
                  </div>
                  <div className="rounded-md bg-black/30 py-1.5">
                    <div className="text-[8px] uppercase tracking-wide text-zinc-500">Remaining</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-amber-300">{fmtCompactUSD(c.remaining)}</div>
                  </div>
                </div>

                {/* Utilization progress */}
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between text-[9px] text-zinc-500">
                    <span>Utilization</span>
                    <span className="text-zinc-300">{utilization.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${utilization}%` }}
                      transition={{ duration: 0.5, delay: i * 0.04 }}
                      className={`h-full ${style.bar}`}
                    />
                  </div>
                </div>

                <Separator className="my-2.5 bg-white/[0.06]" />
                <div className="flex items-center justify-between text-[10px]">
                  <span className="inline-flex items-center gap-1 text-zinc-500">
                    <AlarmClock className="h-3 w-3" /> Exp: {c.expiry}
                  </span>
                  <span className={`inline-flex items-center gap-1 font-semibold ${style.text}`}>
                    <TrendingDown className="h-3 w-3" /> Save {fmtCompactUSD(c.savingUSD)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE — Global Payroll Tax Summary
// ═══════════════════════════════════════════════════════════════════════════════

const PAYROLL_STATUS_BADGE: Record<GlobalPayrollEntry['status'], string> = {
  processed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  review: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

function GlobalPayrollSummary() {
  const totalHeadcount = GLOBAL_PAYROLL.reduce((s, p) => s + p.headcount, 0);
  const totalGross = GLOBAL_PAYROLL.reduce((s, p) => s + p.grossPayrollUSD, 0);
  const totalEmployer = GLOBAL_PAYROLL.reduce((s, p) => s + p.employerTax, 0);
  const totalEmployee = GLOBAL_PAYROLL.reduce((s, p) => s + p.employeeTax, 0);
  const totalNet = GLOBAL_PAYROLL.reduce((s, p) => s + p.netPayroll, 0);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-cyan-400" />
          Global Payroll Tax Summary
          <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            {GLOBAL_PAYROLL.length} entities
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Payroll tax posture across every entity — employer &amp; employee contributions, gross-to-net breakdown &amp; status.
        </p>
      </CardHeader>
      <CardContent>
        {/* Summary KPIs */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Headcount</div>
            <div className="text-sm font-semibold text-violet-300">{totalHeadcount.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Gross Payroll</div>
            <div className="text-sm font-semibold text-emerald-300">{fmtCompactUSD(totalGross)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Employer Tax</div>
            <div className="text-sm font-semibold text-amber-300">{fmtCompactUSD(totalEmployer)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Employee Tax</div>
            <div className="text-sm font-semibold text-rose-300">{fmtCompactUSD(totalEmployee)}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Net Payroll</div>
            <div className="text-sm font-semibold text-emerald-300">{fmtCompactUSD(totalNet)}</div>
          </div>
        </div>

        <ScrollArea className="max-h-[560px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Entity</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Country</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">HC</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Gross (USD)</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Employer Tax</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Employee Tax</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Net Payroll</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Avg Salary</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GLOBAL_PAYROLL.map((p, i) => {
                const country = getCountry(p.countryCode);
                return (
                  <motion.tr
                    key={`${p.entity}-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className="border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-black/30 text-sm">
                          {country?.flag ?? '🏳️'}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-zinc-100">{p.entity}</div>
                          <div className="text-[9px] text-zinc-500">{p.currency}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[10px] text-zinc-400">{p.countryCode}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-[11px] text-violet-300">{p.headcount}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-[11px] text-emerald-300">{fmtCompactUSD(p.grossPayrollUSD)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-[11px] text-amber-300">{fmtCompactUSD(p.employerTax)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-[11px] text-rose-300">{fmtCompactUSD(p.employeeTax)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-[11px] text-zinc-200">{fmtCompactUSD(p.netPayroll)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-[11px] text-teal-300">{fmtUSD(p.avgSalary)}/mo</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] uppercase ${PAYROLL_STATUS_BADGE[p.status]}`}>
                        {p.status}
                      </Badge>
                    </TableCell>
                  </motion.tr>
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
// ENTERPRISE — Consolidated Tax Position
// ═══════════════════════════════════════════════════════════════════════════════

function ConsolidatedTaxPosition() {
  const totalAssets = CONSOLIDATED_ASSETS.reduce((s, a) => s + a.totalUSD, 0);
  const totalLiabilities = CONSOLIDATED_LIABILITIES.reduce((s, l) => s + l.totalUSD, 0);
  const netPosition = totalAssets - totalLiabilities;

  // Determine max category total for bar scaling
  const maxAssetCat = Math.max(...CONSOLIDATED_ASSETS.map((a) => a.totalUSD));
  const maxLiabCat = Math.max(...CONSOLIDATED_LIABILITIES.map((l) => l.totalUSD));
  const maxCat = Math.max(maxAssetCat, maxLiabCat);

  // Multi-currency totals (module-level constants — no memoization needed)
  const totalsByCurrency = {
    assets: {
      inr: CONSOLIDATED_ASSETS.reduce((s, a) => s + a.inr, 0),
      usd: CONSOLIDATED_ASSETS.reduce((s, a) => s + a.usd, 0),
      eur: CONSOLIDATED_ASSETS.reduce((s, a) => s + a.eur, 0),
      gbp: CONSOLIDATED_ASSETS.reduce((s, a) => s + a.gbp, 0),
      other: CONSOLIDATED_ASSETS.reduce((s, a) => s + a.other, 0),
    },
    liabilities: {
      inr: CONSOLIDATED_LIABILITIES.reduce((s, l) => s + l.inr, 0),
      usd: CONSOLIDATED_LIABILITIES.reduce((s, l) => s + l.usd, 0),
      eur: CONSOLIDATED_LIABILITIES.reduce((s, l) => s + l.eur, 0),
      gbp: CONSOLIDATED_LIABILITIES.reduce((s, l) => s + l.gbp, 0),
      other: CONSOLIDATED_LIABILITIES.reduce((s, l) => s + l.other, 0),
    },
  };

  function renderRow(item: ConsolidatedBalance, i: number, isAsset: boolean) {
    const widthPct = (item.totalUSD / maxCat) * 100;
    const accentText = isAsset ? 'text-emerald-300' : 'text-amber-300';
    const barColor = isAsset ? 'bg-emerald-500' : 'bg-amber-400';
    return (
      <motion.tr
        key={`${item.category}-${isAsset ? 'a' : 'l'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: i * 0.02 }}
        className="border-white/[0.04] hover:bg-white/[0.03] transition-colors"
      >
        <TableCell className="py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-200">{item.category}</span>
            <div className="h-2 flex-1 max-w-[180px] overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${widthPct}%` }}
                transition={{ duration: 0.5, delay: i * 0.03 }}
                className={`h-full ${barColor}`}
              />
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <span className="font-mono text-[10px] text-zinc-400">{fmtCompactUSD(item.inr)}</span>
        </TableCell>
        <TableCell className="text-right">
          <span className="font-mono text-[10px] text-zinc-300">{fmtCompactUSD(item.usd)}</span>
        </TableCell>
        <TableCell className="text-right">
          <span className="font-mono text-[10px] text-zinc-400">{fmtCompactUSD(item.eur)}</span>
        </TableCell>
        <TableCell className="text-right">
          <span className="font-mono text-[10px] text-zinc-400">{fmtCompactUSD(item.gbp)}</span>
        </TableCell>
        <TableCell className="text-right">
          <span className="font-mono text-[10px] text-zinc-400">{fmtCompactUSD(item.other)}</span>
        </TableCell>
        <TableCell className="text-right">
          <span className={`font-mono text-[11px] font-semibold ${accentText}`}>{fmtCompactUSD(item.totalUSD)}</span>
        </TableCell>
        <TableCell className="text-right">
          <span className="font-mono text-[10px] text-zinc-500">{item.pctOfTotal.toFixed(1)}%</span>
        </TableCell>
      </motion.tr>
    );
  }

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-violet-400" />
          Consolidated Tax Position
          <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
            Multi-currency
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Consolidated balance sheet across all entities — assets vs liabilities by category, multi-currency breakdown (INR/USD/EUR/GBP/Other).
        </p>
      </CardHeader>
      <CardContent>
        {/* Net Position Summary */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Total Assets</div>
            <div className="text-sm font-semibold text-emerald-300">{fmtCompactUSD(totalAssets)}</div>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Total Liabilities</div>
            <div className="text-sm font-semibold text-amber-300">{fmtCompactUSD(totalLiabilities)}</div>
          </div>
          <div className={`rounded-lg border p-2.5 ${netPosition >= 0 ? 'border-teal-500/20 bg-teal-500/[0.05]' : 'border-rose-500/20 bg-rose-500/[0.05]'}`}>
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Net Position</div>
            <div className={`text-sm font-semibold ${netPosition >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>{fmtCompactUSD(netPosition)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Equity Ratio</div>
            <div className="text-sm font-semibold text-violet-300">{((netPosition / totalAssets) * 100).toFixed(1)}%</div>
          </div>
        </div>

        {/* Assets Table */}
        <div className="mb-2 mt-3 flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-emerald-400" />
          <h3 className="text-xs font-semibold text-zinc-200">Consolidated Assets</h3>
          <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            {CONSOLIDATED_ASSETS.length} categories
          </Badge>
        </div>
        <ScrollArea className="max-h-[300px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Category</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">INR</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">USD</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">EUR</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">GBP</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Other</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Total USD</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CONSOLIDATED_ASSETS.map((a, i) => renderRow(a, i, true))}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Liabilities Table */}
        <div className="mb-2 mt-4 flex items-center gap-2">
          <Banknote className="h-3.5 w-3.5 text-amber-400" />
          <h3 className="text-xs font-semibold text-zinc-200">Consolidated Liabilities</h3>
          <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
            {CONSOLIDATED_LIABILITIES.length} categories
          </Badge>
        </div>
        <ScrollArea className="max-h-[300px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Category</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">INR</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">USD</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">EUR</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">GBP</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Other</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Total USD</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CONSOLIDATED_LIABILITIES.map((l, i) => renderRow(l, i, false))}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Multi-currency totals footer */}
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Multi-Currency Totals</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <div className="text-[9px] text-zinc-500">INR (Assets)</div>
              <div className="text-[11px] font-mono text-emerald-300">{fmtCompactUSD(totalsByCurrency.assets.inr)}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">INR (Liab.): {fmtCompactUSD(totalsByCurrency.liabilities.inr)}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500">USD (Assets)</div>
              <div className="text-[11px] font-mono text-emerald-300">{fmtCompactUSD(totalsByCurrency.assets.usd)}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">USD (Liab.): {fmtCompactUSD(totalsByCurrency.liabilities.usd)}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500">EUR (Assets)</div>
              <div className="text-[11px] font-mono text-emerald-300">{fmtCompactUSD(totalsByCurrency.assets.eur)}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">EUR (Liab.): {fmtCompactUSD(totalsByCurrency.liabilities.eur)}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500">GBP (Assets)</div>
              <div className="text-[11px] font-mono text-emerald-300">{fmtCompactUSD(totalsByCurrency.assets.gbp)}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">GBP (Liab.): {fmtCompactUSD(totalsByCurrency.liabilities.gbp)}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500">Other (Assets)</div>
              <div className="text-[11px] font-mono text-emerald-300">{fmtCompactUSD(totalsByCurrency.assets.other)}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">Other (Liab.): {fmtCompactUSD(totalsByCurrency.liabilities.other)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MultiTaxEngine() {
  const [sectionTab, setSectionTab] = useState<'simulator' | 'tp' | 'loss' | 'calendar' | 'recs' | 'credits' | 'payroll' | 'consolidated'>('simulator');

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
              GST, VAT, Sales Tax &amp; Consumption Tax unified — simulate scenarios, transfer pricing, loss tracking &amp; AI recommendations.
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

        {/* ─── Deep Dives: tabbed enterprise sections ─────────────────────────── */}
        <section className="mt-6">
          <TooltipProvider delayDuration={200}>
            <Tabs value={sectionTab} onValueChange={(v) => setSectionTab(v as typeof sectionTab)}>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal-400" />
                  <h2 className="text-sm font-semibold text-zinc-200">Tax Engineering Deep Dives</h2>
                </div>
                <TabsList className="bg-white/[0.03] h-9 overflow-x-auto">
                  <TabsTrigger value="simulator" className="text-[11px]">
                    <Workflow className="mr-1 h-3 w-3" /> Scenario Simulator
                  </TabsTrigger>
                  <TabsTrigger value="tp" className="text-[11px]">
                    <Network className="mr-1 h-3 w-3" /> Transfer Pricing
                  </TabsTrigger>
                  <TabsTrigger value="loss" className="text-[11px]">
                    <PiggyBank className="mr-1 h-3 w-3" /> Loss Tracker
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="text-[11px]">
                    <AlarmClock className="mr-1 h-3 w-3" /> Tax Calendar
                  </TabsTrigger>
                  <TabsTrigger value="recs" className="text-[11px]">
                    <Brain className="mr-1 h-3 w-3" /> Optimization
                  </TabsTrigger>
                  <TabsTrigger value="credits" className="text-[11px]">
                    <Award className="mr-1 h-3 w-3" /> Tax Credits
                  </TabsTrigger>
                  <TabsTrigger value="payroll" className="text-[11px]">
                    <Users className="mr-1 h-3 w-3" /> Global Payroll
                  </TabsTrigger>
                  <TabsTrigger value="consolidated" className="text-[11px]">
                    <BarChart3 className="mr-1 h-3 w-3" /> Consolidated
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="simulator" className="mt-0">
                <TaxScenarioSimulator />
              </TabsContent>
              <TabsContent value="tp" className="mt-0">
                <TransferPricingCalculator />
              </TabsContent>
              <TabsContent value="loss" className="mt-0">
                <LossCarryforwardTracker />
              </TabsContent>
              <TabsContent value="calendar" className="mt-0">
                <TaxCalendar />
              </TabsContent>
              <TabsContent value="recs" className="mt-0">
                <OptimizationRecommendations />
              </TabsContent>
              <TabsContent value="credits" className="mt-0">
                <TaxCreditsDashboard />
              </TabsContent>
              <TabsContent value="payroll" className="mt-0">
                <GlobalPayrollSummary />
              </TabsContent>
              <TabsContent value="consolidated" className="mt-0">
                <ConsolidatedTaxPosition />
              </TabsContent>
            </Tabs>
          </TooltipProvider>
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3 text-emerald-400" />
            Multi-Tax Engine™ · Phase 14 · {TAX_SYSTEMS.length} systems · {COUNTRIES.length} jurisdictions · {TAX_RECS.length} recommendations · {TAX_CREDITS.length} tax credits · {GLOBAL_PAYROLL.length} payroll entities
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-teal-400" /> Founder &amp; Owner: Prince Singh
          </div>
        </footer>
      </div>
    </div>
  );
}
