'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: INTERNATIONAL BANKING™
//
// Unified banking & payments integration console — 11 banks and payment
// processors across 9 countries with status, volume, fees & feature matrix.
// Pure static data layer (no API, no Math.random).
//
//   • KPI row              — connected, volume, transactions, fees
//   • Filter tabs          — All / Connected / Available / Coming Soon
//   • Bank cards grid      — logo, status, region, volume, features
//   • Connected → emerald ring · Available → dashed "Connect" button
//
// Tagline: Every Bank. Every Rail. One Treasury.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Banknote, ArrowRightLeft, Percent, Gauge, Sparkles,
  Landmark, CreditCard, Globe2, ShieldCheck, Plus, CheckCircle2,
  Plug, Activity, type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BANK_INTEGRATIONS, fmtUSD, getCountry, type BankIntegration,
  type CountryCode,
} from '@/lib/global/data';

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

const COLOR_MAP: Record<string, { ring: string; bg: string; text: string }> = {
  emerald: { ring: 'border-emerald-500/40 bg-emerald-500/15', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
  teal:    { ring: 'border-teal-500/40 bg-teal-500/15',       bg: 'bg-teal-500/10',    text: 'text-teal-300' },
  cyan:    { ring: 'border-cyan-500/40 bg-cyan-500/15',       bg: 'bg-cyan-500/10',    text: 'text-cyan-300' },
  violet:  { ring: 'border-violet-500/40 bg-violet-500/15',   bg: 'bg-violet-500/10',  text: 'text-violet-300' },
  amber:   { ring: 'border-amber-500/40 bg-amber-500/15',     bg: 'bg-amber-500/10',   text: 'text-amber-300' },
  orange:  { ring: 'border-orange-500/40 bg-orange-500/15',   bg: 'bg-orange-500/10',  text: 'text-orange-300' },
  red:     { ring: 'border-rose-500/40 bg-rose-500/15',       bg: 'bg-rose-500/10',    text: 'text-rose-300' },
  slate:   { ring: 'border-slate-500/40 bg-slate-500/15',     bg: 'bg-slate-500/10',   text: 'text-slate-300' },
  // 'blue' is mapped to teal to keep the palette free of indigo/blue
  blue:    { ring: 'border-teal-500/40 bg-teal-500/15',       bg: 'bg-teal-500/10',    text: 'text-teal-300' },
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
      transition={{ duration: 0.35, ease: 'easeOut' }}
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
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
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

// ─── Main Component ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'connected' | 'available' | 'coming-soon';

export default function InternationalBanking() {
  const [tab, setTab] = useState<FilterTab>('all');

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

  const KPI_TILES: KpiTileProps[] = [
    {
      icon: Building2, label: 'Total Connected', value: String(stats.connectedCount),
      sub: `${BANK_INTEGRATIONS.length} integrations available`, accent: 'emerald',
    },
    {
      icon: Banknote, label: 'Total Volume', value: fmtUSD(stats.totalVolume),
      sub: 'Monthly processed volume', accent: 'teal',
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
              Connect every bank, payment processor & cross-border rail — unified treasury in one console.
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

        {/* ─── Compliance strip ───────────────────────────────────────────────── */}
        <section className="mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-semibold text-emerald-200">PCI DSS L1</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                All connected processors maintain Level 1 PCI compliance & tokenized vaults.
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
                Pool, sweep & reconcile across 9 currencies with automated FX hedging recommendations.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3 text-emerald-400" />
            International Banking™ · Phase 14 · {stats.connectedCount} connected · {fmtUSD(stats.totalVolume)} monthly volume
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-teal-400" /> Founder & Owner: Prince Singh
          </div>
        </footer>
      </div>
    </div>
  );
}
