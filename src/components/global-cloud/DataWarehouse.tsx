'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 8
// ENTERPRISE DATA WAREHOUSE™
//
// Subtitle: "8 Datasets · 1.6B Rows · 1.9M Queries/24h · Petabyte-Scale"
//
// Petabyte-scale analytics warehouse with 8 fact/dim tables, saved SQL queries,
// BI dashboards and natural-language AI queries. Visualizes datasets, queries,
// BI dashboards, AI queries (NL→SQL), and storage utilization.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BarChart3, Database, HardDrive, Search,
  CheckCircle2, Play, Clock, Users, RefreshCw, Sparkles, Cpu,
  TrendingUp, Zap, FileCode2, BrainCircuit, type LucideIcon,
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
  WAREHOUSE_DATASETS, SAVED_QUERIES, BI_DASHBOARDS, AI_QUERIES,
  ACCENT_CLASSES, fmtN, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parse dataset size strings (e.g. '1.8 TB', '980 GB', '64 GB') → GB (number)
function sizeToGB(size: string): number {
  const s = size.trim();
  if (s.endsWith('TB')) return parseFloat(s) * 1024;
  if (s.endsWith('GB')) return parseFloat(s);
  return parseFloat(s) || 0;
}

// Deterministic mini-sparkline bar heights (no Math.random — curated per index)
const SPARK_HEIGHTS = [40, 55, 35, 70, 60, 80, 50, 75, 45, 65, 90, 55];

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

