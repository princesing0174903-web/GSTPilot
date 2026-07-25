'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ORACLE INTELLIGENCE CORE™ — COMMAND CENTER
//
// One Brain. Every Decision. Entire Enterprise.
//
// The unified AI brain that orchestrates 17 enterprise AI modules:
// reasoning, memory, conversation, insights, multi-model routing,
// self-improvement, context engine, and security — all in one UI.
//
// Tabs:
//   1.  Brain Overview        — 17 module cards + recent activity
//   2.  Ask Oracle            — chat interface with structured reasoning output
//   3.  Unified Memory        — search the unified memory layer
//   4.  Executive Conversation — multi-AI-executive collaboration timeline
//   5.  Reasoning History     — past reasoning records with expandable details
//   6.  Knowledge Synthesis   — 8-category daily insights with actions
//   7.  Multi-Model Router    — model catalog + router stats + call log
//   8.  Self-Improvement      — top lessons + record learning form
//   9.  Context Engine        — live business context snapshot
//   10. Security & Audit      — security stats + audit log table
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Brain, Sparkles, Zap, Target, Microscope, Lightbulb, RefreshCw,
  Activity, Database, Cpu, BrainCircuit, MessageSquare,
  GraduationCap, Network, ShieldCheck, Loader2, Search, Send, Play,
  CheckCircle2, XCircle, AlertTriangle, Clock, ChevronDown, ChevronRight,
  TrendingUp, DollarSign, ShieldAlert, Scale, Wrench, Briefcase, Users,
  Crown, FileText, Bot, Workflow, Boxes, Globe2, Server,
  Settings as SettingsIcon, CircleDollarSign, GitBranch,
  ThumbsUp, Pencil, Gauge,
  ArrowRight, Plus, Square, BookOpen, History, HelpCircle, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import type {
  OracleDashboard, AIModuleInfo, ReasoningResult, Conversation,
  InsightRecord, LearningRecord, BusinessContext, Explanation,
  ConversationTurn, MemoryCategory, MemorySource, LearningCategory,
  InsightCategory, ModelChoice,
} from '@/lib/oracle-core/types';
import { fetchWithTimeout } from '@/lib/async';

// ─── Local types mirroring API response shapes ──────────────────────────────

interface MemoryRecordLite {
  id: string;
  category: MemoryCategory;
  source: MemorySource;
  title: string;
  summary: string;
  importance: number;
  tags: string[];
  createdAt: string;
}

interface MemorySearchResponse {
  total: number;
  records: MemoryRecordLite[];
  sources: MemorySource[];
  suggestions: string[];
}

interface ModelCatalogEntry {
  provider: string;
  model: string;
  tier: string;
  purposes: string[];
  inputCostPer1k: number;
  outputCostPer1k: number;
  latencyMs: number;
  contextWindow: number;
  supportsVision: boolean;
  supportsVoice: boolean;
}

interface ModelCallLogLite {
  id: string;
  provider: string;
  model: string;
  tier: string;
  purpose: string;
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  costUsd: number;
  createdAt: string;
}

interface RouterStats {
  totalCalls: number;
  byProvider: Record<string, number>;
  byTier: Record<string, number>;
  successRate: number;
  avgLatencyMs: number;
  totalCostUsd: number;
  fallbacksTriggered: number;
}

interface ModelsResponse {
  catalog: ModelCatalogEntry[];
  stats: RouterStats;
  recentCalls: ModelCallLogLite[];
  totalModels: number;
  providers: string[];
}

