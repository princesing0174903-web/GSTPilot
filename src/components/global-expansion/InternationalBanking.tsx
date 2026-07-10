'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: INTERNATIONAL BANKING™ (ENHANCED)
//
// Unified banking & payments integration console — 11 banks and payment
// processors across 9 countries, with live cash position dashboard,
// account list, payment routing optimizer, fee analyzer & reconciliation status.
// Pure static data layer (no API, no Math.random).
//
//   • KPI row                       — connected, volume, transactions, fees
//   • Filter tabs                   — All / Connected / Available / Coming Soon
//   • Bank cards grid               — logo, status, region, volume, features
//   • Live Cash Position Dashboard  — total balance, breakdown by bank & currency
//   • Bank Account List             — detailed table of all BANK_BALANCES
//   • Payment Routing Optimizer     — interactive — best rail recommendation
//   • Bank Fee Analyzer             — per bank fee %, trend, cheapest rail
//   • Reconciliation Status         — pending, auto, manual review
//
// Tagline: Every Bank. Every Rail. One Treasury.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Banknote, ArrowRightLeft, Percent, Gauge, Sparkles,
  Landmark, CreditCard, Globe2, ShieldCheck, Plus, CheckCircle2,
  Plug, Activity, Wallet, Route, TrendingDown, TrendingUp,
  FileText, PieChart, Server, RefreshCw, AlertCircle,
  Layers, HandCoins, History, ShieldAlert, Info, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BANK_INTEGRATIONS, fmtUSD, getCountry, BANK_BALANCES,
  type BankIntegration, type CountryCode, type BankBalance,
} from '@/lib/global/data';
import {
  CASH_POOL, INTERCOMPANY_LOANS, AUDIT_TRAIL,
  type CashPoolPosition, type IntercompanyLoan, type AuditEntry,
} from '@/lib/global/data-enterprise';

// ─── Status palette ─────────────────────────────────────────────────────────────

type BankStatus = BankIntegration['status'];

const STATUS_BADGE: Record<BankStatus, string> = {
  connected: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  available: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'coming-soon': 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};

const STATUS_DOT: Record<BankStatus, string> = {
  connected: 'bg-emerald-400',
  available: 'bg-amber-400',
  'coming-soon': 'bg-slate-400',
};

const STATUS_LABEL: Record<BankStatus, string> = {
  connected: 'Connected',
  available: 'Available',
  'coming-soon': 'Coming Soon',
};

// ─── Color palette (NO indigo/blue) — bank.color → accent ───────────────────────
// The data layer lists 'blue' for some banks; we map it to a teal/cyan-safe accent
// so the visual stays inside the emerald/teal/cyan/violet family.

const COLOR_MAP: Record<string, { ring: string; bg: string; text: string; bar: string }> = {
  emerald: { ring: 'border-emerald-500/40 bg-emerald-500/15', bg: 'bg-emerald-500/10', text: 'text-emerald-300', bar: 'bg-emerald-500' },
  teal:    { ring: 'border-teal-500/40 bg-teal-500/15',       bg: 'bg-teal-500/10',    text: 'text-teal-300',    bar: 'bg-teal-400' },
  cyan:    { ring: 'border-cyan-500/40 bg-cyan-500/15',       bg: 'bg-cyan-500/10',    text: 'text-cyan-300',    bar: 'bg-cyan-400' },
  violet:  { ring: 'border-violet-500/40 bg-violet-500/15',   bg: 'bg-violet-500/10',  text: 'text-violet-300',  bar: 'bg-violet-400' },
  amber:   { ring: 'border-amber-500/40 bg-amber-500/15',     bg: 'bg-amber-500/10',   text: 'text-amber-300',   bar: 'bg-amber-400' },
  orange:  { ring: 'border-orange-500/40 bg-orange-500/15',   bg: 'bg-orange-500/10',  text: 'text-orange-300',  bar: 'bg-orange-400' },
  red:     { ring: 'border-rose-500/40 bg-rose-500/15',       bg: 'bg-rose-500/10',    text: 'text-rose-300',    bar: 'bg-rose-400' },
  slate:   { ring: 'border-slate-500/40 bg-slate-500/15',     bg: 'bg-slate-500/10',   text: 'text-slate-300',   bar: 'bg-slate-400' },
  // 'blue' is mapped to teal to keep the palette free of indigo/blue
  blue:    { ring: 'border-teal-500/40 bg-teal-500/15',       bg: 'bg-teal-500/10',    text: 'text-teal-300',    bar: 'bg-teal-400' },
};

function accentFor(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP.slate;
}

// ─── Country flag helper ────────────────────────────────────────────────────────

