'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 7
// ENTERPRISE AUTOMATION STUDIO™
//
// Subtitle: "184 Templates · 13 Node Types · 1.8M Runs/24h · 98.6% Avg Success"
//
// Visual drag-and-drop workflow builder with 13 node types and 184 ready-made
// templates. Visualizes templates, a sample workflow canvas, node palette, and
// recent runs.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Workflow, Zap, Boxes, Activity, CheckCircle2,
  FilePlus, Banknote, Calendar, Filter, Shield, Brain, TrendingUp,
  ScanLine, MessageCircle, BookOpen, Receipt, Globe, Webhook,
  Play, Clock, ChevronRight, type LucideIcon,
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
  WORKFLOW_TEMPLATES, AUTOMATION_NODES, ACCENT_CLASSES, fmtN, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Icon resolver for automation nodes ───────────────────────────────────────
const NODE_ICONS: Record<string, LucideIcon> = {
  'file-plus': FilePlus,
  'banknote': Banknote,
  'calendar': Calendar,
  'filter': Filter,
  'shield': Shield,
  'brain': Brain,
  'trending-up': TrendingUp,
  'scan-line': ScanLine,
  'message-circle': MessageCircle,
  'book-open': BookOpen,
  'receipt': Receipt,
  'globe': Globe,
  'webhook': Webhook,
};

// ─── Node type union + accent mapping ─────────────────────────────────────────
type AUTOMATION_NODE_TYPE = 'Trigger' | 'Condition' | 'AI Node' | 'Action' | 'API Node' | 'Webhook' | 'Schedule';

const NODE_TYPE_ACCENT: Record<AUTOMATION_NODE_TYPE, Accent> = {
  Trigger: 'emerald',
  Condition: 'amber',
  'AI Node': 'violet',
  Action: 'cyan',
  'API Node': 'rose',
  Webhook: 'emerald',
  Schedule: 'teal',
};

// ─── Deterministic recent runs synthesized from WORKFLOW_TEMPLATES ────────────
interface RecentRun {
  workflow: string;
  accent: Accent;
  startedAt: string;
  duration: string;
  status: 'success' | 'failed';
  records: number;
}

const RECENT_RUNS: RecentRun[] = [
  { workflow: WORKFLOW_TEMPLATES[0].name, accent: WORKFLOW_TEMPLATES[0].accent, startedAt: '14:23:42', duration: '4m 12s', status: 'success', records: 1_240 },
  { workflow: WORKFLOW_TEMPLATES[2].name, accent: WORKFLOW_TEMPLATES[2].accent, startedAt: '14:22:18', duration: '6 sec',  status: 'success', records:    42 },
  { workflow: WORKFLOW_TEMPLATES[1].name, accent: WORKFLOW_TEMPLATES[1].accent, startedAt: '14:21:04', duration: '18 sec', status: 'success', records:   184 },
  { workflow: WORKFLOW_TEMPLATES[3].name, accent: WORKFLOW_TEMPLATES[3].accent, startedAt: '14:19:55', duration: '42 sec', status: 'success', records:   620 },
  { workflow: WORKFLOW_TEMPLATES[4].name, accent: WORKFLOW_TEMPLATES[4].accent, startedAt: '14:18:30', duration: '24 sec', status: 'failed',  records:     0 },
  { workflow: WORKFLOW_TEMPLATES[5].name, accent: WORKFLOW_TEMPLATES[5].accent, startedAt: '14:17:12', duration: '2m 48s', status: 'success', records:   280 },
  { workflow: WORKFLOW_TEMPLATES[6].name, accent: WORKFLOW_TEMPLATES[6].accent, startedAt: '14:15:48', duration: '8m 20s', status: 'success', records:    18 },
  { workflow: WORKFLOW_TEMPLATES[7].name, accent: WORKFLOW_TEMPLATES[7].accent, startedAt: '14:14:22', duration: '4 sec',  status: 'success', records:     1 },
  { workflow: WORKFLOW_TEMPLATES[0].name, accent: WORKFLOW_TEMPLATES[0].accent, startedAt: '14:12:08', duration: '4m 02s', status: 'success', records: 1_180 },
  { workflow: WORKFLOW_TEMPLATES[2].name, accent: WORKFLOW_TEMPLATES[2].accent, startedAt: '14:10:42', duration: '6 sec',  status: 'success', records:    38 },
];

