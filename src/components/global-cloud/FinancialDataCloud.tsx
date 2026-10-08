'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 5
// FINANCIAL DATA CLOUD™
//
// Subtitle: "11 Unified Domains · 1.1B Records · 15.4 TB Storage · Real-time Sync"
//
// A unified financial data layer synchronizing 11 domains across every connected
// system in real-time. Visualizes domain cards, sync jobs, a source→cloud→consumer
// flow diagram, and a proportional storage breakdown bar.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Database, HardDrive, Clock, Layers, Activity,
  CheckCircle2, RefreshCw, Hourglass, XCircle, Cloud, Cpu, BarChart3,
  BrainCircuit, Webhook, Store, Plug, ArrowRightLeft, Zap, Server,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DATA_DOMAINS, DATA_SYNC_JOBS, ACCENT_CLASSES, fmtN, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Static Source / Consumer definitions (deterministic, in-file) ────────────
interface FlowNode { label: string; icon: string; accent: Accent; }

const SOURCES: FlowNode[] = [
  { label: 'Tally Prime',     icon: 'database',  accent: 'emerald' },
  { label: 'SAP S/4HANA',     icon: 'database',  accent: 'teal'    },
  { label: 'QuickBooks',      icon: 'database',  accent: 'cyan'    },
  { label: 'HDFC Bank',       icon: 'database',  accent: 'violet'  },
  { label: 'Salesforce',      icon: 'database',  accent: 'amber'   },
  { label: 'GST Network',     icon: 'database',  accent: 'rose'    },
  { label: 'Google Drive',    icon: 'database',  accent: 'emerald' },
  { label: 'Internal HRMS',   icon: 'database',  accent: 'teal'    },
];

const CONSUMERS: FlowNode[] = [
  { label: 'Analytics',         icon: 'analytics', accent: 'emerald' },
  { label: 'BI Dashboards',     icon: 'bi',        accent: 'teal'    },
  { label: 'AI Oracle™',        icon: 'ai',        accent: 'violet'  },
  { label: 'API Gateway',       icon: 'api',       accent: 'cyan'    },
  { label: 'Webhooks',          icon: 'webhook',   accent: 'amber'   },
  { label: 'Marketplace Apps',  icon: 'store',     accent: 'rose'    },
];

const ICONS: Record<string, LucideIcon> = {
  database: Database, analytics: Activity, bi: BarChart3, ai: BrainCircuit,
  api: Plug, webhook: Webhook, store: Store,
};

// ─── KPI tile helper ──────────────────────────────────────────────────────────
function KpiTile({
  label, value, sub, accent, icon: Icon,
}: { label: string; value: string; sub: string; accent: Accent; icon: LucideIcon }) {
  const a = ACCENT_CLASSES[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('rounded-2xl border p-4', a.border, a.bg)}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</div>
        <Icon className={cn('h-4 w-4', a.text)} />
      </div>
      <div className={cn('mt-2 text-2xl font-bold', a.text)}>{value}</div>
      <div className="mt-0.5 text-[10px] text-white/40">{sub}</div>
    </motion.div>
  );
}

// ─── Sync status renderer ─────────────────────────────────────────────────────
function SyncStatusBadge({ status }: { status: 'synced' | 'syncing' | 'pending' }) {
  if (status === 'synced') {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Synced
      </Badge>
    );
  }
  if (status === 'syncing') {
    return (
      <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
        <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Syncing
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
      <Hourglass className="mr-1 h-3 w-3" /> Pending
    </Badge>
  );
}

