'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 6
// EVENT STREAMING PLATFORM™
//
// Subtitle: "9 Event Types · 17.3M Daily Volume · 18ms P99 · 7-Year Compliance"
//
// Real-time event bus delivering 17M+ events per day with 18ms p99 latency and
// 7-year retention. Visualizes event types, a mock live stream, webhook endpoints,
// and a per-event-type throughput chart.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Radio, Activity, Zap, Clock, ShieldCheck,
  CheckCircle2, XCircle, Pause, Loader2, Radio as RadioIcon,
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
  EVENT_TYPES, WEBHOOK_ENDPOINTS, ACCENT_CLASSES, fmtN, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Live event stream shape ───────────────────────────────────────────────────
// No hardcoded events. Real events stream from the backend event bus when wired;
// this type is kept so the UI can render honest empty states until then.
interface MockEvent {
  time: string;     // HH:MM:SS
  topic: string;
  eventType: string;
  accent: Accent;
  entity: string;   // entity id
  payload: string;  // short preview
}

const MOCK_EVENTS: MockEvent[] = []

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

// ─── Webhook success-rate color mapper ────────────────────────────────────────
function successRateColor(rate: number): { text: string; bg: string; border: string } {
  if (rate > 99) return { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  if (rate > 97) return { text: 'text-teal-300',    bg: 'bg-teal-500/10',    border: 'border-teal-500/30'    };
  if (rate > 95) return { text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   };
  return { text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
}

// ─── Webhook status renderer ──────────────────────────────────────────────────
function WebhookStatusBadge({ status }: { status: 'active' | 'paused' | 'failing' }) {
  if (status === 'active') {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Active
      </Badge>
    );
  }
  if (status === 'paused') {
    return (
      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">
        <Pause className="mr-1 h-3 w-3" /> Paused
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="animate-pulse border-rose-500/30 bg-rose-500/10 text-rose-300">
      <XCircle className="mr-1 h-3 w-3" /> Failing
    </Badge>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EventStreaming() {
  const { setCurrentView } = useApp();

  // ─── Deterministic derived metrics ────────────────────────────────────────
  const totalDailyVolume = EVENT_TYPES.reduce((s, e) => s + e.dailyVolume, 0);
  const totalSubscribers = EVENT_TYPES.reduce((s, e) => s + e.subscribers, 0);
  const avgP99 = Math.round(EVENT_TYPES.reduce((s, e) => s + e.p99LatencyMs, 0) / EVENT_TYPES.length);
  const maxVolume = Math.max(...EVENT_TYPES.map(e => e.dailyVolume));

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
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-rose-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
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
                <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                  <Radio className="mr-1.5 h-3 w-3" /> Phase 16 · Module 6
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <Activity className="mr-1.5 h-3 w-3" /> Kafka + Pulsar
                </Badge>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10">
                <Radio className="h-6 w-6 text-rose-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Event Streaming Platform
                  <span className="ml-1 bg-gradient-to-r from-rose-300 to-cyan-300 bg-clip-text text-transparent">™</span>
                </h1>
                <p className="mt-0.5 text-xs text-white/55 sm:text-sm">
                  9 Event Types · 17.3M Daily Volume · 18ms P99 · 7-Year Compliance Retention
                </p>
              </div>
            </div>

            {/* KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label="Event Types"   value={String(EVENT_TYPES.length)} sub="Versioned schemas"        accent="emerald" icon={RadioIcon} />
              <KpiTile label="Daily Volume"  value={fmtN(totalDailyVolume)}    sub="Peak 4.2M/hr"             accent="teal"    icon={Activity}  />
              <KpiTile label="P99 Latency"   value={`${avgP99} ms`}            sub="End-to-end"               accent="cyan"    icon={Zap}       />
              <KpiTile label="Retention"     value="7 years"                   sub="Compliance-grade"         accent="amber"   icon={ShieldCheck} />
            </div>
          </div>
        </motion.section>

        {/* ─── EVENT TYPES GRID ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Event Types</h2>
              <p className="text-xs text-white/50">
                {EVENT_TYPES.length} event types · {fmtN(totalSubscribers)} active subscribers
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              All topics live
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EVENT_TYPES.map((e, idx) => {
              const a = ACCENT_CLASSES[e.accent];
              return (
                <motion.div
                  key={e.topic}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.4) }}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4',
                    'transition-all duration-300 hover:-translate-y-0.5',
                    a.border,
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{e.name}</h3>
                      <code className={cn('mt-1 block font-mono text-[11px]', a.text)}>{e.topic}</code>
                    </div>
                    {/* Live pulse */}
                    <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                      <span className={cn('absolute h-2.5 w-2.5 animate-ping rounded-full', a.bar, 'opacity-60')} />
                      <span className={cn('h-2 w-2 rounded-full', a.bar)} />
                    </div>
                  </div>

                  {/* Schema badge */}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="border-white/10 bg-white/[0.02] font-mono text-[10px] text-white/70">
                      schema {e.schema}
                    </Badge>
                    <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-[10px] text-white/70">
                      <Clock className="mr-1 h-2.5 w-2.5" /> {e.retention}
                    </Badge>
                  </div>

                  {/* Stats grid */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[9px] uppercase tracking-wide text-white/40">Subs</div>
                      <div className="text-sm font-bold text-white">{e.subscribers}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wide text-white/40">Daily</div>
                      <div className={cn('text-sm font-bold', a.text)}>{fmtN(e.dailyVolume)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wide text-white/40">P99</div>
                      <div className="text-sm font-bold text-white">{e.p99LatencyMs} ms</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─── LIVE EVENT STREAM + THROUGHPUT CHART ─────────────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Live stream */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400/70" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </span>
                    Live Event Stream
                  </CardTitle>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                    <Activity className="mr-1 h-3 w-3" /> {fmtN(totalDailyVolume)}/day
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {MOCK_EVENTS.length === 0 ? (
                  <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-black/20 px-6 text-center">
                    <p className="text-sm text-white/60">No live events yet — events will stream here as they occur.</p>
                  </div>
                ) : (
                <ScrollArea className="h-[420px] rounded-lg border border-white/[0.04] bg-black/30">
                  <div className="divide-y divide-white/[0.04]">
                    {MOCK_EVENTS.map((ev, i) => {
                      const a = ACCENT_CLASSES[ev.accent];
                      const isLatest = i === 0;
                      return (
                        <motion.div
                          key={`${ev.time}-${ev.topic}-${i}`}
                          initial={isLatest ? { opacity: 0, x: -10 } : false}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4 }}
                          className={cn(
                            'flex flex-col gap-1.5 px-3 py-2.5',
                            isLatest && 'bg-emerald-500/[0.04]',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {/* timestamp */}
                            <code className="font-mono text-[10px] text-white/40">{ev.time}</code>
                            {/* event type badge */}
                            <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-medium', a.border, a.bg, a.text)}>
                              {ev.eventType}
                            </span>
                            <code className="ml-auto font-mono text-[10px] text-white/50">{ev.entity}</code>
                            {isLatest && (
                              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                                NEW
                              </span>
                            )}
                          </div>
                          <code className="block truncate font-mono text-[10px] leading-relaxed text-white/50">
                            <span className="text-white/40">{ev.topic}</span>
                            <span className="text-white/20"> · </span>
                            {ev.payload}
                          </code>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.section>

          {/* Throughput chart */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Activity className="h-4 w-4 text-cyan-300" />
                    Daily Throughput by Event Type
                  </CardTitle>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                    Total: {fmtN(totalDailyVolume)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[420px] pr-2">
                  <div className="space-y-2.5">
                    {EVENT_TYPES.map((e) => {
                      const a = ACCENT_CLASSES[e.accent];
                      const widthPct = (e.dailyVolume / maxVolume) * 100;
                      return (
                        <div key={e.topic} className="group">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <code className={cn('font-mono', a.text)}>{e.topic}</code>
                            </div>
                            <span className="font-mono text-white/60">{fmtN(e.dailyVolume)}</span>
                          </div>
                          <div className="h-7 w-full overflow-hidden rounded-md border border-white/[0.04] bg-white/[0.02]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' as const }}
                              className={cn('relative flex h-full items-center justify-end rounded-md', a.bar)}
                            >
                              <span className="px-2 text-[10px] font-semibold text-black/70">
                                {((e.dailyVolume / totalDailyVolume) * 100).toFixed(1)}%
                              </span>
                            </motion.div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.section>
        </div>

        {/* ─── WEBHOOK ENDPOINTS TABLE ──────────────────────────────────── */}
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
                  <Radio className="h-4 w-4 text-amber-300" />
                  Webhook Endpoints
                </CardTitle>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  {WEBHOOK_ENDPOINTS.length} endpoints · {WEBHOOK_ENDPOINTS.filter(w => w.status === 'active').length} active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96 rounded-lg border border-white/[0.04]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wider text-white/50">URL</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-white/50">Subscribed Events</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Success</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Avg Latency</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Last Delivery</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider text-white/50">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {WEBHOOK_ENDPOINTS.map((w) => {
                      const sr = successRateColor(w.successRate);
                      return (
                        <TableRow key={w.id} className="border-white/[0.04] hover:bg-white/[0.02]">
                          <TableCell>
                            <code className="block max-w-[260px] truncate font-mono text-xs text-white/80">{w.url}</code>
                            <span className="text-[10px] text-white/40">{w.id}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {w.events.map(ev => (
                                <span key={ev} className="rounded border border-white/10 bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] text-white/60">
                                  {ev}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {w.successRate === 0 ? (
                              <span className="font-mono text-xs text-zinc-500">—</span>
                            ) : (
                              <span className={cn('rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold', sr.border, sr.bg, sr.text)}>
                                {w.successRate.toFixed(1)}%
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/70">
                            {w.avgLatencyMs > 0 ? `${w.avgLatencyMs} ms` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/50">{w.lastDelivery}</TableCell>
                          <TableCell className="text-right"><WebhookStatusBadge status={w.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Footer hint */}
              <div className="mt-3 flex items-center gap-2 text-[11px] text-white/40">
                <Loader2 className="h-3 w-3 animate-spin text-cyan-300" />
                Failed deliveries auto-retried with exponential backoff (max 8 attempts).
                <Separator orientation="vertical" className="mx-1 h-3 bg-white/[0.06]" />
                Dead-letter queue retention: 14 days.
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── FOOTER ───────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center">
          <Radio className="h-3.5 w-3.5 text-white/30" />
          <p className="text-[11px] text-white/40">
            Every event. Every subscriber. 18ms end-to-end. — GSTPilot Infinity™
          </p>
          <ArrowRight className="h-3 w-3 text-white/20" />
        </div>
      </div>
    </div>
  );
}
