'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT EXECUTION CLOUD™
// Phase 8 — Connect. Execute. Automate. Scale.
//
// "I don't use software. GSTPilot actually runs my business.
//  It files, reminds, reconciles, predicts and executes automatically."
//
// Modules rendered here (all 8):
//   Module 1 — GSTN Live Integration™
//   Module 2 — Banking Cloud™
//   Module 3 — Real Invoice Engine™
//   Module 4 — Communication Cloud™
//   Module 5 — Execution Engine™ (Observe → Think → Decide → Execute → Confirm → Learn)
//   Module 6 — Background Job System™
//   Module 7 — SaaS Billing™
//   Module 8 — Mobile Apps™
//
// Data source: GET /api/execution-cloud → ExecutionCloudState (auto-refresh 60s).
// Interactions:
//   POST /api/execution-cloud/gstn         → file/fetch/generate/search/verify
//   POST /api/execution-cloud/banking       → sync/collect/fetch/reconcile
//   POST /api/execution-cloud/invoice       → create invoice/expense/TDS/payroll
//   POST /api/execution-cloud/communicate   → send WhatsApp/email/SMS/notice/report
//   POST /api/execution-cloud/execute       → run execution cycle
//   POST /api/execution-cloud/jobs          → enqueue background job
//   POST /api/execution-cloud/billing       → upgrade/downgrade/cancel/retry
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cloud, RefreshCw, ShieldCheck, Landmark, FileText, MessageSquare,
  Cpu, CreditCard, Smartphone, Activity, CheckCircle2, AlertTriangle,
  Clock, Zap, ArrowRight, Send, Play, TrendingUp, Wifi, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type {
  BackgroundJob, BankAccount, BankingCapability, CloudJobStatus, CloudRiskLevel,
  CommChannel, CommMessage, CurrentSubscription, ExecutionCloudState,
  ExecutionCycle, ExecStage, GstnCapability, GstnConnection, GstnOperation,
  Invoice2, InvoiceRecord, InvoiceTypeBucket, JobQueueStatus, JobSystemStats,
  MobileAppBuild, MobileDevice, PlanId, PushNotification, ReconciliationEntry,
} from '@/lib/execution-cloud/types';
import {
  BILLING_PLANS, CLOUD_RISK_GLYPH, CLOUD_RISK_LABEL, JOB_STATUS_GLYPH,
  JOB_STATUS_LABEL, STAGE_GLYPH, STAGE_LABEL,
} from '@/lib/execution-cloud/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 0) return 'just now';
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeUntil(iso?: string): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  const d = Math.floor(diff / 86400000);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'today';
  return `in ${d}d`;
}

const RISK_TONE: Record<CloudRiskLevel, string> = {
  low: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.06]',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/[0.06]',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/[0.06]',
  critical: 'text-red-400 border-red-500/30 bg-red-500/[0.06]',
};

const JOB_TONE: Record<CloudJobStatus, string> = {
  queued: 'text-sky-400',
  running: 'text-amber-400',
  completed: 'text-emerald-400',
  failed: 'text-red-400',
  retrying: 'text-violet-400',
  scheduled: 'text-cyan-400',
};

