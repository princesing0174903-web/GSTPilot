'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: INTERNATIONAL ERP™ (BILLION-DOLLAR GRADE)
//
// Cross-border operations hub: warehouses, purchase orders, cross-border invoices,
// vendor scorecards, landed-cost calculator, inventory aging & customs tracker.
// All values derived from static data layer (@/lib/global/data). No API calls.
//
//   • Header with subtitle
//   • Stat strip — Warehouses / Items / Capacity / POs
//   • Tab navigation: Warehouses | Purchase Orders | Invoices | Supply Chain |
//     Vendors | Landed Cost | Inventory Aging | Customs
//   • Supply Chain Map — CSS route diagram with volume flows
//   • Vendor Scorecard — sortable table with stars, on-time, defects, risk
//   • Landed Cost Calculator — interactive origin/dest with duty/freight/insurance/VAT
//   • Inventory Aging — SKUs by 0-30/31-60/61-90/90+ buckets
//   • Customs Documentation Tracker — per-shipment document status
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Warehouse as WarehouseIcon, Truck, FileText, ArrowRight, Package,
  MapPin, Boxes, TrendingUp, Globe2, type LucideIcon,
  Star, Network, Calculator, PackageX, FileCheck2, FileClock, FileWarning,
  ChevronUp, ChevronDown, Ship, ShieldCheck, AlertTriangle, DollarSign,
  Users, AlertOctagon, Anchor, Gauge,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  WAREHOUSES, INTERNATIONAL_POS, VENDORS, getCountry, statusColor,
  formatCurrency, convertCurrency, fmtUSD,
  type Warehouse, type InternationalPO, type Vendor, type CountryCode,
} from '@/lib/global/data';
import {
  CUSTOMS_DECLARATIONS, GLOBAL_PAYROLL, SUPPLY_CHAIN_RISKS,
  type CustomsDeclaration, type GlobalPayrollEntry, type SupplyChainRisk,
} from '@/lib/global/data-enterprise';

// ─── Style Maps ────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<Warehouse['type'], string> = {
  Owned: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  Leased: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  '3PL': 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
};

const TYPE_DOT: Record<Warehouse['type'], string> = {
  Owned: 'bg-emerald-400',
  Leased: 'bg-amber-400',
  '3PL': 'bg-cyan-400',
};

const STATUS_BADGE: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  slate: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};

const ACCENT_RING: Record<'emerald' | 'teal' | 'cyan' | 'amber' | 'violet' | 'rose', string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  rose: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
};

const RISK_BADGE: Record<Vendor['riskLevel'], string> = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

// ─── Warehouse Card ────────────────────────────────────────────────────────────

function WarehouseCard({ wh, index }: { wh: Warehouse; index: number }) {
  const country = getCountry(wh.country);
  const pct = Math.round((wh.utilized / wh.capacity) * 100);
  const accentBar =
    pct >= 85 ? 'bg-rose-500' : pct >= 65 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.14] transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <WarehouseIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100 truncate">{wh.name}</h3>
            <div className="flex items-center gap-1 text-[11px] text-zinc-400">
              <span className="text-sm leading-none">{country?.flag}</span>
              <MapPin className="h-3 w-3" />
              <span className="truncate">{wh.city}</span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${TYPE_BADGE[wh.type]}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${TYPE_DOT[wh.type]}`} />
          {wh.type}
        </Badge>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-zinc-400">Utilization</span>
          <span className="text-zinc-200 font-medium tabular-nums">
            {pct}% · {wh.utilized.toLocaleString('en-US')}/{wh.capacity.toLocaleString('en-US')}
          </span>
        </div>
        <div className="h-2 rounded-full bg-black/40 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, delay: index * 0.04, ease: 'easeOut' }}
            className={`h-full ${accentBar}`}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">
            <Boxes className="h-2.5 w-2.5" />Items
          </div>
          <div className="text-sm font-semibold text-teal-300 tabular-nums">{wh.items.toLocaleString('en-US')}</div>
        </div>
        <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Free Capacity</div>
          <div className="text-sm font-semibold text-cyan-300 tabular-nums">
            {(wh.capacity - wh.utilized).toLocaleString('en-US')}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Purchase Orders Table ─────────────────────────────────────────────────────

function PurchaseOrdersTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
    >
      <ScrollArea className="max-h-[600px]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">PO Number</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Vendor</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Route</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">Amount</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">Items</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Incoterm</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Status</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">ETA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INTERNATIONAL_POS.map((po) => {
              const color = statusColor(po.status);
              const origin = getCountry(po.originCountry);
              const dest = getCountry(po.destinationCountry);
              return (
                <TableRow
                  key={po.id}
                  className="border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                >
                  <TableCell className="font-mono text-[11px] text-emerald-300">{po.poNumber}</TableCell>
                  <TableCell className="text-[12px] text-zinc-200">
                    <div className="flex items-center gap-1.5">
                      <span>{getCountry(po.vendorCountry)?.flag}</span>
                      <span className="truncate max-w-[180px]">{po.vendor}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[12px]">
                      <span title={origin?.name} className="text-sm leading-none">{origin?.flag}</span>
                      <ArrowRight className="h-3 w-3 text-zinc-500" />
                      <span title={dest?.name} className="text-sm leading-none">{dest?.flag}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[12px] font-semibold text-zinc-100 tabular-nums">
                    {formatCurrency(po.amount, po.currency)}
                  </TableCell>
                  <TableCell className="text-right text-[12px] text-zinc-300 tabular-nums">
                    {po.items.toLocaleString('en-US')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] border-violet-500/30 bg-violet-500/10 text-violet-300">
                      {po.incoterm}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_BADGE[color]}`}>
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] text-zinc-400 font-mono">{po.eta}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </motion.div>
  );
}

// ─── Cross-Border Invoices Tab ─────────────────────────────────────────────────

interface RouteSummary {
  key: string;
  originName: string;
  originFlag: string;
  destName: string;
  destFlag: string;
  count: number;
  totalUSD: number;
  currencies: string[];
  invoices: InternationalPO[];
}

