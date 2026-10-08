'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — GLOBAL COMPLIANCE CLOUD™ (AUTONOMOUS COMPLIANCE ENGINE)
// One unified compliance engine — every regulation, filing, risk and audit
// flows through it. Predict. Prepare. Validate. Comply.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PremiumPageLoader } from '@/components/ui/premium-loading';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Shield, Scale, AlertTriangle, FileCheck, CalendarClock, Globe,
  Sparkles, Activity, RefreshCw, Loader2, AlertCircle, CheckCircle2,
  ChevronRight, ChevronDown, RotateCcw, Play, Send, ThumbsUp, Search,
  Gavel, Building2, Users, Banknote, TrendingUp, Hash,
  MapPin, Clock, Cpu, Eye, ShieldCheck, Flame, BellRing, ScrollText,
  CircleDot, Landmark, ClipboardCheck, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ComplianceDashboard, ComplianceFiling, ComplianceRisk, ComplianceRegulation,
  ComplianceAuditEntry, RegulationUpdateRecord, RegulationType, FilingType,
  FilingStatus, RiskSeverity, RiskStatus, ActorType, AuditActionType,
  RegulationUpdateType, AnalyzeResponse, PrepareResponse, ApproveResponse,
  SubmitResponse, ReplayResponse,
} from '@/lib/compliance-cloud/types';
import {
  REGULATION_TYPE_META, FILING_TYPE_META, RISK_SEVERITY_META,
  FILING_STATUS_META,
} from '@/lib/compliance-cloud/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const FOUNDER = 'Prince Singh';
const TITLE = 'Global Compliance Cloud™';
const SUBTITLE = 'AUTONOMOUS COMPLIANCE ENGINE — Predict. Prepare. Validate. Comply.';
const PHASE_TAG = 'Phase 11';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inr = (n: number): string => {
  if (!Number.isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

const timeAgo = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;
  if (diff < 0) return 'just now';
  const s = Math.floor(diff / 1_000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

const fmtPct = (n: number, decimals = 0): string => `${n.toFixed(decimals)}%`;

// ISO 3166-1 alpha-2 → flag emoji
const flag = (iso: string | null | undefined): string => {
  if (!iso || iso.length !== 2) return '🏳️';
  const A = 0x1F1E6;
  const base = 'A'.charCodeAt(0);
  const upper = iso.toUpperCase();
  return String.fromCodePoint(
    A + upper.charCodeAt(0) - base,
    A + upper.charCodeAt(1) - base,
  );
};

// Score → colour (≥90 emerald, ≥75 amber, <75 rose)
const scoreColor = (score: number): string => {
  if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 75) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

const scoreGradient = (score: number): string => {
  if (score >= 90) return 'from-emerald-500 to-teal-500';
  if (score >= 75) return 'from-amber-500 to-orange-500';
  return 'from-rose-500 to-red-500';
};

// Defensive risk colour lookup (handles unknown severity strings)
const riskColor = (severity: string): string => {
  const meta = RISK_SEVERITY_META[severity as RiskSeverity];
  if (meta) return meta.color;
  const lower = severity.toLowerCase();
  if (lower.includes('crit')) return RISK_SEVERITY_META.critical.color;
  if (lower.includes('high')) return RISK_SEVERITY_META.high.color;
  if (lower.includes('med')) return RISK_SEVERITY_META.medium.color;
  return RISK_SEVERITY_META.low.color;
};

const riskLabel = (severity: string): string => {
  const meta = RISK_SEVERITY_META[severity as RiskSeverity];
  return meta ? meta.label : severity;
};

const statusColor = (status: FilingStatus | string): string => {
  const meta = FILING_STATUS_META[status as FilingStatus];
  return meta ? meta.color : 'text-slate-600 bg-slate-50 border-slate-200';
};

const statusLabel = (status: FilingStatus | string): string => {
  const meta = FILING_STATUS_META[status as FilingStatus];
  return meta ? meta.label : status;
};

const regTypeMeta = (type: RegulationType | string) => {
  return REGULATION_TYPE_META[type as RegulationType] ?? {
    label: type,
    icon: '📜',
    color: 'text-slate-600 bg-slate-50 border-slate-200',
  };
};

const filingTypeMeta = (type: FilingType | string) => {
  return FILING_TYPE_META[type as FilingType] ?? { label: type, regulation: 'gst' as RegulationType };
};

// Audit actionType styling
const AUDIT_ACTION_STYLES: Partial<Record<AuditActionType, string>> = {
  filing_prepared: 'text-violet-700 bg-violet-50 border-violet-200',
  filing_approved: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  filing_submitted: 'text-teal-700 bg-teal-50 border-teal-200',
  filing_rejected: 'text-rose-700 bg-rose-50 border-rose-200',
  risk_detected: 'text-amber-700 bg-amber-50 border-amber-200',
  risk_resolved: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  policy_evaluated: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200',
  regulation_updated: 'text-cyan-700 bg-cyan-50 border-cyan-200',
  twin_simulated: 'text-purple-700 bg-purple-50 border-purple-200',
  ai_recommendation: 'text-violet-700 bg-violet-50 border-violet-200',
  signature_applied: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  replay_requested: 'text-orange-700 bg-orange-50 border-orange-200',
};

const ACTOR_LABELS: Record<ActorType, string> = {
  oracle: 'Oracle™',
  ai_cfo: 'AI CFO',
  ai_legal: 'AI Legal',
  ai_coo: 'AI COO',
  human: 'Human',
  system: 'System',
  connector: 'Connector',
};

const UPDATE_TYPE_STYLES: Record<RegulationUpdateType, { label: string; color: string }> = {
  new_law: { label: 'New Law', color: 'text-violet-700 bg-violet-50 border-violet-200' },
  amendment: { label: 'Amendment', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  circular: { label: 'Circular', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  notification: { label: 'Notification', color: 'text-teal-700 bg-teal-50 border-teal-200' },
  rate_change: { label: 'Rate Change', color: 'text-rose-700 bg-rose-50 border-rose-200' },
  deadline_change: { label: 'Deadline Change', color: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200' },
  abolished: { label: 'Abolished', color: 'text-slate-700 bg-slate-50 border-slate-200' },
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

type KpiColor = 'violet' | 'emerald' | 'amber' | 'rose' | 'teal' | 'cyan' | 'orange' | 'fuchsia' | 'purple' | 'slate';

const KPI_COLORS: Record<KpiColor, string> = {
  violet: 'from-violet-500 to-violet-600',
  emerald: 'from-emerald-500 to-emerald-600',
  amber: 'from-amber-500 to-amber-600',
  rose: 'from-rose-500 to-rose-600',
  teal: 'from-teal-500 to-teal-600',
  cyan: 'from-cyan-500 to-cyan-600',
  orange: 'from-orange-500 to-orange-600',
  fuchsia: 'from-fuchsia-500 to-fuchsia-600',
  purple: 'from-purple-500 to-purple-600',
  slate: 'from-slate-500 to-slate-600',
};

function KPICard({
  icon: Icon, label, value, sub, color = 'emerald',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color?: KpiColor;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={cn('h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center', KPI_COLORS[color])}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          {sub && <span className="text-[10px] text-muted-foreground truncate max-w-[60%] text-right">{sub}</span>}
        </div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{label}</div>
      </CardContent>
    </Card>
  );
}

// ─── Loading / Error / Empty states ──────────────────────────────────────────

function LoadingState({ label }: { label: string }) {
  return <PremiumPageLoader label={label} />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertCircle className="h-8 w-8 mb-3 text-rose-500" />
      <p className="text-sm text-rose-600 mb-3 max-w-md text-center">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
          <Icon className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="text-sm font-semibold mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground max-w-md">{description}</p>
      </CardContent>
    </Card>
  );
}

function ScrollContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('max-h-96 overflow-y-auto pr-1 -mr-1 custom-scroll', className)}>
      {children}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info';

interface ToastMsg {
  message: string;
  kind: ToastKind;
}

function ToastView({ toast }: { toast: ToastMsg | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-lg backdrop-blur-sm',
            toast.kind === 'success' && 'bg-emerald-50/95 border-emerald-200 text-emerald-800',
            toast.kind === 'error' && 'bg-rose-50/95 border-rose-200 text-rose-800',
            toast.kind === 'info' && 'bg-violet-50/95 border-violet-200 text-violet-800',
          )}>
            {toast.kind === 'success' && <CheckCircle2 className="h-4 w-4" />}
            {toast.kind === 'error' && <AlertCircle className="h-4 w-4" />}
            {toast.kind === 'info' && <Sparkles className="h-4 w-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function GlobalComplianceCloudPage() {
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3_200);
  }, []);

  const loadDashboard = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/compliance/dashboard');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.ok) setDashboard(j.data as ComplianceDashboard);
      else setError(j.error || 'Failed to load compliance dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Auto-refresh every 20s
  useEffect(() => {
    const t = setInterval(loadDashboard, 20_000);
    return () => clearInterval(t);
  }, [loadDashboard]);

  const overallScore = dashboard?.overallScore ?? 0;
  const scoreClasses = scoreColor(overallScore);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
      {/* ═══════ Header (sticky) ═══════ */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-violet-500 rounded-xl blur-md opacity-60" />
                <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-violet-500 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
                  {TITLE}
                  <Badge variant="secondary" className="text-[10px]">{PHASE_TAG}</Badge>
                </h1>
                <p className="text-xs text-muted-foreground">{SUBTITLE}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Live overall compliance score */}
              <Badge variant="outline" className={cn('text-sm font-bold border px-3 py-1.5', scoreClasses)}>
                <CircleDot className="h-3.5 w-3.5 mr-1.5" />
                Score {overallScore.toFixed(0)}
              </Badge>
              <Button size="sm" variant="outline" onClick={loadDashboard} disabled={refreshing}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1', refreshing && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Shield className="h-3 w-3 text-emerald-500" />
            <span>RBAC · Audit Cloud™ · Digital Twin™ · Policy Engine™ · 13 subsystems · 1 unified engine</span>
            <span className="text-muted-foreground/60">·</span>
            <span>Founded, developed &amp; owned by <strong className="text-foreground">{FOUNDER}</strong></span>
          </div>
        </div>
      </header>

      {/* ═══════ Main Content ═══════ */}
      <main className="container mx-auto px-4 py-6 flex-1">
        {/* Oracle narrative banner */}
        {dashboard && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-6"
          >
            <Card className="overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-violet-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold">Compliance Oracle™</span>
                      <Badge variant="outline" className="text-[10px]">
                        <Clock className="h-2.5 w-2.5 mr-1" />
                        {timeAgo(dashboard.generatedAt)}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[10px]', scoreClasses)}>
                        Score {dashboard.overallScore.toFixed(0)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{dashboard.oracleNarrative}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1 h-auto p-1">
            <TabsTrigger value="dashboard" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" />Dashboard</TabsTrigger>
            <TabsTrigger value="risks" className="text-xs"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Risks</TabsTrigger>
            <TabsTrigger value="filings" className="text-xs"><FileCheck className="h-3.5 w-3.5 mr-1" />Filings</TabsTrigger>
            <TabsTrigger value="deadlines" className="text-xs"><CalendarClock className="h-3.5 w-3.5 mr-1" />Deadlines</TabsTrigger>
            <TabsTrigger value="regulations" className="text-xs"><Scale className="h-3.5 w-3.5 mr-1" />Regulations</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs"><Shield className="h-3.5 w-3.5 mr-1" />Audit Cloud</TabsTrigger>
            <TabsTrigger value="legal" className="text-xs"><Gavel className="h-3.5 w-3.5 mr-1" />Legal Center</TabsTrigger>
            <TabsTrigger value="updates" className="text-xs"><BellRing className="h-3.5 w-3.5 mr-1" />Updates</TabsTrigger>
          </TabsList>

          {/* ═══════ 1. DASHBOARD ═══════ */}
          <TabsContent value="dashboard" className="space-y-6">
            {loading && !dashboard ? <LoadingState label="Loading compliance dashboard" />
              : error ? <ErrorState message={error} onRetry={loadDashboard} />
              : !dashboard ? <ErrorState message="No dashboard payload returned" onRetry={loadDashboard} />
              : <DashboardPanel dashboard={dashboard} />}
          </TabsContent>

          {/* ═══════ 2. RISKS ═══════ */}
          <TabsContent value="risks" className="space-y-6">
            {loading && !dashboard ? <LoadingState label="Loading compliance risks" />
              : error ? <ErrorState message={error} onRetry={loadDashboard} />
              : !dashboard ? <ErrorState message="No risk data" onRetry={loadDashboard} />
              : <RisksPanel dashboard={dashboard} showToast={showToast} />}
          </TabsContent>

          {/* ═══════ 3. FILINGS ═══════ */}
          <TabsContent value="filings" className="space-y-6">
            {loading && !dashboard ? <LoadingState label="Loading filings" />
              : error ? <ErrorState message={error} onRetry={loadDashboard} />
              : !dashboard ? <ErrorState message="No filing data" onRetry={loadDashboard} />
              : <FilingsPanel dashboard={dashboard} showToast={showToast} />}
          </TabsContent>

          {/* ═══════ 4. DEADLINES ═══════ */}
          <TabsContent value="deadlines" className="space-y-6">
            {loading && !dashboard ? <LoadingState label="Loading deadlines" />
              : error ? <ErrorState message={error} onRetry={loadDashboard} />
              : !dashboard ? <ErrorState message="No deadline data" onRetry={loadDashboard} />
              : <DeadlinesPanel dashboard={dashboard} />}
          </TabsContent>

          {/* ═══════ 5. REGULATIONS ═══════ */}
          <TabsContent value="regulations" className="space-y-6">
            <RegulationsPanel showToast={showToast} />
          </TabsContent>

          {/* ═══════ 6. AUDIT CLOUD ═══════ */}
          <TabsContent value="audit" className="space-y-6">
            {loading && !dashboard ? <LoadingState label="Loading audit cloud" />
              : error ? <ErrorState message={error} onRetry={loadDashboard} />
              : !dashboard ? <ErrorState message="No audit data" onRetry={loadDashboard} />
              : <AuditPanel dashboard={dashboard} showToast={showToast} />}
          </TabsContent>

          {/* ═══════ 7. LEGAL CENTER ═══════ */}
          <TabsContent value="legal" className="space-y-6">
            <LegalCenterPanel showToast={showToast} />
          </TabsContent>

          {/* ═══════ 8. REGULATION UPDATES ═══════ */}
          <TabsContent value="updates" className="space-y-6">
            {loading && !dashboard ? <LoadingState label="Loading regulation updates" />
              : error ? <ErrorState message={error} onRetry={loadDashboard} />
              : !dashboard ? <ErrorState message="No update data" onRetry={loadDashboard} />
              : <RegulationUpdatesPanel dashboard={dashboard} />}
          </TabsContent>
        </Tabs>
      </main>

      <ToastView toast={toast} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB PANELS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. DASHBOARD PANEL ──────────────────────────────────────────────────────

function DashboardPanel({ dashboard }: { dashboard: ComplianceDashboard }) {
  const breakdown = dashboard.scoreBreakdown;
  const breakdownItems: Array<{ label: string; value: number; color: string; icon: LucideIcon }> = [
    { label: 'Tax', value: breakdown.tax, color: 'bg-emerald-500', icon: Banknote },
    { label: 'Payroll', value: breakdown.payroll, color: 'bg-teal-500', icon: Users },
    { label: 'Corporate', value: breakdown.corporate, color: 'bg-violet-500', icon: Building2 },
    { label: 'Banking', value: breakdown.banking, color: 'bg-amber-500', icon: Landmark },
    { label: 'Legal', value: breakdown.legal, color: 'bg-rose-500', icon: Scale },
  ];

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* KPI Row 1 — Scale & posture */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KPICard icon={Scale} label="Total Regulations" value={dashboard.totalRegulations.toLocaleString('en-IN')} color="violet" />
        <KPICard icon={AlertTriangle} label="Open Risks" value={dashboard.openRisks} sub="active" color="amber" />
        <KPICard icon={Flame} label="Critical Risks" value={dashboard.criticalRisks} sub="urgent" color="rose" />
        <KPICard icon={CalendarClock} label="Upcoming Deadlines" value={dashboard.upcomingDeadlines} color="teal" />
      </div>

      {/* KPI Row 2 — Filing lifecycle */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KPICard icon={Clock} label="Pending Approvals" value={dashboard.pendingApprovals} color="orange" />
        <KPICard icon={Send} label="Submitted Filings" value={dashboard.submittedFilings.toLocaleString('en-IN')} color="cyan" />
        <KPICard icon={CheckCircle2} label="Acknowledged" value={dashboard.acknowledgedFilings.toLocaleString('en-IN')} color="emerald" />
        <KPICard icon={BellRing} label="Regulation Updates" value={dashboard.regulationUpdates} color="fuchsia" />
      </div>

      {/* Score breakdown + By regulation type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />Compliance Score Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {breakdownItems.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <span className={cn(
                      'tabular-nums font-semibold',
                      item.value >= 90 ? 'text-emerald-600'
                        : item.value >= 75 ? 'text-amber-600'
                          : 'text-rose-600',
                    )}>
                      {item.value.toFixed(0)}
                    </span>
                  </div>
                  <Progress
                    value={item.value}
                    className={cn('h-1.5', item.color)}
                    // custom indicatorColor via classnames
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Overall Compliance Score</span>
              <Badge variant="outline" className={cn('text-sm font-bold', scoreColor(dashboard.overallScore))}>
                {dashboard.overallScore.toFixed(0)}/100
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* By regulation type */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Hash className="h-4 w-4 text-violet-500" />By Regulation Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.byRegulationType.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No regulation breakdown yet.</p>
            ) : (
              <ScrollContainer>
                <div className="space-y-2">
                  {(() => {
                    const max = Math.max(...dashboard.byRegulationType.map((r) => r.count), 1);
                    return dashboard.byRegulationType
                      .slice()
                      .sort((a, b) => b.count - a.count)
                      .map((r) => {
                        const meta = regTypeMeta(r.type);
                        const pct = (r.count / max) * 100;
                        return (
                          <div key={r.type} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span>{meta.icon}</span>
                                <span className="font-medium truncate">{meta.label}</span>
                                <Badge variant="outline" className={cn('text-[9px]', meta.color)}>
                                  {r.riskCount} risks
                                </Badge>
                              </div>
                              <span className="text-muted-foreground tabular-nums">{r.count}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-violet-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.4 }}
                              />
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              </ScrollContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By country table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-teal-500" />Compliance Posture by Country
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.byCountry.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No country data yet.</p>
          ) : (
            <ScrollContainer className="max-h-[24rem]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b text-muted-foreground">
                      <th className="py-2 pr-3">Country</th>
                      <th className="py-2 pr-3 text-right">Score</th>
                      <th className="py-2 pr-3 text-right">Open Risks</th>
                      <th className="py-2 pr-3 text-right">Upcoming</th>
                      <th className="py-2 pr-3">Posture</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.byCountry
                      .slice()
                      .sort((a, b) => a.score - b.score)
                      .map((c) => (
                        <tr key={c.countryIso} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-3">
                            <span className="flex items-center gap-2">
                              <span className="text-base">{flag(c.countryIso)}</span>
                              <span className="font-medium">{c.countryName}</span>
                              <span className="text-[10px] text-muted-foreground">{c.countryIso}</span>
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            <span className={cn(
                              'font-semibold',
                              c.score >= 90 ? 'text-emerald-600'
                                : c.score >= 75 ? 'text-amber-600'
                                  : 'text-rose-600',
                            )}>
                              {c.score.toFixed(0)}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{c.openRisks}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{c.upcomingDeadlines}</td>
                          <td className="py-2 pr-3">
                            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn('h-full rounded-full bg-gradient-to-r', scoreGradient(c.score))}
                                style={{ width: `${c.score}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── 2. RISKS PANEL ──────────────────────────────────────────────────────────

type RiskFilter = 'all' | 'open' | 'critical';

function RisksPanel({ dashboard, showToast }: { dashboard: ComplianceDashboard; showToast: (m: string, k?: ToastKind) => void }) {
  const [filter, setFilter] = useState<RiskFilter>('all');
  const [extraRisks, setExtraRisks] = useState<ComplianceRisk[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  // Combine topRisks from dashboard with any extra fetched risks (dedupe by id)
  const allRisks = useMemo(() => {
    const map = new Map<string, ComplianceRisk>();
    [...dashboard.topRisks, ...extraRisks].forEach((r) => map.set(r.id, r));
    return Array.from(map.values());
  }, [dashboard.topRisks, extraRisks]);

  // Fetch full risk list when panel mounts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingExtra(true);
      try {
        const r = await fetch('/api/compliance/risks');
        const j = await r.json();
        if (!cancelled && j.ok && Array.isArray(j.data)) {
          setExtraRisks(j.data as ComplianceRisk[]);
        }
      } catch {
        // silent — topRisks from dashboard are still shown
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'open') return allRisks.filter((r) => r.status === 'open' || r.status === 'acknowledged' || r.status === 'mitigating');
    if (filter === 'critical') return allRisks.filter((r) => r.severity === 'critical' || r.severity === 'high');
    return allRisks;
  }, [allRisks, filter]);

  const counts = {
    all: allRisks.length,
    open: allRisks.filter((r) => r.status === 'open' || r.status === 'acknowledged' || r.status === 'mitigating').length,
    critical: allRisks.filter((r) => r.severity === 'critical' || r.severity === 'high').length,
  };

  const filterButton = (f: RiskFilter, label: string, count: number, icon: LucideIcon) => {
    const Icon = icon;
    return (
      <button
        type="button"
        onClick={() => setFilter(f)}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs border transition-colors flex items-center gap-1.5',
          filter === f ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-card hover:bg-muted',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        <span className={cn(
          'ml-1 px-1.5 rounded-full text-[10px]',
          filter === f ? 'bg-white/20' : 'bg-muted',
        )}>{count}</span>
      </button>
    );
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Filter chips */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground mr-1">Filter:</span>
            {filterButton('all', 'All Risks', counts.all, AlertTriangle)}
            {filterButton('open', 'Open', counts.open, CircleDot)}
            {filterButton('critical', 'Critical', counts.critical, Flame)}
            {loadingExtra && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-2" />}
            <span className="text-[10px] text-muted-foreground ml-auto">
              Showing {filtered.length} of {allRisks.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Risk list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />Compliance Risk Engine™
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No compliance risks detected"
              description="The Compliance Risk Engine™ continuously scans for late filings, GST mismatches, payroll inconsistencies, banking violations and audit exposures. Risks will appear here the moment they are detected."
            />
          ) : (
            <ScrollContainer className="max-h-[600px]">
              <div className="space-y-3">
                {filtered
                  .slice()
                  .sort((a, b) => {
                    const wA = RISK_SEVERITY_META[a.severity]?.weight ?? 0;
                    const wB = RISK_SEVERITY_META[b.severity]?.weight ?? 0;
                    if (wB !== wA) return wB - wA;
                    return Date.parse(b.detectedAt) - Date.parse(a.detectedAt);
                  })
                  .map((risk) => (
                    <RiskCard key={risk.id} risk={risk} showToast={showToast} />
                  ))}
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RiskCard({ risk, showToast }: { risk: ComplianceRisk; showToast: (m: string, k?: ToastKind) => void }) {
  const meta = regTypeMeta(risk.countryIso); // not regulation, but for flag
  const sevMeta = RISK_SEVERITY_META[risk.severity];
  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn(
          'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br',
          risk.severity === 'critical' ? 'from-rose-500 to-red-600'
            : risk.severity === 'high' ? 'from-orange-500 to-amber-600'
              : risk.severity === 'medium' ? 'from-amber-500 to-yellow-600'
                : 'from-slate-400 to-slate-500',
        )}>
          <AlertTriangle className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={cn('text-[10px] font-medium border', sevMeta?.color)}>
              {sevMeta?.label ?? risk.severity}
            </Badge>
            <Badge variant="outline" className="text-[9px] uppercase">
              {risk.riskType.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className="text-[9px]">{flag(risk.countryIso)} {risk.countryIso}</Badge>
            <Badge variant="outline" className={cn('text-[9px]', risk.status === 'open' ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50')}>
              {risk.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{timeAgo(risk.detectedAt)}</span>
          </div>
          <h4 className="text-sm font-semibold mb-1">{risk.title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">{risk.description}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-2">
            <div className="p-2 rounded bg-muted/40">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Financial Impact</div>
              <div className="font-semibold text-rose-600 tabular-nums">{inr(risk.financialImpact)}</div>
            </div>
            <div className="p-2 rounded bg-muted/40">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Confidence</div>
              <div className="font-semibold tabular-nums">{risk.confidence.toFixed(0)}%</div>
            </div>
            <div className="p-2 rounded bg-muted/40">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Risk Type</div>
              <div className="font-semibold capitalize">{risk.riskType.replace(/_/g, ' ')}</div>
            </div>
            <div className="p-2 rounded bg-muted/40">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Expected Deadline</div>
              <div className="font-semibold">{fmtDate(risk.expectedDeadline)}</div>
            </div>
          </div>

          {risk.recommendedAction && (
            <div className="p-2 rounded border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
              <div className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-[9px] text-emerald-700 uppercase tracking-wide font-semibold">Oracle™ Recommendation</div>
                  <p className="text-xs text-foreground/90">{risk.recommendedAction}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => showToast('Risk acknowledged — owner notified', 'success')}
              className="h-7 text-[11px]"
            >
              <Eye className="h-3 w-3 mr-1" />Acknowledge
            </Button>
            {risk.status !== 'resolved' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => showToast('Mitigation workflow triggered', 'info')}
                className="h-7 text-[11px]"
              >
                <Shield className="h-3 w-3 mr-1" />Mitigate
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3. FILINGS PANEL ────────────────────────────────────────────────────────

function FilingsPanel({ dashboard, showToast }: { dashboard: ComplianceDashboard; showToast: (m: string, k?: ToastKind) => void }) {
  const filings = dashboard.recentFilings ?? [];

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={FileCheck} label="Total Filings" value={dashboard.totalFilings.toLocaleString('en-IN')} color="violet" />
        <KPICard icon={Clock} label="Pending Approval" value={dashboard.pendingApprovals} color="amber" />
        <KPICard icon={Send} label="Submitted" value={dashboard.submittedFilings.toLocaleString('en-IN')} color="cyan" />
        <KPICard icon={CheckCircle2} label="Acknowledged" value={dashboard.acknowledgedFilings.toLocaleString('en-IN')} color="emerald" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-violet-500" />Recent Filings &amp; Autonomous Execution™
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filings.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No filings prepared yet"
              description="Oracle™ autonomously prepares every return — GSTR, ITR, TDS, EPFO, ESIC, MCA, RBI. Use the Analyze action on a filing to begin the Predict → Prepare → Validate → Comply lifecycle."
            />
          ) : (
            <ScrollContainer className="max-h-[680px]">
              <div className="space-y-3">
                {filings.map((f) => (
                  <FilingCard key={f.id} filing={f} showToast={showToast} />
                ))}
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FilingCard({ filing, showToast }: { filing: ComplianceFiling; showToast: (m: string, k?: ToastKind) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState<'analyze' | 'prepare' | 'approve' | 'submit' | null>(null);
  const fmeta = filingTypeMeta(filing.filingType);
  const regMeta = regTypeMeta(fmeta.regulation);
  const smeta = FILING_STATUS_META[filing.status];

  const handleAnalyze = async () => {
    setBusy('analyze');
    try {
      const r = await fetch('/api/compliance/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filingType: filing.filingType,
          period: filing.period,
          countryIso: filing.countryIso,
          organizationId: filing.organizationId,
          entityId: filing.entityId,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setAnalyzeResult(j.data as AnalyzeResponse);
        setExpanded(true);
        showToast('Filing analyzed by Oracle™ — twin simulation complete', 'success');
      } else {
        showToast(j.error || 'Analyze failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Analyze failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePrepare = async () => {
    setBusy('prepare');
    try {
      const r = await fetch('/api/compliance/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filingType: filing.filingType,
          period: filing.period,
          countryIso: filing.countryIso,
          organizationId: filing.organizationId,
          entityId: filing.entityId,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        showToast('Filing prepared by Oracle™', 'success');
      } else {
        showToast(j.error || 'Prepare failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Prepare failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleApprove = async () => {
    setBusy('approve');
    try {
      const r = await fetch('/api/compliance/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filingId: filing.id, approvedBy: 'human' }),
      });
      const j = await r.json();
      if (j.ok) {
        showToast('Filing approved', 'success');
      } else {
        showToast(j.error || 'Approve failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Approve failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async () => {
    setBusy('submit');
    try {
      const r = await fetch('/api/compliance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filingId: filing.id, submittedBy: 'oracle' }),
      });
      const j = await r.json();
      if (j.ok) {
        const ack = (j.data as SubmitResponse)?.ackReference;
        showToast(ack ? `Filing submitted — ACK ${ack}` : 'Filing submitted', 'success');
      } else {
        showToast(j.error || 'Submit failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Submit failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br', KPI_COLORS.violet)}>
          <FileCheck className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={cn('text-[10px] font-medium', regMeta.color, 'border-current/20 bg-current/5')}>
              <span className="mr-1">{regMeta.icon}</span>{fmeta.label}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px] border', smeta.color)}>
              {smeta.label}
            </Badge>
            <Badge variant="outline" className="text-[9px]">{flag(filing.countryIso)} {filing.countryIso}</Badge>
            <Badge variant="outline" className="text-[9px]">Period: {filing.period}</Badge>
            <span className="text-[10px] text-muted-foreground ml-auto">
              Prepared by <span className="font-semibold">{ACTOR_LABELS[filing.preparedBy] ?? filing.preparedBy}</span> · {timeAgo(filing.preparedAt)}
            </span>
          </div>
          <h4 className="text-sm font-semibold">{filing.title}</h4>
          {filing.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{filing.description}</p>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mt-2">
            {typeof filing.summary.totalLiability === 'number' && (
              <div className="p-2 rounded bg-muted/40">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Liability</div>
                <div className="font-semibold text-rose-600 tabular-nums">{inr(filing.summary.totalLiability)}</div>
              </div>
            )}
            {typeof filing.summary.taxPayable === 'number' && (
              <div className="p-2 rounded bg-muted/40">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Tax Payable</div>
                <div className="font-semibold tabular-nums">{inr(filing.summary.taxPayable)}</div>
              </div>
            )}
            {typeof filing.summary.itcClaimed === 'number' && (
              <div className="p-2 rounded bg-muted/40">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">ITC Claimed</div>
                <div className="font-semibold text-emerald-600 tabular-nums">{inr(filing.summary.itcClaimed)}</div>
              </div>
            )}
            {filing.dueDate && (
              <div className="p-2 rounded bg-muted/40">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Due Date</div>
                <div className="font-semibold">{fmtDate(filing.dueDate)}</div>
              </div>
            )}
          </div>

          {/* AI recommendation */}
          {filing.aiRecommendation && (
            <div className="mt-2 p-2 rounded border border-violet-200 bg-violet-50/50 dark:bg-violet-900/10">
              <div className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-[9px] text-violet-700 uppercase tracking-wide font-semibold">Oracle™ Recommendation</div>
                  <p className="text-xs text-foreground/90">{filing.aiRecommendation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={busy !== null} className="h-7 text-[11px]">
              {busy === 'analyze' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
              Analyze
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrepare} disabled={busy !== null} className="h-7 text-[11px]">
              {busy === 'prepare' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Cpu className="h-3 w-3 mr-1" />}
              Prepare
            </Button>
            <Button size="sm" variant="outline" onClick={handleApprove} disabled={busy !== null} className="h-7 text-[11px]">
              {busy === 'approve' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ThumbsUp className="h-3 w-3 mr-1" />}
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={handleSubmit} disabled={busy !== null} className="h-7 text-[11px]">
              {busy === 'submit' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Submit
            </Button>

            {filing.ackReference && (
              <Badge variant="outline" className="text-[9px] ml-auto text-emerald-700 bg-emerald-50 border-emerald-200">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" />ACK {filing.ackReference}
              </Badge>
            )}
          </div>

          {/* Analyze result collapsible */}
          {analyzeResult && (
            <Collapsible open={expanded} onOpenChange={setExpanded}>
              <CollapsibleTrigger asChild>
                <button className="mt-3 flex items-center gap-1 text-[11px] text-violet-600 hover:underline">
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {expanded ? 'Hide' : 'Show'} Twin™ simulation &amp; analysis
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <AnalyzeResultView result={analyzeResult} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalyzeResultView({ result }: { result: AnalyzeResponse }) {
  const twin = result.twin;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.25 }}
      className="mt-2 space-y-3"
    >
      {/* Twin simulation */}
      <div className="p-3 rounded-lg border border-violet-200 bg-violet-50/30 dark:bg-violet-900/10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-xs font-semibold">Compliance Digital Twin™ — Scenario: {twin.scenario}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="p-2 rounded bg-background">
            <div className="text-[9px] text-muted-foreground uppercase">GST Impact</div>
            <div className="font-semibold tabular-nums">{inr(twin.gstImpact)}</div>
          </div>
          <div className="p-2 rounded bg-background">
            <div className="text-[9px] text-muted-foreground uppercase">Tax Impact</div>
            <div className="font-semibold tabular-nums">{inr(twin.taxImpact)}</div>
          </div>
          <div className="p-2 rounded bg-background">
            <div className="text-[9px] text-muted-foreground uppercase">Penalty Estimate</div>
            <div className="font-semibold text-rose-600 tabular-nums">{inr(twin.penaltyEstimate)}</div>
          </div>
          <div className="p-2 rounded bg-background">
            <div className="text-[9px] text-muted-foreground uppercase">Interest Estimate</div>
            <div className="font-semibold text-amber-600 tabular-nums">{inr(twin.interestEstimate)}</div>
          </div>
          <div className="p-2 rounded bg-background">
            <div className="text-[9px] text-muted-foreground uppercase">Cash Flow Effect</div>
            <div className={cn('font-semibold tabular-nums', twin.cashFlowEffect >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {inr(twin.cashFlowEffect)}
            </div>
          </div>
          <div className="p-2 rounded bg-background">
            <div className="text-[9px] text-muted-foreground uppercase">Audit Probability</div>
            <div className="font-semibold tabular-nums">{twin.auditProbability.toFixed(1)}%</div>
          </div>
          <div className="p-2 rounded bg-background">
            <div className="text-[9px] text-muted-foreground uppercase">Score Δ</div>
            <div className={cn('font-semibold tabular-nums', twin.complianceScoreDelta >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {twin.complianceScoreDelta >= 0 ? '+' : ''}{twin.complianceScoreDelta.toFixed(1)}
            </div>
          </div>
          <div className="p-2 rounded bg-background">
            <div className="text-[9px] text-muted-foreground uppercase">Regulatory Risk</div>
            <Badge variant="outline" className={cn('text-[9px]', riskColor(twin.regulatoryRisk))}>
              {twin.regulatoryRisk}
            </Badge>
          </div>
        </div>
        {twin.recommendation && (
          <p className="text-xs mt-2 text-foreground/90">{twin.recommendation}</p>
        )}
      </div>

      {/* Oracle recommendation */}
      {result.oracleRecommendation && (
        <div className="p-2 rounded border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
          <div className="flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[9px] text-emerald-700 uppercase tracking-wide font-semibold">Oracle™ Final Recommendation</div>
              <p className="text-xs text-foreground/90">{result.oracleRecommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Risks surfaced by analyze */}
      {result.risks.length > 0 && (
        <div className="text-[11px]">
          <span className="text-muted-foreground">Risks surfaced by analysis: </span>
          <span className="font-semibold text-rose-600">{result.risks.length}</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── 4. DEADLINES PANEL ──────────────────────────────────────────────────────

interface DeadlineBucket {
  key: 'overdue' | 'today' | 'week' | 'month';
  label: string;
  color: string;
  items: ComplianceDashboard['upcomingDeadlineFeed'];
}

function DeadlinesPanel({ dashboard }: { dashboard: ComplianceDashboard }) {
  const feed = dashboard.upcomingDeadlineFeed ?? [];

  const buckets = useMemo<DeadlineBucket[]>(() => {
    const overdue: DeadlineBucket['items'] = [];
    const today: DeadlineBucket['items'] = [];
    const week: DeadlineBucket['items'] = [];
    const month: DeadlineBucket['items'] = [];

    feed.forEach((d) => {
      const days = d.daysUntil;
      if (days === null || days === undefined) return;
      if (days < 0) overdue.push(d);
      else if (days === 0) today.push(d);
      else if (days <= 7) week.push(d);
      else if (days <= 30) month.push(d);
    });

    return [
      { key: 'overdue', label: 'Overdue', color: 'text-rose-700 bg-rose-50 border-rose-200', items: overdue },
      { key: 'today', label: 'Today', color: 'text-amber-700 bg-amber-50 border-amber-200', items: today },
      { key: 'week', label: 'This Week', color: 'text-violet-700 bg-violet-50 border-violet-200', items: week },
      { key: 'month', label: 'This Month', color: 'text-teal-700 bg-teal-50 border-teal-200', items: month },
    ];
  }, [feed]);

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Flame} label="Overdue" value={buckets[0].items.length} color="rose" />
        <KPICard icon={Clock} label="Due Today" value={buckets[1].items.length} color="amber" />
        <KPICard icon={CalendarClock} label="This Week" value={buckets[2].items.length} color="violet" />
        <KPICard icon={CalendarClock} label="This Month" value={buckets[3].items.length} color="teal" />
      </div>

      {feed.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No upcoming deadlines in the next 30 days"
          description="The Global Deadline Engine™ aggregates GST, Income Tax, TDS, EPFO, ESIC, MCA, RBI and labour-law deadlines across every jurisdiction. Upcoming items will appear here, grouped by urgency."
        />
      ) : (
        <div className="space-y-4">
          {buckets.map((bucket) => bucket.items.length > 0 && (
            <Card key={bucket.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  {bucket.label}
                  <Badge variant="outline" className={cn('text-[10px]', bucket.color)}>
                    {bucket.items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollContainer className="max-h-[260px]">
                  <div className="space-y-2">
                    {bucket.items
                      .slice()
                      .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999))
                      .map((d, i) => (
                        <DeadlineRow key={`${d.countryIso}-${d.title}-${i}`} item={d} />
                      ))}
                  </div>
                </ScrollContainer>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function DeadlineRow({ item }: { item: ComplianceDashboard['upcomingDeadlineFeed'][number] }) {
  const regMeta = regTypeMeta(item.regulationType);
  const days = item.daysUntil;
  const daysLabel = days === null || days === undefined
    ? '—'
    : days < 0
      ? `${Math.abs(days)}d overdue`
      : days === 0
        ? 'today'
        : `in ${days}d`;

  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="text-2xl flex-shrink-0">{flag(item.countryIso)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge variant="outline" className={cn('text-[9px]', regMeta.color, 'border-current/20 bg-current/5')}>
            <span className="mr-0.5">{regMeta.icon}</span>{regMeta.label}
          </Badge>
          <Badge variant="outline" className={cn('text-[9px] border', riskColor(item.riskLevel))}>
            {riskLabel(item.riskLevel)}
          </Badge>
          {item.authority && (
            <Badge variant="outline" className="text-[9px]">{item.authority}</Badge>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{daysLabel}</span>
        </div>
        <div className="text-xs font-semibold truncate">{item.title}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {item.countryName} · Due {fmtDate(item.dueDate)}
        </div>
      </div>
    </div>
  );
}

// ─── 5. REGULATIONS PANEL ────────────────────────────────────────────────────

function RegulationsPanel({ showToast }: { showToast: (m: string, k?: ToastKind) => void }) {
  const [regulations, setRegulations] = useState<ComplianceRegulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/compliance/regulations');
      const j = await r.json();
      if (j.ok) setRegulations(j.data as ComplianceRegulation[]);
      else setError(j.error || 'Failed to load regulations');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return regulations;
    const q = search.toLowerCase();
    return regulations.filter((r) =>
      r.regulationCode.toLowerCase().includes(q)
      || r.title.toLowerCase().includes(q)
      || r.jurisdiction.toLowerCase().includes(q)
      || r.countryIso.toLowerCase().includes(q),
    );
  }, [regulations, search]);

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Search + summary */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by code, title, jurisdiction…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Badge variant="outline" className="text-[10px]">
              {filtered.length} of {regulations.length}
            </Badge>
            <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-7 text-[11px]">
              <RefreshCw className={cn('h-3 w-3 mr-1', loading && 'animate-spin')} />Reload
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Loading regulation knowledge graph" />
        : error ? <ErrorState message={error} onRetry={load} />
        : filtered.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No regulations found"
            description="The Regulation Knowledge Graph™ continuously ingests GST, IT, MCA, RBI, EPFO, ESIC and labour-law regulations from official sources. They will appear here once the connectors start emitting."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="h-4 w-4 text-violet-500" />Regulation Knowledge Graph™ ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollContainer className="max-h-[680px]">
                <div className="space-y-2">
                  {filtered.map((reg) => (
                    <RegulationCard key={reg.id} regulation={reg} showToast={showToast} />
                  ))}
                </div>
              </ScrollContainer>
            </CardContent>
          </Card>
        )}
    </motion.div>
  );
}

function RegulationCard({ regulation, showToast }: { regulation: ComplianceRegulation; showToast: (m: string, k?: ToastKind) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = regTypeMeta(regulation.regulationType);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br', KPI_COLORS.violet)}>
            <Scale className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={cn('text-[10px] font-medium', meta.color, 'border-current/20 bg-current/5')}>
                <span className="mr-1">{meta.icon}</span>{regulation.regulationCode}
              </Badge>
              <Badge variant="outline" className="text-[9px]">{flag(regulation.countryIso)} {regulation.jurisdiction}</Badge>
              <Badge variant="outline" className="text-[9px] uppercase">{regulation.category}</Badge>
              <Badge variant="outline" className={cn(
                'text-[9px]',
                regulation.riskWeight >= 75 ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : regulation.riskWeight >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200',
              )}>
                Risk {regulation.riskWeight}
              </Badge>
              {regulation.authority && (
                <Badge variant="outline" className="text-[9px]">{regulation.authority}</Badge>
              )}
              {!regulation.isActive && (
                <Badge variant="outline" className="text-[9px] text-slate-500 bg-slate-50">Inactive</Badge>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">
                Reviewed {timeAgo(regulation.lastReviewedAt)}
              </span>
            </div>
            <h4 className="text-sm font-semibold">{regulation.title}</h4>
            {regulation.description && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{regulation.description}</p>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mt-2">
              <div className="p-1.5 rounded bg-muted/40">
                <div className="text-[9px] text-muted-foreground uppercase">Sections</div>
                <div className="font-semibold tabular-nums">{regulation.sections.length}</div>
              </div>
              <div className="p-1.5 rounded bg-muted/40">
                <div className="text-[9px] text-muted-foreground uppercase">Linked Entities</div>
                <div className="font-semibold tabular-nums">{regulation.linkedEntityIds.length}</div>
              </div>
              <div className="p-1.5 rounded bg-muted/40">
                <div className="text-[9px] text-muted-foreground uppercase">Cross-Border Refs</div>
                <div className="font-semibold tabular-nums">{regulation.crossBorderRefs.length}</div>
              </div>
              <div className="p-1.5 rounded bg-muted/40">
                <div className="text-[9px] text-muted-foreground uppercase">Interest Rate</div>
                <div className="font-semibold tabular-nums">{regulation.interestRatePct.toFixed(1)}%</div>
              </div>
            </div>

            <CollapsibleTrigger asChild>
              <button className="mt-2 flex items-center gap-1 text-[11px] text-violet-600 hover:underline">
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {expanded ? 'Hide' : 'Show'} sections &amp; linked entities
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
                className="mt-3 space-y-3"
              >
                {/* Sections */}
                {regulation.sections.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-semibold">Sections</div>
                    <div className="space-y-1.5">
                      {regulation.sections.map((s, i) => (
                        <div key={i} className="p-2 rounded border bg-background">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px]">{s.section}</Badge>
                            <span className="text-xs font-semibold">{s.title}</span>
                          </div>
                          {s.summary && <p className="text-[11px] text-muted-foreground mt-1">{s.summary}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked entities + cross-border refs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-semibold">Linked Entities</div>
                    {regulation.linkedEntityIds.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No entities linked yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {regulation.linkedEntityIds.map((id) => (
                          <Badge key={id} variant="outline" className="text-[9px]">
                            <Building2 className="h-2.5 w-2.5 mr-1" />{id}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-semibold">Cross-Border References</div>
                    {regulation.crossBorderRefs.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No cross-border refs.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {regulation.crossBorderRefs.map((ref, i) => (
                          <Badge key={i} variant="outline" className="text-[9px]">
                            <Globe className="h-2.5 w-2.5 mr-1" />{ref}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Industry tags + penalty */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {regulation.industryTags.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-semibold">Industry Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {regulation.industryTags.map((t, i) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {regulation.penaltySummary && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-semibold">Penalty Summary</div>
                      <p className="text-[11px] text-rose-700">{regulation.penaltySummary}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => showToast('Linked to Business Graph™', 'info')}
                    className="h-7 text-[11px]"
                  >
                    <Globe className="h-3 w-3 mr-1" />Link to Graph
                  </Button>
                  {regulation.sourceUrl && (
                    <a
                      href={regulation.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-violet-600 hover:underline ml-2"
                    >
                      View official source →
                    </a>
                  )}
                </div>
              </motion.div>
            </CollapsibleContent>
          </div>
        </div>
      </div>
    </Collapsible>
  );
}

// ─── 6. AUDIT CLOUD PANEL ────────────────────────────────────────────────────

function AuditPanel({ dashboard, showToast }: { dashboard: ComplianceDashboard; showToast: (m: string, k?: ToastKind) => void }) {
  const entries = dashboard.recentAuditEntries ?? [];

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Shield} label="Audit Entries" value={entries.length.toLocaleString('en-IN')} color="violet" />
        <KPICard icon={FileCheck} label="Filings Approved" value={entries.filter((e) => e.actionType === 'filing_approved').length} color="emerald" />
        <KPICard icon={Send} label="Filings Submitted" value={entries.filter((e) => e.actionType === 'filing_submitted').length} color="teal" />
        <KPICard icon={Sparkles} label="AI Recommendations" value={entries.filter((e) => e.actionType === 'ai_recommendation').length} color="fuchsia" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-500" />Audit Cloud™ — Immutable, Replayable, Signed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No audit entries yet"
              description="The Audit Cloud™ permanently records every compliance action — filing prepared, approved, submitted, risk detected, regulation updated, twin simulated. Every entry is SHA-256 signed and replayable."
            />
          ) : (
            <ScrollContainer className="max-h-[600px]">
              <div className="relative space-y-3 pl-6">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                {entries.map((e) => (
                  <AuditRow key={e.id} entry={e} showToast={showToast} />
                ))}
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AuditRow({ entry, showToast }: { entry: ComplianceAuditEntry; showToast: (m: string, k?: ToastKind) => void }) {
  const [busy, setBusy] = useState(false);
  const actionStyle = AUDIT_ACTION_STYLES[entry.actionType] ?? 'text-slate-600 bg-slate-50 border-slate-200';

  const handleReplay = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/compliance/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replayToken: entry.replayToken, requestedBy: 'human' }),
      });
      const j = await r.json();
      if (j.ok) {
        showToast('Audit step replayed — reconstructed state attached', 'success');
      } else {
        showToast(j.error || 'Replay failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Replay failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <div className="absolute -left-5 top-1.5 h-3 w-3 rounded-full ring-2 ring-background bg-violet-500" />
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
        <Activity className="h-4 w-4 flex-shrink-0 mt-0.5 text-violet-600" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={cn('text-[9px] border', actionStyle)}>
              {entry.actionType.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className="text-[9px]">{ACTOR_LABELS[entry.actorType] ?? entry.actorType}</Badge>
            {entry.countryIso && (
              <Badge variant="outline" className="text-[9px]">{flag(entry.countryIso)} {entry.countryIso}</Badge>
            )}
            {entry.entityType && (
              <Badge variant="outline" className="text-[9px] uppercase">{entry.entityType}</Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{fmtDateTime(entry.createdAt)}</span>
          </div>
          <p className="text-xs leading-relaxed">{entry.action}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="h-2.5 w-2.5" />
              <code className="font-mono">{entry.replayToken.slice(0, 12)}…</code>
            </span>
            {entry.signature && (
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
                <code className="font-mono">{entry.signature.slice(0, 12)}…</code>
              </span>
            )}
            {entry.ipAddress && (
              <span className="flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" />
                {entry.ipAddress}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReplay}
            disabled={busy}
            className="mt-2 h-7 text-[11px]"
          >
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
            Replay
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 7. LEGAL CENTER PANEL ───────────────────────────────────────────────────

interface LegalCenterData {
  contractCount?: number;
  openObligations?: number;
  filingStatus?: Array<{ type: string; status: string; count: number }>;
  litigationRisks?: Array<{
    title: string;
    severity: string;
    description?: string;
    estimatedExposure?: number;
    likelihood?: number;
    status?: string;
  }>;
  directorResponsibilities?: Array<{
    director: string;
    role?: string;
    responsibilities?: string[];
    status?: string;
  }>;
  executiveSummary?: string;
}

function LegalCenterPanel({ showToast }: { showToast: (m: string, k?: ToastKind) => void }) {
  const [data, setData] = useState<LegalCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/compliance/legal');
      const j = await r.json();
      if (j.ok) setData(j.data as LegalCenterData);
      else setError(j.error || 'Failed to load legal center');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState label="Loading AI Legal Command Center" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <ErrorState message="No legal data returned" onRetry={load} />;

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Executive summary */}
      <Card className="overflow-hidden border-rose-500/30 bg-gradient-to-br from-rose-500/5 via-violet-500/5 to-emerald-500/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-rose-500 via-violet-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
              <Gavel className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-semibold">AI Legal Command Center™</span>
                <Badge variant="outline" className="text-[10px]">
                  <Clock className="h-2.5 w-2.5 mr-1" />Executive Summary
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {data.executiveSummary || 'AI Legal is reviewing contracts, obligations, filing exposures and litigation risks across all jurisdictions. The summary will populate as obligations are ingested.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={ScrollText} label="Contracts" value={data.contractCount ?? 0} color="violet" />
        <KPICard icon={ClipboardCheck} label="Open Obligations" value={data.openObligations ?? 0} color="amber" />
        <KPICard icon={AlertTriangle} label="Litigation Risks" value={data.litigationRisks?.length ?? 0} color="rose" />
        <KPICard icon={Users} label="Directors Tracked" value={data.directorResponsibilities?.length ?? 0} color="teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Filing status overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-violet-500" />Filing Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data.filingStatus || data.filingStatus.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No filing status data yet.</p>
            ) : (
              <ScrollContainer>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b text-muted-foreground">
                      <th className="py-2 pr-3">Filing Type</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.filingStatus.map((fs, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="py-2 pr-3 font-medium">{fs.type}</td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className={cn('text-[9px] border', statusColor(fs.status))}>
                            {statusLabel(fs.status)}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums font-semibold">{fs.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollContainer>
            )}
          </CardContent>
        </Card>

        {/* Director responsibilities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-500" />Director Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data.directorResponsibilities || data.directorResponsibilities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No director data yet.</p>
            ) : (
              <ScrollContainer>
                <div className="space-y-2">
                  {data.directorResponsibilities.map((d, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold">{d.director}</span>
                        {d.role && (
                          <Badge variant="outline" className="text-[9px]">{d.role}</Badge>
                        )}
                        {d.status && (
                          <Badge variant="outline" className={cn(
                            'text-[9px]',
                            d.status === 'compliant' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : d.status === 'pending' ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : 'text-rose-700 bg-rose-50 border-rose-200',
                          )}>
                            {d.status}
                          </Badge>
                        )}
                      </div>
                      {d.responsibilities && d.responsibilities.length > 0 && (
                        <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                          {d.responsibilities.map((r, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span className="text-teal-500 mt-0.5">•</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Litigation risks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />Litigation Risks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.litigationRisks || data.litigationRisks.length === 0 ? (
            <div className="py-6 flex flex-col items-center text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-2" />
              <p className="text-xs text-muted-foreground">No litigation risks detected by AI Legal.</p>
            </div>
          ) : (
            <ScrollContainer className="max-h-[400px]">
              <div className="space-y-2">
                {data.litigationRisks.map((lr, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className={cn('text-[9px] border', riskColor(lr.severity))}>
                        {riskLabel(lr.severity)}
                      </Badge>
                      {lr.status && (
                        <Badge variant="outline" className="text-[9px]">{lr.status}</Badge>
                      )}
                      {typeof lr.likelihood === 'number' && (
                        <Badge variant="outline" className="text-[9px]">Likelihood {lr.likelihood}%</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        Exposure: <span className="font-semibold text-rose-600 tabular-nums">{inr(lr.estimatedExposure ?? 0)}</span>
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold">{lr.title}</h4>
                    {lr.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{lr.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button
          size="sm"
          variant="outline"
          onClick={() => showToast('AI Legal review queued — contracts being scanned', 'info')}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />Trigger Full Legal Review
        </Button>
      </div>
    </motion.div>
  );
}

// ─── 8. REGULATION UPDATES PANEL ─────────────────────────────────────────────

function RegulationUpdatesPanel({ dashboard }: { dashboard: ComplianceDashboard }) {
  const updates = dashboard.recentRegulationUpdates ?? [];

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={BellRing} label="Recent Updates" value={updates.length} color="fuchsia" />
        <KPICard icon={Scale} label="New Laws" value={updates.filter((u) => u.updateType === 'new_law').length} color="violet" />
        <KPICard icon={AlertTriangle} label="Rate Changes" value={updates.filter((u) => u.updateType === 'rate_change').length} color="rose" />
        <KPICard icon={CalendarClock} label="Deadline Changes" value={updates.filter((u) => u.updateType === 'deadline_change').length} color="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BellRing className="h-4 w-4 text-fuchsia-500" />Regulation Update Engine™
          </CardTitle>
        </CardHeader>
        <CardContent>
          {updates.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="No regulation updates detected"
              description="The Regulation Update Engine™ continuously monitors official gazettes, CBDT/CBIC circulars, RBI/MCA notifications and global tax-law changes. New laws, amendments, rate changes and deadline shifts will appear here the moment they are detected."
            />
          ) : (
            <ScrollContainer className="max-h-[680px]">
              <div className="space-y-3">
                {updates.map((u) => (
                  <UpdateCard key={u.id} update={u} />
                ))}
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function UpdateCard({ update }: { update: RegulationUpdateRecord }) {
  const utMeta = UPDATE_TYPE_STYLES[update.updateType] ?? {
    label: update.updateType,
    color: 'text-slate-600 bg-slate-50 border-slate-200',
  };
  const impact = update.impactAssessment;

  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br', KPI_COLORS.fuchsia)}>
          <BellRing className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={cn('text-[9px] border', utMeta.color)}>
              {utMeta.label}
            </Badge>
            <Badge variant="outline" className="text-[9px]">{flag(update.countryIso)} {update.jurisdiction}</Badge>
            <Badge variant="outline" className="text-[9px]">{update.regulationCode}</Badge>
            {update.authority && (
              <Badge variant="outline" className="text-[9px]">{update.authority}</Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
              Detected {timeAgo(update.detectedAt)}
            </span>
          </div>
          <h4 className="text-sm font-semibold">{update.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{update.summary}</p>

          {/* Impact assessment */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mt-2">
            <div className="p-2 rounded bg-muted/40">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Affected Filings</div>
              <div className="font-semibold tabular-nums">{impact.affectedFilings.length}</div>
            </div>
            <div className="p-2 rounded bg-muted/40">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Risk Δ</div>
              <div className={cn('font-semibold tabular-nums', impact.riskDelta >= 0 ? 'text-rose-600' : 'text-emerald-600')}>
                {impact.riskDelta >= 0 ? '+' : ''}{impact.riskDelta}
              </div>
            </div>
            <div className="p-2 rounded bg-muted/40">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Estimated INR</div>
              <div className="font-semibold text-rose-600 tabular-nums">{inr(impact.estimatedINR)}</div>
            </div>
            <div className="p-2 rounded bg-muted/40">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Effective</div>
              <div className="font-semibold">{fmtDate(update.effectiveDate)}</div>
            </div>
          </div>

          {/* Affected filing chips */}
          {impact.affectedFilings.length > 0 && (
            <div className="mt-2">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Affected Filings</div>
              <div className="flex flex-wrap gap-1">
                {impact.affectedFilings.map((f, i) => {
                  const fm = filingTypeMeta(f);
                  return (
                    <Badge key={i} variant="outline" className="text-[9px]">
                      {fm.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Oracle advice */}
          {update.oracleAdvice && (
            <div className="mt-2 p-2 rounded border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
              <div className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-[9px] text-emerald-700 uppercase tracking-wide font-semibold">Oracle™ Advice</div>
                  <p className="text-xs text-foreground/90">{update.oracleAdvice}</p>
                </div>
              </div>
            </div>
          )}

          {/* Notification status */}
          <div className="mt-2 flex items-center gap-2 text-[10px]">
            {update.notifiedExecutives ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />Executives notified
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <Clock className="h-3 w-3" />Pending executive notification
              </span>
            )}
            {update.acknowledgedAt && (
              <span className="flex items-center gap-1 text-emerald-600">
                · Acknowledged {timeAgo(update.acknowledgedAt)}
              </span>
            )}
            {update.sourceUrl && (
              <a
                href={update.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-violet-600 hover:underline"
              >
                Source →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
