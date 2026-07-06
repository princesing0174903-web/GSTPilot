'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: INTERNATIONAL REPORTS™
//
// The global financial reporting cockpit: every country, currency, cash flow,
// P&L, regional, and tax report — across all jurisdictions and formats. Real
// data from /lib/global/data.ts — no mocks, no API calls, no Math.random.
//
//   • Generate New Report CTA card at the top
//   • 4 KPI tiles              — Total / Ready / Generating / Scheduled
//   • Category filter          — All / Country / Currency / Cash Flow / P&L / Regional / Tax
//   • Reports table            — name, category badge, scope, period, generatedOn,
//                                 format badge (PDF=red, XLSX=emerald, CSV=cyan),
//                                 status badge, action buttons (Download/Regenerate/Schedule)
//
// Tagline: One Report Engine. Every Jurisdiction. Total Audit Readiness.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, FileSpreadsheet, FileBarChart, Plus, Sparkles,
  Download, RefreshCw, CalendarClock, Filter, CheckCircle2,
  Clock, Loader2, FileStack, type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  GLOBAL_REPORTS, statusColor,
  type GlobalReport,
} from '@/lib/global/data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Helpers ───────────────────────────────────────────────────────────────────

type Category = 'all' | GlobalReport['category'];

const CATEGORY_LIST: GlobalReport['category'][] = [
  'Country', 'Currency', 'Cash Flow', 'P&L', 'Regional', 'Tax',
];

const CATEGORY_BADGE: Record<GlobalReport['category'], string> = {
  'Country': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  'Currency': 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  'Cash Flow': 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  'P&L': 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  'Regional': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Tax': 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const FORMAT_BADGE: Record<GlobalReport['format'], string> = {
  PDF: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  XLSX: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  CSV: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
};

const FORMAT_ICON: Record<GlobalReport['format'], LucideIcon> = {
  PDF: FileText,
  XLSX: FileSpreadsheet,
  CSV: FileBarChart,
};

const STATUS_BADGE: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  slate: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

const STATUS_ICON: Record<string, LucideIcon> = {
  emerald: CheckCircle2,
  amber: Loader2,
  slate: Clock,
};

// ─── KPI Tile ──────────────────────────────────────────────────────────────────