// ─── Saved query card (stateful Run button) ───────────────────────────────────
function SavedQueryCard({
  query, index,
}: { query: typeof SAVED_QUERIES[number]; index: number }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  // Deterministic accent rotation
  const accents: Accent[] = ['emerald', 'teal', 'cyan', 'violet', 'amber', 'rose'];
  const accent = accents[index % accents.length];
  const a = ACCENT_CLASSES[accent];

  const handleRun = () => {
    if (running || done) return;
    setRunning(true);
    // Use setTimeout — NOT Date.now or setInterval-based randomness
    window.setTimeout(() => {
      setRunning(false);
      setDone(true);
      window.setTimeout(() => setDone(false), 2400);
    }, 700);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4',
        a.border,
      )}
    >
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileCode2 className={cn('h-3.5 w-3.5 shrink-0', a.text)} />
              <h3 className="truncate text-sm font-semibold text-white">{query.name}</h3>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
              <Users className="h-3 w-3" />
              <span>{query.author}</span>
            </div>
          </div>
          <Button
            onClick={handleRun}
            size="sm"
            variant="outline"
            disabled={running}
            className={cn(
              'h-7 shrink-0 border-white/10 bg-white/[0.02] px-2 text-[10px] text-white hover:bg-white/[0.06]',
              done && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
            )}
          >
            {running ? (
              <>
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Running…
              </>
            ) : done ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" /> Done · {query.avgMs} ms
              </>
            ) : (
              <>
                <Play className="mr-1 h-3 w-3" /> Run
              </>
            )}
          </Button>
        </div>

        {/* SQL preview */}
        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/40 p-2.5">
          <code className="block truncate font-mono text-[11px] leading-relaxed text-emerald-300/80">
            <span className="text-violet-300/70">{'>'}</span> {query.sql}
          </code>
        </div>

        {/* Stats */}
        <Separator className="my-3 bg-white/[0.06]" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[9px] uppercase tracking-wide text-white/40">Runs</div>
            <div className={cn('text-sm font-bold', a.text)}>{fmtN(query.runs)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-white/40">Avg ms</div>
            <div className="text-sm font-bold text-white">{query.avgMs}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-white/40">Cache</div>
            <div className="text-sm font-bold text-white">{query.cacheHit}%</div>
          </div>
        </div>

        {/* Inline success flash */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300"
            >
              <CheckCircle2 className="h-3 w-3" />
              Query executed successfully · {fmtN(query.runs + 1)} total runs · {query.avgMs} ms
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DataWarehouse() {
  const { setCurrentView } = useApp();

  // ─── Deterministic derived metrics ────────────────────────────────────────
  const totalRows     = WAREHOUSE_DATASETS.reduce((s, d) => s + d.rows, 0);
  const totalQueries  = WAREHOUSE_DATASETS.reduce((s, d) => s + d.queries24h, 0);
  const totalSizeGB   = WAREHOUSE_DATASETS.reduce((s, d) => s + sizeToGB(d.size), 0);
  const totalSizeTB   = (totalSizeGB / 1024).toFixed(1);
  const maxSizeGB     = Math.max(...WAREHOUSE_DATASETS.map(d => sizeToGB(d.size)));

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
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
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
                <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-300">
                  <BarChart3 className="mr-1.5 h-3 w-3" /> Phase 16 · Module 8
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <Cpu className="mr-1.5 h-3 w-3" /> Petabyte-scale
                </Badge>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-500/30 bg-teal-500/10">
                <BarChart3 className="h-6 w-6 text-teal-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Enterprise Data Warehouse
                  <span className="ml-1 bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">™</span>
                </h1>
                <p className="mt-0.5 text-xs text-white/55 sm:text-sm">
                  8 Datasets · 1.6B Rows · 1.9M Queries/24h · Petabyte-Scale
                </p>
              </div>
            </div>

            {/* KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label="Datasets"    value={String(WAREHOUSE_DATASETS.length)} sub="Facts + dimensions"          accent="emerald" icon={Database}    />
              <KpiTile label="Total Rows"  value={fmtN(totalRows)}                   sub="Across 8 tables"              accent="teal"    icon={HardDrive}   />
              <KpiTile label="Storage"     value={`${totalSizeTB} TB`}                sub="SSD + columnar compressed"    accent="cyan"    icon={HardDrive}   />
              <KpiTile label="Queries/24h" value={fmtN(totalQueries)}                sub="Avg 124ms p95"                accent="amber"   icon={Search}      />
            </div>
          </div>
        </motion.section>

        {/* ─── DATASETS TABLE ───────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Database className="h-4 w-4 text-teal-300" />
                  Warehouse Datasets
                </CardTitle>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  {WAREHOUSE_DATASETS.length} tables · {fmtN(totalRows)} rows
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96 rounded-lg border border-white/[0.04]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wider text-white/50">Dataset</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-white/50">Schema</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Rows</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Size</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Freshness</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Queries / 24h</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {WAREHOUSE_DATASETS.map((d) => {
                      const a = ACCENT_CLASSES[d.accent];
                      // Deterministic schema version per dataset
                      const schemaVersion = `v4.${(d.name.length % 4) + 1}`;
                      return (
                        <TableRow key={d.name} className="border-white/[0.04] hover:bg-white/[0.02]">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn('h-1.5 w-1.5 rounded-full', a.bar)} />
                              <code className={cn('font-mono text-xs font-medium', a.text)}>{d.name}</code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-white/10 bg-white/[0.02] font-mono text-[10px] text-white/70">
                              {schemaVersion}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/80">{fmtN(d.rows)}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/70">{d.size}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/50">{d.freshness}</TableCell>
                          <TableCell className="text-right">
                            <div className="ml-auto flex items-center justify-end gap-2">
                              <span className="font-mono text-xs text-white/80">{fmtN(d.queries24h)}</span>
                              <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.04] sm:block">
                                <div
                                  className={cn('h-full rounded-full', a.bar)}
                                  style={{ width: `${(d.queries24h / Math.max(...WAREHOUSE_DATASETS.map(x => x.queries24h))) * 100}%` }}
                                />
                              </div>
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
        </motion.section>

        {/* ─── SAVED QUERIES ────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Saved Queries</h2>
              <p className="text-xs text-white/50">
                {SAVED_QUERIES.length} curated SQL snippets · click Run to execute
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
              <Zap className="mr-1.5 h-3 w-3" /> Cached & indexed
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SAVED_QUERIES.length === 0 ? (
              <div className="col-span-full h-32 flex flex-col items-center justify-center text-white/40">
                <Database className="h-8 w-8 mb-2 text-white/20" />
                <p className="text-sm font-medium">No saved queries yet</p>
                <p className="text-xs text-white/30 mt-1">Curated SQL snippets will appear here once saved</p>
              </div>
            ) : SAVED_QUERIES.map((q, i) => (
              <SavedQueryCard key={q.name} query={q} index={i} />
            ))}
          </div>
        </motion.section>

        {/* ─── BI DASHBOARDS GRID ───────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">BI Dashboards</h2>
              <p className="text-xs text-white/50">
                {BI_DASHBOARDS.length} live dashboards · {BI_DASHBOARDS.reduce((s, d) => s + d.viewers, 0)} total viewers
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
              <TrendingUp className="mr-1.5 h-3 w-3" /> Real-time
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BI_DASHBOARDS.map((d, idx) => {
              const a = ACCENT_CLASSES[d.accent];
              return (
                <motion.div
                  key={d.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4',
                    'transition-all duration-300 hover:-translate-y-0.5',
                    a.border,
                  )}
                >
                  {/* Mini sparkline decoration (top-right) */}
                  <div className="absolute right-3 top-3 flex h-8 items-end gap-0.5">
                    {SPARK_HEIGHTS.map((h, i) => (
                      <div
                        key={i}
                        className={cn('w-0.5 rounded-full opacity-60', a.bar)}
                        style={{ height: `${h * 0.32}px` }}
                      />
                    ))}
                  </div>

                  <div className="relative z-10">
                    <h3 className="pr-24 text-sm font-semibold text-white">{d.name}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/50">
                      <Users className="h-3 w-3" />
                      {d.owner}
                    </div>

                    <Separator className="my-3 bg-white/[0.06]" />

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Viewers</div>
                        <div className={cn('text-sm font-bold', a.text)}>{d.viewers}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Refresh</div>
                        <div className="flex items-center gap-1 text-sm font-bold text-white">
                          <RefreshCw className="h-3 w-3 text-white/40" />
                          {d.refresh}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Tiles</div>
                        <div className="text-sm font-bold text-white">{d.tiles}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─── AI QUERIES (NL → SQL) ────────────────────────────────────── */}
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
                  <BrainCircuit className="h-4 w-4 text-violet-300" />
                  AI Queries — Natural Language → SQL
                </CardTitle>
                <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300">
                  <Sparkles className="mr-1 h-3 w-3" /> Oracle™ powered
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {AI_QUERIES.map((q, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
                    className="space-y-2"
                  >
                    {/* User bubble — right aligned */}
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-sm border border-white/[0.06] bg-white/[0.04] px-3.5 py-2">
                        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-white/40">
                          <Users className="h-3 w-3" /> You
                        </div>
                        <p className="mt-0.5 text-sm leading-relaxed text-white/90">{q.question}</p>
                      </div>
                    </div>

                    {/* AI response — left aligned, emerald-tinted SQL block */}
                    <div className="flex justify-start">
                      <div className="max-w-[85%] space-y-2">
                        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-violet-300/80">
                          <BrainCircuit className="h-3 w-3" /> Oracle™ SQL Generator
                        </div>
                        {/* SQL code block */}
                        <div className="overflow-x-auto rounded-2xl rounded-bl-sm border border-emerald-500/20 bg-emerald-500/[0.05] px-3.5 py-2.5">
                          <code className="block whitespace-pre font-mono text-[11px] leading-relaxed text-emerald-200/90">
                            <span className="text-violet-300/70">{'>'}</span> {q.sqlGenerated}
                          </code>
                        </div>
                        {/* Confidence + runtime badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn(
                            'border-white/10 bg-white/[0.02] text-[10px]',
                            q.confidence >= 95 ? 'text-emerald-300' : q.confidence >= 90 ? 'text-teal-300' : 'text-amber-300',
                          )}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {q.confidence}% confidence
                          </Badge>
                          <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-[10px] text-white/70">
                            <Clock className="mr-1 h-3 w-3" />
                            {q.runtime}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Separator between conversations */}
                    {idx < AI_QUERIES.length - 1 && (
                      <Separator className="bg-white/[0.04]" />
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Hint footer */}
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2 text-[11px] text-violet-200/80">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Ask in plain English — Oracle™ translates to optimized SQL, runs against the warehouse, and returns results in under 4 seconds.
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── STORAGE UTILIZATION ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <HardDrive className="h-4 w-4 text-cyan-300" />
                  Storage Utilization by Dataset
                </CardTitle>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  Total: {totalSizeTB} TB · 3× replicated
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Top summary */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Total Storage</div>
                  <div className="mt-1 text-base font-bold text-white">{totalSizeTB} TB</div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Datasets</div>
                  <div className="mt-1 text-base font-bold text-white">{WAREHOUSE_DATASETS.length}</div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Largest Table</div>
                  <div className="mt-1 text-base font-bold text-white">
                    {WAREHOUSE_DATASETS.reduce((m, d) => sizeToGB(d.size) > sizeToGB(m.size) ? d : m, WAREHOUSE_DATASETS[0]).name}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Compression</div>
                  <div className="mt-1 text-base font-bold text-white">3.8× ratio</div>
                </div>
              </div>

              {/* Per-dataset horizontal bars */}
              <div className="space-y-2.5">
                {WAREHOUSE_DATASETS.map((d) => {
                  const a = ACCENT_CLASSES[d.accent];
                  const gb = sizeToGB(d.size);
                  const widthPct = (gb / maxSizeGB) * 100;
                  const pctOfTotal = ((gb / totalSizeGB) * 100).toFixed(1);
                  return (
                    <div key={d.name} className="grid grid-cols-[140px_1fr_60px] items-center gap-3 sm:grid-cols-[180px_1fr_80px]">
                      <code className={cn('truncate font-mono text-xs', a.text)}>{d.name}</code>
                      <div className="h-6 w-full overflow-hidden rounded-md border border-white/[0.04] bg-white/[0.02]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' as const }}
                          className={cn('relative flex h-full items-center justify-end rounded-md', a.bar)}
                        >
                          <span className="px-2 text-[9px] font-semibold text-black/70">
                            {d.size}
                          </span>
                        </motion.div>
                      </div>
                      <span className="text-right font-mono text-[10px] text-white/50">{pctOfTotal}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── FOOTER ───────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center">
          <BarChart3 className="h-3.5 w-3.5 text-white/30" />
          <p className="text-[11px] text-white/40">
            Petabyte-scale analytics. SQL, BI, and natural language in one warehouse. — GSTPilot Infinity™
          </p>
          <ArrowRight className="h-3 w-3 text-white/20" />
        </div>
      </div>
    </div>
  );
}