interface AuditLogEntry {
  id: string;
  action: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  userId: string | null;
  rbacRole: string | null;
  rateLimited: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface SecurityStats {
  totalCalls: number;
  rateLimited: number;
  rbacEnforced: number;
  auditLogged: number;
  errors: number;
}

interface AuditResponse {
  stats: SecurityStats;
  recent: AuditLogEntry[];
  total: number;
}

interface AskResponse {
  reasoning: ReasoningResult;
  explanation: Explanation | null;
  durationMs: number;
}

interface PlanResponse {
  plan: {
    objective: string;
    conversation: Conversation;
    reasoning: ReasoningResult;
    consensus: string | null;
    createdAt: string;
    durationMs: number;
  };
}

interface AnalyzeResponse {
  analysis: {
    topic: string;
    reasoning: ReasoningResult;
    contextSnapshot: {
      estimatedTokens: number;
      finance: BusinessContext['finance'];
      twin: BusinessContext['twin'];
      graph: BusinessContext['graph'];
      connectedSystems: BusinessContext['connectedSystems'];
    };
    formattedContext: string;
    createdAt: string;
    durationMs: number;
  };
}

interface InsightsSynthesizeResponse {
  insights: InsightRecord[];
  total: number;
  synthesizedAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EXECUTIVE_LABELS: Record<string, string> = {
  oracle: 'Oracle Brain',
  ceo: 'AI CEO',
  cfo: 'AI CFO',
  coo: 'AI COO',
  cto: 'AI CTO',
  cro: 'AI CRO',
  legal: 'AI Legal',
  hr: 'AI HR',
  marketing: 'AI Marketing',
  operations: 'AI Operations',
  graph: 'Business Graph',
  knowledge: 'Knowledge Graph',
  twin: 'Digital Twin',
  autonomous: 'Autonomous Enterprise',
  connectivity: 'Connectivity Fabric',
  factory: 'Software Factory',
  event: 'Event Stream Engine',
};

const EXECUTIVE_ICONS: Record<string, LucideIcon> = {
  oracle: Brain, ceo: Crown, cfo: CircleDollarSign, coo: Workflow,
  cto: Cpu, cro: ShieldAlert, legal: Scale, hr: Users,
  marketing: TrendingUp, operations: SettingsIcon, graph: Network,
  knowledge: BookOpen, twin: Boxes, autonomous: Bot,
  connectivity: Globe2, factory: Server, event: Activity,
};

const MEMORY_CATEGORIES: MemoryCategory[] = [
  'customer', 'vendor', 'employee', 'invoice', 'gst', 'payment', 'meeting',
  'voice', 'strategy', 'plan', 'prediction', 'report', 'simulation',
  'approval', 'graph_change', 'knowledge_update', 'connector_event',
  'marketplace_install', 'factory_build', 'reasoning', 'conversation',
  'insight', 'learning',
];

const MEMORY_SOURCES: MemorySource[] = [
  'oracle', 'ceo', 'cfo', 'coo', 'cto', 'cro', 'legal', 'hr', 'marketing',
  'operations', 'graph', 'twin', 'autonomous', 'connectivity', 'factory', 'user',
];

const LEARNING_CATEGORIES: LearningCategory[] = [
  'accepted_rec', 'rejected_rec', 'successful_auto', 'failed_auto',
  'revenue_growth', 'customer_behavior', 'collections', 'expenses', 'compliance',
];

const INSIGHT_CATEGORIES: InsightCategory[] = [
  'business_insight', 'risk_summary', 'growth_opportunity', 'cost_saving',
  'compliance_warning', 'revenue_forecast', 'cash_forecast', 'executive_summary',
];

const TABS = [
  { value: 'overview', label: 'Brain Overview', icon: BrainCircuit },
  { value: 'ask', label: 'Ask Oracle', icon: MessageSquare },
  { value: 'memory', label: 'Unified Memory', icon: Database },
  { value: 'conversation', label: 'Executive Conversation', icon: Users },
  { value: 'reasoning', label: 'Reasoning History', icon: Brain },
  { value: 'insights', label: 'Knowledge Synthesis', icon: Lightbulb },
  { value: 'router', label: 'Multi-Model Router', icon: Network },
  { value: 'learning', label: 'Self-Improvement', icon: GraduationCap },
  { value: 'context', label: 'Context Engine', icon: Globe2 },
  { value: 'security', label: 'Security & Audit', icon: ShieldCheck },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 0) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return '—';
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtINR(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)} K`;
  return `₹${Math.round(n)}`;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function statusColor(status: string): string {
  if (['online', 'active', 'success', 'consensus_reached', 'healthy'].includes(status))
    return 'text-emerald-600 dark:text-emerald-400';
  if (['offline', 'failed', 'error', 'abandoned', 'rejected'].includes(status))
    return 'text-rose-600 dark:text-rose-400';
  if (['degraded', 'pending', 'partial', 'expiring'].includes(status))
    return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

function statusBadgeClass(status: string): string {
  if (['online', 'active', 'success', 'consensus_reached', 'healthy'].includes(status))
    return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900';
  if (['offline', 'failed', 'error', 'abandoned', 'rejected'].includes(status))
    return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900';
  if (['degraded', 'pending', 'partial', 'expiring'].includes(status))
    return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900';
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700';
}

function confidenceClass(c: number): string {
  if (c >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (c >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function confidenceBarClass(c: number): string {
  if (c >= 80) return 'bg-emerald-500';
  if (c >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    business_insight: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    risk_summary: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    growth_opportunity: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
    cost_saving: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
    compliance_warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    revenue_forecast: 'bg-lime-100 text-lime-700 dark:bg-lime-950/60 dark:text-lime-300',
    cash_forecast: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
    executive_summary: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
  };
  return map[cat] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ─── Fetch helper ───────────────────────────────────────────────────────────
//
// Wraps fetch with a 30s AbortController timeout (via fetchWithTimeout) and a
// strict res.ok check. Throws on non-2xx responses with the JSON body's
// `error` field if present (falls back to a generic HTTP message).

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
    timeoutMs: init?.signal ? 0 : 30_000, // disable internal timeout if caller passes a signal
  });
  const data = await res.json().catch(() => ({ error: 'Invalid JSON' }));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function OracleIntelligenceCorePage() {
  const [dashboard, setDashboard] = useState<OracleDashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Modal state
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false);

  // Poll dashboard every 30 seconds. The `dashLoading` check uses a ref so
  // `loadDashboard`'s identity stays stable — otherwise the effect re-runs
  // on every loading-state flip, causing duplicate fetches + interval churn.
  const dashLoadingRef = useRef(dashLoading);
  useEffect(() => { dashLoadingRef.current = dashLoading; }, [dashLoading]);
  // Single-flight: skip overlapping polls.
  const dashInFlightRef = useRef(false);
  const dashMountedRef = useRef(true);
  useEffect(() => {
    dashMountedRef.current = true;
    return () => { dashMountedRef.current = false; };
  }, []);

  const loadDashboard = useCallback(async () => {
    if (dashInFlightRef.current) return;
    dashInFlightRef.current = true;
    try {
      const d = await fetchJson<OracleDashboard>('/api/oracle/dashboard');
      if (!dashMountedRef.current) return;
      setDashboard(d);
    } catch (e) {
      if (!dashMountedRef.current) return;
      // Silent fail on poll — initial load will surface errors via toast.
      if (dashLoadingRef.current) {
        toast.error('Failed to load Oracle dashboard', {
          description: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    } finally {
      if (dashMountedRef.current) {
        setDashLoading(false);
      }
      dashInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const id = setInterval(() => { void loadDashboard(); }, 30_000);
    return () => clearInterval(id);
  }, [loadDashboard]);

  const handleSynthesize = useCallback(async () => {
    const tid = toast.loading('Synthesizing fresh insights from all 17 AI modules…');
    try {
      const res = await fetchJson<InsightsSynthesizeResponse>(
        '/api/oracle/insights', { method: 'POST' },
      );
      toast.success(`Synthesized ${res.total} insights`, {
        id: tid,
        description: `Generated at ${new Date(res.synthesizedAt).toLocaleTimeString()}`,
      });
      setActiveTab('insights');
    } catch (e) {
      toast.error('Synthesis failed', {
        id: tid,
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }, []);

  const brain = dashboard?.brainHealth;
  const modulesOnline = brain?.modulesOnline ?? 0;
  const modulesTotal = brain?.modulesTotal ?? 17;
  const overallHealth = brain?.overall ?? 0;
  const avgRespMs = brain?.avgResponseMs ?? 0;

  return (
    <div className="min-h-screen flex flex-col gap-6 p-4 md:p-6 bg-background">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden border-border">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              {/* Title block */}
              <div className="flex items-start gap-4 flex-1">
                <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/20">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    Oracle Intelligence Core™
                  </h1>
                  <p className="text-sm md:text-base text-muted-foreground">
                    One Brain. Every Decision. Entire Enterprise.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="outline" className="gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${overallHealth >= 80 ? 'bg-emerald-500' : overallHealth >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      Brain Health {overallHealth}/100
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Cpu className="h-3 w-3" />
                      {modulesOnline}/{modulesTotal} modules online
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Gauge className="h-3 w-3" />
                      {avgRespMs}ms avg response
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-2">
                <Button onClick={() => setAskModalOpen(true)} size="sm" className="gap-1.5">
                  <Sparkles className="h-4 w-4" /> Ask Oracle
                </Button>
                <Button onClick={() => setPlanModalOpen(true)} size="sm" variant="outline" className="gap-1.5">
                  <Target className="h-4 w-4" /> Plan
                </Button>
                <Button onClick={() => setAnalyzeModalOpen(true)} size="sm" variant="outline" className="gap-1.5">
                  <Microscope className="h-4 w-4" /> Analyze
                </Button>
                <Button onClick={handleSynthesize} size="sm" variant="outline" className="gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Synthesize
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── KPI Row ─── */}
      <KPIRow dashboard={dashboard} loading={dashLoading} />

      {/* ─── Main Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="overflow-x-auto custom-scrollbar -mx-1 px-1">
          <TabsList className="h-auto flex w-max gap-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5 px-3 py-2">
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <BrainOverviewTab dashboard={dashboard} loading={dashLoading} />
        </TabsContent>
        <TabsContent value="ask" className="mt-4">
          <AskOracleTab />
        </TabsContent>
        <TabsContent value="memory" className="mt-4">
          <UnifiedMemoryTab />
        </TabsContent>
        <TabsContent value="conversation" className="mt-4">
          <ExecutiveConversationTab />
        </TabsContent>
        <TabsContent value="reasoning" className="mt-4">
          <ReasoningHistoryTab />
        </TabsContent>
        <TabsContent value="insights" className="mt-4">
          <KnowledgeSynthesisTab />
        </TabsContent>
        <TabsContent value="router" className="mt-4">
          <MultiModelRouterTab />
        </TabsContent>
        <TabsContent value="learning" className="mt-4">
          <SelfImprovementTab />
        </TabsContent>
        <TabsContent value="context" className="mt-4">
          <ContextEngineTab />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecurityAuditTab />
        </TabsContent>
      </Tabs>

      {/* ─── Quick Action Modals ─── */}
      <AskOracleModal open={askModalOpen} onOpenChange={setAskModalOpen} />
      <PlanModal open={planModalOpen} onOpenChange={setPlanModalOpen} />
      <AnalyzeModal open={analyzeModalOpen} onOpenChange={setAnalyzeModalOpen} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// KPI ROW — 8 metric cards
// ═════════════════════════════════════════════════════════════════════════════

interface KPIRowProps {
  dashboard: OracleDashboard | null;
  loading: boolean;
}

function KPIRow({ dashboard, loading }: KPIRowProps) {
  const items: Array<{
    title: string;
    icon: LucideIcon;
    primary: string;
    secondary: string;
    accent: string;
    progress?: number;
  }> = dashboard
    ? [
        {
          title: 'Brain Health',
          icon: Brain,
          primary: `${dashboard.brainHealth.overall}/100`,
          secondary: `${dashboard.brainHealth.modulesOnline}/${dashboard.brainHealth.modulesTotal} modules online`,
          accent: 'text-emerald-600 dark:text-emerald-400',
          progress: dashboard.brainHealth.overall,
        },
        {
          title: 'Unified Memory',
          icon: Database,
          primary: fmtNum(dashboard.memory.totalRecords),
          secondary: `+${dashboard.memory.last24h} records in 24h`,
          accent: 'text-teal-600 dark:text-teal-400',
        },
        {
          title: 'AI Calls (24h)',
          icon: Cpu,
          primary: fmtNum(dashboard.router.totalCalls),
          secondary: `${dashboard.router.successRate}% success · ${dashboard.router.avgLatencyMs}ms avg`,
          accent: 'text-cyan-600 dark:text-cyan-400',
        },
        {
          title: 'Reasoning (24h)',
          icon: BrainCircuit,
          primary: fmtNum(dashboard.reasoning.total),
          secondary: `${dashboard.reasoning.approved} approved · ${dashboard.reasoning.pending} pending · ${dashboard.reasoning.rejected} rejected`,
          accent: 'text-violet-600 dark:text-violet-400',
        },
        {
          title: 'Conversations (24h)',
          icon: MessageSquare,
          primary: fmtNum(dashboard.conversations.total),
          secondary: `${dashboard.conversations.active} active · ${dashboard.conversations.consensusReached} consensus`,
          accent: 'text-lime-600 dark:text-lime-400',
        },
        {
          title: 'Insights Today',
          icon: Lightbulb,
          primary: fmtNum(dashboard.insights.total),
          secondary: `${dashboard.insights.acknowledged} acknowledged · ${dashboard.insights.actedOn} acted on`,
          accent: 'text-amber-600 dark:text-amber-400',
        },
        {
          title: 'Learning',
          icon: GraduationCap,
          primary: fmtNum(dashboard.learning.totalLessons),
          secondary: `${dashboard.learning.appliedRecently} applied recently`,
          accent: 'text-orange-600 dark:text-orange-400',
        },
        {
          title: 'Security (24h)',
          icon: ShieldCheck,
          primary: fmtNum(dashboard.security.totalCalls),
          secondary: `${dashboard.security.rateLimited} rate-limited · ${dashboard.security.errors} errors`,
          accent: 'text-rose-600 dark:text-rose-400',
        },
      ]
    : [];

  if (loading && !dashboard) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 h-28" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.03 }}
        >
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.title}
                </span>
                <item.icon className={`h-4 w-4 ${item.accent}`} />
              </div>
              <div className={`text-2xl font-bold ${item.accent}`}>{item.primary}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.secondary}</div>
              {item.progress !== undefined && (
                <Progress
                  value={item.progress}
                  className="h-1.5 mt-2"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1 — BRAIN OVERVIEW
// ═════════════════════════════════════════════════════════════════════════════

interface BrainOverviewTabProps {
  dashboard: OracleDashboard | null;
  loading: boolean;
}

function BrainOverviewTab({ dashboard, loading }: BrainOverviewTabProps) {
  const modules: AIModuleInfo[] = dashboard?.brainHealth.modules ?? [];
  const activity = dashboard?.recentActivity ?? [];

  if (loading && !dashboard) {
    return <LoadingBlock label="Loading brain overview…" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">AI Module Registry</h2>
        <p className="text-sm text-muted-foreground">
          {modules.filter((m) => m.status === 'online').length} of {modules.length} modules online
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((m) => {
          const Icon = EXECUTIVE_ICONS[m.id] || Bot;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={`hover:shadow-md transition-shadow border-l-4 ${
                m.status === 'online'
                  ? 'border-l-emerald-500'
                  : m.status === 'degraded'
                    ? 'border-l-amber-500'
                    : 'border-l-rose-500'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-muted p-1.5">
                        <Icon className="h-4 w-4 text-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">{m.label}</div>
                        <div className="text-xs text-muted-foreground font-mono">{m.id}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusBadgeClass(m.status)}>
                      {m.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate" title={m.entryPoint}>
                    {m.entryPoint}
                  </div>
                  {m.lastCheckedAt && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Checked {timeAgo(m.lastCheckedAt)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {modules.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-6 text-center text-muted-foreground">
              No module data available
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Recent Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {activity.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No recent activity</div>
            ) : (
              activity.slice(0, 10).map((a, i) => {
                const Icon = EXECUTIVE_ICONS[a.module] || Activity;
                return (
                  <div
                    key={`${a.module}-${i}`}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="rounded-md bg-muted p-1.5 shrink-0">
                      <Icon className="h-3.5 w-3.5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{a.type}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {EXECUTIVE_LABELS[a.module] || a.module}
                        </Badge>
                      </div>
                      <div className="text-sm text-foreground mt-1">{a.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {timeAgo(a.at)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// REASONING DISPLAY — Shared component for Ask/Plan/Analyze results
// ═════════════════════════════════════════════════════════════════════════════

interface ReasoningDisplayProps {
  reasoning: ReasoningResult;
  explanation: Explanation | null;
  durationMs?: number;
}

const REASONING_DIMENSIONS: Array<{
  key: keyof Pick<ReasoningResult,
    'businessReasoning' | 'financialReasoning' | 'riskReasoning' |
    'complianceReasoning' | 'operationalReasoning' | 'legalReasoning'>;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'businessReasoning', label: 'Business', icon: Briefcase },
  { key: 'financialReasoning', label: 'Financial', icon: DollarSign },
  { key: 'riskReasoning', label: 'Risk', icon: ShieldAlert },
  { key: 'complianceReasoning', label: 'Compliance', icon: ShieldCheck },
  { key: 'operationalReasoning', label: 'Operational', icon: Wrench },
  { key: 'legalReasoning', label: 'Legal', icon: Scale },
];

function ReasoningDisplay({ reasoning, explanation, durationMs }: ReasoningDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Confidence + meta */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`text-3xl font-bold ${confidenceClass(reasoning.confidence)}`}>
                {reasoning.confidence}%
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Confidence</div>
                <div className="text-xs text-muted-foreground">
                  Model: <span className="font-mono">{reasoning.modelUsed}</span> · Tier: {reasoning.modelTier}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="capitalize">{reasoning.requestType}</Badge>
              {reasoning.approved && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                </Badge>
              )}
              {reasoning.rejected && (
                <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900">
                  <XCircle className="h-3 w-3 mr-1" /> Rejected
                </Badge>
              )}
              {!reasoning.approved && !reasoning.rejected && (
                <Badge variant="outline" className="text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900">
                  <Clock className="h-3 w-3 mr-1" /> Pending
                </Badge>
              )}
              {durationMs !== undefined && (
                <Badge variant="outline">{durationMs}ms</Badge>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${confidenceBarClass(reasoning.confidence)}`}
                style={{ width: `${Math.min(100, Math.max(0, reasoning.confidence))}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Answer */}
      {reasoning.finalAnswer && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Final Answer
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {reasoning.finalAnswer}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 6 Reasoning Dimensions */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Reasoning Dimensions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REASONING_DIMENSIONS.map((dim) => {
            const text = reasoning[dim.key];
            return (
              <Card key={dim.key}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <dim.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{dim.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {text || 'No analysis available.'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Historical Evidence */}
      {reasoning.historicalEvidence && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Historical Evidence
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{reasoning.historicalEvidence}</p>
          </CardContent>
        </Card>
      )}

      {/* Alternatives */}
      {reasoning.alternatives && reasoning.alternatives.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <GitBranch className="h-4 w-4 text-primary" /> Alternatives Considered
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {reasoning.alternatives.map((alt, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="font-semibold text-sm mb-2">{alt.label}</div>
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Pros</div>
                  <ul className="text-xs text-muted-foreground space-y-0.5 mb-2 list-disc list-inside">
                    {alt.pros.map((p, j) => <li key={j}>{p}</li>)}
                  </ul>
                  <div className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-1">Cons</div>
                  <ul className="text-xs text-muted-foreground space-y-0.5 mb-2 list-disc list-inside">
                    {alt.cons.map((c, j) => <li key={j}>{c}</li>)}
                  </ul>
                  <div className="text-xs">
                    <span className="text-muted-foreground">ROI: </span>
                    <span className="font-medium text-foreground">{alt.estimatedRoi}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Expected ROI + Rollback */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reasoning.expectedRoi && (
          <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-1 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Expected ROI
              </div>
              <p className="text-sm text-foreground">{reasoning.expectedRoi}</p>
            </CardContent>
          </Card>
        )}
        {reasoning.rollbackStrategy && (
          <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Rollback Strategy
              </div>
              <p className="text-sm text-foreground">{reasoning.rollbackStrategy}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Executives Consulted */}
      {reasoning.executivesConsulted && reasoning.executivesConsulted.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Executives Consulted</div>
            <div className="flex flex-wrap gap-2">
              {reasoning.executivesConsulted.map((ex) => {
                const Icon = EXECUTIVE_ICONS[ex] || Bot;
                return (
                  <Badge key={ex} variant="outline" className="gap-1">
                    <Icon className="h-3 w-3" />
                    {EXECUTIVE_LABELS[ex] || ex}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Explanation */}
      {explanation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Microscope className="h-4 w-4 text-primary" /> Explainable AI — Why This Answer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ExplanationRow label="Why" value={explanation.why} icon={HelpCircle} />
            <ExplanationRow label="How" value={explanation.how} icon={Wrench} />
            <ExplanationRow
              label="Based On"
              value={explanation.basedOn.join(' · ')}
              icon={Database}
            />
            <ExplanationRow label="What If Ignored" value={explanation.whatIfIgnored} icon={AlertTriangle} />
            <ExplanationRow label="What Happens Next" value={explanation.whatHappensNext} icon={ArrowRight} />
            <ExplanationRow label="Expected Benefit" value={explanation.expectedBenefit} icon={TrendingUp} />
            <ExplanationRow label="Risk" value={explanation.risk} icon={ShieldAlert} />
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> Confidence
              </span>
              <Badge variant="outline" className={confidenceClass(explanation.confidence)}>
                {explanation.confidence}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ExplanationRow({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-md bg-muted p-1.5 shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-foreground" />
      </div>
      <div className="flex-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase">{label}</div>
        <div className="text-sm text-foreground">{value || '—'}</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2 — ASK ORACLE
// ═════════════════════════════════════════════════════════════════════════════

function AskOracleTab() {
  const [question, setQuestion] = useState('');
  const [callLLM, setCallLLM] = useState(true);
  const [tier, setTier] = useState<'auto' | 'fast' | 'standard' | 'deep'>('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<AskResponse>('/api/oracle/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: question.trim(),
          callLLM,
          preferredTier: tier === 'auto' ? undefined : tier,
        }),
      });
      setResult(res);
      toast.success('Oracle has answered', {
        description: `Generated in ${res.durationMs}ms with ${res.reasoning.confidence}% confidence`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      toast.error('Oracle could not answer', { description: msg });
    } finally {
      setLoading(false);
    }
  }, [question, callLLM, tier]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="ask-question" className="text-sm font-medium">
              Ask the Oracle Brain anything
            </Label>
            <Textarea
              id="ask-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Should we extend credit to a new customer with ₹50L monthly orders but a thin credit history?"
              className="mt-1.5 min-h-[100px]"
              disabled={loading}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as typeof tier)}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="deep">Deep</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={callLLM}
                onChange={(e) => setCallLLM(e.target.checked)}
                className="rounded"
              />
              Use LLM (uncheck for deterministic-only)
            </label>
            <Button onClick={handleSubmit} disabled={loading} className="ml-auto gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? 'Oracle thinking…' : 'Ask Oracle'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
          <CardContent className="p-4 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </CardContent>
        </Card>
      )}

      {loading && !result && <LoadingBlock label="Oracle is gathering context, consulting executives, and reasoning…" />}

      {result && (
        <ReasoningDisplay
          reasoning={result.reasoning}
          explanation={result.explanation}
          durationMs={result.durationMs}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 3 — UNIFIED MEMORY
// ═════════════════════════════════════════════════════════════════════════════

function UnifiedMemoryTab() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [data, setData] = useState<MemorySearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category !== 'all') params.set('category', category);
      if (source !== 'all') params.set('source', source);
      params.set('limit', '50');
      const res = await fetchJson<MemorySearchResponse>(`/api/oracle/memory?${params.toString()}`);
      setData(res);
    } catch (e) {
      toast.error('Memory search failed', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [query, category, source]);

  // Lazy load on mount
  useEffect(() => {
    doSearch();
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                placeholder="Search unified memory…"
                className="pl-8"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto custom-scrollbar">
                <SelectItem value="all">All Categories</SelectItem>
                {MEMORY_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto custom-scrollbar">
                <SelectItem value="all">All Sources</SelectItem>
                {MEMORY_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {data ? `${data.total.toLocaleString()} records · ${data.sources.length} sources` : 'Loading…'}
            </div>
            <Button onClick={doSearch} disabled={loading} size="sm" className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && data.suggestions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Suggestions</div>
            <div className="flex flex-wrap gap-1.5">
              {data.suggestions.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  onClick={() => { setQuery(s); }}
                  className="px-2 py-1 text-xs rounded-md bg-muted hover:bg-muted/70 text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && <LoadingBlock label="Searching memory…" />}

      {data && !loading && (
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {data.records.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {searched ? 'No records match your search' : 'Memory is empty'}
              </CardContent>
            </Card>
          ) : (
            data.records.map((r) => (
              <Card key={r.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="secondary" className="text-xs">{r.category}</Badge>
                        <Badge variant="outline" className="text-xs">{r.source}</Badge>
                      </div>
                      <div className="font-semibold text-sm text-foreground">{r.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{r.summary}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {timeAgo(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Importance</span>
                    <Progress value={r.importance} className="h-1.5 flex-1 max-w-[200px]" />
                    <span className="text-xs font-medium">{r.importance}</span>
                  </div>
                  {r.tags && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.tags.slice(0, 5).map((t, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-mono">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 4 — EXECUTIVE CONVERSATION
// ═════════════════════════════════════════════════════════════════════════════

function ExecutiveConversationTab() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // Lazy load recent conversations
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchJson<{ records: Conversation[]; total: number }>(
          '/api/oracle/conversations?limit=20',
        );
        setRecent(res.records);
      } catch {
        // silent
      } finally {
        setRecentLoading(false);
      }
    })();
  }, []);

  const handleRun = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchJson<Conversation>('/api/oracle/conversations', {
        method: 'POST',
        body: JSON.stringify({ topic: topic.trim(), runNow: true, maxTurns: 10 }),
      });
      setConversation(res);
      toast.success('Executive conversation completed', {
        description: `${res.turns.length} turns · ${res.status}`,
      });
    } catch (e) {
      toast.error('Conversation failed', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [topic]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="conv-topic" className="text-sm font-medium">Conversation Topic</Label>
            <Input
              id="conv-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Should we expand to the UAE market in Q3?"
              className="mt-1.5"
              disabled={loading}
            />
          </div>
          <Button onClick={handleRun} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {loading ? 'Executives deliberating…' : 'Run Executive Conversation'}
          </Button>
        </CardContent>
      </Card>

      {loading && <LoadingBlock label="9 AI executives are sharing perspectives and reaching consensus…" />}

      {conversation && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {conversation.topic}
              <Badge variant="outline" className={statusBadgeClass(conversation.status)}>
                {conversation.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar space-y-3 pr-1">
              {conversation.turns.map((turn, i) => (
                <ConversationTurnCard key={i} turn={turn} />
              ))}
            </div>
            {conversation.consensus && (
              <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
                <CardContent className="p-4">
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Consensus Reached
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{conversation.consensus}</p>
                  <div className="text-xs text-muted-foreground mt-2">
                    {conversation.participants.length} executives · Completed {timeAgo(conversation.completedAt || conversation.createdAt)}
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent conversations */}
      {!conversation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <LoadingBlock label="Loading recent conversations…" />
            ) : recent.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No conversations yet</div>
            ) : (
              <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {recent.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setConversation(c)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-medium text-sm text-foreground truncate">{c.topic}</div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${statusBadgeClass(c.status)}`}>
                        {c.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.turns.length} turns · {timeAgo(c.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConversationTurnCard({ turn }: { turn: ConversationTurn }) {
  const Icon = EXECUTIVE_ICONS[turn.executive] || Bot;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3"
    >
      <div className="rounded-full bg-primary/10 p-2 shrink-0 ring-1 ring-primary/20">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-sm">{turn.executiveLabel}</span>
          <Badge variant="outline" className={`text-xs ${confidenceClass(turn.confidence)}`}>
            {turn.confidence}% confidence
          </Badge>
          <span className="text-xs text-muted-foreground">{timeAgo(turn.at)}</span>
        </div>
        <div className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
          {turn.message || '(no message)'}
        </div>
        {turn.reasoning && (
          <div className="text-xs text-muted-foreground mt-1 italic">
            Reasoning: {turn.reasoning}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 5 — REASONING HISTORY
// ═════════════════════════════════════════════════════════════════════════════

function ReasoningHistoryTab() {
  const [records, setRecords] = useState<ReasoningResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchJson<{ records: ReasoningResult[]; total: number }>(
          '/api/oracle/reasoning?limit=50',
        );
        setRecords(res.records);
      } catch (e) {
        toast.error('Failed to load reasoning history', {
          description: e instanceof Error ? e.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingBlock label="Loading reasoning history…" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reasoning History</h2>
        <Badge variant="outline">{records.length} records</Badge>
      </div>
      <div className="max-h-[700px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
        {records.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No reasoning records yet. Try asking Oracle a question.
            </CardContent>
          </Card>
        ) : (
          records.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="secondary" className="text-xs capitalize">{r.requestType}</Badge>
                      {r.approved && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                        </Badge>
                      )}
                      {r.rejected && (
                        <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900 text-xs">
                          <XCircle className="h-3 w-3 mr-1" /> Rejected
                        </Badge>
                      )}
                      {!r.approved && !r.rejected && (
                        <Badge variant="outline" className="text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900 text-xs">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${confidenceClass(r.confidence)}`}>
                        {r.confidence}% confidence
                      </Badge>
                    </div>
                    <div className="text-sm font-medium text-foreground">{truncate(r.request, 120)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Model: <span className="font-mono">{r.modelUsed}</span> ({r.modelTier}) · {timeAgo(r.createdAt)}
                    </div>
                    {r.executivesConsulted && r.executivesConsulted.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.executivesConsulted.map((ex) => (
                          <Badge key={ex} variant="outline" className="text-xs">
                            {EXECUTIVE_LABELS[ex] || ex}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {expanded === r.id
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              </button>
              <AnimatePresence>
                {expanded === r.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 border-t border-border">
                      <ReasoningDisplay reasoning={r} explanation={null} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 6 — KNOWLEDGE SYNTHESIS
// ═════════════════════════════════════════════════════════════════════════════

function KnowledgeSynthesisTab() {
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<{ records: InsightRecord[]; total: number }>(
        '/api/oracle/insights?limit=50',
      );
      setInsights(res.records);
    } catch (e) {
      toast.error('Failed to load insights', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const handleSynthesize = useCallback(async () => {
    setSynthesizing(true);
    const tid = toast.loading('Synthesizing fresh insights from all 17 AI modules…');
    try {
      const res = await fetchJson<InsightsSynthesizeResponse>('/api/oracle/insights', {
        method: 'POST',
      });
      setInsights(res.insights);
      toast.success(`Synthesized ${res.total} insights`, { id: tid });
    } catch (e) {
      toast.error('Synthesis failed', {
        id: tid,
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setSynthesizing(false);
    }
  }, []);

  // busyId tracks which insight is being mutated so we can disable its button
  // (single-flight) and show a spinner.
  const [insightBusyId, setInsightBusyId] = useState<string | null>(null);

  const handleAcknowledge = useCallback(async (id: string) => {
    if (insightBusyId === id) return;
    setInsightBusyId(id);
    try {
      const res = await fetchJson<{ ok?: boolean }>(`/api/oracle/insights/${id}/acknowledge`, { method: 'POST' });
      void res;
      setInsights((prev) => prev.map((i) => i.id === id ? { ...i, acknowledged: true } : i));
      toast.success('Insight acknowledged');
    } catch (e) {
      toast.error('Failed to acknowledge insight', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setInsightBusyId(null);
    }
  }, [insightBusyId]);

  const handleActOn = useCallback(async (id: string) => {
    if (insightBusyId === id) return;
    setInsightBusyId(id);
    try {
      const res = await fetchJson<{ ok?: boolean }>(`/api/oracle/insights/${id}/act-on`, { method: 'POST' });
      void res;
      setInsights((prev) => prev.map((i) => i.id === id ? { ...i, acknowledged: true, actedOn: true } : i));
      toast.success('Insight marked as acted on');
    } catch (e) {
      toast.error('Failed to mark insight as acted on', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setInsightBusyId(null);
    }
  }, [insightBusyId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Knowledge Synthesis</h2>
          <p className="text-sm text-muted-foreground">{insights.length} insights across {INSIGHT_CATEGORIES.length} categories</p>
        </div>
        <Button onClick={handleSynthesize} disabled={synthesizing} className="gap-1.5">
          {synthesizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {synthesizing ? 'Synthesizing…' : 'Synthesize Now'}
        </Button>
      </div>

      {loading && <LoadingBlock label="Loading insights…" />}

      {!loading && insights.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No insights yet. Click "Synthesize Now" to generate fresh insights from all 17 AI modules.
          </CardContent>
        </Card>
      )}

      {!loading && insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((ins) => (
            <Card key={ins.id} className={`overflow-hidden ${ins.actedOn ? 'opacity-70' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge className={`text-xs ${categoryColor(ins.category)}`}>
                    {ins.category.replace(/_/g, ' ')}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {ins.actedOn && (
                      <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Acted on
                      </Badge>
                    )}
                    {ins.acknowledged && !ins.actedOn && (
                      <Badge variant="outline" className="text-xs">
                        Acknowledged
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">{ins.title}</div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{ins.body}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className={`font-medium ${confidenceClass(ins.confidence)}`}>{ins.confidence}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Impact</span>
                    <span className="font-medium">{ins.impactScore}/100</span>
                  </div>
                </div>
                {ins.actionItems && ins.actionItems.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Action Items</div>
                    <ul className="text-xs text-foreground space-y-0.5 list-disc list-inside">
                      {ins.actionItems.slice(0, 4).map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {ins.dataSources && ins.dataSources.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ins.dataSources.map((src) => (
                      <Badge key={src} variant="outline" className="text-xs">
                        {EXECUTIVE_LABELS[src] || src}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAcknowledge(ins.id)}
                    disabled={ins.acknowledged || insightBusyId === ins.id}
                    className="gap-1.5 text-xs h-7"
                  >
                    {insightBusyId === ins.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                    Acknowledge
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleActOn(ins.id)}
                    disabled={ins.actedOn || insightBusyId === ins.id}
                    className="gap-1.5 text-xs h-7"
                  >
                    {insightBusyId === ins.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                    Act On
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 7 — MULTI-MODEL ROUTER
// ═════════════════════════════════════════════════════════════════════════════

function MultiModelRouterTab() {
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [routePurpose, setRoutePurpose] = useState('reasoning');
  const [routeTier, setRouteTier] = useState('auto');
  const [routeTokens, setRouteTokens] = useState('1000');
  const [routeResult, setRouteResult] = useState<{
    choice: ModelChoice;
    estimatedCostUsd: number;
  } | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchJson<ModelsResponse>('/api/oracle/models');
        setData(res);
      } catch (e) {
        toast.error('Failed to load model catalog', {
          description: e instanceof Error ? e.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRoute = useCallback(async () => {
    if (routeBusy) return; // single-flight
    setRouteBusy(true);
    try {
      const res = await fetchJson<{
        choice: ModelChoice;
        estimatedCostUsd: number;
      }>('/api/oracle/route', {
        method: 'POST',
        body: JSON.stringify({
          purpose: routePurpose,
          tier: routeTier === 'auto' ? undefined : routeTier,
          inputTokensEstimate: parseInt(routeTokens, 10) || 1000,
        }),
      });
      setRouteResult(res);
      toast.success(`Router selected: ${res.choice.provider}/${res.choice.model}`);
    } catch (e) {
      toast.error('Routing failed', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setRouteBusy(false);
    }
  }, [routePurpose, routeTier, routeTokens, routeBusy]);

  if (loading) return <LoadingBlock label="Loading model catalog…" />;

  const maxProviderCalls = data?.stats
    ? Math.max(1, ...Object.values(data.stats.byProvider))
    : 1;

  return (
    <div className="space-y-4">
      {/* Router test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" /> Test Router
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Purpose</Label>
              <Select value={routePurpose} onValueChange={setRoutePurpose}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reasoning">Reasoning</SelectItem>
                  <SelectItem value="code">Code</SelectItem>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="vision">Vision</SelectItem>
                  <SelectItem value="voice">Voice</SelectItem>
                  <SelectItem value="embedding">Embedding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tier</Label>
              <Select value={routeTier} onValueChange={setRouteTier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="deep">Deep</SelectItem>
                  <SelectItem value="vision">Vision</SelectItem>
                  <SelectItem value="voice">Voice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tokens (est.)</Label>
              <Input
                value={routeTokens}
                onChange={(e) => setRouteTokens(e.target.value)}
                type="number"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleRoute} disabled={routeBusy} className="w-full gap-1.5">
                {routeBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {routeBusy ? 'Routing…' : 'Route'}
              </Button>
            </div>
          </div>
          {routeResult && (
            <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
              <CardContent className="p-3">
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                  Recommended Model
                </div>
                <div className="text-sm font-medium">
                  {routeResult.choice.provider} / {routeResult.choice.model}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {routeResult.choice.rationale}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Cost: {fmtUsd(routeResult.estimatedCostUsd)} · Latency: {routeResult.choice.estimatedLatencyMs}ms · Tier: {routeResult.choice.tier}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Catalog table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Model Catalog — {data?.totalModels ?? 0} models · {data?.providers.length ?? 0} providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Purposes</TableHead>
                  <TableHead className="text-right">In $/1k</TableHead>
                  <TableHead className="text-right">Out $/1k</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Context</TableHead>
                  <TableHead className="text-center">Vision</TableHead>
                  <TableHead className="text-center">Voice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.catalog.map((m, i) => (
                  <TableRow key={`${m.provider}-${m.model}-${i}`}>
                    <TableCell className="font-medium">{m.provider}</TableCell>
                    <TableCell className="font-mono text-xs">{m.model}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{m.tier}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.purposes.map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">${m.inputCostPer1k}</TableCell>
                    <TableCell className="text-right font-mono text-xs">${m.outputCostPer1k}</TableCell>
                    <TableCell className="text-right text-xs">{m.latencyMs}ms</TableCell>
                    <TableCell className="text-right text-xs">{fmtNum(m.contextWindow)}</TableCell>
                    <TableCell className="text-center">
                      {m.supportsVision
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.supportsVoice
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Router stats */}
      {data?.stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase mb-1">Total Calls (24h)</div>
              <div className="text-2xl font-bold">{fmtNum(data.stats.totalCalls)}</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                {data.stats.successRate}% success
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase mb-1">Avg Latency</div>
              <div className="text-2xl font-bold">{data.stats.avgLatencyMs}ms</div>
              <div className="text-xs text-muted-foreground mt-1">
                {data.stats.fallbacksTriggered} fallbacks
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase mb-1">Total Cost (24h)</div>
              <div className="text-2xl font-bold">{fmtUsd(data.stats.totalCostUsd)}</div>
              <div className="text-xs text-muted-foreground mt-1">across all providers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase mb-1">Calls by Provider</div>
              <div className="space-y-1 mt-1">
                {Object.entries(data.stats.byProvider)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([p, c]) => (
                    <div key={p} className="flex items-center gap-2 text-xs">
                      <span className="w-16 truncate">{p}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(c / maxProviderCalls) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono">{c}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent calls */}
      {data && data.recentCalls && data.recentCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Model Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentCalls.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{c.provider}</TableCell>
                      <TableCell className="font-mono text-xs">{c.model}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{c.purpose}</Badge></TableCell>
                      <TableCell className="text-right text-xs">{fmtNum(c.promptTokens + c.outputTokens)}</TableCell>
                      <TableCell className="text-right text-xs">{c.latencyMs}ms</TableCell>
                      <TableCell className="text-right text-xs font-mono">{fmtUsd(c.costUsd)}</TableCell>
                      <TableCell className="text-center">
                        {c.success
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          : <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 mx-auto" />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 8 — SELF-IMPROVEMENT
// ═════════════════════════════════════════════════════════════════════════════

function SelfImprovementTab() {
  const [lessons, setLessons] = useState<LearningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    category: 'accepted_rec' as LearningCategory,
    signal: '',
    lessonLearned: '',
    evidence: '{}',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    try {
      const dash = await fetchJson<OracleDashboard>('/api/oracle/dashboard');
      setLessons(dash.learning.topLessons);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const handleSubmit = useCallback(async () => {
    if (!form.signal.trim() || !form.lessonLearned.trim()) {
      toast.error('Signal and lesson learned are required');
      return;
    }
    let evidence: Record<string, unknown> = {};
    try {
      evidence = form.evidence.trim() ? JSON.parse(form.evidence) : {};
    } catch {
      toast.error('Evidence must be valid JSON');
      return;
    }
    setSubmitting(true);
    try {
      await fetchJson<{ learning: LearningRecord }>('/api/oracle/learn', {
        method: 'POST',
        body: JSON.stringify({
          category: form.category,
          signal: form.signal.trim(),
          lessonLearned: form.lessonLearned.trim(),
          evidence,
        }),
      });
      toast.success('Learning recorded', {
        description: 'The Oracle brain has absorbed a new lesson.',
      });
      setForm({ ...form, signal: '', lessonLearned: '', evidence: '{}' });
      loadLessons();
    } catch (e) {
      toast.error('Failed to record learning', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [form, loadLessons]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Self-Improvement Engine</h2>
        <p className="text-sm text-muted-foreground">Top lessons learned by the Oracle brain</p>
      </div>

      {loading ? (
        <LoadingBlock label="Loading lessons…" />
      ) : lessons.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No lessons recorded yet. Use the form below to teach the Oracle brain.
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[500px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {lessons.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{l.category.replace(/_/g, ' ')}</Badge>
                      <Badge variant="outline" className="text-xs">
                        Weight: {l.weight.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="font-medium text-sm text-foreground">{l.signal}</div>
                    <p className="text-sm text-muted-foreground mt-1">{l.lessonLearned}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mt-2 pt-2 border-t border-border">
                  <div>
                    <span className="text-muted-foreground">Applied: </span>
                    <span className="font-medium">{l.appliedCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Success: </span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{l.successCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last: </span>
                    <span className="font-medium">{l.lastAppliedAt ? timeAgo(l.lastAppliedAt) : 'never'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Record Learning Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" /> Record New Learning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as LearningCategory })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEARNING_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Signal</Label>
              <Input
                value={form.signal}
                onChange={(e) => setForm({ ...form, signal: e.target.value })}
                placeholder="e.g. Customer accepted 14-day payment terms"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Lesson Learned</Label>
            <Textarea
              value={form.lessonLearned}
              onChange={(e) => setForm({ ...form, lessonLearned: e.target.value })}
              placeholder="e.g. Offering 14-day terms to repeat customers increases retention by 22%."
              className="min-h-[80px]"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Evidence (JSON)</Label>
            <Textarea
              value={form.evidence}
              onChange={(e) => setForm({ ...form, evidence: e.target.value })}
              placeholder='{"sampleSize": 47, "upliftPct": 22}'
              className="min-h-[60px] font-mono text-xs"
            />
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Record Learning
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 9 — CONTEXT ENGINE
// ═════════════════════════════════════════════════════════════════════════════

function ContextEngineTab() {
  const [data, setData] = useState<{
    context: BusinessContext;
    formatted: string;
    estimatedTokens: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<{
        context: BusinessContext;
        formatted: string;
        estimatedTokens: number;
      }>('/api/oracle/context');
      setData(res);
    } catch (e) {
      toast.error('Failed to load business context', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const tid = toast.loading('Gathering fresh context from all 17 modules…');
    try {
      const res = await fetchJson<{ ok?: boolean }>('/api/oracle/context', { method: 'POST' });
      void res;
      await load();
      toast.success('Context refreshed', { id: tid });
    } catch (e) {
      toast.error('Refresh failed', {
        id: tid,
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (loading) return <LoadingBlock label="Gathering business context from all 17 modules…" />;

  const ctx = data?.context;
  if (!ctx) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Context Engine</h2>
          <p className="text-sm text-muted-foreground">
            Gathered {timeAgo(ctx.gatheredAt)} · ~{fmtNum(data?.estimatedTokens ?? 0)} tokens
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="gap-1.5">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh Context
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Finance */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-primary" /> Finance</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <ContextRow label="Cash Balance" value={fmtINR(ctx.finance.cashBalance)} />
            <ContextRow label="Monthly Revenue" value={fmtINR(ctx.finance.monthlyRevenue)} />
            <ContextRow label="Monthly Expenses" value={fmtINR(ctx.finance.monthlyExpenses)} />
            <ContextRow label="GST Collected" value={fmtINR(ctx.finance.gstCollected)} />
            <ContextRow label="GST Paid" value={fmtINR(ctx.finance.gstPaid)} />
            <ContextRow label="Receivables" value={fmtINR(ctx.finance.receivables)} />
            <ContextRow label="Payables" value={fmtINR(ctx.finance.payables)} />
          </CardContent>
        </Card>

        {/* Digital Twin */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" /> Digital Twin</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <ContextRow label="Health Score" value={`${ctx.twin.healthScore}/100`} />
            <ContextRow label="Cash Runway" value={`${ctx.twin.cashRunwayDays} days`} />
            <ContextRow label="Anomalies" value={String(ctx.twin.anomalies)} />
            <ContextRow label="Forecast" value={
              <Badge variant="outline" className={statusBadgeClass(
                ctx.twin.forecastDirection === 'up' ? 'online' :
                ctx.twin.forecastDirection === 'down' ? 'offline' : 'degraded'
              )}>
                {ctx.twin.forecastDirection}
              </Badge>
            } />
          </CardContent>
        </Card>

        {/* Business Graph */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4 text-primary" /> Business Graph</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <ContextRow label="Nodes" value={fmtNum(ctx.graph.nodeCount)} />
            <ContextRow label="Edges" value={fmtNum(ctx.graph.edgeCount)} />
            <ContextRow label="Top Risks" value={`${ctx.graph.topRisks.length} identified`} />
            <ContextRow label="Recent Changes" value={`${ctx.graph.recentChanges.length} changes`} />
          </CardContent>
        </Card>

        {/* Connected Systems */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe2 className="h-4 w-4 text-primary" /> Connected Systems</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <ContextRow label="Total" value={String(ctx.connectedSystems.total)} />
            <ContextRow label="Healthy" value={
              <span className="text-emerald-600 dark:text-emerald-400">{ctx.connectedSystems.healthy}</span>
            } />
            <ContextRow label="Failing" value={
              <span className="text-rose-600 dark:text-rose-400">{ctx.connectedSystems.failing}</span>
            } />
            <ContextRow label="Avg Reliability" value={`${ctx.connectedSystems.avgReliability}%`} />
          </CardContent>
        </Card>

        {/* Knowledge Graph */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Knowledge Graph</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <ContextRow label="Entities" value={fmtNum(ctx.knowledge.entityCount)} />
            <ContextRow label="Recent Updates" value={String(ctx.knowledge.recentUpdates)} />
          </CardContent>
        </Card>

        {/* Goals & Strategies */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Goals & Strategies</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground uppercase mb-1">Goals ({ctx.goals.length})</div>
              <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                {ctx.goals.slice(0, 5).map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="truncate">{g.title}</span>
                    <span className="font-medium">{g.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase mb-1">Strategies ({ctx.strategies.length})</div>
              <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                {ctx.strategies.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="truncate">{s.title}</span>
                    <Badge variant="outline" className="text-xs">{s.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Invoices</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 text-sm">
              {ctx.recentInvoices.length === 0 ? (
                <div className="text-muted-foreground text-xs">None</div>
              ) : ctx.recentInvoices.map((inv, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-mono">{inv.invoiceNumber}</span>
                  <span className="font-medium">{fmtINR(inv.total)}</span>
                  <Badge variant="outline" className="text-xs">{inv.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Events</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 text-sm">
              {ctx.recentEvents.length === 0 ? (
                <div className="text-muted-foreground text-xs">None</div>
              ) : ctx.recentEvents.map((ev, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <Badge variant="secondary" className="text-xs">{ev.type}</Badge>
                  <span className="truncate flex-1 mx-2">{ev.title}</span>
                  <span className="text-muted-foreground">{timeAgo(ev.at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Pending Approvals</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 text-sm">
              {ctx.pendingApprovals.length === 0 ? (
                <div className="text-muted-foreground text-xs">None</div>
              ) : ctx.pendingApprovals.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{a.title}</span>
                  <Badge variant="outline" className="text-xs ml-2">{a.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Previous Conversations</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 text-sm">
              {ctx.previousConversations.length === 0 ? (
                <div className="text-muted-foreground text-xs">None</div>
              ) : ctx.previousConversations.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{c.topic}</span>
                  <span className="text-muted-foreground ml-2">{timeAgo(c.at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formatted context */}
      {data?.formatted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Formatted Context (for LLM prompt)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar p-3 bg-muted/40 rounded-lg">
              {data.formatted}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 10 — SECURITY & AUDIT
// ═════════════════════════════════════════════════════════════════════════════

function SecurityAuditTab() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<AuditResponse>('/api/oracle/audit?limit=50');
      setData(res);
    } catch (e) {
      toast.error('Failed to load audit log', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading security stats and audit log…" />;

  const stats = data?.stats;
  const recent = data?.recent ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Security & Audit</h2>
        <Button onClick={load} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase">Total Calls</span>
              </div>
              <div className="text-2xl font-bold">{fmtNum(stats.totalCalls)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-muted-foreground uppercase">Rate-Limited</span>
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.rateLimited}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs text-muted-foreground uppercase">RBAC Enforced</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.rbacEnforced}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase">Audit Logged</span>
              </div>
              <div className="text-2xl font-bold">{fmtNum(stats.auditLogged)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span className="text-xs text-muted-foreground uppercase">Errors</span>
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.errors}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audit log table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No audit entries yet</div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-xs">
                        <div className="flex items-center gap-1.5">
                          {a.rateLimited && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                          {a.action}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.endpoint}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{a.method}</Badge></TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${a.statusCode >= 400 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {a.statusCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">{a.durationMs}ms</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.rbacRole || a.userId || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// QUICK ACTION MODALS
// ═════════════════════════════════════════════════════════════════════════════

function AskOracleModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [question, setQuestion] = useState('');
  const [callLLM, setCallLLM] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchJson<AskResponse>('/api/oracle/ask', {
        method: 'POST',
        body: JSON.stringify({ question: question.trim(), callLLM }),
      });
      setResult(res);
      toast.success('Oracle answered');
    } catch (e) {
      toast.error('Oracle could not answer', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [question, callLLM]);

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) {
      setQuestion('');
      setResult(null);
      setLoading(false);
    }
    onOpenChange(v);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Ask Oracle
          </DialogTitle>
          <DialogDescription>
            Ask the unified brain anything. Oracle will gather context, consult executives, and deliver structured reasoning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What is our cash runway if we delay receivables by 30 days?"
            className="min-h-[80px]"
            disabled={loading}
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={callLLM}
                onChange={(e) => setCallLLM(e.target.checked)}
                className="rounded"
              />
              Use LLM
            </label>
            <Button onClick={handleSubmit} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? 'Thinking…' : 'Ask'}
            </Button>
          </div>

          {loading && !result && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Oracle is reasoning…
            </div>
          )}

          {result && (
            <div className="border-t border-border pt-3">
              <ReasoningDisplay
                reasoning={result.reasoning}
                explanation={result.explanation}
                durationMs={result.durationMs}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [objective, setObjective] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResponse['plan'] | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!objective.trim()) {
      toast.error('Please enter an objective');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchJson<PlanResponse>('/api/oracle/plan', {
        method: 'POST',
        body: JSON.stringify({ objective: objective.trim() }),
      });
      setResult(res.plan);
      toast.success(`Plan ready in ${res.plan.durationMs}ms`);
    } catch (e) {
      toast.error('Planning failed', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [objective]);

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) {
      setObjective('');
      setResult(null);
      setLoading(false);
    }
    onOpenChange(v);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Plan with Oracle
          </DialogTitle>
          <DialogDescription>
            Set an objective. Oracle's 9 executives will deliberate, reach consensus, and produce a structured plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="e.g. Launch a new product line in the West India market within 60 days"
            className="min-h-[80px]"
            disabled={loading}
          />
          <Button onClick={handleSubmit} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            {loading ? 'Planning…' : 'Generate Plan'}
          </Button>

          {loading && !result && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> 9 AI executives are deliberating…
            </div>
          )}

          {result && (
            <div className="border-t border-border pt-3 space-y-4">
              <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
                <CardContent className="p-4">
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Executive Consensus
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{result.consensus || 'No consensus reached'}</p>
                  <div className="text-xs text-muted-foreground mt-2">
                    {result.conversation.turns.length} turns · {result.conversation.participants.length} executives · {result.durationMs}ms
                  </div>
                </CardContent>
              </Card>
              <ReasoningDisplay reasoning={result.reasoning} explanation={null} />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnalyzeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse['analysis'] | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchJson<AnalyzeResponse>('/api/oracle/analyze', {
        method: 'POST',
        body: JSON.stringify({ topic: topic.trim() }),
      });
      setResult(res.analysis);
      toast.success(`Analysis ready in ${res.analysis.durationMs}ms`);
    } catch (e) {
      toast.error('Analysis failed', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [topic]);

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) {
      setTopic('');
      setResult(null);
      setLoading(false);
    }
    onOpenChange(v);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-primary" /> Deep Analysis
          </DialogTitle>
          <DialogDescription>
            Oracle gathers a fresh business context snapshot, then performs deep reasoning on your topic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Why did our Q3 margins drop 4%?"
            className="min-h-[80px]"
            disabled={loading}
          />
          <Button onClick={handleSubmit} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Microscope className="h-4 w-4" />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </Button>

          {loading && !result && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Gathering context + deep reasoning…
            </div>
          )}

          {result && (
            <div className="border-t border-border pt-3 space-y-4">
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Context Snapshot</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Tokens:</span> <span className="font-medium">{fmtNum(result.contextSnapshot.estimatedTokens)}</span></div>
                    <div><span className="text-muted-foreground">Cash:</span> <span className="font-medium">{fmtINR(result.contextSnapshot.finance.cashBalance)}</span></div>
                    <div><span className="text-muted-foreground">Twin Health:</span> <span className="font-medium">{result.contextSnapshot.twin.healthScore}/100</span></div>
                    <div><span className="text-muted-foreground">Nodes:</span> <span className="font-medium">{fmtNum(result.contextSnapshot.graph.nodeCount)}</span></div>
                  </div>
                </CardContent>
              </Card>
              <ReasoningDisplay reasoning={result.reasoning} explanation={null} durationMs={result.durationMs} />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED UI HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function LoadingBlock({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