// ─── Sync job status renderer ─────────────────────────────────────────────────
function JobStatusBadge({ status }: { status: 'success' | 'running' | 'queued' | 'failed' }) {
  switch (status) {
    case 'success':
      return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Success
        </Badge>
      );
    case 'running':
      return (
        <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
          <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Running
        </Badge>
      );
    case 'queued':
      return (
        <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">
          <Hourglass className="mr-1 h-3 w-3" /> Queued
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
          <XCircle className="mr-1 h-3 w-3" /> Failed
        </Badge>
      );
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FinancialDataCloud() {
  const { setCurrentView } = useApp();

  // ─── Deterministic derived metrics ────────────────────────────────────────
  const totalRecords   = DATA_DOMAINS.reduce((s, d) => s + d.records, 0);
  const totalStorageGB = DATA_DOMAINS.reduce((s, d) => s + d.storageGB, 0);
  const totalStorageTB = (totalStorageGB / 1024).toFixed(1);
  const totalConsumers = DATA_DOMAINS.reduce((s, d) => s + d.consumers, 0);

  // Storage breakdown proportions
  const maxStorage = Math.max(...DATA_DOMAINS.map(d => d.storageGB));

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ─── HEADER ───────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 -z-0">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                onClick={() => setCurrentView('global-financial-cloud')}
                variant="outline"
                size="sm"
                className="border-white/10 bg-white/[0.02] text-white hover:bg-white/[0.06]"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Hub
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                  <Database className="mr-1.5 h-3 w-3" /> Phase 16 · Module 5
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <Activity className="mr-1.5 h-3 w-3" /> Real-time
                </Badge>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
                <Database className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Financial Data Cloud
                  <span className="ml-1 bg-gradient-to-r from-amber-300 to-emerald-300 bg-clip-text text-transparent">™</span>
                </h1>
                <p className="mt-0.5 text-xs text-white/55 sm:text-sm">
                  11 Unified Domains · 1.1B Records · 15.4 TB Storage · Real-time Sync
                </p>
              </div>
            </div>

            {/* KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label="Domains"      value="11"              sub="All unified & synced"   accent="emerald" icon={Layers}      />
              <KpiTile label="Records"      value={fmtN(totalRecords)} sub="Across 11 domains"     accent="teal"    icon={Database}    />
              <KpiTile label="Storage"      value={`${totalStorageTB} TB`} sub="SSD-backed, encrypted" accent="cyan"    icon={HardDrive}   />
              <KpiTile label="Avg Freshness" value="12 sec"          sub="Source → Cloud latency" accent="amber"   icon={Clock}       />
            </div>
          </div>
        </motion.section>

        {/* ─── DOMAIN CARDS GRID ────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Unified Data Domains</h2>
              <p className="text-xs text-white/50">
                {DATA_DOMAINS.length} domains · {fmtN(totalRecords)} records · {fmtN(totalConsumers)} active consumers
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
              <Layers className="mr-1.5 h-3 w-3" /> Schemas versioned
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {DATA_DOMAINS.map((d, idx) => {
              const a = ACCENT_CLASSES[d.accent];
              return (
                <motion.div
                  key={d.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.4) }}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4',
                    'transition-all duration-300 hover:-translate-y-0.5',
                    a.border,
                  )}
                >
                  <div className={cn('pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br from-transparent via-transparent to-transparent', a.bg)} />

                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{d.name}</h3>
                        <Badge variant="outline" className={cn('mt-1 border-white/10 bg-white/[0.02] font-mono text-[10px]', a.text)}>
                          schema {d.schema}
                        </Badge>
                      </div>
                      <SyncStatusBadge status={d.syncStatus} />
                    </div>

                    {/* Stats grid */}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Records</div>
                        <div className={cn('text-base font-bold', a.text)}>{fmtN(d.records)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Storage</div>
                        <div className="text-base font-bold text-white">{d.storageGB >= 1024 ? `${(d.storageGB / 1024).toFixed(1)} TB` : `${d.storageGB} GB`}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Consumers</div>
                        <div className="text-base font-bold text-white">{d.consumers}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Freshness</div>
                        <div className="text-xs font-medium text-white/80">{d.freshness}</div>
                      </div>
                    </div>

                    {/* Storage bar */}
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className={cn('h-full rounded-full', a.bar)}
                          style={{ width: `${(d.storageGB / maxStorage) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─── SYNC JOBS TABLE ──────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <RefreshCw className="h-4 w-4 text-emerald-300" />
                  Active Sync Jobs
                </CardTitle>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  {DATA_SYNC_JOBS.length} jobs · {DATA_SYNC_JOBS.filter(j => j.status === 'running').length} running
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96 rounded-lg border border-white/[0.04]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wider text-white/50">Domain</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-white/50">Source → Destination</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Records</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Duration</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DATA_SYNC_JOBS.map((j) => {
                      const domain = DATA_DOMAINS.find(d => d.name === j.domain);
                      const a = domain ? ACCENT_CLASSES[domain.accent] : ACCENT_CLASSES.emerald;
                      return (
                        <TableRow key={`${j.domain}-${j.source}`} className="border-white/[0.04] hover:bg-white/[0.02]">
                          <TableCell className={cn('font-medium', a.text)}>{j.domain}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="rounded-md border border-white/10 bg-white/[0.02] px-1.5 py-0.5 text-white/80">{j.source}</span>
                              <ArrowRight className="h-3 w-3 text-white/40" />
                              <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">{j.destination}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/80">{fmtN(j.records)}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/60">{j.duration}</TableCell>
                          <TableCell className="text-right"><JobStatusBadge status={j.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── DATA FLOW DIAGRAM ────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <Card className="overflow-hidden border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <ArrowRightLeft className="h-4 w-4 text-teal-300" />
                  Data Flow Diagram
                </CardTitle>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  {SOURCES.length} sources · {CONSUMERS.length} consumers
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
                {/* Sources column */}
                <div>
                  <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-white/40">Sources</div>
                  <div className="space-y-1.5">
                    {SOURCES.map((s) => {
                      const Icon = ICONS[s.icon] ?? Database;
                      const a = ACCENT_CLASSES[s.accent];
                      return (
                        <div
                          key={s.label}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border bg-white/[0.02] px-2.5 py-1.5',
                            a.border,
                          )}
                        >
                          <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', a.bg)}>
                            <Icon className={cn('h-3.5 w-3.5', a.text)} />
                          </div>
                          <span className="text-xs font-medium text-white/80">{s.label}</span>
                          <ArrowRight className="ml-auto h-3 w-3 text-white/30" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Center hub node */}
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative">
                    {/* Glow rings */}
                    <div className="absolute -inset-6 -z-10 rounded-full bg-emerald-500/15 blur-2xl" />
                    <div className="absolute -inset-3 -z-10 rounded-3xl bg-emerald-500/10 blur-xl" />

                    {/* Arrow in from left (visible only on lg) */}
                    <div className="absolute left-[-40px] top-1/2 hidden h-px w-10 -translate-y-1/2 bg-gradient-to-r from-transparent via-emerald-500/50 to-emerald-400 lg:block" />

                    <motion.div
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      className="relative flex w-44 flex-col items-center rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/[0.06] to-transparent p-4 shadow-[0_0_50px_-10px_rgba(37,99,235,0.5)]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15">
                        <Cloud className="h-6 w-6 text-emerald-300" />
                      </div>
                      <div className="mt-3 text-center">
                        <div className="text-sm font-bold text-white">Financial</div>
                        <div className="text-sm font-bold text-white">Data Cloud™</div>
                      </div>
                      <div className="mt-1 text-[10px] text-emerald-300/80">11 domains · 1.1B records</div>

                      {/* pulse dot */}
                      <div className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center">
                        <span className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400/60" />
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      </div>
                    </motion.div>

                    {/* Arrow out to right (visible only on lg) */}
                    <div className="absolute right-[-40px] top-1/2 hidden h-px w-10 -translate-y-1/2 bg-gradient-to-l from-transparent via-emerald-500/50 to-emerald-400 lg:block" />
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-[10px] text-white/40">
                    <Zap className="h-3 w-3 text-emerald-300" />
                    Real-time CDC pipeline
                  </div>
                </div>

                {/* Consumers column */}
                <div>
                  <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-white/40">Consumers</div>
                  <div className="space-y-1.5">
                    {CONSUMERS.map((c) => {
                      const Icon = ICONS[c.icon] ?? Database;
                      const a = ACCENT_CLASSES[c.accent];
                      return (
                        <div
                          key={c.label}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border bg-white/[0.02] px-2.5 py-1.5',
                            a.border,
                          )}
                        >
                          <ArrowLeft className="h-3 w-3 text-white/30" />
                          <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', a.bg)}>
                            <Icon className={cn('h-3.5 w-3.5', a.text)} />
                          </div>
                          <span className="text-xs font-medium text-white/80">{c.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── STORAGE BREAKDOWN ────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <HardDrive className="h-4 w-4 text-cyan-300" />
                  Storage Breakdown by Domain
                </CardTitle>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  Total: {totalStorageTB} TB
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stacked horizontal bar */}
              <div className="flex h-7 w-full overflow-hidden rounded-lg border border-white/[0.06]">
                {DATA_DOMAINS.map((d) => {
                  const a = ACCENT_CLASSES[d.accent];
                  const width = (d.storageGB / totalStorageGB) * 100;
                  return (
                    <div
                      key={d.name}
                      className={cn('relative h-full transition-all hover:brightness-125', a.bar)}
                      style={{ width: `${width}%` }}
                      title={`${d.name}: ${d.storageGB >= 1024 ? `${(d.storageGB / 1024).toFixed(1)} TB` : `${d.storageGB} GB`}`}
                    >
                      {width > 6 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[9px] font-semibold text-black/70">{d.storageGB >= 1024 ? `${(d.storageGB / 1024).toFixed(1)}T` : `${d.storageGB}G`}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <Separator className="my-4 bg-white/[0.06]" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {DATA_DOMAINS.map((d) => {
                  const a = ACCENT_CLASSES[d.accent];
                  const pct = ((d.storageGB / totalStorageGB) * 100).toFixed(1);
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', a.bar)} />
                      <span className="text-white/70">{d.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-white/40">{pct}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Summary footer */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                    <Server className="h-3 w-3" /> Total Storage
                  </div>
                  <div className="mt-1 text-base font-bold text-white">{totalStorageTB} TB</div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                    <Database className="h-3 w-3" /> Domains
                  </div>
                  <div className="mt-1 text-base font-bold text-white">{DATA_DOMAINS.length}</div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                    <Layers className="h-3 w-3" /> Avg / Domain
                  </div>
                  <div className="mt-1 text-base font-bold text-white">{(totalStorageGB / DATA_DOMAINS.length / 1024).toFixed(1)} TB</div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                    <Cpu className="h-3 w-3" /> Replication
                  </div>
                  <div className="mt-1 text-base font-bold text-white">3× copies</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── FOOTER ───────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center">
          <Database className="h-3.5 w-3.5 text-white/30" />
          <p className="text-[11px] text-white/40">
            One unified financial data layer. Every system. Every developer. — VEYRO™
          </p>
        </div>
      </div>
    </div>
  );
}