function flagFor(code: string): string {
  return getCountry(code as CountryCode)?.flag ?? '🏳️';
}

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
      transition={{ duration: 0.35, ease: 'easeOut' as const }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm"
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

// ─── Bank Integration Card ──────────────────────────────────────────────────────

function BankCard({ bank, index }: { bank: BankIntegration; index: number }) {
  const accent = accentFor(bank.color);
  const isConnected = bank.status === 'connected';
  const isAvailable = bank.status === 'available';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' as const }}
      whileHover={{ y: -3 }}
      className={`relative rounded-xl border bg-white/[0.02] p-4 backdrop-blur-sm transition-all ${
        isConnected
          ? 'border-emerald-500/30 hover:border-emerald-500/50 ring-1 ring-emerald-500/20'
          : isAvailable
          ? 'border-amber-500/20 hover:border-amber-500/40'
          : 'border-white/[0.06] hover:border-white/[0.12]'
      }`}
    >
      {/* Status indicator (top-right) */}
      <div className="absolute right-3 top-3">
        <Badge variant="outline" className={`text-[9px] uppercase ${STATUS_BADGE[bank.status]}`}>
          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[bank.status]}`} />
          {STATUS_LABEL[bank.status]}
        </Badge>
      </div>

      {/* Header: logo + name */}
      <div className="flex items-start gap-3 pr-20">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${accent.ring}`}>
          <span className={`text-lg font-bold ${accent.text}`}>{bank.logo}</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-100">{bank.name}</div>
          <div className="mt-0.5 inline-flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-400">
              {bank.type}
            </Badge>
          </div>
        </div>
      </div>

      {/* Region + countries */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Globe2 className="h-3 w-3 text-cyan-300" />
          <span>{bank.region}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {bank.countries.slice(0, 6).map((code) => (
            <span
              key={code}
              className="text-sm"
              title={getCountry(code as CountryCode)?.name ?? code}
            >
              {flagFor(code)}
            </span>
          ))}
          {bank.countries.length > 6 && (
            <span className="ml-1 text-[10px] text-zinc-500">+{bank.countries.length - 6}</span>
          )}
        </div>
      </div>

      <Separator className="my-3 bg-white/[0.06]" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-black/30 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Tx (mo)</div>
          <div className="mt-0.5 text-xs font-semibold text-zinc-200">
            {bank.transactions > 0 ? bank.transactions.toLocaleString() : '—'}
          </div>
        </div>
        <div className="rounded-md bg-black/30 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Volume</div>
          <div className="mt-0.5 text-xs font-semibold text-emerald-300">
            {bank.volume > 0 ? fmtUSD(bank.volume) : '—'}
          </div>
        </div>
        <div className="rounded-md bg-black/30 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Fees</div>
          <div className="mt-0.5 text-xs font-semibold text-amber-300">{bank.fees}</div>
        </div>
      </div>

      {/* Features */}
      <div className="mt-3 flex flex-wrap gap-1">
        {bank.features.map((f) => (
          <span
            key={f}
            className="inline-flex items-center rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] text-zinc-400"
          >
            {f}
          </span>
        ))}
      </div>

      {/* Action */}
      <div className="mt-3 flex items-center justify-between">
        {isConnected ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Active integration
          </span>
        ) : isAvailable ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-dashed border-amber-500/40 bg-amber-500/5 text-[11px] text-amber-300 hover:bg-amber-500/15 hover:text-amber-200"
          >
            <Plus className="mr-1 h-3 w-3" /> Connect
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
            <Plug className="h-3 w-3" /> Pending integration
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10px] text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]"
        >
          Details
        </Button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Live Cash Position Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