// ─── Fade-in wrapper ──────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ icon: Icon, emoji, title, subtitle, action }: {
  icon: LucideIcon; emoji?: string; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            {emoji && <span className="text-base">{emoji}</span>}
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function Tile({ label, value, sub, emoji, tone }: {
  label: string; value: string | number; sub?: string; emoji?: string; tone?: string;
}) {
  return (
    <div className="accent-gradient-soft rounded-2xl border border-white/[0.06] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {emoji && <span className="text-sm">{emoji}</span>}
      </div>
      <div className={`mt-1.5 text-2xl font-bold tracking-tight ${tone ?? 'text-foreground'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ExecutionCloudPage() {
  const { toast } = useToast();
  const [state, setState] = useState<ExecutionCloudState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchState = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/execution-cloud', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ExecutionCloudState = await res.json();
      setState(data);
    } catch (err) {
      console.error('[ExecutionCloud] fetch failed:', err);
      if (!silent) toast({ title: 'Failed to load Execution Cloud state', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchState();
    const id = setInterval(() => fetchState(true), 60000);
    return () => clearInterval(id);
  }, [fetchState]);

  if (loading || !state) {
    return <CloudSkeleton />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ═══ Header strip ═══ */}
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground md:text-2xl">
              <span className="accent-gradient-soft rounded-lg px-2 py-0.5 text-sm font-bold accent-text">EXECUTION CLOUD™</span>
              GSTPilot Execution Cloud
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect. Execute. Automate. Scale. · Files, reminds, reconciles, predicts &amp; executes automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live · {state.jobs.stats.activeWorkers} workers
            </Badge>
            <Button variant="outline" size="sm" onClick={() => fetchState()} disabled={refreshing} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* ═══ Headline + Key Stats ═══ */}
      <FadeIn delay={0.05}>
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl accent-gradient-soft">
                <Cloud className="h-5 w-5 accent-text" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live Headline</span>
                  <Badge variant="outline" className={`gap-1 border-white/[0.06] text-[10px] ${RISK_TONE[state.execution.pipelineHealth]}`}>
                    {CLOUD_RISK_GLYPH[state.execution.pipelineHealth]} {CLOUD_RISK_LABEL[state.execution.pipelineHealth]} pipeline
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-foreground">{state.headline}</p>
              </div>
            </div>
            <Separator className="my-4 bg-white/[0.06]" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="GSTN Ops Today" value={state.gstn.operationsToday} sub={`${state.gstn.filingsThisMonth} filings/mo`} emoji="🧾" />
              <Tile label="Bank Balance" value={formatINR(state.banking.totalBalanceINR)} sub={`${state.banking.accounts.length} accounts`} emoji="🏦" tone="accent-text" />
              <Tile label="Recon Match" value={`${state.banking.reconMatchRatePct}%`} sub="auto-reconciled" emoji="⚖️" tone="text-emerald-400" />
              <Tile label="Messages Sent" value={state.communication.totalSentToday} sub={`${state.communication.avgDeliveryRatePct}% delivered`} emoji="💬" />
              <Tile label="Jobs Today" value={state.jobs.stats.jobsCompletedToday.toLocaleString('en-IN')} sub={`${state.jobs.stats.jobsFailedToday} failed`} emoji="⚙️" />
              <Tile label="Autonomous" value={state.execution.autonomousExecutionsToday} sub="executions today" emoji="🚀" tone="accent-text" />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* ═══ Tabs for 8 modules ═══ */}
      <FadeIn delay={0.1}>
        <Tabs defaultValue="gstn" className="w-full">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex h-auto w-max gap-1 rounded-2xl border border-white/[0.06] bg-card/60 p-1.5 backdrop-blur-sm">
              {[
                { v: 'gstn', l: 'GSTN Live', e: '🧾' },
                { v: 'banking', l: 'Banking Cloud', e: '🏦' },
                { v: 'invoices', l: 'Invoice Engine', e: '🧾' },
                { v: 'comm', l: 'Communication', e: '💬' },
                { v: 'execution', l: 'Execution Engine', e: '⚙️' },
                { v: 'jobs', l: 'Background Jobs', e: '📦' },
                { v: 'billing', l: 'SaaS Billing', e: '💳' },
                { v: 'mobile', l: 'Mobile Apps', e: '📱' },
              ].map((t) => (
                <TabsTrigger key={t.v} value={t.v} className="gap-1.5 rounded-xl px-3 py-1.5 text-xs data-[state=active]:accent-gradient-soft">
                  <span>{t.e}</span>
                  <span className="hidden sm:inline">{t.l}</span>
                  <span className="sm:hidden">{t.l.split(' ')[0]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <TabsContent value="gstn" className="mt-4"><GstnModule state={state} onAction={toast} /></TabsContent>
          <TabsContent value="banking" className="mt-4"><BankingModule state={state} onAction={toast} /></TabsContent>
          <TabsContent value="invoices" className="mt-4"><InvoiceModule state={state} onAction={toast} /></TabsContent>
          <TabsContent value="comm" className="mt-4"><CommModule state={state} onAction={toast} /></TabsContent>
          <TabsContent value="execution" className="mt-4"><ExecutionModule state={state} onAction={toast} /></TabsContent>
          <TabsContent value="jobs" className="mt-4"><JobsModule state={state} onAction={toast} /></TabsContent>
          <TabsContent value="billing" className="mt-4"><BillingModule state={state} onAction={toast} /></TabsContent>
          <TabsContent value="mobile" className="mt-4"><MobileModule state={state} /></TabsContent>
        </Tabs>
      </FadeIn>

      {/* ═══ Footer ═══ */}
      <FadeIn delay={0.15}>
        <Card className="border-white/[0.06] bg-card/40 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 accent-text" />
                <span>8 API endpoints · GSTN · Banking · Invoice · Comm · Execute · Jobs · Billing · Mobile</span>
              </div>
              <span>Generated {timeAgo(state.generatedAt)} · {state.clientCount} clients · {state.hasLiveData ? 'live data' : 'demo data'}</span>
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <p className="text-center text-xs text-muted-foreground">
              <span className="accent-text font-semibold">GSTPilot Infinity™</span> — The Financial Brain of India.{' '}
              <span className="text-muted-foreground/70">I don't use software. GSTPilot actually runs my business.</span>
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1 — GSTN Live Integration™
// ═══════════════════════════════════════════════════════════════════════════════

function GstnModule({ state, onAction }: { state: ExecutionCloudState; onAction: ReturnType<typeof useToast>['toast'] }) {
  const [busy, setBusy] = useState<string | null>(null);

  const doAction = async (cap: GstnCapability, action: 'file' | 'fetch' | 'generate' | 'search' | 'verify') => {
    setBusy(cap.id);
    try {
      const res = await fetch('/api/execution-cloud/gstn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capability: cap.id, action }),
      });
      const data = await res.json();
      if (data.ok) {
        onAction({ title: `${cap.emoji} ${data.message}`, description: `GSTN ack: ${data.operation.ack}` });
      } else {
        onAction({ title: 'GSTN action failed', variant: 'destructive' });
      }
    } catch {
      onAction({ title: 'GSTN action failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const actionLabel: Record<string, string> = { file: 'File', fetch: 'Fetch', generate: 'Generate', search: 'Search', verify: 'Verify' };
  const capAction: Record<string, 'file' | 'fetch' | 'generate' | 'search' | 'verify'> = {
    gstr1: 'file', gstr3b: 'file', gstr2b: 'fetch', einvoice: 'generate', ewaybill: 'generate', gstsearch: 'search', panverify: 'verify',
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={ShieldCheck} emoji="🧾" title="GSTN Live Integration™" subtitle="7 live capabilities — file returns, fetch ITC, generate e-invoice/e-way bill, search GSTIN, verify PAN."
        action={<Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400"><Wifi className="h-3 w-3" /> {state.gstn.connections.length} GSTINs connected</Badge>} />

      {/* Connections */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Connected GSTINs</CardTitle></CardHeader>
        <CardContent className="space-y-2 pt-0">
          {state.gstn.connections.map((c: GstnConnection) => (
            <div key={c.gstin} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-foreground">{c.gstin}</span>
                  <Badge variant="outline" className={`gap-1 text-[10px] ${c.status === 'active' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : 'border-red-500/30 bg-red-500/[0.06] text-red-400'}`}>{c.status}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.legalName} · {c.state} · {c.filingFrequency}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Auth valid till</div>
                <div className="text-foreground">{new Date(c.authValidTill).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Capabilities */}
      <div className="grid gap-3 md:grid-cols-2">
        {state.gstn.capabilities.map((cap) => (
          <Card key={cap.id} className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-lg">{cap.emoji}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{cap.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{cap.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 text-[10px] ${cap.status === 'live' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : cap.status === 'sandbox' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400' : 'border-red-500/30 bg-red-500/[0.06] text-red-400'}`}>
                  {cap.status}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/[0.02] p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Records</div>
                  <div className="text-sm font-semibold text-foreground">{cap.recordsProcessed}</div>
                </div>
                <div className="rounded-lg bg-white/[0.02] p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Queued</div>
                  <div className="text-sm font-semibold text-foreground">{cap.queuedActions}</div>
                </div>
                <div className="rounded-lg bg-white/[0.02] p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Success</div>
                  <div className="text-sm font-semibold text-emerald-400">{cap.successRatePct}%</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">Last sync: {timeAgo(cap.lastSyncAt)} · {cap.endpoint}</div>
              <Button size="sm" className="mt-3 w-full gap-1.5" disabled={busy === cap.id} onClick={() => doAction(cap, capAction[cap.id])}>
                {busy === cap.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {actionLabel[capAction[cap.id]]} now
              </Button>
              {cap.recentOperations.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent operations</div>
                  {cap.recentOperations.slice(0, 2).map((op: GstnOperation) => (
                    <div key={op.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-muted-foreground">{op.action}</span>
                      <span className={`shrink-0 font-medium ${JOB_TONE[op.status]}`}>{JOB_STATUS_GLYPH[op.status]} {timeAgo(op.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — Banking Cloud™
// ═══════════════════════════════════════════════════════════════════════════════

function BankingModule({ state, onAction }: { state: ExecutionCloudState; onAction: ReturnType<typeof useToast>['toast'] }) {
  const [busy, setBusy] = useState<string | null>(null);

  const doAction = async (cap: BankingCapability, action: 'sync' | 'collect' | 'fetch' | 'reconcile') => {
    setBusy(cap.id);
    try {
      const res = await fetch('/api/execution-cloud/banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capability: cap.id, action }),
      });
      const data = await res.json();
      if (data.ok) onAction({ title: `🏦 ${data.message}` });
      else onAction({ title: 'Banking action failed', variant: 'destructive' });
    } catch {
      onAction({ title: 'Banking action failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const actionMap: Record<string, 'sync' | 'collect' | 'fetch' | 'reconcile'> = {
    statement_sync: 'sync', upi: 'collect', account_aggregator: 'fetch', cashflow: 'sync', auto_reconciliation: 'reconcile',
  };
  const actionLabel: Record<string, string> = { sync: 'Sync now', collect: 'Collect', fetch: 'Fetch', reconcile: 'Reconcile' };

  return (
    <div className="space-y-4">
      <SectionHeader icon={Landmark} emoji="🏦" title="Banking Cloud™" subtitle="Statement sync · UPI · Account Aggregator · Cash flow · Auto-reconciliation"
        action={<Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">⚖️ {state.banking.reconMatchRatePct}% match rate</Badge>} />

      {/* Accounts */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Connected Bank Accounts · Total {formatINR(state.banking.totalBalanceINR)}</CardTitle></CardHeader>
        <CardContent className="space-y-2 pt-0">
          {state.banking.accounts.map((a: BankAccount) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg accent-gradient-soft">
                  <Landmark className="h-4 w-4 accent-text" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{a.bankName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{a.accountMasked}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{a.accountType.toUpperCase()} · IFSC {a.ifsc}{a.upiHandle ? ` · UPI ${a.upiHandle}` : ''}{a.aaConsent ? ' · AA consent' : ''}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold accent-text">{formatINR(a.balance)}</div>
                <div className="text-[10px] text-muted-foreground">synced {timeAgo(a.syncedAt)}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Capabilities */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {state.banking.capabilities.map((cap) => (
          <Card key={cap.id} className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-lg">{cap.emoji}</div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">{cap.name}</h3>
                  <p className="truncate text-[11px] text-muted-foreground">{cap.description}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[9px] uppercase text-muted-foreground">Accounts</div><div className="text-sm font-semibold text-foreground">{cap.accountsLinked}</div></div>
                <div><div className="text-[9px] uppercase text-muted-foreground">Today</div><div className="text-sm font-semibold text-foreground">{cap.recordsToday}</div></div>
                <div><div className="text-[9px] uppercase text-muted-foreground">Success</div><div className="text-sm font-semibold text-emerald-400">{cap.successRatePct}%</div></div>
              </div>
              <Button size="sm" variant="outline" className="mt-3 w-full gap-1.5" disabled={busy === cap.id} onClick={() => doAction(cap, actionMap[cap.id])}>
                {busy === cap.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {actionLabel[actionMap[cap.id]]}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reconciliation */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Auto-Reconciliation · {state.banking.reconciliation.length} entries</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="max-h-72">
            <div className="space-y-1.5">
              {state.banking.reconciliation.map((r: ReconciliationEntry) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[10px] ${r.status === 'matched' ? 'text-emerald-400' : r.status === 'pending' ? 'text-amber-400' : 'text-red-400'}`}>{r.bankRef}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-foreground">{r.matchedInvoice ?? 'unmatched'}</span>
                    {r.matchedTo && <span className="text-muted-foreground">({r.matchedTo})</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">{formatINR(r.bankAmount)}</span>
                    <Badge variant="outline" className={`text-[10px] ${r.status === 'matched' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : r.status === 'pending' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400' : 'border-red-500/30 bg-red-500/[0.06] text-red-400'}`}>
                      {r.status} · {r.confidencePct}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3 — Real Invoice Engine™
// ═══════════════════════════════════════════════════════════════════════════════

function InvoiceModule({ state, onAction }: { state: ExecutionCloudState; onAction: ReturnType<typeof useToast>['toast'] }) {
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<InvoiceTypeBucket['type']>('sales');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');

  const create = async () => {
    if (!party || !amount) return;
    setBusy(true);
    try {
      const res = await fetch('/api/execution-cloud/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, party, amountINR: Number(amount), gstINR: Math.round(Number(amount) * 0.18) }),
      });
      const data = await res.json();
      if (data.ok) {
        onAction({ title: `🧾 ${data.message}`, description: `${data.invoice.number} · GST ₹${data.invoice.gstINR.toLocaleString('en-IN')}` });
        setParty(''); setAmount('');
      } else onAction({ title: 'Invoice creation failed', variant: 'destructive' });
    } catch {
      onAction({ title: 'Invoice creation failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={FileText} emoji="🧾" title="Real Invoice Engine™" subtitle="Sales · Purchase · Expenses · Receivables · Payables · TDS · Payroll"
        action={<Badge variant="outline" className="gap-1.5 border-amber-500/30 bg-amber-500/[0.06] text-amber-400"><AlertTriangle className="h-3 w-3" /> {formatINR(state.invoices.totalOverdueINR)} overdue</Badge>} />

      {/* Buckets */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {state.invoices.buckets.map((b: InvoiceTypeBucket) => (
          <Card key={b.type} className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-lg">{b.emoji}</span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">{b.count} records</Badge>
              </div>
              <h3 className="mt-1 text-sm font-semibold text-foreground">{b.name}</h3>
              <div className="mt-2 text-lg font-bold accent-text">{formatINR(b.totalAmountINR)}</div>
              <Separator className="my-2 bg-white/[0.06]" />
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Pending: <span className="text-foreground">{formatINR(b.pendingAmountINR)}</span></span>
                <span className={b.overdueCount > 0 ? 'text-red-400' : 'text-muted-foreground'}>Overdue: {b.overdueCount}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create invoice */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Create Record</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as InvoiceTypeBucket['type'])}
                className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-foreground outline-none focus:border-white/20">
                {state.invoices.buckets.map((b) => <option key={b.type} value={b.type} className="bg-background">{b.emoji} {b.name}</option>)}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Party</label>
              <input value={party} onChange={(e) => setParty(e.target.value)} placeholder="e.g. Reliance Retail Ltd"
                className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20" />
            </div>
            <div className="flex w-32 flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000"
                className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20" />
            </div>
            <Button onClick={create} disabled={busy || !party || !amount} className="gap-1.5">
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent invoices */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Records</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="max-h-80">
            <div className="space-y-1.5">
              {state.invoices.recent.map((inv: InvoiceRecord) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{inv.number}</span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">{inv.type}</Badge>
                  </div>
                  <span className="min-w-0 flex-1 truncate text-foreground">{inv.party}</span>
                  <span className="font-semibold text-foreground">{formatINR(inv.amountINR)}</span>
                  <Badge variant="outline" className={`text-[10px] ${inv.status === 'paid' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : inv.status === 'overdue' ? 'border-red-500/30 bg-red-500/[0.06] text-red-400' : 'border-white/[0.06] text-muted-foreground'}`}>{inv.status}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — Communication Cloud™
// ═══════════════════════════════════════════════════════════════════════════════

function CommModule({ state, onAction }: { state: ExecutionCloudState; onAction: ReturnType<typeof useToast>['toast'] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [channel, setChannel] = useState<CommChannel['id']>('whatsapp');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const send = async () => {
    if (!to || !subject) return;
    setBusy('send');
    try {
      const res = await fetch('/api/execution-cloud/communicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, to, toName: to, subject, body }),
      });
      const data = await res.json();
      if (data.ok) {
        onAction({ title: `💬 ${channel} sent`, description: `"${subject}" → ${to}` });
        setTo(''); setSubject(''); setBody('');
      } else onAction({ title: 'Send failed', variant: 'destructive' });
    } catch {
      onAction({ title: 'Send failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={MessageSquare} emoji="💬" title="Communication Cloud™" subtitle="WhatsApp Business · Email · SMS · Notices · Reports"
        action={<Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400"><Send className="h-3 w-3" /> {state.communication.totalSentToday} sent today</Badge>} />

      {/* Channels */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {state.communication.channels.map((c: CommChannel) => (
          <Card key={c.id} className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xl">{c.emoji}</span>
                <Badge variant="outline" className={`text-[10px] ${c.status === 'live' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400'}`}>{c.status}</Badge>
              </div>
              <h3 className="mt-1 text-xs font-semibold text-foreground">{c.name}</h3>
              <div className="mt-2 text-2xl font-bold text-foreground">{c.sentToday}</div>
              <div className="text-[10px] text-muted-foreground">sent · {c.queued} queued</div>
              <Separator className="my-2 bg-white/[0.06]" />
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Delivered</span>
                <span className="font-semibold text-emerald-400">{c.deliveryRatePct}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Composer */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Send Message</CardTitle></CardHeader>
        <CardContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-2">
            <select value={channel} onChange={(e) => setChannel(e.target.value as CommChannel['id'])}
              className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-foreground outline-none focus:border-white/20">
              {state.communication.channels.map((c) => <option key={c.id} value={c.id} className="bg-background">{c.emoji} {c.name}</option>)}
            </select>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To: phone / email"
              className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20" />
          </div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body..." rows={3}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20" />
          <Button onClick={send} disabled={busy === 'send' || !to || !subject} className="gap-1.5">
            {busy === 'send' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send {channel}
          </Button>
        </CardContent>
      </Card>

      {/* Recent messages */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Messages</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="max-h-80">
            <div className="space-y-1.5">
              {state.communication.recent.map((m: CommMessage) => (
                <div key={m.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{state.communication.channels.find((c) => c.id === m.channel)?.emoji}</span>
                      <span className="font-semibold text-foreground">{m.subject}</span>
                      {m.template && <Badge variant="outline" className="text-[10px] text-muted-foreground">{m.template}</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{m.preview}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">→ {m.toName} · {timeAgo(m.at)}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${m.status === 'delivered' || m.status === 'read' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : m.status === 'sent' ? 'border-sky-500/30 bg-sky-500/[0.06] text-sky-400' : m.status === 'queued' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400' : 'border-red-500/30 bg-red-500/[0.06] text-red-400'}`}>{m.status}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5 — Execution Engine™ (6-stage pipeline)
// ═══════════════════════════════════════════════════════════════════════════════

function ExecutionModule({ state, onAction }: { state: ExecutionCloudState; onAction: ReturnType<typeof useToast>['toast'] }) {
  const [busy, setBusy] = useState(false);

  const runCycle = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/execution-cloud/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'user', command: 'Run my business today' }),
      });
      const data = await res.json();
      if (data.ok) onAction({ title: '⚙️ Execution cycle completed', description: data.message });
      else onAction({ title: 'Execution failed', variant: 'destructive' });
    } catch {
      onAction({ title: 'Execution failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const cycle = state.execution.currentCycle;

  return (
    <div className="space-y-4">
      <SectionHeader icon={Cpu} emoji="⚙️" title="Execution Engine™" subtitle="Observe → Think → Decide → Execute → Confirm → Learn"
        action={<Button size="sm" onClick={runCycle} disabled={busy} className="gap-1.5">{busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run cycle</Button>} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Cycles Today" value={state.execution.cyclesToday} emoji="🔄" />
        <Tile label="Autonomous Execs" value={state.execution.autonomousExecutionsToday} emoji="🚀" tone="accent-text" />
        <Tile label="Pipeline Health" value={CLOUD_RISK_LABEL[state.execution.pipelineHealth]} emoji={CLOUD_RISK_GLYPH[state.execution.pipelineHealth]} tone={state.execution.pipelineHealth === 'low' ? 'text-emerald-400' : state.execution.pipelineHealth === 'high' ? 'text-orange-400' : 'text-amber-400'} />
        <Tile label="Avg Latency" value={`${state.jobs.stats.avgLatencyMs}ms`} emoji="⚡" />
      </div>

      {/* Current cycle pipeline */}
      {cycle && (
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Current Cycle · {cycle.cycleId}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] text-muted-foreground">{cycle.trigger}</Badge>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">{cycle.status}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Pipeline visualization */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {cycle.stages.map((s: ExecStage, i: number) => (
                <div key={s.id} className="flex items-center gap-1">
                  <div className={`flex min-w-[110px] flex-col items-center rounded-xl border p-2.5 text-center ${s.status === 'done' ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : s.status === 'active' ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                    <span className="text-xl">{s.emoji}</span>
                    <span className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${s.status === 'done' ? 'text-emerald-400' : s.status === 'active' ? 'text-amber-400' : 'text-muted-foreground'}`}>{s.label}</span>
                    <span className="text-[9px] text-muted-foreground">{s.durationMs}ms</span>
                  </div>
                  {i < cycle.stages.length - 1 && <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                </div>
              ))}
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <div className="space-y-2">
              {cycle.stages.map((s: ExecStage) => (
                <div key={s.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 text-sm">{s.emoji}</span>
                  <div className="min-w-0">
                    <span className={`font-semibold ${s.status === 'done' ? 'text-emerald-400' : s.status === 'active' ? 'text-amber-400' : 'text-muted-foreground'}`}>{s.label}</span>
                    <span className="ml-2 text-muted-foreground">{s.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <div className="rounded-xl accent-gradient-soft p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 accent-text" />
                <span className="text-xs font-semibold accent-text">Outcome</span>
                {cycle.impactINR && <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">impact {formatINR(cycle.impactINR)}</Badge>}
              </div>
              <p className="mt-1 text-xs text-foreground">{cycle.outcome}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent cycles */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Cycles</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {state.execution.recentCycles.map((c: ExecutionCycle) => (
              <div key={c.cycleId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">{c.trigger}</Badge>
                  <span className="text-muted-foreground">{timeAgo(c.startedAt)}</span>
                </div>
                <span className="min-w-0 flex-1 truncate text-foreground">{c.outcome}</span>
                {c.impactINR && <span className="font-semibold text-emerald-400">{formatINR(c.impactINR)}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 6 — Background Job System™
// ═══════════════════════════════════════════════════════════════════════════════

function JobsModule({ state, onAction }: { state: ExecutionCloudState; onAction: ReturnType<typeof useToast>['toast'] }) {
  const [busy, setBusy] = useState(false);
  const [jobType, setJobType] = useState<BackgroundJob['type']>('file_gstr3b');

  const enqueue = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/execution-cloud/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: jobType, priority: 'normal' }),
      });
      const data = await res.json();
      if (data.ok) onAction({ title: `📦 Job enqueued`, description: `${data.job.title} → ${data.job.queue} (${data.job.status})` });
      else onAction({ title: 'Enqueue failed', variant: 'destructive' });
    } catch {
      onAction({ title: 'Enqueue failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const stats: JobSystemStats = state.jobs.stats;

  return (
    <div className="space-y-4">
      <SectionHeader icon={Activity} emoji="📦" title="Background Job System™" subtitle="Queues · Workers · Scheduling · Notifications · Retry mechanisms"
        action={<Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400"><Cpu className="h-3 w-3" /> {stats.activeWorkers}/{stats.totalWorkers} workers active</Badge>} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Completed Today" value={stats.jobsCompletedToday.toLocaleString('en-IN')} emoji="✅" tone="text-emerald-400" />
        <Tile label="Failed Today" value={stats.jobsFailedToday} emoji="⚠️" tone="text-red-400" />
        <Tile label="Avg Latency" value={`${stats.avgLatencyMs}ms`} emoji="⚡" />
        <Tile label="Retry Success" value={`${stats.retrySuccessPct}%`} emoji="🔄" />
        <Tile label="Notifications" value={stats.notificationQueueDepth} sub="queued" emoji="🔔" />
        <Tile label="Cron Entries" value={stats.schedulerCronEntries} emoji="📅" />
      </div>

      {/* Enqueue */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Enqueue Job</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Job type</label>
              <select value={jobType} onChange={(e) => setJobType(e.target.value as BackgroundJob['type'])}
                className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-foreground outline-none focus:border-white/20">
                {(['file_gstr1','file_gstr3b','fetch_gstr2b','generate_einvoice','generate_ewaybill','sync_bank_statement','upi_collect','reconcile_txns','create_invoice','process_payroll','deduct_tds','send_whatsapp','send_email','send_sms','issue_notice','generate_report','generate_forecast'] as BackgroundJob['type'][]).map((t) => (
                  <option key={t} value={t} className="bg-background">{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <Button onClick={enqueue} disabled={busy} className="gap-1.5">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enqueue</Button>
          </div>
        </CardContent>
      </Card>

      {/* Queues */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Job Queues</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {state.jobs.queues.map((q: JobQueueStatus) => (
              <div key={q.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><span>{q.emoji}</span>{q.name}</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">{q.workers} workers</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                  <div className="text-muted-foreground">Depth: <span className="text-foreground">{q.depth}</span></div>
                  <div className="text-muted-foreground">Throughput: <span className="text-foreground">{q.throughputPerMin}/min</span></div>
                  <div className="text-muted-foreground">Failed: <span className={q.failedToday > 0 ? 'text-red-400' : 'text-foreground'}>{q.failedToday}</span></div>
                  <div className="text-muted-foreground">Retried: <span className="text-foreground">{q.retriedToday}</span></div>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">Oldest waiting: {q.oldestJobAgeSec}s</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active jobs */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Active &amp; Recent Jobs</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="max-h-96">
            <div className="space-y-1.5">
              {state.jobs.active.map((j: BackgroundJob) => (
                <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[10px] ${JOB_TONE[j.status]}`}>{JOB_STATUS_GLYPH[j.status]}</span>
                    <span className="text-foreground">{j.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">{j.queue.replace('_', ' ')}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${j.priority === 'critical' ? 'border-red-500/30 bg-red-500/[0.06] text-red-400' : j.priority === 'high' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400' : 'text-muted-foreground'}`}>{j.priority}</Badge>
                    <span className="text-[10px] text-muted-foreground">{j.attempts}/{j.maxAttempts}</span>
                    {j.output && <span className="text-[10px] text-emerald-400">{j.output}</span>}
                    {j.error && <span className="text-[10px] text-red-400">✗ {j.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 7 — SaaS Billing™
// ═══════════════════════════════════════════════════════════════════════════════

function BillingModule({ state, onAction }: { state: ExecutionCloudState; onAction: ReturnType<typeof useToast>['toast'] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const sub: CurrentSubscription = state.billing.current;

  const doAction = async (action: 'upgrade' | 'downgrade' | 'cancel' | 'retry_payment', planId?: PlanId) => {
    setBusy(action + (planId ?? ''));
    try {
      const res = await fetch('/api/execution-cloud/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, planId }),
      });
      const data = await res.json();
      if (data.ok) onAction({ title: `💳 ${data.message}` });
      else onAction({ title: 'Billing action failed', variant: 'destructive' });
    } catch {
      onAction({ title: 'Billing action failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={CreditCard} emoji="💳" title="SaaS Billing™" subtitle="Free · Starter · Professional · Business · Enterprise"
        action={<Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400"><ShieldCheck className="h-3 w-3" /> {sub.planName} · {sub.status}</Badge>} />

      {/* Current subscription */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Current Subscription</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{BILLING_PLANS.find((p) => p.id === sub.planId)?.emoji}</span>
                <div>
                  <div className="text-lg font-bold text-foreground">{sub.planName}</div>
                  <div className="text-xs text-muted-foreground">{formatINR(sub.monthlyAmountINR)}/mo · renews {timeUntil(sub.currentPeriodEnd)}</div>
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Payment: <span className="text-foreground">{sub.paymentMethod?.label ?? '—'}</span></div>
              <div>Started: <span className="text-foreground">{new Date(sub.startedAt).toLocaleDateString('en-IN')}</span></div>
            </div>
          </div>
          <Separator className="my-3 bg-white/[0.06]" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg bg-white/[0.02] p-2 text-center"><div className="text-[9px] uppercase text-muted-foreground">Clients</div><div className="text-sm font-semibold text-foreground">{sub.usage.clients}</div></div>
            <div className="rounded-lg bg-white/[0.02] p-2 text-center"><div className="text-[9px] uppercase text-muted-foreground">GSTINs</div><div className="text-sm font-semibold text-foreground">{sub.usage.gstinConnections}</div></div>
            <div className="rounded-lg bg-white/[0.02] p-2 text-center"><div className="text-[9px] uppercase text-muted-foreground">Banks</div><div className="text-sm font-semibold text-foreground">{sub.usage.bankAccounts}</div></div>
            <div className="rounded-lg bg-white/[0.02] p-2 text-center"><div className="text-[9px] uppercase text-muted-foreground">Comm Msgs</div><div className="text-sm font-semibold text-foreground">{sub.usage.commMessagesThisMonth.toLocaleString('en-IN')}</div></div>
            <div className="rounded-lg bg-white/[0.02] p-2 text-center"><div className="text-[9px] uppercase text-muted-foreground">Jobs</div><div className="text-sm font-semibold text-foreground">{sub.usage.backgroundJobsThisMonth.toLocaleString('en-IN')}</div></div>
            <div className="rounded-lg bg-white/[0.02] p-2 text-center"><div className="text-[9px] uppercase text-muted-foreground">Autonomous</div><div className="text-sm font-semibold text-foreground">{sub.usage.autonomousExecutionsThisMonth.toLocaleString('en-IN')}</div></div>
          </div>
          {sub.status !== 'active' && (
            <Button size="sm" className="mt-3 gap-1.5" onClick={() => doAction('retry_payment')} disabled={busy === 'retry_payment'}>
              {busy === 'retry_payment' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Retry payment
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {BILLING_PLANS.map((p) => {
          const isCurrent = p.id === sub.planId;
          const isUpgrade = BILLING_PLANS.findIndex((x) => x.id === p.id) > BILLING_PLANS.findIndex((x) => x.id === sub.planId);
          return (
            <Card key={p.id} className={`relative border-white/[0.06] backdrop-blur-sm ${p.popular ? 'accent-gradient-soft ring-1 ring-emerald-500/20' : 'bg-card/60'} ${isCurrent ? 'ring-2 ring-emerald-500/40' : ''}`}>
              {p.popular && <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px]">POPULAR</Badge>}
              <CardContent className="p-4">
                <div className="text-2xl">{p.emoji}</div>
                <h3 className="mt-1 text-sm font-bold text-foreground">{p.name}</h3>
                <p className="text-[11px] text-muted-foreground">{p.tagline}</p>
                <div className="mt-2 text-2xl font-bold accent-text">{p.priceINR === 0 ? '₹0' : formatINR(p.priceINR)}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                <Separator className="my-2 bg-white/[0.06]" />
                <ul className="space-y-1">
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-2.5 w-2.5 shrink-0 text-emerald-400" />{f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Badge variant="outline" className="mt-3 w-full justify-center border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">Current plan</Badge>
                ) : (
                  <Button size="sm" variant={isUpgrade ? 'default' : 'outline'} className="mt-3 w-full gap-1.5"
                    disabled={busy === ('upgrade' + p.id) || busy === ('downgrade' + p.id)}
                    onClick={() => doAction(isUpgrade ? 'upgrade' : 'downgrade', p.id)}>
                    {busy === ('upgrade' + p.id) || busy === ('downgrade' + p.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                    {isUpgrade ? 'Upgrade' : 'Switch'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* History */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Billing History</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {state.billing.history.map((inv: Invoice2) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{inv.number}</span>
                  <span className="text-foreground">{inv.period}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">{formatINR(inv.totalINR)}</span>
                  <Badge variant="outline" className={`text-[10px] ${inv.status === 'paid' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : inv.status === 'overdue' ? 'border-red-500/30 bg-red-500/[0.06] text-red-400' : 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400'}`}>{inv.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 8 — Mobile Apps™
// ═══════════════════════════════════════════════════════════════════════════════

function MobileModule({ state }: { state: ExecutionCloudState }) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Smartphone} emoji="📱" title="Mobile Apps™" subtitle="Android · iOS · Push notifications"
        action={<Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400"><Smartphone className="h-3 w-3" /> {state.mobile.activeDevices} active devices</Badge>} />

      {/* Builds */}
      <div className="grid gap-3 md:grid-cols-2">
        {state.mobile.builds.map((b: MobileAppBuild) => (
          <Card key={b.platform} className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient-soft text-2xl">
                    {b.platform === 'android' ? '🤖' : '🍎'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{b.platform === 'android' ? 'Android' : 'iOS'} · v{b.version}</h3>
                    <p className="text-[11px] text-muted-foreground">Build {b.buildNumber} · {b.sizeMB}MB · released {timeAgo(b.releasedAt)}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] ${b.status === 'released' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : b.status === 'in_review' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400' : 'text-muted-foreground'}`}>{b.status.replace('_', ' ')}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-white/[0.02] p-2"><div className="text-[9px] uppercase text-muted-foreground">Installs</div><div className="text-sm font-semibold text-foreground">{b.installCount.toLocaleString('en-IN')}</div></div>
                <div className="rounded-lg bg-white/[0.02] p-2"><div className="text-[9px] uppercase text-muted-foreground">Rating</div><div className="text-sm font-semibold text-amber-400">{b.rating}★</div></div>
              </div>
              <Button size="sm" variant="outline" className="mt-3 w-full gap-1.5" onClick={() => window.open(b.storeUrl, '_blank', 'noopener')}>
                <Smartphone className="h-3.5 w-3.5" /> {b.platform === 'android' ? 'Google Play' : 'App Store'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Devices */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Connected Devices</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="max-h-72">
            <div className="space-y-1.5">
              {state.mobile.devices.map((d: MobileDevice) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{d.platform === 'android' ? '🤖' : '🍎'}</span>
                    <div>
                      <div className="text-foreground">{d.model}</div>
                      <div className="text-[10px] text-muted-foreground">{d.ownerName} · v{d.appVersion}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{d.pushToken}</span>
                    <Badge variant="outline" className={`text-[10px] ${d.notificationsEnabled ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : 'text-muted-foreground'}`}>{d.notificationsEnabled ? '🔔 on' : '🔕 off'}</Badge>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(d.lastSeenAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Push notifications */}
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Push Notifications</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {state.mobile.notifications.map((n: PushNotification) => (
              <div key={n.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">{n.category.replace(/_/g, ' ')}</Badge>
                    <span className="font-semibold text-foreground">{n.title}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.sentAt)}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-emerald-400">{n.deliveryRatePct}%</div>
                  <div className="text-[10px] text-muted-foreground">{n.delivered}/{n.recipients}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════════════════════════════

function CloudSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full rounded-2xl" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    </div>
  );
}