function KpiTile({
  icon: Icon, label, value, sub, accent, ring,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  ring: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className={cn('absolute -right-5 -top-5 h-16 w-16 rounded-full blur-2xl opacity-40', ring)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={cn('mt-1 text-xl font-semibold tracking-tight', accent)}>{value}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{sub}</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08]', accent)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Filter pill ───────────────────────────────────────────────────────────────

function FilterPill({
  active, onClick, children, count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
        active
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-white hover:bg-white/[0.04]',
      )}
    >
      {children}
      {typeof count === 'number' && (
        <span className={cn(
          'ml-0.5 rounded px-1 text-[10px]',
          active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/[0.05] text-muted-foreground',
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function InternationalReports() {
  const [category, setCategory] = useState<Category>('all');
  const { toast } = useToast();

  // KPI counts
  const counts = useMemo(() => ({
    total: GLOBAL_REPORTS.length,
    ready: GLOBAL_REPORTS.filter((r) => r.status === 'ready').length,
    generating: GLOBAL_REPORTS.filter((r) => r.status === 'generating').length,
    scheduled: GLOBAL_REPORTS.filter((r) => r.status === 'scheduled').length,
  }), []);

  // Filtered reports
  const filtered = useMemo(() => {
    if (category === 'all') return GLOBAL_REPORTS;
    return GLOBAL_REPORTS.filter((r) => r.category === category);
  }, [category]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const base: Record<Category, number> = {
      all: GLOBAL_REPORTS.length,
      Country: 0, Currency: 0, 'Cash Flow': 0, 'P&L': 0, Regional: 0, Tax: 0,
    };
    for (const r of GLOBAL_REPORTS) base[r.category] += 1;
    return base;
  }, []);

  const handleDownload = (r: GlobalReport) => {
    toast({
      title: 'Download started',
      description: `${r.name} (${r.format}) is being prepared for download.`,
    });
  };
  const handleRegenerate = (r: GlobalReport) => {
    toast({
      title: 'Report queued',
      description: `${r.name} has been queued for regeneration.`,
    });
  };
  const handleSchedule = (r: GlobalReport) => {
    toast({
      title: 'Schedule created',
      description: `${r.name} has been scheduled for recurring generation.`,
    });
  };
  const handleGenerateNew = () => {
    toast({
      title: 'Report wizard launched',
      description: 'Choose a category, scope, period, and format to generate a new report.',
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <FileStack className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                International Reports<sup className="text-[10px] text-emerald-400">™</sup>
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Multi-jurisdiction financial reporting — country, currency, cash flow, P&L, regional & tax.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <CheckCircle2 className="mr-1 h-3 w-3" /> {counts.ready} Ready
            </Badge>
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> {counts.generating} Generating
            </Badge>
            <Badge className="border-slate-500/30 bg-slate-500/10 text-slate-300">
              <CalendarClock className="mr-1 h-3 w-3" /> {counts.scheduled} Scheduled
            </Badge>
          </div>
        </motion.div>

        <Separator className="my-5 bg-white/[0.06]" />

        {/* ─── Generate New Report CTA ─── */}
        <motion.button
          type="button"
          onClick={handleGenerateNew}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          className="group w-full text-left"
        >
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-cyan-500/[0.04] transition-colors group-hover:border-emerald-500/50">
            <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10">
                  <Plus className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Generate New Report</h3>
                  <p className="text-xs text-muted-foreground">
                    Country · Currency · Cash Flow · P&L · Regional · Tax — across all jurisdictions & formats.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <Sparkles className="mr-1 h-3 w-3" /> AI-Assisted
                </Badge>
                <span className="text-emerald-300 text-sm font-medium">Open wizard →</span>
              </div>
            </CardContent>
          </Card>
        </motion.button>

        {/* ─── KPI Row ─── */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile
            icon={FileStack}
            label="Total Reports"
            value={counts.total}
            sub="Across all categories"
            accent="text-white"
            ring="bg-white/30"
          />
          <KpiTile
            icon={CheckCircle2}
            label="Ready"
            value={counts.ready}
            sub="Available to download"
            accent="text-emerald-300"
            ring="bg-emerald-500/30"
          />
          <KpiTile
            icon={Loader2}
            label="Generating"
            value={counts.generating}
            sub="In pipeline"
            accent="text-amber-300"
            ring="bg-amber-500/30"
          />
          <KpiTile
            icon={CalendarClock}
            label="Scheduled"
            value={counts.scheduled}
            sub="Recurring runs"
            accent="text-slate-300"
            ring="bg-slate-500/30"
          />
        </div>

        {/* ─── Category Filters ─── */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Category</span>
          </div>
          <FilterPill active={category === 'all'} onClick={() => setCategory('all')} count={categoryCounts.all}>
            All
          </FilterPill>
          {CATEGORY_LIST.map((cat) => (
            <FilterPill
              key={cat}
              active={category === cat}
              onClick={() => setCategory(cat)}
              count={categoryCounts[cat]}
            >
              {cat}
            </FilterPill>
          ))}
        </div>

        {/* ─── Reports Table ─── */}
        <Card className="mt-4 border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white">Report Library</CardTitle>
              <span className="text-[11px] text-muted-foreground">
                Showing <span className="text-emerald-300">{filtered.length}</span> of {GLOBAL_REPORTS.length}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[560px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Report</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Scope</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Period</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Generated</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Format</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((r, i) => {
                      const color = statusColor(r.status);
                      const StatusIcon = STATUS_ICON[color] ?? Clock;
                      const FormatIcon = FORMAT_ICON[r.format];
                      return (
                        <motion.tr
                          key={r.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25, delay: i * 0.02 }}
                          className="border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', FORMAT_BADGE[r.format])}>
                                <FormatIcon className="h-4 w-4" />
                              </div>
                              <span className="text-[12px] font-medium text-white">{r.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium', CATEGORY_BADGE[r.category])}>
                              {r.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-[11px] text-white/90">{r.scope}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{r.period}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{r.generatedOn}</TableCell>
                          <TableCell>
                            <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-medium', FORMAT_BADGE[r.format])}>
                              {r.format}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize', STATUS_BADGE[color])}>
                              <StatusIcon className={cn('h-2.5 w-2.5', color === 'amber' && 'animate-spin')} />
                              {r.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={r.status !== 'ready'}
                                onClick={() => handleDownload(r)}
                                className={cn(
                                  'h-7 px-2 text-[10px] border-white/[0.08]',
                                  r.status === 'ready'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                    : 'bg-white/[0.02] text-muted-foreground opacity-50 cursor-not-allowed',
                                )}
                              >
                                <Download className="h-3 w-3" />
                                <span className="ml-1 hidden sm:inline">Download</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRegenerate(r)}
                                className="h-7 px-2 text-[10px] border-white/[0.08] bg-white/[0.02] text-cyan-300 hover:bg-cyan-500/10"
                              >
                                <RefreshCw className="h-3 w-3" />
                                <span className="ml-1 hidden sm:inline">Regenerate</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSchedule(r)}
                                className="h-7 px-2 text-[10px] border-white/[0.08] bg-white/[0.02] text-violet-300 hover:bg-violet-500/10"
                              >
                                <CalendarClock className="h-3 w-3" />
                                <span className="ml-1 hidden sm:inline">Schedule</span>
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No reports in this category.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ─── Footer ─── */}
        <div className="mt-5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Reports are auto-generated from live financial data across all jurisdictions.</span>
          <span>PDF · XLSX · CSV supported</span>
        </div>
      </div>
    </div>
  );
}