function InvoicesTab() {
  const routes = useMemo<RouteSummary[]>(() => {
    const m = new Map<string, RouteSummary>();
    for (const po of INTERNATIONAL_POS) {
      const origin = getCountry(po.originCountry);
      const dest = getCountry(po.destinationCountry);
      const key = `${po.originCountry}→${po.destinationCountry}`;
      const existing = m.get(key);
      const usd = convertCurrency(po.amount, po.currency, 'USD');
      if (existing) {
        existing.count += 1;
        existing.totalUSD += usd;
        if (!existing.currencies.includes(po.currency)) existing.currencies.push(po.currency);
        existing.invoices.push(po);
      } else {
        m.set(key, {
          key,
          originName: origin?.name ?? po.originCountry,
          originFlag: origin?.flag ?? '🏳️',
          destName: dest?.name ?? po.destinationCountry,
          destFlag: dest?.flag ?? '🏳️',
          count: 1,
          totalUSD: usd,
          currencies: [po.currency],
          invoices: [po],
        });
      }
    }
    return Array.from(m.values()).sort((a, b) => b.totalUSD - a.totalUSD);
  }, []);

  const grandTotal = useMemo(
    () => routes.reduce((sum, r) => sum + r.totalUSD, 0),
    [routes],
  );

  const totalInvoices = INTERNATIONAL_POS.length;

  const tiles: {
    icon: LucideIcon;
    label: string;
    value: string;
    accent: 'emerald' | 'teal' | 'cyan' | 'violet';
  }[] = [
    { icon: FileText, label: 'Total Invoices', value: String(totalInvoices), accent: 'teal' },
    { icon: Globe2, label: 'Active Routes', value: String(routes.length), accent: 'cyan' },
    { icon: TrendingUp, label: 'Cross-Border Volume', value: fmtUSD(grandTotal), accent: 'emerald' },
    { icon: Truck, label: 'Avg / Route', value: fmtUSD(grandTotal / routes.length), accent: 'violet' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${ACCENT_RING[t.accent]}`}>
                <t.icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">{t.label}</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-zinc-50 tabular-nums">{t.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {routes.map((r, i) => (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.14] transition-all"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl leading-none">{r.originFlag}</span>
                <div className="flex flex-col items-center">
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[9px] text-zinc-500">{r.count} inv</span>
                </div>
                <span className="text-2xl leading-none">{r.destFlag}</span>
                <div className="ml-1 min-w-0">
                  <div className="text-xs font-semibold text-zinc-100 truncate">
                    {r.originName} → {r.destName}
                  </div>
                  <div className="text-[10px] text-zinc-500">{r.currencies.join(' · ')}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-emerald-300 tabular-nums">{fmtUSD(r.totalUSD)}</div>
                <div className="text-[9px] uppercase tracking-wider text-zinc-500">Total Volume</div>
              </div>
            </div>

            <Separator className="my-3 bg-white/[0.06]" />

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {r.invoices.map((inv) => {
                const color = statusColor(inv.status);
                const origin = getCountry(inv.originCountry);
                const dest = getCountry(inv.destinationCountry);
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="font-mono text-[10px] text-zinc-300 truncate">{inv.poNumber}</span>
                      <span className="text-[10px] text-zinc-500 truncate hidden sm:inline">{inv.vendor}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px]">
                        {origin?.flag}<ArrowRight className="inline h-2.5 w-2.5 text-zinc-600 mx-0.5" />{dest?.flag}
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-100 tabular-nums">
                        {formatCurrency(inv.amount, inv.currency)}
                      </span>
                      <Badge variant="outline" className={`text-[9px] capitalize ${STATUS_BADGE[color]}`}>
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Supply Chain Map Tab ──────────────────────────────────────────────────────

interface SupplyRoute {
  key: string;
  origin: CountryCode;
  destination: CountryCode;
  vendor: string;
  volume: number; // USD
  incoterm: string;
  status: string;
}

function SupplyChainMap() {
  const routes = useMemo<SupplyRoute[]>(() => {
    return INTERNATIONAL_POS.map((po) => ({
      key: po.id,
      origin: po.originCountry,
      destination: po.destinationCountry,
      vendor: po.vendor,
      volume: convertCurrency(po.amount, po.currency, 'USD'),
      incoterm: po.incoterm,
      status: po.status,
    })).sort((a, b) => b.volume - a.volume);
  }, []);

  const maxVolume = Math.max(...routes.map((r) => r.volume));
  const totalVolume = routes.reduce((s, r) => s + r.volume, 0);

  // Unique origins/destinations for legend (derived from stable import — no memo needed)
  const origins = Array.from(new Set(INTERNATIONAL_POS.map((po) => po.originCountry)));
  const destinations = Array.from(new Set(INTERNATIONAL_POS.map((po) => po.destinationCountry)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/20 bg-violet-500/10 text-violet-300">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Supply Chain Map</h2>
            <p className="text-[11px] text-zinc-500">
              {routes.length} active flows · {fmtUSD(totalVolume)} total volume
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <div>
            <div className="text-zinc-500 uppercase tracking-wider">Origins</div>
            <div className="flex items-center gap-0.5 mt-0.5">
              {origins.map((cc) => (
                <span key={cc} title={getCountry(cc).name} className="text-base">
                  {getCountry(cc).flag}
                </span>
              ))}
            </div>
          </div>
          <ArrowRight className="h-3 w-3 text-zinc-500" />
          <div>
            <div className="text-zinc-500 uppercase tracking-wider">Destinations</div>
            <div className="flex items-center gap-0.5 mt-0.5">
              {destinations.map((cc) => (
                <span key={cc} title={getCountry(cc).name} className="text-base">
                  {getCountry(cc).flag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Route Diagram */}
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_180px] gap-4 items-stretch">
        {/* Origins column */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Origin (Vendor)</div>
          {origins.map((cc) => {
            const c = getCountry(cc);
            const total = routes.filter((r) => r.origin === cc).reduce((s, r) => s + r.volume, 0);
            return (
              <div
                key={cc}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5 flex items-center gap-2"
              >
                <span className="text-xl">{c.flag}</span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-100 truncate">{c.name}</div>
                  <div className="text-[9px] text-emerald-300 tabular-nums">{fmtUSD(total)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Flow lines (CSS) */}
        <div className="relative min-h-[280px] hidden md:block">
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            {routes.map((r, i) => {
              const y1 = (origins.indexOf(r.origin) + 0.5) * (100 / origins.length);
              const y2 = (destinations.indexOf(r.destination) + 0.5) * (100 / destinations.length);
              const intensity = r.volume / maxVolume;
              const isHigh = r.status === 'delivered';
              const color = isHigh ? '#10b981' : r.status === 'in-transit' ? '#f59e0b' : r.status === 'customs' ? '#f43f5e' : '#71717a';
              return (
                <motion.path
                  key={r.key}
                  d={`M 0 ${y1} C 40 ${y1}, 60 ${y2}, 100 ${y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.4 + intensity * 2}
                  strokeOpacity={0.35 + intensity * 0.5}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: i * 0.1, ease: 'easeInOut' }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-[10px] text-violet-300 uppercase tracking-wider">
              Trade Flows
            </div>
          </div>
        </div>

        {/* Destinations column */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Destination (Warehouse)</div>
          {destinations.map((cc) => {
            const c = getCountry(cc);
            const total = routes.filter((r) => r.destination === cc).reduce((s, r) => s + r.volume, 0);
            return (
              <div
                key={cc}
                className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-2.5 flex items-center gap-2"
              >
                <span className="text-xl">{c.flag}</span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-100 truncate">{c.name}</div>
                  <div className="text-[9px] text-cyan-300 tabular-nums">{fmtUSD(total)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator className="bg-white/[0.06]" />

      {/* Route list with volume bars */}
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">All Flows (sorted by volume)</div>
        <ScrollArea className="max-h-[300px] pr-2">
          <div className="space-y-1.5">
            {routes.map((r, i) => {
              const origin = getCountry(r.origin);
              const dest = getCountry(r.destination);
              const pct = Math.round((r.volume / maxVolume) * 100);
              const color = statusColor(r.status);
              return (
                <motion.div
                  key={r.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{origin.flag}</span>
                    <ArrowRight className="h-3 w-3 text-zinc-500" />
                    <span className="text-base">{dest.flag}</span>
                    <span className="text-[11px] text-zinc-300 truncate flex-1">{r.vendor}</span>
                    <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
                      {r.incoterm}
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] capitalize ${STATUS_BADGE[color]}`}>
                      {r.status}
                    </Badge>
                    <span className="text-[11px] font-semibold text-emerald-300 tabular-nums w-20 text-right">
                      {fmtUSD(r.volume)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.04 }}
                      className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
}

// ─── Vendor Scorecard (Sortable Table) ─────────────────────────────────────────

type SortKey = 'name' | 'country' | 'category' | 'rating' | 'onTimeRate' | 'defectRate' | 'totalSpend' | 'activePOs' | 'paymentTerms' | 'riskLevel';

function SortableHeader({
  label, k, sortKey, sortDir, onSort, align = 'left',
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  return (
    <TableHead
      className={`text-[10px] uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-zinc-300 select-none ${align === 'right' ? 'text-right' : ''}`}
      onClick={() => onSort(k)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        {sortKey === k ? (
          sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-emerald-400" /> : <ChevronDown className="h-3 w-3 text-emerald-400" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

function VendorScorecard() {
  const [sortKey, setSortKey] = useState<SortKey>('totalSpend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const list = [...VENDORS];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'country': cmp = getCountry(a.country).name.localeCompare(getCountry(b.country).name); break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'rating': cmp = a.rating - b.rating; break;
        case 'onTimeRate': cmp = a.onTimeRate - b.onTimeRate; break;
        case 'defectRate': cmp = a.defectRate - b.defectRate; break;
        case 'totalSpend': cmp = a.totalSpend - b.totalSpend; break;
        case 'activePOs': cmp = a.activePOs - b.activePOs; break;
        case 'paymentTerms': cmp = a.paymentTerms.localeCompare(b.paymentTerms); break;
        case 'riskLevel': {
          const order = { low: 0, medium: 1, high: 2 };
          cmp = order[a.riskLevel] - order[b.riskLevel];
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'country' || key === 'category' || key === 'paymentTerms' ? 'asc' : 'desc');
    }
  };

  const totalSpend = VENDORS.reduce((s, v) => s + v.totalSpend, 0);
  const avgRating = (VENDORS.reduce((s, v) => s + v.rating, 0) / VENDORS.length).toFixed(1);
  const avgOnTime = Math.round(VENDORS.reduce((s, v) => s + v.onTimeRate, 0) / VENDORS.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Boxes} label="Active Vendors" value={String(VENDORS.length)} sub="Across 7 countries" accent="teal" />
        <StatTile icon={DollarSign} label="Total Spend" value={fmtUSD(totalSpend)} sub="Trailing 12 months" accent="emerald" />
        <StatTile icon={Star} label="Avg Rating" value={`${avgRating}★`} sub="Quality-weighted" accent="amber" />
        <StatTile icon={Truck} label="Avg On-Time" value={`${avgOnTime}%`} sub="Delivery performance" accent="cyan" />
      </div>

      {/* Vendor Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <ScrollArea className="max-h-[560px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <SortableHeader label="Vendor" k="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Country" k="country" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Category" k="category" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Rating" k="rating" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="On-Time" k="onTimeRate" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Defects" k="defectRate" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Spend" k="totalSpend" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="POs" k="activePOs" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Terms" k="paymentTerms" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Risk" k="riskLevel" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((v) => {
                const c = getCountry(v.country);
                return (
                  <TableRow key={v.id} className="border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <TableCell className="text-[12px] font-medium text-zinc-100">
                      <span className="truncate block max-w-[160px]">{v.name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                        <span className="text-sm leading-none">{c.flag}</span>
                        <span>{c.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] text-zinc-300">{v.category}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-[11px] font-semibold text-zinc-100 tabular-nums">{v.rating.toFixed(1)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-[11px] tabular-nums">
                      <span className={
                        v.onTimeRate >= 90 ? 'text-emerald-300' :
                        v.onTimeRate >= 80 ? 'text-teal-300' : 'text-amber-300'
                      }>
                        {v.onTimeRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-[11px] tabular-nums">
                      <span className={
                        v.defectRate <= 1 ? 'text-emerald-300' :
                        v.defectRate <= 2 ? 'text-amber-300' : 'text-rose-300'
                      }>
                        {v.defectRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-[11px] font-semibold text-zinc-100 tabular-nums">
                      {fmtUSD(v.totalSpend)}
                    </TableCell>
                    <TableCell className="text-right text-[11px] text-zinc-300 tabular-nums">{v.activePOs}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                        {v.paymentTerms}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] capitalize ${RISK_BADGE[v.riskLevel]}`}>
                        {v.riskLevel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </motion.div>
  );
}

// ─── Landed Cost Calculator ────────────────────────────────────────────────────

function LandedCostCalculator() {
  const [productValue, setProductValue] = useState<number>(25000);
  const [origin, setOrigin] = useState<CountryCode>('SG');
  const [destination, setDestination] = useState<CountryCode>('IN');
  const [weight, setWeight] = useState<number>(150); // kg
  const [qty, setQty] = useState<number>(100);

  const originCountry = getCountry(origin);
  const destCountry = getCountry(destination);

  // Deterministic freight estimate: $4/kg air, $1.5/kg sea — assume blended
  const freightPerKg = 4;
  const totalWeight = weight * qty;
  const freight = totalWeight * freightPerKg;

  // Insurance ~1.5% of (product + freight)
  const insurance = Math.round((productValue + freight) * 0.015);

  // Import duty uses destination country's importDuty %
  const importDuty = Math.round((productValue * destCountry.importDuty) / 100);

  // VAT/GST on import = (productValue + duty + freight + insurance) * destTaxRate%
  const vatOnImport = Math.round(((productValue + importDuty + freight + insurance) * destCountry.taxRate) / 100);

  // Customs brokerage flat fee
  const brokerage = 250;

  const totalLanded = productValue + importDuty + freight + insurance + vatOnImport + brokerage;
  const perUnitLanded = Math.round(totalLanded / qty);
  const landedPctOfProduct = ((totalLanded - productValue) / productValue) * 100;

  const costRows = [
    { label: 'Product Cost (FOB)', value: productValue, color: 'text-zinc-100', note: `${qty} units @ ${fmtUSD(productValue / qty)}/unit` },
    { label: `Import Duty (${destCountry.importDuty}%)`, value: importDuty, color: 'text-amber-300', note: `${destCountry.flag} ${destCountry.name} customs` },
    { label: `Freight (${totalWeight.toLocaleString()} kg)`, value: freight, color: 'text-cyan-300', note: `$${freightPerKg}/kg blended air` },
    { label: 'Insurance (1.5%)', value: insurance, color: 'text-teal-300', note: 'Cargo + transit cover' },
    { label: `VAT/GST on Import (${destCountry.taxRate}%)`, value: vatOnImport, color: 'text-violet-300', note: `${destCountry.primaryTaxName} on CIF+Duty` },
    { label: 'Customs Brokerage', value: brokerage, color: 'text-zinc-300', note: 'Flat fee per shipment' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-300">
          <Calculator className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Landed Cost Calculator</h2>
          <p className="text-[11px] text-zinc-500">Cross-border import cost estimation — duty, freight, insurance & VAT</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inputs */}
        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Origin (Vendor)</label>
              <Select value={origin} onValueChange={(v) => setOrigin(v as CountryCode)}>
                <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/[0.08]">
                  {(['SG', 'US', 'GB', 'DE', 'FR', 'JP', 'AE', 'IN'] as CountryCode[]).map((cc) => (
                    <SelectItem key={cc} value={cc} className="text-zinc-100 text-xs">
                      {getCountry(cc).flag} {getCountry(cc).name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Destination</label>
              <Select value={destination} onValueChange={(v) => setDestination(v as CountryCode)}>
                <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/[0.08]">
                  {(['IN', 'US', 'GB', 'DE', 'FR', 'JP', 'AE', 'SG', 'AU', 'CA'] as CountryCode[]).map((cc) => (
                    <SelectItem key={cc} value={cc} className="text-zinc-100 text-xs">
                      {getCountry(cc).flag} {getCountry(cc).name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Product Value (USD)</label>
              <Input
                type="number"
                min={0}
                value={productValue}
                onChange={(e) => setProductValue(Math.max(0, Number(e.target.value) || 0))}
                className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9 tabular-nums"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Weight / Unit (kg)</label>
              <Input
                type="number"
                min={0}
                value={weight}
                onChange={(e) => setWeight(Math.max(0, Number(e.target.value) || 0))}
                className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9 tabular-nums"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Quantity</label>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9 tabular-nums"
              />
            </div>
          </div>

          {/* Route summary */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 flex items-center gap-3">
            <Ship className="h-5 w-5 text-emerald-400" />
            <div className="flex items-center gap-2">
              <span className="text-xl">{originCountry.flag}</span>
              <span className="text-xs text-zinc-300">{originCountry.name}</span>
              <ArrowRight className="h-3 w-3 text-emerald-400" />
              <span className="text-xl">{destCountry.flag}</span>
              <span className="text-xs text-zinc-300">{destCountry.name}</span>
            </div>
            <Separator orientation="vertical" className="bg-white/[0.06] h-8 mx-1" />
            <div className="grid grid-cols-3 gap-3 text-[10px]">
              <div>
                <div className="text-zinc-500 uppercase tracking-wider">Duty</div>
                <div className="text-amber-300 font-semibold">{destCountry.importDuty}%</div>
              </div>
              <div>
                <div className="text-zinc-500 uppercase tracking-wider">VAT/GST</div>
                <div className="text-violet-300 font-semibold">{destCountry.taxRate}%</div>
              </div>
              <div>
                <div className="text-zinc-500 uppercase tracking-wider">Total Wt</div>
                <div className="text-cyan-300 font-semibold tabular-nums">{totalWeight.toLocaleString()} kg</div>
              </div>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-4 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300 mb-3">
            <ShieldCheck className="h-3 w-3" />Landed Cost Breakdown
          </div>

          <div className="space-y-1.5 flex-1">
            {costRows.map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 truncate">{row.label}</span>
                  <span className={`font-semibold tabular-nums ${row.color}`}>{fmtUSD(row.value)}</span>
                </div>
                <div className="text-[9px] text-zinc-600">{row.note}</div>
              </motion.div>
            ))}
          </div>

          <Separator className="bg-white/[0.06] my-3" />

          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total Landed Cost</div>
            <div className="text-2xl font-bold text-emerald-300 tabular-nums">{fmtUSD(totalLanded)}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              +{landedPctOfProduct.toFixed(1)}% over FOB · {fmtUSD(perUnitLanded)}/unit
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Inventory Aging ───────────────────────────────────────────────────────────

interface AgingBucket {
  key: string;
  label: string;
  skus: number;
  valueUSD: number;
  pctOfTotal: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

interface WarehouseAging {
  warehouseId: string;
  warehouseName: string;
  country: CountryCode;
  buckets: AgingBucket[];
}

// Deterministic aging distribution per warehouse
function deriveAgingData(): WarehouseAging[] {
  const hashStr = (s: string): number => {
    let h = 7;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return h;
  };
  return WAREHOUSES.map((wh) => {
    const seed1 = hashStr(`${wh.id}-a`) % 100;
    const seed2 = hashStr(`${wh.id}-b`) % 100;
    const seed3 = hashStr(`${wh.id}-c`) % 100;
    const seed4 = hashStr(`${wh.id}-d`) % 100;
    const total = wh.items;
    const b1 = Math.round(total * (0.45 + (seed1 % 12) / 100)); // 0-30d ~45-57%
    const b2 = Math.round(total * (0.25 + (seed2 % 10) / 100)); // 31-60d ~25-35%
    const b3 = Math.round(total * (0.12 + (seed3 % 8) / 100));  // 61-90d ~12-20%
    const b4 = total - b1 - b2 - b3;                            // 90+ remainder
    const unitValue = 28 + (seed4 % 18); // $28-46 per unit
    const buckets: AgingBucket[] = [
      { key: '0-30', label: '0-30 days', skus: b1, valueUSD: b1 * unitValue, pctOfTotal: 0, risk: 'low' },
      { key: '31-60', label: '31-60 days', skus: b2, valueUSD: b2 * unitValue * 1.02, pctOfTotal: 0, risk: 'medium' },
      { key: '61-90', label: '61-90 days', skus: b3, valueUSD: b3 * unitValue * 1.05, pctOfTotal: 0, risk: 'high' },
      { key: '90+', label: '90+ days', skus: b4, valueUSD: b4 * unitValue * 1.10, pctOfTotal: 0, risk: 'critical' },
    ];
    const totalValue = buckets.reduce((s, b) => s + b.valueUSD, 0);
    buckets.forEach((b) => { b.pctOfTotal = (b.valueUSD / totalValue) * 100; });
    return {
      warehouseId: wh.id,
      warehouseName: wh.name,
      country: wh.country,
      buckets,
    };
  });
}

const AGING_RISK_STYLE: Record<AgingBucket['risk'], { bar: string; badge: string; label: string }> = {
  low: { bar: 'bg-emerald-500', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', label: 'Fresh' },
  medium: { bar: 'bg-teal-400', badge: 'border-teal-500/30 bg-teal-500/10 text-teal-300', label: 'Stable' },
  high: { bar: 'bg-amber-400', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300', label: 'Aging' },
  critical: { bar: 'bg-rose-500', badge: 'border-rose-500/30 bg-rose-500/10 text-rose-400', label: 'At Risk' },
};

function InventoryAging() {
  const data = useMemo(() => deriveAgingData(), []);
  const [selected, setSelected] = useState<WarehouseAging>(data[0]);

  // Aggregate across all warehouses
  const totals = useMemo(() => {
    const t: Record<string, { skus: number; valueUSD: number }> = {
      '0-30': { skus: 0, valueUSD: 0 },
      '31-60': { skus: 0, valueUSD: 0 },
      '61-90': { skus: 0, valueUSD: 0 },
      '90+': { skus: 0, valueUSD: 0 },
    };
    for (const w of data) {
      for (const b of w.buckets) {
        t[b.key].skus += b.skus;
        t[b.key].valueUSD += b.valueUSD;
      }
    }
    return t;
  }, [data]);

  const totalValue = Object.values(totals).reduce((s, b) => s + b.valueUSD, 0);
  const atRiskValue = totals['61-90'].valueUSD + totals['90+'].valueUSD;
  const atRiskPct = (atRiskValue / totalValue) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-300">
          <PackageX className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Inventory Aging</h2>
          <p className="text-[11px] text-zinc-500">SKU aging distribution across warehouses — identify slow-moving inventory</p>
        </div>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total Inventory Value</div>
          <div className="text-base font-bold text-zinc-100 tabular-nums">{fmtUSD(totalValue)}</div>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3">
          <div className="text-[10px] uppercase tracking-wider text-rose-300">Value at Risk (61d+)</div>
          <div className="text-base font-bold text-rose-300 tabular-nums">{fmtUSD(atRiskValue)}</div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
          <div className="text-[10px] uppercase tracking-wider text-amber-300">% at Risk</div>
          <div className="text-base font-bold text-amber-300 tabular-nums">{atRiskPct.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300">Fresh Inventory (≤30d)</div>
          <div className="text-base font-bold text-emerald-300 tabular-nums">
            {((totals['0-30'].valueUSD / totalValue) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Aggregate buckets chart */}
      <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Aggregate Aging Distribution (all warehouses)</div>
        <div className="space-y-2">
          {Object.entries(totals).map(([k, v]) => {
            const bucket = AGING_RISK_STYLE[k as keyof typeof AGING_RISK_STYLE];
            const pct = (v.valueUSD / totalValue) * 100;
            return (
              <div key={k}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-zinc-300">
                    {bucket.label} ({k})
                  </span>
                  <span className="text-zinc-100 tabular-nums">
                    {fmtUSD(v.valueUSD)} · {v.skus.toLocaleString()} SKUs · {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full ${bucket.bar}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-warehouse selector */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Select Warehouse for Drill-Down</div>
        <ScrollArea className="max-h-[260px] pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.map((w) => {
              const c = getCountry(w.country);
              const isActive = w.warehouseId === selected.warehouseId;
              const whValue = w.buckets.reduce((s, b) => s + b.valueUSD, 0);
              const wAtRisk = w.buckets.filter((b) => b.key === '61-90' || b.key === '90+').reduce((s, b) => s + b.valueUSD, 0);
              const wAtRiskPct = (wAtRisk / whValue) * 100;
              return (
                <button
                  key={w.warehouseId}
                  type="button"
                  onClick={() => setSelected(w)}
                  className={`text-left rounded-lg border p-2.5 transition-all ${
                    isActive
                      ? 'border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{c.flag}</span>
                    <span className="text-[12px] font-semibold text-zinc-100 flex-1 truncate">{w.warehouseName}</span>
                    <span className="text-[10px] text-zinc-500 tabular-nums">{fmtUSD(whValue)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className={wAtRiskPct > 30 ? 'h-full bg-rose-500' : wAtRiskPct > 15 ? 'h-full bg-amber-400' : 'h-full bg-emerald-500'}
                        style={{ width: `${Math.min(100, wAtRiskPct)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-500 tabular-nums">{wAtRiskPct.toFixed(0)}% risk</span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Selected warehouse detail */}
      <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{getCountry(selected.country).flag}</span>
          <div>
            <div className="text-xs font-semibold text-zinc-100">{selected.warehouseName}</div>
            <div className="text-[10px] text-zinc-500">{getCountry(selected.country).name}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {selected.buckets.map((b, i) => {
            const sty = AGING_RISK_STYLE[b.risk];
            return (
              <motion.div
                key={b.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">{b.label}</span>
                  <Badge variant="outline" className={`text-[8px] ${sty.badge}`}>{sty.label}</Badge>
                </div>
                <div className="text-base font-bold text-zinc-100 tabular-nums">{fmtUSD(b.valueUSD)}</div>
                <div className="text-[10px] text-zinc-400 tabular-nums">{b.skus.toLocaleString()} SKUs</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${b.pctOfTotal}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className={`h-full ${sty.bar}`}
                  />
                </div>
                <div className="text-[9px] text-zinc-500 mt-1 tabular-nums">{b.pctOfTotal.toFixed(1)}% of WH value</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Customs Documentation Tracker ─────────────────────────────────────────────

interface CustomsDoc {
  id: string;
  name: string;
  icon: LucideIcon;
  required: boolean;
}

const CUSTOMS_DOCS: CustomsDoc[] = [
  { id: 'bol', name: 'Bill of Lading', icon: Ship, required: true },
  { id: 'ci', name: 'Commercial Invoice', icon: FileText, required: true },
  { id: 'pl', name: 'Packing List', icon: Boxes, required: true },
  { id: 'co', name: 'Certificate of Origin', icon: ShieldCheck, required: false },
  { id: 'cd', name: 'Customs Declaration', icon: FileCheck2, required: true },
  { id: 'ic', name: 'Insurance Certificate', icon: AlertTriangle, required: false },
];

interface ShipmentDocStatus {
  poId: string;
  poNumber: string;
  route: { origin: CountryCode; destination: CountryCode };
  docs: Record<string, 'ready' | 'pending' | 'missing'>;
}

// Deterministic doc status per shipment
function deriveShipmentDocStatus(): ShipmentDocStatus[] {
  const hashStr = (s: string): number => {
    let h = 11;
    for (let i = 0; i < s.length; i += 1) h = (h * 17 + s.charCodeAt(i)) % 7919;
    return h;
  };
  return INTERNATIONAL_POS.map((po) => {
    const docs: Record<string, 'ready' | 'pending' | 'missing'> = {};
    for (const d of CUSTOMS_DOCS) {
      const h = hashStr(`${po.id}-${d.id}`) % 100;
      // Delivered shipments are mostly ready, customs shipments mostly pending, etc.
      if (po.status === 'delivered') {
        docs[d.id] = d.required ? 'ready' : (h < 70 ? 'ready' : 'missing');
      } else if (po.status === 'customs') {
        docs[d.id] = h < 60 ? 'ready' : 'pending';
      } else if (po.status === 'in-transit') {
        docs[d.id] = d.required ? (h < 80 ? 'ready' : 'pending') : (h < 40 ? 'ready' : 'missing');
      } else if (po.status === 'pending') {
        docs[d.id] = h < 30 ? 'ready' : h < 80 ? 'pending' : 'missing';
      } else {
        docs[d.id] = 'missing';
      }
    }
    return {
      poId: po.id,
      poNumber: po.poNumber,
      route: { origin: po.originCountry, destination: po.destinationCountry },
      docs,
    };
  });
}

const DOC_STATUS_STYLE: Record<'ready' | 'pending' | 'missing', { badge: string; icon: LucideIcon; dot: string }> = {
  ready: { badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', icon: FileCheck2, dot: 'bg-emerald-400' },
  pending: { badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300', icon: FileClock, dot: 'bg-amber-400' },
  missing: { badge: 'border-rose-500/30 bg-rose-500/10 text-rose-400', icon: FileWarning, dot: 'bg-rose-400' },
};

function CustomsTracker() {
  const data = useMemo(() => deriveShipmentDocStatus(), []);

  // Aggregate stats
  const stats = useMemo(() => {
    let total = 0, ready = 0, pending = 0, missing = 0;
    for (const s of data) {
      for (const d of CUSTOMS_DOCS) {
        total += 1;
        const st = s.docs[d.id];
        if (st === 'ready') ready += 1;
        else if (st === 'pending') pending += 1;
        else missing += 1;
      }
    }
    return { total, ready, pending, missing };
  }, [data]);

  const completionPct = (stats.ready / stats.total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
          <FileCheck2 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-zinc-100">Customs Documentation Tracker</h2>
          <p className="text-[11px] text-zinc-500">Per-shipment document readiness for cross-border clearance</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Overall Completion</div>
          <div className="text-base font-bold text-emerald-300 tabular-nums">{completionPct.toFixed(1)}%</div>
        </div>
      </div>

      {/* Aggregate progress */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300">Ready</div>
          <div className="text-lg font-bold text-emerald-300 tabular-nums">{stats.ready}</div>
          <div className="text-[9px] text-zinc-500">of {stats.total}</div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
          <div className="text-[10px] uppercase tracking-wider text-amber-300">Pending</div>
          <div className="text-lg font-bold text-amber-300 tabular-nums">{stats.pending}</div>
          <div className="text-[9px] text-zinc-500">in processing</div>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3">
          <div className="text-[10px] uppercase tracking-wider text-rose-300">Missing</div>
          <div className="text-lg font-bold text-rose-400 tabular-nums">{stats.missing}</div>
          <div className="text-[9px] text-zinc-500">action needed</div>
        </div>
      </div>

      <Progress value={completionPct} className="h-2 bg-black/40" />

      {/* Per-shipment grid */}
      <ScrollArea className="max-h-[480px] pr-2">
        <div className="space-y-2">
          {data.map((shipment, idx) => {
            const readyCount = CUSTOMS_DOCS.filter((d) => shipment.docs[d.id] === 'ready').length;
            const pct = (readyCount / CUSTOMS_DOCS.length) * 100;
            const origin = getCountry(shipment.route.origin);
            const dest = getCountry(shipment.route.destination);
            return (
              <motion.div
                key={shipment.poId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-mono text-[11px] text-emerald-300">{shipment.poNumber}</span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-base">{origin.flag}</span>
                    <ArrowRight className="h-3 w-3 text-zinc-500" />
                    <span className="text-base">{dest.flag}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className={pct === 100 ? 'h-full bg-emerald-500' : pct >= 50 ? 'h-full bg-amber-400' : 'h-full bg-rose-500'}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400 tabular-nums">{readyCount}/{CUSTOMS_DOCS.length}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CUSTOMS_DOCS.map((doc) => {
                    const st = shipment.docs[doc.id];
                    const sty = DOC_STATUS_STYLE[st];
                    const Icon = doc.icon;
                    const StatusIcon = sty.icon;
                    return (
                      <div
                        key={doc.id}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${sty.badge}`}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="text-[10px] flex-1 truncate">{doc.name}</span>
                        <StatusIcon className="h-3 w-3 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE — Customs Declarations Log
// ═══════════════════════════════════════════════════════════════════════════════

const CUSTOMS_TYPE_BADGE: Record<CustomsDeclaration['type'], string> = {
  Import: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  Export: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
};

const CUSTOMS_STATUS_BADGE: Record<CustomsDeclaration['status'], string> = {
  cleared: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  filed: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  held: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  pending: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

function CustomsDeclarationsLog() {
  const stats = useMemo(() => {
    const totalDuty = CUSTOMS_DECLARATIONS.reduce((s, c) => s + c.dutyPaid, 0);
    const totalGst = CUSTOMS_DECLARATIONS.reduce((s, c) => s + c.gstVatPaid, 0);
    const totalValue = CUSTOMS_DECLARATIONS.reduce((s, c) => s + c.declaredValueUSD, 0);
    const cleared = CUSTOMS_DECLARATIONS.filter((c) => c.status === 'cleared').length;
    return { totalDuty, totalGst, totalValue, cleared };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Anchor} label="Declarations" value={String(CUSTOMS_DECLARATIONS.length)} sub={`${stats.cleared} cleared`} accent="emerald" />
        <StatTile icon={DollarSign} label="Declared Value" value={fmtUSD(stats.totalValue)} sub="Total shipments" accent="teal" />
        <StatTile icon={Package} label="Duty Paid" value={fmtUSD(stats.totalDuty)} sub="Import duties" accent="amber" />
        <StatTile icon={FileText} label="GST/VAT Paid" value={fmtUSD(stats.totalGst)} sub="Border taxes" accent="cyan" />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <ScrollArea className="max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Reference</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Type</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Route</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">HS Code</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Description</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Declared USD</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Duty %</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Duty Paid</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">GST/VAT</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Port</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Incoterm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {CUSTOMS_DECLARATIONS.map((c, i) => {
                  const origin = getCountry(c.originCountry);
                  const dest = getCountry(c.destinationCountry);
                  return (
                    <motion.tr
                      key={c.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className={`border-white/[0.04] hover:bg-white/[0.03] ${
                        c.status === 'held' ? 'bg-amber-500/[0.04]' : ''
                      }`}
                    >
                      <TableCell className="py-2.5">
                        <span className="font-mono text-[11px] text-emerald-300">{c.reference}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${CUSTOMS_TYPE_BADGE[c.type]}`}>
                          {c.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span title={origin?.name} className="text-base leading-none">{origin?.flag}</span>
                          <ArrowRight className="h-3 w-3 text-zinc-500" />
                          <span title={dest?.name} className="text-base leading-none">{dest?.flag}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[10px] text-cyan-300">{c.hsCode}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] text-zinc-300 truncate max-w-[160px] inline-block">{c.description}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-zinc-200">{fmtUSD(c.declaredValueUSD)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-amber-300">{c.dutyRate.toFixed(1)}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-rose-300">{c.dutyPaid > 0 ? fmtUSD(c.dutyPaid) : '—'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-violet-300">{c.gstVatPaid > 0 ? fmtUSD(c.gstVatPaid) : '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] capitalize ${CUSTOMS_STATUS_BADGE[c.status]}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] text-zinc-400">{c.port}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-400">
                          {c.incoterm}
                        </Badge>
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
// ENTERPRISE — Global Payroll Module
// ═══════════════════════════════════════════════════════════════════════════════

const PAYROLL_STATUS_BADGE: Record<GlobalPayrollEntry['status'], string> = {
  processed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  review: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

function GlobalPayrollModule() {
  const stats = useMemo(() => {
    const totalHeadcount = GLOBAL_PAYROLL.reduce((s, p) => s + p.headcount, 0);
    const totalGross = GLOBAL_PAYROLL.reduce((s, p) => s + p.grossPayrollUSD, 0);
    const totalEmployerTax = GLOBAL_PAYROLL.reduce((s, p) => s + p.employerTax, 0);
    const pending = GLOBAL_PAYROLL.filter((p) => p.status === 'pending' || p.status === 'review').length;
    return { totalHeadcount, totalGross, totalEmployerTax, pending };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Users} label="Total Headcount" value={stats.totalHeadcount.toLocaleString('en-US')} sub={`${GLOBAL_PAYROLL.length} entities`} accent="emerald" />
        <StatTile icon={DollarSign} label="Gross Payroll" value={fmtUSD(stats.totalGross)} sub="Monthly USD" accent="teal" />
        <StatTile icon={FileText} label="Employer Tax" value={fmtUSD(stats.totalEmployerTax)} sub="Monthly burden" accent="amber" />
        <StatTile icon={AlertOctagon} label="Pending/Review" value={String(stats.pending)} sub="Awaiting processing" accent="rose" />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <ScrollArea className="max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Entity</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Headcount</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Gross (Local)</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Gross USD</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Employer Tax</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Employee Tax</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Net Payroll</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Avg Salary</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Pay Date</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {GLOBAL_PAYROLL.map((p, i) => {
                  const country = getCountry(p.countryCode);
                  return (
                    <motion.tr
                      key={`${p.entity}-${i}`}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className="border-white/[0.04] hover:bg-white/[0.03]"
                    >
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">{country?.flag ?? '🏳️'}</span>
                          <span className="text-[11px] font-medium text-zinc-200 truncate max-w-[180px]">{p.entity}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-zinc-200">{p.headcount}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-zinc-300">
                          {p.grossPayroll.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          <span className="ml-1 text-[10px] text-cyan-300">{p.currency}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono font-semibold text-emerald-300">{fmtUSD(p.grossPayrollUSD)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-amber-300">{fmtUSD(p.employerTax)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-rose-300">{fmtUSD(p.employeeTax)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-teal-300">{fmtUSD(p.netPayroll)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-zinc-300">{fmtUSD(p.avgSalary)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-mono text-zinc-400">{p.payDate}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] capitalize ${PAYROLL_STATUS_BADGE[p.status]}`}>
                          {p.status}
                        </Badge>
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
// ENTERPRISE — Supply Chain Risk Monitor
// ═══════════════════════════════════════════════════════════════════════════════

const SCR_STATUS_BADGE: Record<SupplyChainRisk['status'], string> = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  critical: 'border-rose-500/50 bg-rose-500/20 text-rose-300',
};

function scrBarColor(score: number): string {
  if (score <= 30) return 'bg-emerald-500';
  if (score <= 50) return 'bg-teal-400';
  if (score <= 65) return 'bg-amber-400';
  return 'bg-rose-500';
}

function SupplyChainRiskMonitor() {
  const stats = useMemo(() => {
    const avgScore = SUPPLY_CHAIN_RISKS.reduce((s, v) => s + v.riskScore, 0) / SUPPLY_CHAIN_RISKS.length;
    const critical = SUPPLY_CHAIN_RISKS.filter((v) => v.status === 'high' || v.status === 'critical').length;
    const singleSource = SUPPLY_CHAIN_RISKS.filter((v) => v.singleSource).length;
    return { avgScore, critical, singleSource };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile icon={Gauge} label="Avg Risk Score" value={stats.avgScore.toFixed(1)} sub="Across all vendors" accent="amber" />
        <StatTile icon={AlertOctagon} label="Critical/High" value={String(stats.critical)} sub="Action required" accent="rose" />
        <StatTile icon={AlertTriangle} label="Single-Source" value={String(stats.singleSource)} sub="No alternate vendor" accent="violet" />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <ScrollArea className="max-h-[640px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Vendor</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Category</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-[140px]">Risk Score</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Lead Time</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">On-Time %</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Single Source</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Alts</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Last Incident</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Mitigation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {SUPPLY_CHAIN_RISKS.map((v, i) => {
                  const country = getCountry(v.vendorCountry);
                  return (
                    <motion.tr
                      key={v.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className={`border-white/[0.04] hover:bg-white/[0.03] ${
                        v.status === 'critical' ? 'bg-rose-500/[0.05]' : v.status === 'high' ? 'bg-rose-500/[0.03]' : ''
                      }`}
                    >
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">{country?.flag ?? '🏳️'}</span>
                          <span className="text-[11px] font-medium text-zinc-200 truncate max-w-[160px]">{v.vendor}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] border-white/10 bg-white/[0.02] text-zinc-400">
                          {v.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-black/40 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${v.riskScore}%` }}
                              transition={{ duration: 0.5, delay: i * 0.04 }}
                              className={`h-full ${scrBarColor(v.riskScore)}`}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-zinc-200 tabular-nums">{v.riskScore}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-zinc-300">{v.leadTimeDays}d</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-[11px] font-mono ${
                          v.onTimeRate >= 99 ? 'text-emerald-300' : v.onTimeRate >= 95 ? 'text-teal-300' : 'text-amber-300'
                        }`}>
                          {v.onTimeRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {v.singleSource ? (
                          <Badge variant="outline" className="text-[9px] border-rose-500/30 bg-rose-500/10 text-rose-300">
                            Sole-source
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                            Multi-source
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-[11px] font-mono text-zinc-300">{v.alternatives}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-mono text-zinc-400">{v.lastIncident}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] capitalize ${SCR_STATUS_BADGE[v.status]}`}>
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] text-zinc-400 truncate max-w-[240px] inline-block">{v.mitigation}</span>
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

// ─── Main Component ────────────────────────────────────────────────────────────

export default function InternationalERP() {
  const [tab, setTab] = useState<'warehouses' | 'pos' | 'invoices' | 'supply' | 'vendors' | 'landed' | 'aging' | 'customs' | 'decl-log' | 'payroll' | 'scr-risk'>('warehouses');

  const totalCapacity = useMemo(
    () => WAREHOUSES.reduce((s, w) => s + w.capacity, 0),
    [],
  );
  const totalUtilized = useMemo(
    () => WAREHOUSES.reduce((s, w) => s + w.utilized, 0),
    [],
  );
  const totalItems = useMemo(
    () => WAREHOUSES.reduce((s, w) => s + w.items, 0),
    [],
  );
  const overallPct = Math.round((totalUtilized / totalCapacity) * 100);

  return (
    <div className="space-y-6">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-teal-400" />
          <h1 className="text-xl font-semibold text-zinc-50">
            International ERP
            <sup className="text-[10px] text-teal-400 ml-0.5">™</sup>
          </h1>
        </div>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-2xl">
          Unified cross-border operations — warehouses, purchase orders, vendor scorecards,
          landed-cost analytics, inventory aging & customs documentation across 10 countries.
        </p>
      </motion.div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          icon={WarehouseIcon}
          label="Warehouses"
          value={String(WAREHOUSES.length)}
          sub="Active facilities"
          accent="teal"
        />
        <StatTile
          icon={Package}
          label="Total Items"
          value={totalItems.toLocaleString('en-US')}
          sub="SKUs in storage"
          accent="cyan"
        />
        <StatTile
          icon={Boxes}
          label="Capacity Used"
          value={`${overallPct}%`}
          sub={`${(totalUtilized / 1000).toFixed(1)}K / ${(totalCapacity / 1000).toFixed(1)}K units`}
          accent="emerald"
        />
        <StatTile
          icon={Truck}
          label="Purchase Orders"
          value={String(INTERNATIONAL_POS.length)}
          sub="Cross-border shipments"
          accent="amber"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <ScrollArea className="w-full">
          <TabsList className="bg-white/[0.02] border border-white/[0.06] h-9 inline-flex">
            <TabsTrigger
              value="warehouses"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <WarehouseIcon className="h-3.5 w-3.5" />Warehouses
            </TabsTrigger>
            <TabsTrigger
              value="pos"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <FileText className="h-3.5 w-3.5" />Purchase Orders
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <TrendingUp className="h-3.5 w-3.5" />Invoices
            </TabsTrigger>
            <TabsTrigger
              value="supply"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <Network className="h-3.5 w-3.5" />Supply Chain
            </TabsTrigger>
            <TabsTrigger
              value="vendors"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <Boxes className="h-3.5 w-3.5" />Vendors
            </TabsTrigger>
            <TabsTrigger
              value="landed"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <Calculator className="h-3.5 w-3.5" />Landed Cost
            </TabsTrigger>
            <TabsTrigger
              value="aging"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <PackageX className="h-3.5 w-3.5" />Inventory Aging
            </TabsTrigger>
            <TabsTrigger
              value="customs"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <FileCheck2 className="h-3.5 w-3.5" />Customs
            </TabsTrigger>
            <TabsTrigger
              value="decl-log"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <Anchor className="h-3.5 w-3.5" />Declarations Log
            </TabsTrigger>
            <TabsTrigger
              value="payroll"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <Users className="h-3.5 w-3.5" />Global Payroll
            </TabsTrigger>
            <TabsTrigger
              value="scr-risk"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30"
            >
              <AlertOctagon className="h-3.5 w-3.5" />Supply Risk
            </TabsTrigger>
          </TabsList>
        </ScrollArea>

        <TabsContent value="warehouses" className="mt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key="warehouses-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
            >
              {WAREHOUSES.map((w, i) => (
                <WarehouseCard key={w.id} wh={w} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="pos" className="mt-4">
          <PurchaseOrdersTab />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab />
        </TabsContent>

        <TabsContent value="supply" className="mt-4">
          <SupplyChainMap />
        </TabsContent>

        <TabsContent value="vendors" className="mt-4">
          <VendorScorecard />
        </TabsContent>

        <TabsContent value="landed" className="mt-4">
          <LandedCostCalculator />
        </TabsContent>

        <TabsContent value="aging" className="mt-4">
          <InventoryAging />
        </TabsContent>

        <TabsContent value="customs" className="mt-4">
          <CustomsTracker />
        </TabsContent>

        <TabsContent value="decl-log" className="mt-4">
          <CustomsDeclarationsLog />
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <GlobalPayrollModule />
        </TabsContent>

        <TabsContent value="scr-risk" className="mt-4">
          <SupplyChainRiskMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── StatTile (local) ──────────────────────────────────────────────────────────

function StatTile({
  icon: Icon, label, value, sub, accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent: 'emerald' | 'teal' | 'cyan' | 'amber' | 'violet' | 'rose';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.12] transition-colors"
    >
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${ACCENT_RING[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold text-zinc-50 tabular-nums">{value}</div>
      <div className="text-[10px] text-zinc-500">{sub}</div>
    </motion.div>
  );
}