function LiveCashPositionDashboard() {
  const totals = useMemo(() => {
    const totalBalance = BANK_BALANCES.reduce((s, b) => s + b.balanceUSD, 0);
    const totalAvailable = BANK_BALANCES.reduce((s, b) => s + b.available, 0);
    const totalPending = BANK_BALANCES.reduce((s, b) => s + b.pending, 0);
    return { totalBalance, totalAvailable, totalPending };
  }, []);

  const byBank = useMemo(() => {
    const map = new Map<string, { name: string; total: number; color: string; logo: string }>();
    for (const b of BANK_BALANCES) {
      const cur = map.get(b.bankId) ?? {
        name: b.bankName,
        total: 0,
        color: BANK_INTEGRATIONS.find((bi) => bi.id === b.bankId)?.color ?? 'slate',
        logo: BANK_INTEGRATIONS.find((bi) => bi.id === b.bankId)?.logo ?? '?',
      };
      cur.total += b.balanceUSD;
      map.set(b.bankId, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, []);

  const byCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of BANK_BALANCES) {
      map.set(b.currency, (map.get(b.currency) ?? 0) + b.balanceUSD);
    }
    return Array.from(map.entries())
      .map(([currency, total]) => ({ currency, total }))
      .sort((a, b) => b.total - a.total);
  }, []);

  const maxBankTotal = byBank.length > 0 ? byBank[0].total : 1;
  const totalForDonut = byCurrency.reduce((s, c) => s + c.total, 0);
  const DONUT_COLORS = ['#10b981', '#14b8a6', '#06b6d4', '#a78bfa', '#f59e0b', '#fb7185', '#84cc16', '#f97316'];

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-emerald-400" />
              Live Cash Position Dashboard
              <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <span className="relative mr-1.5 inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Live
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Real-time aggregated balances across all connected banks &amp; currencies.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-2.5 py-1.5">
              <div className="text-[9px] uppercase text-emerald-300/80">Total Balance</div>
              <div className="text-xs font-semibold text-emerald-300">{fmtUSD(totals.totalBalance)}</div>
            </div>
            <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.05] px-2.5 py-1.5">
              <div className="text-[9px] uppercase text-teal-300/80">Available</div>
              <div className="text-xs font-semibold text-teal-300">{fmtUSD(totals.totalAvailable)}</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-2.5 py-1.5">
              <div className="text-[9px] uppercase text-amber-300/80">Pending</div>
              <div className="text-xs font-semibold text-amber-300">{fmtUSD(totals.totalPending)}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left: breakdown by bank (horizontal bars) */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Breakdown by Bank</span>
              <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-400">
                {byBank.length} banks
              </Badge>
            </div>
            <ScrollArea className="max-h-[340px] pr-2">
              <div className="space-y-2">
                {byBank.map((b, i) => {
                  const accent = accentFor(b.color);
                  return (
                    <motion.div
                      key={b.name}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${accent.ring}`}>
                            <span className={`text-[11px] font-bold ${accent.text}`}>{b.logo}</span>
                          </div>
                          <span className="text-xs font-medium text-zinc-200 truncate">{b.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-emerald-300">{fmtUSD(b.total)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(b.total / maxBankTotal) * 100}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}
                          className={`h-full ${accent.bar}`}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500">
                        <span>{((b.total / totals.totalBalance) * 100).toFixed(1)}% of total</span>
                        <span className="font-mono">${(b.total / 1000).toFixed(1)}K</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right: donut chart by currency */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Breakdown by Currency</span>
              <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-400">
                {byCurrency.length} currencies
              </Badge>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              {/* Donut */}
              <div className="relative h-40 w-40 shrink-0">
                <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
                  {byCurrency.reduce<{ segments: { currency: string; pct: number; offset: number; color: string }[]; acc: number }>(
                    (accState, c, i) => {
                      const pct = (c.total / totalForDonut) * 100;
                      accState.segments.push({
                        currency: c.currency,
                        pct,
                        offset: accState.acc,
                        color: DONUT_COLORS[i % DONUT_COLORS.length],
                      });
                      accState.acc += pct;
                      return accState;
                    },
                    { segments: [], acc: 0 },
                  ).segments.map((seg) => (
                    <motion.circle
                      key={seg.currency}
                      cx="21"
                      cy="21"
                      r="15.9155"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="3.5"
                      strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
                      strokeDashoffset={-seg.offset}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500">Total</div>
                  <div className="text-xs font-bold text-zinc-100">{fmtUSD(totals.totalBalance)}</div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-1.5 self-stretch overflow-y-auto pr-1">
                {byCurrency.map((c, i) => (
                  <div key={c.currency} className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-zinc-300">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      {c.currency}
                    </span>
                    <span className="font-mono text-zinc-400">
                      {fmtUSD(c.total)} <span className="text-zinc-600">({((c.total / totalForDonut) * 100).toFixed(1)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Bank Account List (table)
// ═══════════════════════════════════════════════════════════════════════════════

function BankAccountList() {
  const [search, setSearch] = useState<string>('');
  const filtered = useMemo(() => {
    if (!search) return BANK_BALANCES;
    const q = search.toLowerCase();
    return BANK_BALANCES.filter(
      (b) => b.bankName.toLowerCase().includes(q) || b.currency.toLowerCase().includes(q) || b.accountType.toLowerCase().includes(q),
    );
  }, [search]);

  const totalUSD = filtered.reduce((s, b) => s + b.balanceUSD, 0);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-teal-400" />
              Bank Account List
              <Badge variant="outline" className="text-[9px] border-teal-500/30 bg-teal-500/10 text-teal-300">
                {filtered.length} accounts
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Detailed ledger of every connected account with masked numbers, balance &amp; sync status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Search bank, currency, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[240px] border-white/10 bg-white/[0.02] text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[460px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Bank</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Account Type</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Account #</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Currency</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Balance</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Balance (USD)</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Available</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Pending</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Last Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filtered.map((b, i) => {
                  const integration = BANK_INTEGRATIONS.find((bi) => bi.id === b.bankId);
                  const accent = accentFor(integration?.color ?? 'slate');
                  return (
                    <motion.tr
                      key={`${b.bankId}-${b.accountNumber}`}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className="border-white/[0.04] hover:bg-white/[0.03]"
                    >
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${accent.ring}`}>
                            <span className={`text-[11px] font-bold ${accent.text}`}>{integration?.logo ?? '?'}</span>
                          </div>
                          <span className="text-xs font-medium text-zinc-200">{b.bankName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-300">
                          {b.accountType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[11px] text-zinc-400">{b.accountNumber}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-medium text-cyan-300">{b.currency}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-zinc-200">
                          {b.currency === 'JPY' || b.currency === 'INR'
                            ? b.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })
                            : b.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono font-semibold text-emerald-300">{fmtUSD(b.balanceUSD)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-teal-300">{fmtUSD(b.available)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-[11px] font-mono ${b.pending > 0 ? 'text-amber-300' : 'text-zinc-600'}`}>
                          {b.pending > 0 ? fmtUSD(b.pending) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                          <RefreshCw className="h-2.5 w-2.5 text-emerald-400" />
                          {b.lastSync}
                        </span>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
          <span className="text-[11px] text-zinc-400">Total across {filtered.length} accounts</span>
          <span className="text-sm font-bold text-emerald-300">{fmtUSD(totalUSD)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Payment Routing Optimizer
// ═══════════════════════════════════════════════════════════════════════════════

interface Rail {
  id: string;
  name: string;
  feePct: number;
  feeFixed: number;
  fxMarkupPct: number;
  speedHours: number;
  maxAmount: number;
  pros: string[];
  cons: string[];
  color: string;
}

const RAILS: Rail[] = [
  {
    id: 'stripe', name: 'Stripe', feePct: 2.9, feeFixed: 0.30, fxMarkupPct: 1.0, speedHours: 2, maxAmount: 1000000,
    pros: ['Fast settlement', 'Wide country support', 'Excellent developer API'],
    cons: ['Higher fees', 'FX markup applied'],
    color: 'violet',
  },
  {
    id: 'wise', name: 'Wise', feePct: 0.41, feeFixed: 0, fxMarkupPct: 0, speedHours: 24, maxAmount: 1000000,
    pros: ['Mid-market FX rate', 'Lowest fees', 'Borderless accounts'],
    cons: ['Slower than card', 'Limited country coverage'],
    color: 'emerald',
  },
  {
    id: 'hsbc', name: 'HSBC', feePct: 0.15, feeFixed: 25, fxMarkupPct: 0.3, speedHours: 48, maxAmount: 50000000,
    pros: ['Enterprise scale', 'Custom rates', 'Trade finance'],
    cons: ['Higher fixed fee', 'Longer settlement'],
    color: 'red',
  },
];

function PaymentRoutingOptimizer() {
  const [srcCurrency, setSrcCurrency] = useState<string>('USD');
  const [dstCurrency, setDstCurrency] = useState<string>('INR');
  const [amount, setAmount] = useState<string>('50000');

  const parsed = Number(amount) || 0;

  const quotes = useMemo(() => {
    return RAILS.map((r) => {
      const pctFee = (parsed * r.feePct) / 100;
      const fxMarkup = (parsed * r.fxMarkupPct) / 100;
      const totalFee = pctFee + r.feeFixed + fxMarkup;
      const net = Math.max(0, parsed - totalFee);
      return { ...r, pctFee, fxMarkup, totalFee, net };
    }).sort((a, b) => b.net - a.net);
  }, [parsed]);

  const best = quotes[0];
  const worst = quotes[quotes.length - 1];
  const savings = best && worst ? worst.totalFee - best.totalFee : 0;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="h-4 w-4 text-violet-400" />
          Payment Routing Optimizer
          <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
            Smart routing
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Compare cost &amp; speed across rails — recommends the best route based on amount &amp; currency pair.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Source Currency</label>
            <Select value={srcCurrency} onValueChange={setSrcCurrency}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AED', 'AUD', 'CAD', 'SGD'].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Destination Currency</label>
            <Select value={dstCurrency} onValueChange={setDstCurrency}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AED', 'AUD', 'CAD', 'SGD'].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Amount ({srcCurrency})</label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-white/10 bg-white/[0.02] text-zinc-100"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Currency pair banner */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg font-mono font-semibold text-cyan-300">{srcCurrency}</span>
            <ArrowRightLeft className="h-4 w-4 text-zinc-500" />
            <span className="text-lg font-mono font-semibold text-emerald-300">{dstCurrency}</span>
            <span className="ml-2 text-[11px] text-zinc-500">Cross-border transfer</span>
          </div>
          {best && (
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Recommended: {best.name} · Save {fmtUSD(savings)}
            </Badge>
          )}
        </div>

        {/* Rail comparison */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quotes.map((q, i) => {
            const accent = accentFor(q.color);
            const isBest = i === 0;
            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={`rounded-xl border p-3 ${
                  isBest
                    ? 'border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md border ${accent.ring}`}>
                      <span className={`text-[11px] font-bold ${accent.text}`}>{q.name[0]}</span>
                    </div>
                    <span className="text-xs font-semibold text-zinc-100">{q.name}</span>
                  </div>
                  {isBest && (
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      Best
                    </Badge>
                  )}
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500">Pct Fee ({q.feePct}%)</span>
                    <span className="font-mono text-amber-300">{fmtUSD(q.pctFee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500">Fixed Fee</span>
                    <span className="font-mono text-zinc-300">{fmtUSD(q.feeFixed)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500">FX Markup ({q.fxMarkupPct}%)</span>
                    <span className="font-mono text-rose-300">{fmtUSD(q.fxMarkup)}</span>
                  </div>
                  <Separator className="my-1 bg-white/[0.06]" />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Total Fee</span>
                    <span className="font-mono font-semibold text-rose-300">{fmtUSD(q.totalFee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Net Received</span>
                    <span className={`font-mono font-bold ${isBest ? 'text-emerald-300' : 'text-zinc-200'}`}>
                      {fmtUSD(q.net)}
                    </span>
                  </div>
                </div>

                <Separator className="my-2 bg-white/[0.06]" />

                <div className="flex items-center justify-between text-[10px]">
                  <span className="inline-flex items-center gap-1 text-zinc-400">
                    <Activity className="h-3 w-3 text-cyan-300" /> Speed
                  </span>
                  <span className="font-mono text-cyan-300">
                    {q.speedHours < 24 ? `${q.speedHours}h` : `${(q.speedHours / 24).toFixed(1)}d`}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {q.pros.map((p) => (
                    <div key={p} className="inline-flex items-center gap-1 text-[9px] text-emerald-300/80">
                      <CheckCircle2 className="h-2.5 w-2.5" /> {p}
                    </div>
                  ))}
                  {q.cons.map((c) => (
                    <div key={c} className="inline-flex items-center gap-1 text-[9px] text-zinc-500">
                      <AlertCircle className="h-2.5 w-2.5" /> {c}
                    </div>
                  ))}
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
// ENHANCED — Bank Fee Analyzer
// ═══════════════════════════════════════════════════════════════════════════════

interface BankFeeStat {
  id: string;
  name: string;
  logo: string;
  color: string;
  feePct: number;
  monthlyVolume: number;
  monthlyFee: number;
  trend: 'up' | 'down' | 'flat';
  trendValue: number;
  cheapestRail: boolean;
}

function BankFeeAnalyzer() {
  const stats: BankFeeStat[] = useMemo(() => {
    const list: BankFeeStat[] = BANK_INTEGRATIONS
      .filter((b) => b.status === 'connected' && b.volume > 0)
      .map((b) => {
        const match = b.fees.match(/([\d.]+)%/);
        const feePct = match ? Number(match[1]) : 0;
        const monthlyFee = (b.volume * feePct) / 100;
        return {
          id: b.id,
          name: b.name,
          logo: b.logo,
          color: b.color,
          feePct,
          monthlyVolume: b.volume,
          monthlyFee,
          trend: feePct > 2 ? 'up' : feePct > 0.5 ? 'flat' : 'down',
          trendValue: feePct > 2 ? 0.4 : feePct > 0.5 ? 0 : -0.15,
          cheapestRail: false,
        };
      });
    if (list.length > 0) {
      const min = Math.min(...list.map((l) => l.feePct));
      list.forEach((l) => { l.cheapestRail = l.feePct === min; });
    }
    return list.sort((a, b) => a.feePct - b.feePct);
  }, []);

  const totalFees = stats.reduce((s, b) => s + b.monthlyFee, 0);
  const totalVolume = stats.reduce((s, b) => s + b.monthlyVolume, 0);
  const blendedRate = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="h-4 w-4 text-amber-400" />
              Bank Fee Analyzer
              <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
                {stats.length} banks
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Per-bank effective fee rate, monthly cost &amp; trend — identifies the cheapest rail.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
              Monthly Fees: {fmtUSD(totalFees)}
            </Badge>
            <Badge variant="outline" className="text-[9px] border-teal-500/30 bg-teal-500/10 text-teal-300">
              Blended Rate: {blendedRate.toFixed(2)}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[420px] pr-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s, i) => {
              const accent = accentFor(s.color);
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className={`rounded-xl border p-3 ${
                    s.cheapestRail
                      ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${accent.ring}`}>
                        <span className={`text-[11px] font-bold ${accent.text}`}>{s.logo}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-zinc-100">{s.name}</div>
                        <div className="text-[10px] text-zinc-500">{fmtUSD(s.monthlyVolume)}/mo</div>
                      </div>
                    </div>
                    {s.cheapestRail && (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shrink-0">
                        Cheapest
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2.5 space-y-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500">Fee Rate</span>
                        <span className={`font-mono font-semibold ${s.feePct > 2 ? 'text-rose-300' : s.feePct > 0.5 ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {s.feePct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(s.feePct * 25, 100)}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full ${s.feePct > 2 ? 'bg-rose-500' : s.feePct > 0.5 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="rounded bg-black/30 px-2 py-1">
                        <div className="text-[9px] text-zinc-500">Monthly Fee</div>
                        <div className="text-[11px] font-semibold text-amber-300">{fmtUSD(s.monthlyFee)}</div>
                      </div>
                      <div className="rounded bg-black/30 px-2 py-1">
                        <div className="text-[9px] text-zinc-500">Trend (QoQ)</div>
                        <div className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${
                          s.trend === 'up' ? 'text-rose-300' : s.trend === 'down' ? 'text-emerald-300' : 'text-zinc-400'
                        }`}>
                          {s.trend === 'up' ? <TrendingUp className="h-2.5 w-2.5" /> : s.trend === 'down' ? <TrendingDown className="h-2.5 w-2.5" /> : <Activity className="h-2.5 w-2.5" />}
                          {s.trend === 'up' ? '+' : s.trend === 'down' ? '' : '±'}{Math.abs(s.trendValue).toFixed(2)}pp
                        </div>
                      </div>
                    </div>
                  </div>

                  {s.cheapestRail && (
                    <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-1 text-[9px] text-emerald-300">
                      <CheckCircle2 className="mr-1 inline h-2.5 w-2.5" />
                      Recommended primary rail — route volume here to save {fmtUSD(totalFees * 0.3)}/mo
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
            <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Cheapest Rail</div>
            <div className="mt-0.5 text-sm font-semibold text-emerald-300">
              {stats[0]?.name ?? '—'} ({stats[0]?.feePct.toFixed(2) ?? '0'}%)
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3">
            <div className="text-[10px] uppercase tracking-wide text-amber-300/80">Avg Rate</div>
            <div className="mt-0.5 text-sm font-semibold text-amber-300">
              {(stats.reduce((s, b) => s + b.feePct, 0) / (stats.length || 1)).toFixed(2)}%
            </div>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] p-3">
            <div className="text-[10px] uppercase tracking-wide text-rose-300/80">Most Expensive</div>
            <div className="mt-0.5 text-sm font-semibold text-rose-300">
              {stats[stats.length - 1]?.name ?? '—'} ({stats[stats.length - 1]?.feePct.toFixed(2) ?? '0'}%)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Reconciliation Status
// ═══════════════════════════════════════════════════════════════════════════════

interface ReconStatus {
  bankId: string;
  bankName: string;
  logo: string;
  color: string;
  pending: number;
  autoReconciled: number;
  manualReview: number;
  total: number;
  lastRecon: string;
}

const RECON_STATUSES: ReconStatus[] = [
  { bankId: 'hsbc', bankName: 'HSBC', logo: 'H', color: 'red', pending: 12, autoReconciled: 248, manualReview: 8, total: 268, lastRecon: '5 min ago' },
  { bankId: 'citibank', bankName: 'Citibank', logo: 'C', color: 'teal', pending: 5, autoReconciled: 184, manualReview: 4, total: 193, lastRecon: '12 min ago' },
  { bankId: 'stripe', bankName: 'Stripe', logo: 'S', color: 'violet', pending: 28, autoReconciled: 1842, manualReview: 12, total: 1882, lastRecon: 'Just now' },
  { bankId: 'razorpay', bankName: 'Razorpay', logo: 'R', color: 'teal', pending: 42, autoReconciled: 3284, manualReview: 24, total: 3350, lastRecon: 'Just now' },
  { bankId: 'wise', bankName: 'Wise', logo: 'W', color: 'emerald', pending: 3, autoReconciled: 312, manualReview: 2, total: 317, lastRecon: '8 min ago' },
  { bankId: 'mercury', bankName: 'Mercury', logo: 'M', color: 'orange', pending: 6, autoReconciled: 148, manualReview: 3, total: 157, lastRecon: '15 min ago' },
];

function ReconciliationStatus() {
  const totals = useMemo(() => {
    const totalPending = RECON_STATUSES.reduce((s, r) => s + r.pending, 0);
    const totalAuto = RECON_STATUSES.reduce((s, r) => s + r.autoReconciled, 0);
    const totalManual = RECON_STATUSES.reduce((s, r) => s + r.manualReview, 0);
    const totalAll = RECON_STATUSES.reduce((s, r) => s + r.total, 0);
    return { totalPending, totalAuto, totalManual, totalAll };
  }, []);

  const autoPct = totals.totalAll > 0 ? (totals.totalAuto / totals.totalAll) * 100 : 0;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-cyan-400" />
              Reconciliation Status
              <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                {RECON_STATUSES.length} banks
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Pending reconciliations, auto-match rate &amp; manual review queue across all institutions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
              Pending: {totals.totalPending}
            </Badge>
            <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Auto-reconciled: {totals.totalAuto}
            </Badge>
            <Badge variant="outline" className="text-[9px] border-rose-500/30 bg-rose-500/10 text-rose-300">
              Manual review: {totals.totalManual}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Auto-reconciliation progress */}
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium text-zinc-200">Auto-reconciliation Rate</span>
            </div>
            <span className="text-xs font-semibold text-emerald-300">{autoPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${autoPct}%` }}
              transition={{ duration: 0.7 }}
              className="h-full bg-emerald-500"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
            <span>{totals.totalAuto.toLocaleString()} of {totals.totalAll.toLocaleString()} transactions auto-matched</span>
            <span>{totals.totalManual} need manual review · {totals.totalPending} pending</span>
          </div>
        </div>

        <ScrollArea className="max-h-[380px] pr-2">
          <div className="space-y-2">
            {RECON_STATUSES.map((r, i) => {
              const accent = accentFor(r.color);
              const autoPct = (r.autoReconciled / r.total) * 100;
              return (
                <motion.div
                  key={r.bankId}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${accent.ring}`}>
                        <span className={`text-[11px] font-bold ${accent.text}`}>{r.logo}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-zinc-100">{r.bankName}</div>
                        <div className="text-[10px] text-zinc-500">Last recon: {r.lastRecon}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-500">{r.total.toLocaleString()} total</div>
                      <div className="text-[10px] font-mono text-emerald-300">{autoPct.toFixed(0)}% auto</div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <div className="rounded bg-amber-500/10 px-1.5 py-1 text-center">
                      <div className="text-[9px] text-amber-300/80">Pending</div>
                      <div className="text-[11px] font-semibold text-amber-300">{r.pending}</div>
                    </div>
                    <div className="rounded bg-emerald-500/10 px-1.5 py-1 text-center">
                      <div className="text-[9px] text-emerald-300/80">Auto</div>
                      <div className="text-[11px] font-semibold text-emerald-300">{r.autoReconciled}</div>
                    </div>
                    <div className="rounded bg-rose-500/10 px-1.5 py-1 text-center">
                      <div className="text-[9px] text-rose-300/80">Manual</div>
                      <div className="text-[11px] font-semibold text-rose-300">{r.manualReview}</div>
                    </div>
                  </div>

                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${autoPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            <span className="text-[11px] text-zinc-300">
              AI matching handles <span className="font-semibold text-emerald-300">{autoPct.toFixed(1)}%</span> of transactions automatically
            </span>
          </div>
          <Button size="sm" variant="outline" className="h-7 border-emerald-500/30 bg-emerald-500/5 text-[10px] text-emerald-300 hover:bg-emerald-500/15">
            <RefreshCw className="mr-1 h-3 w-3" /> Run AI Recon
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE — Cash Pool Management
// ═══════════════════════════════════════════════════════════════════════════════

const SWEEP_BADGE: Record<CashPoolPosition['sweepStatus'], string> = {
  swept: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  manual: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const SWEEP_DOT: Record<CashPoolPosition['sweepStatus'], string> = {
  swept: 'bg-emerald-400',
  pending: 'bg-amber-400',
  manual: 'bg-rose-400',
};

function CashPoolManagement() {
  const totals = useMemo(() => {
    const totalPool = CASH_POOL.reduce((s, c) => s + c.balanceUSD, 0);
    const participants = CASH_POOL.filter((c) => c.accountType === 'Participant').length;
    const avgRate = CASH_POOL.reduce((s, c) => s + c.interestRate, 0) / CASH_POOL.length;
    const sweptCount = CASH_POOL.filter((c) => c.sweepStatus === 'swept').length;
    const automationPct = (sweptCount / CASH_POOL.length) * 100;
    return { totalPool, participants, avgRate, automationPct };
  }, []);

  const kpiTiles: { icon: LucideIcon; label: string; value: string; sub: string; accent: 'emerald' | 'teal' | 'cyan' | 'violet' }[] = [
    { icon: Layers, label: 'Total Pool USD', value: fmtUSD(totals.totalPool), sub: 'Across all positions', accent: 'emerald' },
    { icon: Building2, label: 'Participants', value: String(totals.participants), sub: 'Sweeping into SG header', accent: 'teal' },
    { icon: Percent, label: 'Avg Interest Rate', value: `${totals.avgRate.toFixed(2)}%`, sub: 'Weighted deposit yield', accent: 'cyan' },
    { icon: RefreshCw, label: 'Sweep Automation', value: `${totals.automationPct.toFixed(0)}%`, sub: 'Auto-swept daily', accent: 'violet' },
  ];

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-emerald-400" />
              Cash Pool Management
              <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                {CASH_POOL.length} positions
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Multi-entity notional cash pool — daily sweeps into Singapore Treasury Header account.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpiTiles.map((t) => <KpiTile key={t.label} {...t} />)}
        </div>

        <ScrollArea className="max-h-[460px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Entity</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Account</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Balance</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Balance (USD)</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Sweep</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Rate</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Last Sweep</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {CASH_POOL.map((p, i) => {
                  const isHeader = p.accountType === 'Header';
                  return (
                    <motion.tr
                      key={p.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className={`border-white/[0.04] hover:bg-white/[0.03] ${
                        isHeader ? 'bg-emerald-500/[0.04] ring-1 ring-inset ring-emerald-500/20' : ''
                      }`}
                    >
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">{flagFor(p.countryCode)}</span>
                          <span className={`text-xs font-medium ${isHeader ? 'text-emerald-200' : 'text-zinc-200'}`}>
                            {p.entity}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isHeader
                              ? 'text-[9px] border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                              : 'text-[9px] border-white/10 bg-white/[0.02] text-zinc-300'
                          }
                        >
                          {p.accountType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-mono text-zinc-300">
                          {p.currency === 'JPY' || p.currency === 'INR'
                            ? p.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })
                            : p.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="ml-1 text-[10px] text-cyan-300">{p.currency}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono font-semibold text-emerald-300">{fmtUSD(p.balanceUSD)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${SWEEP_BADGE[p.sweepStatus]}`}>
                          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${SWEEP_DOT[p.sweepStatus]}`} />
                          {p.sweepStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-teal-300">{p.interestRate.toFixed(2)}%</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] text-zinc-500 font-mono">{p.lastSweep}</span>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
          <span className="text-[11px] text-zinc-400">
            Total pool · {CASH_POOL.length} positions · header SG Treasury sweep
          </span>
          <span className="text-sm font-bold text-emerald-300">{fmtUSD(totals.totalPool)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE — Intercompany Loans Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

const LOAN_STATUS_BADGE: Record<IntercompanyLoan['status'], string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  repaid: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  restructured: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

function IntercompanyLoansDashboard() {
  const stats = useMemo(() => {
    const totalOutstanding = INTERCOMPANY_LOANS.reduce((s, l) => s + l.outstanding, 0);
    const weightedRate =
      INTERCOMPANY_LOANS.reduce((s, l) => s + l.interestRate * l.outstanding, 0) /
      Math.max(1, INTERCOMPANY_LOANS.reduce((s, l) => s + l.outstanding, 0));
    const nextDates = INTERCOMPANY_LOANS.map((l) => l.nextPayment).sort();
    return { totalOutstanding, weightedRate, nextPayment: nextDates[0] };
  }, []);

  const kpiTiles: { icon: LucideIcon; label: string; value: string; sub: string; accent: 'emerald' | 'teal' | 'cyan' | 'violet' }[] = [
    { icon: HandCoins, label: 'Total Outstanding', value: fmtUSD(stats.totalOutstanding), sub: `${INTERCOMPANY_LOANS.length} active loans`, accent: 'emerald' },
    { icon: Percent, label: 'Weighted Avg Rate', value: `${stats.weightedRate.toFixed(2)}%`, sub: 'Outstanding-weighted', accent: 'teal' },
    { icon: RefreshCw, label: 'Next Payment', value: stats.nextPayment, sub: 'Upcoming principal + interest', accent: 'cyan' },
    { icon: Building2, label: 'Lender Entities', value: String(new Set(INTERCOMPANY_LOANS.map((l) => l.lender)).size), sub: 'Treasury hub structure', accent: 'violet' },
  ];

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="h-4 w-4 text-teal-400" />
          Intercompany Loans Dashboard
          <Badge variant="outline" className="text-[9px] border-teal-500/30 bg-teal-500/10 text-teal-300">
            {INTERCOMPANY_LOANS.length} loans
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Arm's-length intercompany financing — Treasury Pte Ltd is the global lending hub.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpiTiles.map((t) => <KpiTile key={t.label} {...t} />)}
        </div>

        <ScrollArea className="max-h-[480px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Lender → Borrower</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Principal</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Outstanding</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Rate</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Term</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Next Payment</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {INTERCOMPANY_LOANS.map((l, i) => (
                  <motion.tr
                    key={l.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className="border-white/[0.04] hover:bg-white/[0.03]"
                  >
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-base leading-none">{flagFor(l.lenderCountry)}</span>
                        <span className="text-zinc-200 font-medium truncate max-w-[140px]">{l.lender}</span>
                        <ArrowRightLeft className="h-3 w-3 text-zinc-500 mx-0.5" />
                        <span className="text-base leading-none">{flagFor(l.borrowerCountry)}</span>
                        <span className="text-zinc-300 truncate max-w-[140px]">{l.borrower}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-[11px] font-mono text-zinc-300">
                        {l.principal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        <span className="ml-1 text-[10px] text-cyan-300">{l.currency}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">{fmtUSD(l.principalUSD)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono font-semibold text-emerald-300">{fmtUSD(l.outstanding)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono text-teal-300">{l.interestRate.toFixed(2)}%</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] text-zinc-300">{l.term}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] text-zinc-400 font-mono">{l.nextPayment}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] capitalize ${LOAN_STATUS_BADGE[l.status]}`}>
                        {l.status}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE — Global Audit Trail
// ═══════════════════════════════════════════════════════════════════════════════

const SEVERITY_BORDER: Record<AuditEntry['severity'], string> = {
  info: 'border-l-cyan-500/60',
  warning: 'border-l-amber-500/70',
  critical: 'border-l-rose-500/80',
};

const SEVERITY_DOT: Record<AuditEntry['severity'], string> = {
  info: 'bg-cyan-400',
  warning: 'bg-amber-400',
  critical: 'bg-rose-500',
};

const SEVERITY_BADGE: Record<AuditEntry['severity'], string> = {
  info: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const SEVERITY_ICON: Record<AuditEntry['severity'], LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
};

function GlobalAuditTrail() {
  const [severityFilter, setSeverityFilter] = useState<'all' | AuditEntry['severity']>('all');

  const filtered = useMemo(() => {
    if (severityFilter === 'all') return AUDIT_TRAIL;
    return AUDIT_TRAIL.filter((e) => e.severity === severityFilter);
  }, [severityFilter]);

  const counts = useMemo(() => ({
    info: AUDIT_TRAIL.filter((e) => e.severity === 'info').length,
    warning: AUDIT_TRAIL.filter((e) => e.severity === 'warning').length,
    critical: AUDIT_TRAIL.filter((e) => e.severity === 'critical').length,
  }), []);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-violet-400" />
              Global Audit Trail
              <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
                {AUDIT_TRAIL.length} entries
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Immutable activity log across banking, compliance, FX, payroll &amp; security modules.
            </p>
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'info', 'warning', 'critical'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverityFilter(s)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider transition-all ${
                  severityFilter === s
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                    : 'bg-white/[0.02] text-zinc-400 border border-white/[0.06] hover:text-zinc-200'
                }`}
              >
                {s}
                <span className="ml-1 text-zinc-500">
                  {s === 'all' ? AUDIT_TRAIL.length : counts[s as AuditEntry['severity']]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[560px] pr-2">
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {filtered.map((entry, i) => {
                const SevIcon = SEVERITY_ICON[entry.severity];
                return (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    className={`rounded-lg border border-white/[0.06] border-l-2 ${SEVERITY_BORDER[entry.severity]} bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${SEVERITY_BADGE[entry.severity]}`}>
                        <SevIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-mono text-zinc-500">{entry.timestamp}</span>
                          <Badge variant="outline" className={`text-[9px] ${SEVERITY_BADGE[entry.severity]}`}>
                            <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${SEVERITY_DOT[entry.severity]}`} />
                            {entry.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                            {entry.action}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-400">
                            {entry.module}
                          </Badge>
                          {entry.countryCode === 'GLOBAL' ? (
                            <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                              🌐 GLOBAL
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] border-teal-500/30 bg-teal-500/10 text-teal-300">
                              {flagFor(entry.countryCode as CountryCode)} {entry.countryCode}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 text-[12px] text-zinc-200">{entry.detail}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
                          <span>
                            <span className="text-zinc-600">Actor:</span>{' '}
                            <span className="font-mono text-zinc-300">{entry.actor}</span>
                          </span>
                          <span>
                            <span className="text-zinc-600">Entity:</span>{' '}
                            <span className="font-mono text-zinc-300">{entry.entityType} · {entry.entityId}</span>
                          </span>
                          <span>
                            <span className="text-zinc-600">IP:</span>{' '}
                            <span className="font-mono text-zinc-300">{entry.ipAddress}</span>
                          </span>
                        </div>
                      </div>
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

// ─── Main Component ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'connected' | 'available' | 'coming-soon';

export default function InternationalBanking() {
  const [tab, setTab] = useState<FilterTab>('all');
  const [sectionTab, setSectionTab] = useState<'cash' | 'accounts' | 'routing' | 'fees' | 'recon' | 'pool' | 'loans' | 'audit'>('cash');

  const filtered = useMemo(() => {
    if (tab === 'all') return BANK_INTEGRATIONS;
    return BANK_INTEGRATIONS.filter((b) => b.status === tab);
  }, [tab]);

  const stats = useMemo(() => {
    const connected = BANK_INTEGRATIONS.filter((b) => b.status === 'connected');
    const totalVolume = connected.reduce((s, b) => s + b.volume, 0);
    const totalTx = connected.reduce((s, b) => s + b.transactions, 0);
    // Avg fees approximation — parse percentage strings
    const feePcts = connected
      .map((b) => {
        const match = b.fees.match(/([\d.]+)%/);
        return match ? Number(match[1]) : null;
      })
      .filter((v): v is number => v !== null);
    const avgFees = feePcts.length > 0 ? feePcts.reduce((s, v) => s + v, 0) / feePcts.length : 0;
    return {
      connectedCount: connected.length,
      totalVolume,
      totalTx,
      avgFees,
    };
  }, []);

  const totalCash = useMemo(() => BANK_BALANCES.reduce((s, b) => s + b.balanceUSD, 0), []);

  const KPI_TILES: KpiTileProps[] = [
    {
      icon: Building2, label: 'Total Connected', value: String(stats.connectedCount),
      sub: `${BANK_INTEGRATIONS.length} integrations available`, accent: 'emerald',
    },
    {
      icon: Banknote, label: 'Total Cash', value: fmtUSD(totalCash),
      sub: 'Across all bank accounts', accent: 'teal',
    },
    {
      icon: ArrowRightLeft, label: 'Total Transactions', value: stats.totalTx.toLocaleString(),
      sub: 'Monthly transactions', accent: 'cyan',
    },
    {
      icon: Percent, label: 'Avg Fees', value: `${stats.avgFees.toFixed(2)}%`,
      sub: 'Across connected processors', accent: 'violet',
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
          className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-300">
              <Gauge className="h-3 w-3" /> Phase 14 · Global Expansion
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              International Banking<span className="text-emerald-400">™</span>
            </h1>
            <p className="text-sm text-zinc-400">
              Connect every bank, payment processor &amp; cross-border rail — unified treasury in one console.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <span className="relative mr-1.5 inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {stats.connectedCount} Connected
            </Badge>
            <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-300">
              <Landmark className="mr-1 h-3 w-3" /> {BANK_INTEGRATIONS.length} total
            </Badge>
          </div>
        </motion.header>

        {/* ─── KPI Row ────────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_TILES.map((t) => <KpiTile key={t.label} {...t} />)}
        </section>

        {/* ─── Filter Tabs + Grid ─────────────────────────────────────────────── */}
        <section className="mt-6">
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4 text-emerald-400" />
                    Bank Integrations
                  </CardTitle>
                  <p className="text-[11px] text-zinc-500">
                    {filtered.length} of {BANK_INTEGRATIONS.length} integrations shown
                  </p>
                </div>
                <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
                  <TabsList className="bg-white/[0.03] h-9">
                    <TabsTrigger value="all" className="text-[11px]">
                      All <span className="ml-1 text-zinc-500">({BANK_INTEGRATIONS.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="connected" className="text-[11px]">
                      Connected <span className="ml-1 text-emerald-400">({BANK_INTEGRATIONS.filter(b => b.status === 'connected').length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="available" className="text-[11px]">
                      Available <span className="ml-1 text-amber-400">({BANK_INTEGRATIONS.filter(b => b.status === 'available').length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="coming-soon" className="text-[11px]">
                      Coming Soon <span className="ml-1 text-slate-400">({BANK_INTEGRATIONS.filter(b => b.status === 'coming-soon').length})</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="h-8 w-8 text-zinc-600" />
                  <p className="mt-2 text-sm text-zinc-400">No integrations in this category.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[1400px]">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {filtered.map((b, i) => <BankCard key={b.id} bank={b} index={i} />)}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ─── Deep Dives: tabbed enterprise sections ─────────────────────────── */}
        <section className="mt-6">
          <TooltipProvider delayDuration={200}>
            <Tabs value={sectionTab} onValueChange={(v) => setSectionTab(v as typeof sectionTab)}>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-teal-400" />
                  <h2 className="text-sm font-semibold text-zinc-200">Treasury Deep Dives</h2>
                </div>
                <TabsList className="bg-white/[0.03] h-9 overflow-x-auto">
                  <TabsTrigger value="cash" className="text-[11px]">
                    <Wallet className="mr-1 h-3 w-3" /> Cash Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="accounts" className="text-[11px]">
                    <CreditCard className="mr-1 h-3 w-3" /> Account List
                  </TabsTrigger>
                  <TabsTrigger value="routing" className="text-[11px]">
                    <Route className="mr-1 h-3 w-3" /> Routing Optimizer
                  </TabsTrigger>
                  <TabsTrigger value="fees" className="text-[11px]">
                    <Percent className="mr-1 h-3 w-3" /> Fee Analyzer
                  </TabsTrigger>
                  <TabsTrigger value="recon" className="text-[11px]">
                    <FileText className="mr-1 h-3 w-3" /> Reconciliation
                  </TabsTrigger>
                  <TabsTrigger value="pool" className="text-[11px]">
                    <Layers className="mr-1 h-3 w-3" /> Cash Pool
                  </TabsTrigger>
                  <TabsTrigger value="loans" className="text-[11px]">
                    <HandCoins className="mr-1 h-3 w-3" /> Intercompany Loans
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="text-[11px]">
                    <History className="mr-1 h-3 w-3" /> Audit Trail
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="cash" className="mt-0">
                <LiveCashPositionDashboard />
              </TabsContent>
              <TabsContent value="accounts" className="mt-0">
                <BankAccountList />
              </TabsContent>
              <TabsContent value="routing" className="mt-0">
                <PaymentRoutingOptimizer />
              </TabsContent>
              <TabsContent value="fees" className="mt-0">
                <BankFeeAnalyzer />
              </TabsContent>
              <TabsContent value="recon" className="mt-0">
                <ReconciliationStatus />
              </TabsContent>
              <TabsContent value="pool" className="mt-0">
                <CashPoolManagement />
              </TabsContent>
              <TabsContent value="loans" className="mt-0">
                <IntercompanyLoansDashboard />
              </TabsContent>
              <TabsContent value="audit" className="mt-0">
                <GlobalAuditTrail />
              </TabsContent>
            </Tabs>
          </TooltipProvider>
        </section>

        {/* ─── Compliance strip ───────────────────────────────────────────────── */}
        <section className="mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-semibold text-emerald-200">PCI DSS L1</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                All connected processors maintain Level 1 PCI compliance &amp; tokenized vaults.
              </p>
            </div>
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-300" />
                <span className="text-sm font-semibold text-teal-200">SWIFT / SEPA / UPI</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                Native rails for global wires, European SEPA, and India UPI across all connected banks.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-cyan-300" />
                <span className="text-sm font-semibold text-cyan-200">Multi-Currency Treasury</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                Pool, sweep &amp; reconcile across 9 currencies with automated FX hedging recommendations.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3 text-emerald-400" />
            International Banking™ · Phase 14 · {stats.connectedCount} connected · {fmtUSD(totalCash)} total cash · {fmtUSD(stats.totalVolume)} monthly volume
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-teal-400" /> Founder &amp; Owner: Prince Singh
          </div>
        </footer>
      </div>
    </div>
  );
}
