'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: INTERNATIONAL ERP™
//
// Cross-border operations hub: warehouses, purchase orders & cross-border invoices.
// All values derived from static data layer (@/lib/global/data). No API calls.
//
//   • Header with subtitle
//   • Tab navigation: Warehouses | Purchase Orders | Cross-Border Invoices
//   • Warehouses tab: cards grid w/ capacity progress, type badges
//   • Purchase Orders tab: table with route, amounts, incoterm, status, ETA
//   • Cross-Border Invoices tab: route-grouped summary w/ totals + invoice list
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Warehouse as WarehouseIcon, Truck, FileText, ArrowRight, Package,
  MapPin, Boxes, TrendingUp, Globe2, type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  WAREHOUSES, INTERNATIONAL_POS, getCountry, statusColor, formatCurrency,
  convertCurrency, fmtUSD, type Warehouse, type InternationalPO, type CountryCode,
} from '@/lib/global/data';

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

const ACCENT_RING: Record<'emerald' | 'teal' | 'cyan' | 'amber' | 'violet', string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
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
            {INTERNATIONAL_POS.map((po, i) => {
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

  // KPI tiles for invoices tab
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
      {/* KPI tiles */}
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

      {/* Route summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {routes.map((r, i) => (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.14] transition-all"
          >
            {/* route header */}
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

            {/* invoice list */}
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

// ─── Main Component ────────────────────────────────────────────────────────────

export default function InternationalERP() {
  const [tab, setTab] = useState<'warehouses' | 'pos' | 'invoices'>('warehouses');

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
          Unified cross-border operations — warehouses, purchase orders & multi-currency
          invoices across 10 countries with real-time inventory and trade flow visibility.
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
        <TabsList className="bg-white/[0.02] border border-white/[0.06] h-9">
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
            <TrendingUp className="h-3.5 w-3.5" />Cross-Border Invoices
          </TabsTrigger>
        </TabsList>

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
  accent: 'emerald' | 'teal' | 'cyan' | 'amber' | 'violet';
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