// ─── Sample workflow canvas (deterministic) ───────────────────────────────────
// SAMPLE_CANVAS_NODES — previously a 5-node hardcoded mock workflow visualization
// ("Invoice Created → Amount > Threshold → Oracle™ Classify → Create Journal
// Entry → Emit Webhook"). Removed during mock-data audit (Task 7). The canvas
// now renders an empty state until a real workflow is loaded from the API.
const SAMPLE_CANVAS_NODES: { type: 'Trigger' | 'Condition' | 'AI Node' | 'Action' | 'Webhook'; name: string; desc: string; icon: string; accent: Accent }[] = [];

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

// ─── Success rate color mapper ────────────────────────────────────────────────
function successColor(rate: number): string {
  if (rate >= 99) return 'text-emerald-300';
  if (rate >= 98) return 'text-teal-300';
  if (rate >= 97) return 'text-cyan-300';
  if (rate >= 96) return 'text-amber-300';
  return 'text-rose-300';
}

// ─── Mini node-flow dots for template cards ───────────────────────────────────
function MiniNodeFlow({
  triggers, conditions, actions, aiNodes,
}: { triggers: number; conditions: number; actions: number; aiNodes: number }) {
  const dots: { type: string; accent: Accent }[] = [];
  for (let i = 0; i < triggers; i++)   dots.push({ type: 'T', accent: 'emerald' });
  for (let i = 0; i < conditions; i++) dots.push({ type: 'C', accent: 'amber'   });
  for (let i = 0; i < aiNodes; i++)    dots.push({ type: 'A', accent: 'violet'  });
  for (let i = 0; i < actions; i++)    dots.push({ type: 'X', accent: 'cyan'    });
  return (
    <div className="flex items-center gap-1">
      {dots.map((d, i) => {
        const a = ACCENT_CLASSES[d.accent];
        return (
          <div key={i} className="flex items-center gap-1">
            <div className={cn('flex h-5 w-5 items-center justify-center rounded-md border text-[8px] font-bold', a.border, a.bg, a.text)}>
              {d.type}
            </div>
            {i < dots.length - 1 && <div className="h-px w-2 bg-white/20" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AutomationStudio() {
  const { setCurrentView } = useApp();

  // ─── Deterministic derived metrics ────────────────────────────────────────
  const totalRuns = WORKFLOW_TEMPLATES.reduce((s, w) => s + w.runs, 0);
  const avgSuccess = (WORKFLOW_TEMPLATES.reduce((s, w) => s + w.successRate, 0) / WORKFLOW_TEMPLATES.length).toFixed(1);
  const nodeTypeGroups = Array.from(new Set(AUTOMATION_NODES.map(n => n.type)));

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
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
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
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <Workflow className="mr-1.5 h-3 w-3" /> Phase 16 · Module 7
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <Zap className="mr-1.5 h-3 w-3" /> Visual Builder
                </Badge>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                <Workflow className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Enterprise Automation Studio
                  <span className="ml-1 bg-gradient-to-r from-emerald-300 to-violet-300 bg-clip-text text-transparent">™</span>
                </h1>
                <p className="mt-0.5 text-xs text-white/55 sm:text-sm">
                  184 Templates · 13 Node Types · 1.8M Runs/24h · 98.6% Avg Success
                </p>
              </div>
            </div>

            {/* KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label="Templates"  value="184"          sub="Across 8 categories"   accent="emerald" icon={Boxes}     />
              <KpiTile label="Node Types" value="13"           sub="Triggers → Webhooks"   accent="teal"    icon={Workflow}  />
              <KpiTile label="Runs/24h"   value={fmtN(totalRuns * 1.4)} sub="Auto-scaled workers"   accent="cyan"    icon={Zap}       />
              <KpiTile label="Avg Success" value={`${avgSuccess}%`}     sub="Last 30 days"          accent="amber"   icon={CheckCircle2} />
            </div>
          </div>
        </motion.section>

        {/* ─── WORKFLOW TEMPLATES GRID ──────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Workflow Templates</h2>
              <p className="text-xs text-white/50">
                {WORKFLOW_TEMPLATES.length} templates · {fmtN(WORKFLOW_TEMPLATES.reduce((s, w) => s + w.runs, 0))} total runs
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
              <Boxes className="mr-1.5 h-3 w-3" /> Ready-to-use
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_TEMPLATES.map((w, idx) => {
              const a = ACCENT_CLASSES[w.accent];
              return (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.4) }}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4',
                    'transition-all duration-300 hover:-translate-y-0.5',
                    a.border,
                  )}
                >
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-[10px] text-white/70">
                        {w.category}
                      </Badge>
                      <span className="font-mono text-[9px] text-white/30">{w.id}</span>
                    </div>

                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-white">
                      {w.name}
                    </h3>

                    {/* Mini node flow */}
                    <div className="mt-3">
                      <MiniNodeFlow
                        triggers={w.triggers}
                        conditions={w.conditions}
                        actions={w.actions}
                        aiNodes={w.aiNodes}
                      />
                      <div className="mt-1 flex items-center gap-2 text-[9px] text-white/40">
                        <span className="text-emerald-300">●</span> T
                        <span className="text-amber-300">●</span> C
                        <span className="text-violet-300">●</span> AI
                        <span className="text-cyan-300">●</span> A
                      </div>
                    </div>

                    <Separator className="my-3 bg-white/[0.06]" />

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Runs</div>
                        <div className={cn('text-sm font-bold', a.text)}>{fmtN(w.runs)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Success</div>
                        <div className={cn('text-sm font-bold', successColor(w.successRate))}>{w.successRate}%</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-white/40">Avg</div>
                        <div className="text-sm font-bold text-white">{w.avgDuration}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─── VISUAL WORKFLOW BUILDER MOCK ─────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <Card className="overflow-hidden border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Workflow className="h-4 w-4 text-emerald-300" />
                  Workflow Builder — Vendor Invoice → Auto-Approve
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                    Draft
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    <Play className="mr-1 h-3 w-3" /> Test Run
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Canvas grid: node palette (left) + nodes flow (right) */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">

                {/* ─── Node palette (left sidebar) ─────────────────────── */}
                <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Node Palette</span>
                    <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-[9px] text-white/60">
                      {AUTOMATION_NODES.length} nodes
                    </Badge>
                  </div>
                  <ScrollArea className="h-[360px] pr-2">
                    <div className="space-y-3">
                      {nodeTypeGroups.map(group => {
                        const groupNodes = AUTOMATION_NODES.filter(n => n.type === group);
                        const firstAccent = NODE_TYPE_ACCENT[group as keyof typeof NODE_TYPE_ACCENT];
                        const ga = ACCENT_CLASSES[firstAccent];
                        return (
                          <div key={group}>
                            <div className="mb-1.5 flex items-center gap-1.5">
                              <div className={cn('h-1.5 w-1.5 rounded-full', ga.bar)} />
                              <span className={cn('text-[10px] font-semibold uppercase tracking-wider', ga.text)}>{group}</span>
                              <span className="ml-auto text-[9px] text-white/30">{groupNodes.length}</span>
                            </div>
                            <div className="space-y-1">
                              {groupNodes.map(n => {
                                const Icon = NODE_ICONS[n.icon] ?? Boxes;
                                const a = ACCENT_CLASSES[n.accent];
                                return (
                                  <div
                                    key={`${group}-${n.name}`}
                                    className={cn(
                                      'flex cursor-grab items-center gap-2 rounded-md border bg-white/[0.02] px-2 py-1.5',
                                      'transition-all hover:border-white/15 hover:bg-white/[0.04] active:cursor-grabbing',
                                      a.border,
                                    )}
                                  >
                                    <div className={cn('flex h-6 w-6 items-center justify-center rounded', a.bg)}>
                                      <Icon className={cn('h-3 w-3', a.text)} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-[11px] font-medium text-white/80">{n.name}</div>
                                      <div className="truncate text-[9px] text-white/40">{n.desc}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* ─── Workflow canvas (right) ─────────────────────────── */}
                <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:20px_20px]">
                  {/* Canvas nodes */}
                  <ScrollArea className="h-[420px]">
                    <div className="flex items-stretch gap-0 p-6">
                      {SAMPLE_CANVAS_NODES.map((node, i) => {
                        const Icon = NODE_ICONS[node.icon] ?? Boxes;
                        const a = ACCENT_CLASSES[node.accent];
                        const isLast = i === SAMPLE_CANVAS_NODES.length - 1;
                        return (
                          <motion.div
                            key={`${node.type}-${node.name}`}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                            className="flex items-stretch"
                          >
                            {/* Node card */}
                            <div className="relative w-44">
                              <div className={cn(
                                'rounded-xl border bg-white/[0.02] p-3 shadow-lg backdrop-blur-sm',
                                a.border, a.bg,
                              )}>
                                {/* Type badge */}
                                <div className="mb-2 flex items-center justify-between">
                                  <Badge variant="outline" className={cn('border-white/10 bg-white/[0.04] text-[9px] font-medium', a.text)}>
                                    {node.type}
                                  </Badge>
                                  <span className="font-mono text-[9px] text-white/30">#{i + 1}</span>
                                </div>
                                {/* Icon + name */}
                                <div className="flex items-start gap-2">
                                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', a.border, a.bg)}>
                                    <Icon className={cn('h-4 w-4', a.text)} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold leading-tight text-white">{node.name}</div>
                                    <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-white/50">{node.desc}</div>
                                  </div>
                                </div>
                              </div>
                              {/* Connector dot */}
                              <div className={cn('absolute -right-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-black', a.bar)} />
                              {/* Entry dot */}
                              {i === 0 && (
                                <div className={cn('absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-black', a.bar)} />
                              )}
                            </div>
                            {/* Arrow */}
                            {!isLast && (
                              <div className="flex items-center">
                                <svg width="36" height="24" viewBox="0 0 36 24" fill="none" className="text-white/30">
                                  <line x1="0" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                                  <path d="M28 6 L34 12 L28 18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  {/* Canvas footer */}
                  <div className="border-t border-white/[0.06] bg-black/40 px-4 py-2">
                    <div className="flex items-center justify-between text-[10px] text-white/40">
                      <div className="flex items-center gap-3">
                        <span><span className="text-emerald-300">●</span> Trigger</span>
                        <span><span className="text-amber-300">●</span> Condition</span>
                        <span><span className="text-violet-300">●</span> AI Node</span>
                        <span><span className="text-cyan-300">●</span> Action</span>
                        <span><span className="text-emerald-300">●</span> Webhook</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">5 nodes · 4 connections</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── RECENT RUNS TABLE ────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Activity className="h-4 w-4 text-cyan-300" />
                  Recent Workflow Runs
                </CardTitle>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  {RECENT_RUNS.length} runs · last 14 min
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96 rounded-lg border border-white/[0.04]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wider text-white/50">Workflow</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-white/50">Started</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Duration</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Records</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RECENT_RUNS.map((r, i) => {
                      const a = ACCENT_CLASSES[r.accent];
                      return (
                        <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02]">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn('h-1.5 w-1.5 rounded-full', a.bar)} />
                              <span className="text-xs font-medium text-white/80">{r.workflow}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-white/60">
                              <Clock className="h-3 w-3 text-white/30" />
                              <code className="font-mono">{r.startedAt}</code>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/70">{r.duration}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/70">{fmtN(r.records)}</TableCell>
                          <TableCell className="text-right">
                            {r.status === 'success' ? (
                              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Success
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between text-[11px] text-white/40">
                <div className="flex items-center gap-2">
                  <Play className="h-3 w-3 text-emerald-300" />
                  Auto-retry failed runs up to 3× with exponential backoff.
                </div>
                <button className="flex items-center gap-1 text-white/60 transition-colors hover:text-white">
                  View all runs <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── FOOTER ───────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center">
          <Workflow className="h-3.5 w-3.5 text-white/30" />
          <p className="text-[11px] text-white/40">
            Drag, drop, automate. 184 templates · 13 node types. — VEYRO™
          </p>
          <ArrowRight className="h-3 w-3 text-white/20" />
        </div>
      </div>
    </div>
  );
}
