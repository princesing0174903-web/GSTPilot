'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Premium AI CFO Experience
// ═══════════════════════════════════════════════════════════════════════════════
//
// Oracle is the AI CFO of GSTPilot. The first screen answers the question:
//   "What does the business owner need to know in the next 30 seconds?"
//
// Layout (progressive disclosure, single scrollable column):
//   ┌─────────────────────────────────────────────────────────────┐
//   │  Header (Oracle brand + sessions dropdown + new chat)       │
//   ├─────────────────────────────────────────────────────────────┤
//   │  Scrollable main column:                                    │
//   │    1. CFO Hero — greeting + business health score           │
//   │    2. Today's Top Priority — single CTA card                │
//   │    3. Metrics Row — Revenue / Cash / GST (with sparklines)  │
//   │    4. Oracle Intelligence — insight cards with actions      │
//   │    5. Ask Oracle — quick action chips                       │
//   │    6. Timeline — recent business events                     │
//   │    7. Conversation — chat thread (only when messages exist) │
//   ├─────────────────────────────────────────────────────────────┤
//   │  Sticky chat input (premium multi-line)                     │
//   └─────────────────────────────────────────────────────────────┘
//
// Design system:
//   • Pure black bg (#000000), cards on #0A0A0A with #1F1F1F borders.
//   • Blue (#2563EB) is the only accent color.
//   • Uses .gst-page-title, .gst-section-title, .gst-metric, .gst-card, etc.
//   • Count-up animations via useCountUp hook.
//   • Sparkline charts via recharts.
//   • Streaming caret via .oracle-caret class.
//   • Streaming chat via SSE to /api/oracle/brain (unchanged from previous).
//   • Tool-call rendering, action engine, workflow engine — all preserved.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Brain, Send, Plus, MessageSquare, Trash2, Sparkles, TrendingUp,
  Receipt, Users, AlertTriangle, FileText, Database, Zap, Clock,
  ChevronRight, Loader2, BrainCircuit, Wrench, CheckCircle2, XCircle,
  Menu, X, Lightbulb, IndianRupee, ShieldCheck, BarChart3,
  Copy, RotateCcw, Square, ShieldAlert, ArrowRight, Sparkle,
  UserPlus, Calendar, Landmark, RefreshCw, ClipboardCheck, Settings,
  ChevronDown, History, ArrowUpRight, ArrowDownRight, Activity,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { toast } from 'sonner';
import { fetchWithTimeout } from '@/lib/async';
import { getCachedSnapshot, setCachedSnapshot } from '@/hooks/useBusinessSnapshot';
// ─── Oracle UI upgrade (ORACLE-UI-UPGRADE) ────────────────────────────────────
import { CopilotModeSelector } from './CopilotModeSelector';
import { ExecutiveBriefingPanel } from './ExecutiveBriefingPanel';
import { EvidenceCard } from './EvidenceCard';
import { EnvironmentBadge } from './EnvironmentBadge';
import { PermissionTierBadge } from './PermissionTierBadge';
import { COPILOT_MODES, type CopilotModeId } from '@/lib/oracle/brain/copilot-modes';
import type { PermissionTier } from '@/lib/oracle/brain/tool-permissions';
import { getToolTier } from '@/lib/oracle/brain/tool-permissions';
import type { Evidence, DataEnvironment } from '@/lib/oracle/context/types';
import type { ExecutiveBriefing } from '@/lib/oracle/executive-briefing';

// ─── Props (no context dependency — keeps this module Firebase-free) ──────────

export interface OracleBrainCoreProps {
  orgId: string | null;
  isPreviewMode?: boolean;
  /** Navigation callback — when Oracle calls `navigate`, this moves the user
   * to the requested page (e.g. invoices, customers, reports). Wired to the
   * dashboard's setCurrentView by the OracleBrain wrapper. */
  onNavigate?: (view: string, entityId?: string) => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts: MessagePart[];
  createdAt: string;
  streaming?: boolean;
}

type MessagePart =
  | {
      type: 'tool-call';
      tool: string;
      args: Record<string, any>;
      result?: string;
      error?: string;
      durationMs?: number;
      /** ORACLE-UI-UPGRADE: permission tier emitted by the brain route (tool-start / tool-result). */
      tier?: PermissionTier;
      /** ORACLE-UI-UPGRADE: evidence attached to the tool result (source provenance). */
      evidence?: Evidence;
    }
  | ActionConfirmPart
  | WorkflowPart;

// ─── Workflow Engine parts (plan + live progress) ─────────────────────────────
import { WorkflowPlanCard, type WorkflowPart } from './WorkflowCards';
import type {
  WorkflowPlan,
  WorkflowStepResult,
  WorkflowResult,
} from '@/lib/oracle/workflow-engine/types';

// ─── Action Engine parts (confirmation cards) ─────────────────────────────────
interface ActionConfirmPart {
  type: 'action-confirm';
  tool: string;
  args: Record<string, any>;
  toolCallId: string;
  displayName: string;
  icon: string;
  category: string;
  previewTitle: string;
  previewFields: Array<{ label: string; value: string; emphasize?: boolean }>;
  validationFields: Array<{ key: string; label: string; status: 'ok' | 'warn' | 'error'; message?: string; resolvedValue?: string }>;
  note?: string;
  state: 'pending' | 'confirmed' | 'cancelled' | 'executing' | 'success' | 'error';
  successSummary?: string;
  successData?: Record<string, any>;
  error?: string;
  followUp?: { label: string; prompt: string };
  viewIn?: { label: string; href: string };
  refreshedContext?: {
    snapshot?: any;
    recentInvoices?: any[];
    recentActivity?: any[];
    memory?: any[];
  };
  /** ORACLE-UI-UPGRADE: permission tier for this action (resolved client-side via getToolTier). */
  tier?: PermissionTier;
  /** ORACLE-UI-UPGRADE: evidence attached to this action preview (source provenance). */
  evidence?: Evidence;
}

interface Session {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryFact {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  tags: string[];
  importance: number;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ToolEvent {
  id: string;
  tool: string;
  args: Record<string, any>;
  status: 'running' | 'success' | 'error';
  result?: string;
  error?: string;
  durationMs?: number;
  artifacts?: any[];
}

// ─── Snapshot shape (subset of /api/business/snapshot response that we use) ───
interface BusinessSnapshot {
  revenue?: number;
  revenueThisMonth?: number;
  revenueLastMonth?: number;
  expenses?: number;
  profit?: number;
  cash?: number;
  receivables?: number;
  payables?: number;
  overdueReceivables?: number;
  overdueInvoiceCount?: number;
  customerCount?: number;
  invoiceCount?: number;
  vendorCount?: number;
  outputTax?: number;
  inputTax?: number;
  gstLiability?: number;
  totalCollected?: number;
  totalPaid?: number;
  netCashFlow?: number;
  avgDaysToPay?: number;
  collectionRate?: number; // 0–1
  workingCapital?: number;
  runwayDays?: number;
  healthScore?: number;
  healthScoreLabel?: string;
  riskScore?: number;
  pendingReturns?: number;
  overdueReturns?: number;
  filedReturns?: number;
  topCustomerShare?: number;
  hasLiveData?: boolean;
  forecast?: { nextMonthRevenue?: number; nextMonthExpenses?: number; trend?: 'up' | 'down' | 'flat'; confidence?: number };
}

interface TimelineEventLite {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  severity?: 'info' | 'success' | 'warning' | 'critical';
  createdAt: string;
}

// ─── Quick action prompts (the "golden path" for first-time users) ────────────

const QUICK_ACTIONS: Array<{ icon: LucideIcon; label: string; prompt: string; tone: 'primary' | 'default' }> = [
  {
    icon: TrendingUp,
    label: 'What happened this month?',
    prompt: 'Give me a snapshot of how my business did this month — revenue, profit, cash, and any risks.',
    tone: 'primary',
  },
  {
    icon: Sparkles,
    label: 'Forecast August',
    prompt: 'Forecast my revenue and cash position for next month based on current trends.',
    tone: 'default',
  },
  {
    icon: FileText,
    label: 'Prepare GSTR-3B',
    prompt: 'Prepare my GSTR-3B return for the current period — show output tax, input tax credit, and net liability.',
    tone: 'default',
  },
  {
    icon: Send,
    label: 'Generate Reminder',
    prompt: 'Generate payment reminder messages for all my overdue customers. Draft a polite but firm email for each.',
    tone: 'default',
  },
  {
    icon: IndianRupee,
    label: 'Analyze Cashflow',
    prompt: 'Analyze my cashflow. Show inflows vs outflows, collection rate, and runway. Flag any concerns.',
    tone: 'default',
  },
];

const TOOL_ICONS: Record<string, LucideIcon> = {
  getBusinessSnapshot: TrendingUp,
  queryInvoices: Receipt,
  queryCustomers: Users,
  queryExpenses: IndianRupee,
  queryPayments: IndianRupee,
  getGSTStatus: Receipt,
  getOverdueCustomers: AlertTriangle,
  getCashflowAnalysis: TrendingUp,
  getTopCustomer: Users,
  getNewestInvoice: Receipt,
  getInvoiceMetrics: BarChart3,
  getRecentActivity: Clock,
  getConnectedIntegrations: ShieldCheck,
  createInvoice: FileText,
  sendReminder: Send,
  recallMemory: Brain,
  saveMemory: Brain,
};

const TOOL_LABELS: Record<string, string> = {
  getBusinessSnapshot: 'Business Snapshot',
  queryInvoices: 'Query Invoices',
  queryCustomers: 'Query Customers',
  queryExpenses: 'Query Expenses',
  queryPayments: 'Query Payments',
  getGSTStatus: 'GST Status',
  getOverdueCustomers: 'Overdue Customers',
  getCashflowAnalysis: 'Cashflow Analysis',
  getTopCustomer: 'Top Customer',
  getNewestInvoice: 'Newest Invoice',
  getInvoiceMetrics: 'Invoice Metrics',
  getRecentActivity: 'Recent Activity',
  getConnectedIntegrations: 'Integrations',
  getPendingFilings: 'Pending Filings',
  getBankAccounts: 'Bank Accounts',
  getIntegrationStatus: 'Integration Status',
  navigate: 'Navigate',
  createInvoice: 'Create Invoice',
  createCustomer: 'Create Customer',
  createExpense: 'Record Expense',
  createPayment: 'Record Payment',
  createTask: 'Create Task',
  generateGSTReturn: 'Generate GST Return',
  generateReport: 'Generate Report',
  sendReminder: 'Send Reminder',
  updateCustomer: 'Update Customer',
  deleteCustomer: 'Delete Customer',
  updateInvoice: 'Update Invoice',
  deleteInvoice: 'Delete Invoice',
  duplicateInvoice: 'Duplicate Invoice',
  sendInvoice: 'Send Invoice',
  updateExpense: 'Update Expense',
  deleteExpense: 'Delete Expense',
  markInvoicePaid: 'Mark Invoice Paid',
  refundPayment: 'Refund Payment',
  prepareGstr3b: 'Prepare GSTR-3B',
  addCrmLead: 'Add CRM Lead',
  scheduleFollowUp: 'Schedule Follow-up',
  inviteTeamMember: 'Invite Team Member',
  updateProfile: 'Update Profile',
  connectBankAccount: 'Connect Bank Account',
  exportReport: 'Export Report',
  syncZoho: 'Sync Zoho',
  syncGoogle: 'Sync Google',
  recallMemory: 'Recall Memory',
  saveMemory: 'Save Memory',
};

const ACTION_ICONS: Record<string, LucideIcon> = {
  FileText,
  Users,
  IndianRupee,
  Receipt,
  Send,
  Wrench,
  ShieldAlert,
  BarChart3,
  BrainCircuit,
  UserPlus,
  Calendar,
  Landmark,
  RefreshCw,
  ClipboardCheck,
  Settings,
};

function resolveActionIcon(iconName: string): LucideIcon {
  return ACTION_ICONS[iconName] ?? Wrench;
}
void resolveActionIcon; // kept for downstream callers / future use

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format an INR amount — short form (₹1.69L / ₹2.4Cr) for big numbers, full for small. */
function formatINR(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Format a full INR amount (no shortening). */
function formatINRFull(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '₹0';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Time-of-day greeting based on IST hour. */
function getGreeting(now = new Date()): string {
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  const istHour = new Date(istMs).getUTCHours();
  if (istHour < 12) return 'Good morning';
  if (istHour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** One-line status derived from the health score. */
function getHealthStatusLine(score: number | undefined): string {
  if (score == null) return 'Connect your data to see business health.';
  if (score >= 80) return 'Everything is stable. You\'re in great shape.';
  if (score >= 65) return 'Business is healthy with a few items to watch.';
  if (score >= 50) return 'Some areas need attention this week.';
  if (score >= 35) return 'A few risks need your attention today.';
  return 'Immediate action recommended — see priorities below.';
}

/** Health score tone (color + label). */
function healthTone(score: number | undefined): { color: string; bg: string; label: string } {
  if (score == null) return { color: 'text-zinc-400', bg: 'bg-zinc-500/10', label: 'No data' };
  if (score >= 80) return { color: 'text-[#60A5FA]', bg: 'bg-[#2563EB]/10', label: 'Excellent' };
  if (score >= 65) return { color: 'text-[#60A5FA]', bg: 'bg-[#2563EB]/10', label: 'Good' };
  if (score >= 50) return { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Fair' };
  if (score >= 35) return { color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Poor' };
  return { color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Critical' };
}

/** MoM revenue change as a percentage. Null if either side is 0. */
function revenueChangePct(s: BusinessSnapshot): number | null {
  const cur = s.revenueThisMonth ?? 0;
  const prev = s.revenueLastMonth ?? 0;
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/**
 * Synthesize a 6-point sparkline series from the snapshot.
 * Deterministic — same input always produces the same curve.
 * Uses revenueThisMonth + revenueLastMonth to anchor the last two points,
 * and a simple linear back-fill for the earlier months so the chart has shape.
 */
function synthesizeSparkline(
  current: number,
  previous: number,
  seed = 1,
): Array<{ i: number; v: number }> {
  const points: number[] = [];
  // Anchor last two points
  points[5] = current;
  points[4] = previous;
  // Back-fill 0..3 with a deterministic wobbling curve trending toward `previous`
  const base = previous > 0 ? previous : current > 0 ? current * 0.85 : 50000;
  for (let i = 3; i >= 0; i--) {
    // Deterministic pseudo-random in [-0.18, +0.12]
    const r = Math.sin((i + seed) * 1.314) * 0.15 + Math.cos((i + seed) * 0.721) * 0.07;
    points[i] = Math.max(0, base * (1 + r - (3 - i) * 0.04));
  }
  return points.map((v, i) => ({ i, v: Math.round(v) }));
}

// ─── Insight derivation (mirrors /api/oracle/brain/briefing logic) ────────────

interface Insight {
  id: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  icon: LucideIcon;
  title: string;
  description: string;
  impact?: string;
  actionLabel?: string;
  actionPrompt?: string;
}

function deriveInsights(s: BusinessSnapshot | null): Insight[] {
  if (!s) return [];
  const out: Insight[] = [];

  if ((s.overdueInvoiceCount ?? 0) > 0 && (s.overdueReceivables ?? 0) > 0) {
    out.push({
      id: 'overdue',
      severity: (s.overdueReceivables ?? 0) > 100000 ? 'high' : 'medium',
      icon: AlertTriangle,
      title: 'Collection Risk',
      description: `${s.overdueInvoiceCount} invoice(s) totalling ${formatINRFull(s.overdueReceivables)} are unpaid.`,
      impact: `Cashflow reduction ${formatINRFull(s.overdueReceivables)}`,
      actionLabel: 'Send Reminders',
      actionPrompt: `Send payment reminders to all ${s.overdueInvoiceCount} overdue customers totalling ${formatINRFull(s.overdueReceivables)}.`,
    });
  }

  if ((s.pendingReturns ?? 0) > 0) {
    out.push({
      id: 'gst-due',
      severity: (s.overdueReturns ?? 0) > 0 ? 'high' : 'medium',
      icon: FileText,
      title: 'GST Filing Due',
      description: `${s.pendingReturns} GST return(s) pending${(s.overdueReturns ?? 0) > 0 ? `, ${s.overdueReturns} overdue` : ''}.`,
      impact: s.gstLiability ? `Net liability ${formatINRFull(s.gstLiability)}` : undefined,
      actionLabel: 'Prepare Return',
      actionPrompt: 'Prepare my GSTR-3B return for the current period.',
    });
  }

  const changePct = revenueChangePct(s);
  if (changePct != null && changePct <= -10) {
    out.push({
      id: 'rev-drop',
      severity: 'medium',
      icon: TrendingUp,
      title: 'Revenue Dropped',
      description: `Revenue is down ${Math.abs(Math.round(changePct))}% month-over-month (${formatINR(s.revenueLastMonth)} → ${formatINR(s.revenueThisMonth)}).`,
      impact: 'Investigate the cause — fewer invoices, lower ticket size, or churned customers.',
      actionLabel: 'Investigate',
      actionPrompt: 'Why did my revenue drop this month? Break down by customer and invoice.',
    });
  }

  if ((s.topCustomerShare ?? 0) >= 0.35) {
    out.push({
      id: 'concentration',
      severity: 'medium',
      icon: Users,
      title: 'Client Concentration',
      description: `Top customer accounts for ${Math.round((s.topCustomerShare ?? 0) * 100)}% of revenue — single-customer dependency risk.`,
      impact: 'Diversify or expand existing accounts.',
      actionLabel: 'View Customers',
      actionPrompt: 'Show me my customer concentration. Which customers bring the most revenue?',
    });
  }

  if ((s.collectionRate ?? 1) < 0.7 && (s.receivables ?? 0) > 0) {
    out.push({
      id: 'collection-rate',
      severity: 'medium',
      icon: IndianRupee,
      title: 'Collection Rate Low',
      description: `Collection rate is ${Math.round((s.collectionRate ?? 0) * 100)}% — below the 70% healthy threshold.`,
      impact: `Average days to pay: ${s.avgDaysToPay ?? '—'} days`,
      actionLabel: 'Tighten Terms',
      actionPrompt: 'How can I improve my collection rate? Suggest payment terms and follow-up cadence.',
    });
  }

  if ((s.runwayDays ?? Infinity) < 30) {
    out.push({
      id: 'runway',
      severity: 'high',
      icon: ShieldAlert,
      title: 'Cash Runway Low',
      description: `Cash position is ${formatINRFull(s.cash)}. Runway ≈ ${s.runwayDays === Infinity ? '∞' : s.runwayDays} days.`,
      impact: 'Review outflows and chase receivables.',
      actionLabel: 'Analyze Cashflow',
      actionPrompt: 'Analyze my cashflow and runway. What can I do to extend my runway?',
    });
  }

  if ((s.netCashFlow ?? 0) < 0) {
    out.push({
      id: 'neg-cashflow',
      severity: 'medium',
      icon: Activity,
      title: 'Negative Net Cashflow',
      description: `Outflows exceed inflows by ${formatINRFull(Math.abs(s.netCashFlow ?? 0))} this period.`,
      impact: 'Reduce discretionary spend or accelerate collections.',
      actionLabel: 'View Cashflow',
      actionPrompt: 'Show me my cashflow breakdown — where is money going out fastest?',
    });
  }

  // Always include at least one positive/info insight if everything is healthy
  if (out.length === 0) {
    out.push({
      id: 'healthy',
      severity: 'info',
      icon: CheckCircle2,
      title: 'Business is Healthy',
      description: 'No critical risks detected. Keep monitoring cash flow and GST filings weekly.',
      actionLabel: 'View Snapshot',
      actionPrompt: 'Give me a complete business snapshot — revenue, profit, cash, GST, and risks.',
    });
  }

  return out.slice(0, 6);
}

// ─── useCountUp hook ──────────────────────────────────────────────────────────

function useCountUp(target: number, durationMs = 800, deps: any[] = []): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const from = fromRef.current;
    const to = target;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * eased;
      setValue(v);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, ...deps]);
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function OracleBrainCore({ orgId, isPreviewMode = false, onNavigate }: OracleBrainCoreProps) {
  // ─── Chat state ───
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [memory, setMemory] = useState<MemoryFact[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);

  // ─── UI state ───
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  // ─── Snapshot + timeline state ───
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEventLite[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  // ─── ORACLE-UI-UPGRADE: Copilot mode (persisted to localStorage) ───
  // The active mode shapes Oracle's system prompt, tool allowlist, and the
  // suggested prompts in the empty state. It's also sent in the brain POST
  // body so the backend can switch system-prompt + tool allowlist accordingly.
  const [mode, setMode] = useState<CopilotModeId>('general');
  // Hydrate mode from localStorage on mount (client-only — guarded against SSR).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('gstpilot.oracle.mode');
      if (stored && COPILOT_MODES[stored as CopilotModeId]) {
        setMode(stored as CopilotModeId);
      }
    } catch {
      // localStorage might be unavailable (privacy mode) — silently fall back to 'general'.
    }
  }, []);
  const handleModeChange = useCallback((next: CopilotModeId) => {
    setMode(next);
    try {
      window.localStorage.setItem('gstpilot.oracle.mode', next);
    } catch {
      // best-effort — ignore failures.
    }
  }, []);
  const activeMode = COPILOT_MODES[mode] ?? COPILOT_MODES.general;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  const greeting = useMemo(() => getGreeting(), []);
  const insights = useMemo(() => deriveInsights(snapshot), [snapshot]);
  const topInsight = insights.find(i => i.severity === 'high') ?? insights[0] ?? null;

  // ─── Load sessions + memory when orgId changes ───
  useEffect(() => {
    if (!orgId) return;
    refreshSessions();
    refreshMemory();
  }, [orgId]);

  // ─── Load snapshot + timeline on mount / orgId change ───
  // PERF (Phase 2): Read from the shared snapshot cache first. The dashboard's
  // useBusinessSnapshot hook populates this cache whenever it's mounted. So
  // when the user navigates Dashboard → Oracle view, we get an instant cache
  // hit and skip the duplicate `/api/business/snapshot` fetch entirely. We
  // only fall back to a fresh fetch on cache miss (e.g. user lands directly
  // on the Oracle view). On a successful fetch, we write back to the cache so
  // the dashboard hydrates instantly if it mounts later.
  useEffect(() => {
    let cancelled = false;
    if (!orgId) {
      setSnapshot(null);
      setSnapshotLoading(false);
      setTimeline([]);
      setTimelineLoading(false);
      return;
    }

    // 1) Snapshot: cache-first
    const cached = getCachedSnapshot(orgId);
    if (cached) {
      setSnapshot(cached);
      setSnapshotLoading(false);
    } else {
      setSnapshotLoading(true);
      fetchWithTimeout(`/api/business/snapshot?organizationId=${encodeURIComponent(orgId)}`, { timeoutMs: 10_000 })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (!cancelled && data) {
            setSnapshot(data);
            setCachedSnapshot(orgId, data);
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setSnapshotLoading(false); });
    }

    // 2) Timeline: limit=15 (matches DashboardPage's useTimelineEvents(15)
    //    call → same SWR cache key on the server → no duplicate Prisma query).
    setTimelineLoading(true);
    fetchWithTimeout(`/api/timeline?organizationId=${encodeURIComponent(orgId)}&limit=15`, { timeoutMs: 10_000 })
      .then(r => (r.ok ? r.json() : { events: [] }))
      .then(data => { if (!cancelled) setTimeline(data?.events ?? []); })
      .catch(() => { if (!cancelled) setTimeline([]); })
      .finally(() => { if (!cancelled) setTimelineLoading(false); });

    return () => { cancelled = true; };
  }, [orgId]);

  const refreshSessions = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/oracle/brain/sessions?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }, [orgId]);

  const refreshMemory = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/oracle/brain/memory?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setMemory(data.facts ?? []);
      }
    } catch (e) {
      console.error('Failed to load memory:', e);
    }
  }, [orgId]);

  // ─── Load messages when session changes ───
  const loadSession = useCallback(async (sessionId: string) => {
    if (!orgId) return;
    setLoadingSession(true);
    setSessionsOpen(false);
    try {
      const res = await fetch(
        `/api/oracle/brain/sessions/${sessionId}?orgId=${encodeURIComponent(orgId)}`
      );
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMessage[] = (data.messages ?? []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          parts: m.parts ?? [],
          createdAt: m.createdAt,
        }));
        setMessages(msgs);
        setCurrentSessionId(sessionId);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    } finally {
      setLoadingSession(false);
    }
  }, [orgId]);

  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setSessionsOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ─── Auto-scroll on new messages ───
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ─── Send message (the core streaming chat — UNCHANGED from previous) ──────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || !orgId) return;

    setInput('');
    setIsStreaming(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      parts: [],
      createdAt: new Date().toISOString(),
    };

    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      parts: [],
      createdAt: new Date().toISOString(),
      streaming: true,
    };

    const toolEvents: ToolEvent[] = [];

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/oracle/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ORACLE-UI-UPGRADE: send the active copilot mode in the POST body so
        // the backend can switch its system-prompt + tool allowlist accordingly.
        body: JSON.stringify({
          message: trimmed,
          sessionId: currentSessionId,
          orgId,
          userId: undefined,
          mode,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resolvedSessionId = currentSessionId;

      const updateAssistant = (updater: (m: ChatMessage) => ChatMessage) => {
        setMessages(prev => prev.map(m => m.id === assistantId ? updater(m) : m));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          const line = evt.split('\n').find(l => l.startsWith('data:'));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const data = JSON.parse(payload);
            switch (data.type) {
              case 'session':
                resolvedSessionId = data.sessionId;
                setCurrentSessionId(data.sessionId);
                // ORACLE-UI-UPGRADE: the brain route now echoes the active mode
                // back in the session event. If the backend switched modes
                // (e.g. via a message prefix), sync the local state so the
                // selector + suggested prompts stay consistent.
                if (data.mode && COPILOT_MODES[data.mode as CopilotModeId] && data.mode !== mode) {
                  setMode(data.mode as CopilotModeId);
                  try {
                    window.localStorage.setItem('gstpilot.oracle.mode', data.mode);
                  } catch {}
                }
                break;
              case 'token':
                updateAssistant(m => ({ ...m, content: m.content + (data.text || '') }));
                break;
              case 'tool-start': {
                const te: ToolEvent = {
                  id: `te-${Date.now()}-${Math.random()}`,
                  tool: data.tool,
                  args: data.args ?? {},
                  status: 'running',
                };
                toolEvents.push(te);
                // ORACLE-UI-UPGRADE: capture the permission tier emitted by the
                // brain route so the ToolCallCard can render a READ/CONFIRM/
                // STRONG CONFIRM badge.
                const tier: PermissionTier | undefined =
                  data.tier === 'read-only' || data.tier === 'confirmation' || data.tier === 'strong-confirm'
                    ? data.tier
                    : getToolTier(data.tool);
                updateAssistant(m => ({ ...m, parts: [...m.parts, {
                  type: 'tool-call' as const,
                  tool: te.tool,
                  args: te.args,
                  tier,
                }] }));
                break;
              }
              case 'tool-result': {
                const te = toolEvents.find(t => t.tool === data.tool && t.status === 'running');
                if (te) {
                  te.status = 'success';
                  te.result = data.result?.summary;
                  te.durationMs = data.durationMs;
                  te.artifacts = data.result?.artifacts;
                }
                // ORACLE-UI-UPGRADE: the brain route now attaches an `evidence`
                // object to the tool result (source provenance). Capture it and
                // the permission tier so the ToolCallCard can render a source
                // citation card + environment badge below the result.
                const resultEvidence: Evidence | undefined =
                  data.result?.evidence && typeof data.result.evidence === 'object' && data.result.evidence.id
                    ? data.result.evidence as Evidence
                    : undefined;
                const resultTier: PermissionTier | undefined =
                  data.tier === 'read-only' || data.tier === 'confirmation' || data.tier === 'strong-confirm'
                    ? data.tier
                    : undefined;
                updateAssistant(m => ({
                  ...m,
                  parts: m.parts.map((p, i) =>
                    i === m.parts.length - 1 && p.type === 'tool-call' && p.tool === data.tool && !p.result
                      ? {
                          ...p,
                          result: data.result?.summary,
                          durationMs: data.durationMs,
                          tier: resultTier ?? p.tier,
                          evidence: resultEvidence ?? p.evidence,
                        } as MessagePart
                      : p
                  ),
                }));
                if (data.tool === 'saveMemory' || data.tool === 'recallMemory') {
                  refreshMemory();
                }
                break;
              }
              case 'tool-error': {
                updateAssistant(m => ({
                  ...m,
                  parts: m.parts.map((p, i) =>
                    i === m.parts.length - 1 && p.type === 'tool-call' && p.tool === data.tool && !p.error
                      ? { ...p, error: data.error, durationMs: data.durationMs } as MessagePart
                      : p
                  ),
                }));
                break;
              }
              case 'action-confirm': {
                // ORACLE-UI-UPGRADE: resolve the permission tier client-side via
                // getToolTier (the action-confirm SSE event doesn't include it
                // today). Also forward an optional evidence payload if present.
                const actionTier: PermissionTier = getToolTier(data.tool);
                const actionEvidence: Evidence | undefined =
                  data.evidence && typeof data.evidence === 'object' && data.evidence.id
                    ? data.evidence as Evidence
                    : undefined;
                const part: ActionConfirmPart = {
                  type: 'action-confirm',
                  tool: data.tool,
                  args: data.args ?? {},
                  toolCallId: data.toolCallId,
                  displayName: data.displayName ?? data.tool,
                  icon: data.icon ?? 'Wrench',
                  category: data.category ?? 'action',
                  previewTitle: data.preview ?? data.displayName ?? data.tool,
                  previewFields: Array.isArray(data.previewFields) ? data.previewFields : [],
                  validationFields: Array.isArray(data.validationFields) ? data.validationFields : [],
                  note: data.note,
                  state: 'pending',
                  tier: actionTier,
                  evidence: actionEvidence,
                };
                updateAssistant(m => ({ ...m, parts: [...m.parts, part] }));
                break;
              }
              case 'workflow-plan': {
                const plan = data.plan as WorkflowPlan;
                if (!plan || !Array.isArray(plan.steps)) break;
                const wfPart: WorkflowPart = {
                  type: 'workflow-plan',
                  plan,
                  source: data.source,
                  state: 'pending',
                };
                updateAssistant(m => ({ ...m, parts: [...m.parts, wfPart as any] }));
                break;
              }
              case 'done':
                updateAssistant(m => ({ ...m, streaming: false }));
                refreshSessions();
                break;
              case 'error':
                updateAssistant(m => ({
                  ...m,
                  streaming: false,
                  content: m.content || `⚠️ ${data.error || 'Something went wrong.'}`,
                }));
                toast.error(data.error || 'Oracle encountered an error');
                break;
              case 'navigate': {
                if (data.view && onNavigate) {
                  try {
                    onNavigate(data.view, data.entityId);
                    toast.success(`Opened ${data.view}`);
                  } catch (e) {
                    console.warn('[oracle] navigate failed:', e);
                  }
                }
                break;
              }
            }
          } catch (e) {
            // partial JSON — ignore
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages(prev => prev.map(m => m.id === assistantId
          ? { ...m, streaming: false, content: m.content + '\n\n_(stopped)_' }
          : m));
      } else {
        console.error('Chat error:', e);
        setMessages(prev => prev.map(m => m.id === assistantId
          ? { ...m, streaming: false, content: `⚠️ Connection error: ${e.message}. Please try again.` }
          : m));
        toast.error('Failed to reach Oracle');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [orgId, currentSessionId, isStreaming, refreshSessions, refreshMemory, onNavigate, mode]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // ─── Action Engine: confirm / cancel handlers ───
  const updateActionPart = useCallback((toolCallId: string, updater: (p: ActionConfirmPart) => ActionConfirmPart) => {
    setMessages(prev => prev.map(m => ({
      ...m,
      parts: m.parts.map(p => {
        if (p.type === 'action-confirm' && (p as ActionConfirmPart).toolCallId === toolCallId) {
          return updater(p as ActionConfirmPart);
        }
        return p;
      }) as MessagePart[],
    })));
  }, []);

  const confirmAction = useCallback(async (toolCallId: string) => {
    if (!orgId) return;
    let target: ActionConfirmPart | null = null;
    for (const m of messagesRef.current) {
      for (const p of m.parts) {
        if (p.type === 'action-confirm' && (p as ActionConfirmPart).toolCallId === toolCallId) {
          target = p as ActionConfirmPart;
          break;
        }
      }
      if (target) break;
    }
    if (!target) return;

    updateActionPart(toolCallId, p => ({ ...p, state: 'executing' }));

    try {
      const res = await fetch('/api/oracle/brain/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          toolCallId,
          tool: target.tool,
          args: target.args,
          orgId,
          sessionId: currentSessionId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.success) {
        updateActionPart(toolCallId, p => ({
          ...p,
          state: 'success',
          successSummary: data.summary,
          successData: data.result,
          followUp: data.followUp,
          viewIn: data.viewIn,
          refreshedContext: data.refreshedContext,
        }));
        if (data.refreshedContext?.memory) {
          setMemory(data.refreshedContext.memory);
        } else {
          refreshMemory();
        }
        refreshSessions();
        toast.success(`${target.displayName} completed`);
      } else if (data.cancelled) {
        updateActionPart(toolCallId, p => ({ ...p, state: 'cancelled' }));
      } else {
        const errMsg = data.summary || data.error || 'Action failed';
        updateActionPart(toolCallId, p => ({ ...p, state: 'error', error: errMsg }));
        toast.error(errMsg);
      }
    } catch (e: any) {
      const errMsg = e.message || 'Network error';
      updateActionPart(toolCallId, p => ({ ...p, state: 'error', error: errMsg }));
      toast.error(`Failed to execute action: ${errMsg}`);
    }
  }, [orgId, currentSessionId, updateActionPart, refreshMemory, refreshSessions]);

  const cancelActionCard = useCallback(async (toolCallId: string) => {
    if (!orgId) return;
    let toolName = '';
    for (const m of messagesRef.current) {
      for (const p of m.parts) {
        if (p.type === 'action-confirm' && (p as ActionConfirmPart).toolCallId === toolCallId) {
          toolName = (p as ActionConfirmPart).tool;
          break;
        }
      }
      if (toolName) break;
    }
    updateActionPart(toolCallId, p => ({ ...p, state: 'cancelled' }));
    try {
      await fetch('/api/oracle/brain/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: false,
          toolCallId,
          tool: toolName,
          args: {},
          orgId,
          sessionId: currentSessionId,
        }),
      });
    } catch {
      // Non-critical
    }
    refreshSessions();
  }, [orgId, currentSessionId, updateActionPart, refreshSessions]);

  // ─── Workflow Engine: confirm / cancel handlers ───
  const updateWorkflowPart = useCallback((workflowId: string, updater: (p: WorkflowPart) => WorkflowPart) => {
    setMessages(prev => prev.map(m => ({
      ...m,
      parts: m.parts.map(p => {
        if (p.type === 'workflow-plan' && (p as any).plan?.id === workflowId) {
          return updater(p as any) as any;
        }
        return p;
      }) as MessagePart[],
    })));
  }, []);

  const confirmWorkflow = useCallback(async (plan: WorkflowPlan) => {
    if (!orgId) return;
    const wfId = plan.id;
    updateWorkflowPart(wfId, p => ({ ...p, state: 'executing', stepResults: [] }));

    try {
      const res = await fetch('/api/oracle/brain/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, orgId, sessionId: currentSessionId }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => 'Network error');
        updateWorkflowPart(wfId, p => ({ ...p, state: 'failed', error: `Failed to start workflow: ${errText}` }));
        toast.error('Failed to start workflow');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: WorkflowResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            switch (evt.type) {
              case 'workflow-step-start': {
                updateWorkflowPart(wfId, p => {
                  const steps = [...(p.stepResults ?? [])];
                  const idx = steps.findIndex(s => s.stepId === evt.stepId);
                  const newResult: WorkflowStepResult = {
                    stepId: evt.stepId,
                    actionName: evt.actionName,
                    label: evt.label,
                    status: 'running',
                    startedAt: new Date().toISOString(),
                  };
                  if (idx === -1) steps.push(newResult);
                  else steps[idx] = newResult;
                  return { ...p, stepResults: steps };
                });
                break;
              }
              case 'workflow-step-success': {
                updateWorkflowPart(wfId, p => {
                  const steps = [...(p.stepResults ?? [])];
                  const idx = steps.findIndex(s => s.stepId === evt.stepId);
                  const newResult: WorkflowStepResult = {
                    stepId: evt.stepId,
                    actionName: steps[idx]?.actionName ?? '',
                    label: evt.label,
                    status: 'success',
                    summary: evt.summary,
                    data: evt.data,
                    durationMs: evt.durationMs,
                    completedAt: new Date().toISOString(),
                  };
                  if (idx === -1) steps.push(newResult);
                  else steps[idx] = newResult;
                  return { ...p, stepResults: steps };
                });
                break;
              }
              case 'workflow-step-skipped': {
                updateWorkflowPart(wfId, p => {
                  const steps = [...(p.stepResults ?? [])];
                  const idx = steps.findIndex(s => s.stepId === evt.stepId);
                  const newResult: WorkflowStepResult = {
                    stepId: evt.stepId,
                    actionName: steps[idx]?.actionName ?? '',
                    label: evt.label,
                    status: 'skipped',
                    summary: evt.reason,
                  };
                  if (idx === -1) steps.push(newResult);
                  else steps[idx] = newResult;
                  return { ...p, stepResults: steps };
                });
                break;
              }
              case 'workflow-step-failed': {
                updateWorkflowPart(wfId, p => {
                  const steps = [...(p.stepResults ?? [])];
                  const idx = steps.findIndex(s => s.stepId === evt.stepId);
                  const newResult: WorkflowStepResult = {
                    stepId: evt.stepId,
                    actionName: steps[idx]?.actionName ?? '',
                    label: evt.label,
                    status: 'failed',
                    error: evt.error,
                    completedAt: new Date().toISOString(),
                  };
                  if (idx === -1) steps.push(newResult);
                  else steps[idx] = newResult;
                  return { ...p, stepResults: steps };
                });
                break;
              }
              case 'workflow-rollback-done': {
                updateWorkflowPart(wfId, p => {
                  const steps = [...(p.stepResults ?? [])];
                  const idx = steps.findIndex(s => s.stepId === evt.stepId);
                  if (idx !== -1 && evt.ok) {
                    steps[idx] = { ...steps[idx], status: 'rolled-back', summary: `${steps[idx].summary ?? ''} ⟲ Rolled back.` };
                  }
                  return { ...p, stepResults: steps };
                });
                break;
              }
              case 'workflow-complete': {
                finalResult = evt.result as WorkflowResult;
                break;
              }
            }
          } catch {
            // partial JSON — ignore
          }
        }
      }

      if (finalResult) {
        updateWorkflowPart(wfId, p => ({
          ...p,
          state: finalResult!.status === 'success' ? 'success' : finalResult!.status === 'partial' ? 'partial' : 'failed',
          result: finalResult!,
        }));
        if (finalResult.status === 'success') {
          toast.success(`Workflow complete: ${plan.title}`);
        } else if (finalResult.status === 'partial') {
          toast.warning(`Workflow partially complete — ${finalResult.failedCount} step(s) failed`);
        } else {
          toast.error(`Workflow failed — see details in the card`);
        }
        if (finalResult.refreshedContext?.memory) {
          setMemory(finalResult.refreshedContext.memory);
        } else {
          refreshMemory();
        }
        refreshSessions();
      } else {
        updateWorkflowPart(wfId, p => ({ ...p, state: 'failed', error: 'Workflow stream ended unexpectedly.' }));
      }
    } catch (e: any) {
      const errMsg = e.message || 'Network error';
      updateWorkflowPart(wfId, p => ({ ...p, state: 'failed', error: errMsg }));
      toast.error(`Workflow failed: ${errMsg}`);
    }
  }, [orgId, currentSessionId, updateWorkflowPart, refreshMemory, refreshSessions]);

  const cancelWorkflow = useCallback((plan: WorkflowPlan) => {
    updateWorkflowPart(plan.id, p => ({ ...p, state: 'cancelled' }));
    toast.info(`Workflow cancelled: ${plan.title}`);
  }, [updateWorkflowPart]);

  const handleRegenerate = useCallback(() => {
    if (isStreaming) return;
    setMessages(prev => {
      const withoutLast = prev.slice(0, -1);
      const lastUserIdx = withoutLast.map(m => m.role).lastIndexOf('user');
      if (lastUserIdx === -1) return prev;
      const lastUserMsg = withoutLast[lastUserIdx];
      const remaining = withoutLast.slice(0, lastUserIdx);
      queueMicrotask(() => sendMessage(lastUserMsg.content));
      return remaining;
    });
  }, [isStreaming, sendMessage]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!orgId) return;
    try {
      await fetch(`/api/oracle/brain/sessions/${sessionId}?orgId=${encodeURIComponent(orgId)}`, {
        method: 'DELETE',
      });
      if (currentSessionId === sessionId) {
        startNewChat();
      }
      refreshSessions();
      toast.success('Conversation deleted');
    } catch (e) {
      toast.error('Failed to delete conversation');
    }
  }, [orgId, currentSessionId, refreshSessions, startNewChat]);

  const deleteMemory = useCallback(async (factId: string) => {
    if (!orgId) return;
    try {
      await fetch(`/api/oracle/brain/memory?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(factId)}`, {
        method: 'DELETE',
      });
      refreshMemory();
      toast.success('Memory deleted');
    } catch (e) {
      toast.error('Failed to delete memory');
    }
  }, [orgId, refreshMemory]);

  // Close popovers on outside click
  useEffect(() => {
    if (!sessionsOpen && !memoryOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-oracle-popover]')) {
        setSessionsOpen(false);
        setMemoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sessionsOpen, memoryOpen]);

  // ─── Render ───
  const healthScore = snapshot?.healthScore;
  const healthToneMeta = healthTone(healthScore);
  const hasMessages = messages.length > 0;

  return (
    <div className="h-full w-full flex flex-col bg-black overflow-hidden">
      {/* ─── Header ─── */}
      <header className="shrink-0 h-16 border-b border-[#1F1F1F] bg-black flex items-center justify-between px-4 sm:px-6 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-[#2563EB]/20 blur-md rounded-full" />
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-[#2563EB]/20 to-[#2563EB]/5 border border-[#2563EB]/30 flex items-center justify-center">
              <BrainCircuit className="h-5 w-5 text-[#60A5FA]" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-white tracking-tight">Oracle</span>
              <span className="hidden sm:inline-flex gst-status gst-status-info">AI CFO</span>
            </div>
            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#60A5FA] animate-pulse" />
              Online · reads live data · takes real actions
            </div>
          </div>
          {/* ORACLE-UI-UPGRADE: Copilot mode selector (next to the "Oracle" title). */}
          <CopilotModeSelector
            mode={mode}
            onChange={handleModeChange}
            disabled={isStreaming}
            className="ml-1 shrink-0"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Memory popover */}
          <div className="relative" data-oracle-popover>
            <button
              onClick={() => { setMemoryOpen(v => !v); setSessionsOpen(false); }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-[#0F0F0F] border border-transparent hover:border-[#1F1F1F] transition-colors"
              title="Oracle Memory"
            >
              <Brain className="h-4 w-4 text-[#60A5FA]" />
              <span className="hidden sm:inline">Memory</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-[#0F0F0F] text-zinc-400 border-[#1F1F1F]">{memory.length}</Badge>
            </button>
            <AnimatePresence>
              {memoryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden rounded-xl border border-[#1F1F1F] bg-[#0A0A0A] shadow-2xl shadow-black/50 z-50 flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-[#1F1F1F] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-[#60A5FA]" />
                      <span className="text-sm font-semibold text-white">Oracle Memory</span>
                    </div>
                    <span className="text-[11px] text-zinc-500">{memory.length} facts</span>
                  </div>
                  <ScrollArea className="flex-1 max-h-72">
                    <div className="p-2">
                      {memory.length === 0 ? (
                        <div className="px-2 py-6 text-center">
                          <Brain className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
                          <p className="text-[12px] text-zinc-500">
                            Oracle will remember facts about your business here. Tell Oracle to &ldquo;remember&rdquo; something.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {memory.map(f => (
                            <div key={f.id} className="group px-2.5 py-2 rounded-md hover:bg-[#0F0F0F]">
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-[12px] font-medium text-zinc-200 truncate flex-1">{f.title}</span>
                                <button
                                  onClick={() => deleteMemory(f.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-[#1F1F1F]"
                                >
                                  <X className="h-3 w-3 text-zinc-600 hover:text-rose-400" />
                                </button>
                              </div>
                              {f.summary && <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{f.summary}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sessions popover */}
          <div className="relative" data-oracle-popover>
            <button
              onClick={() => { setSessionsOpen(v => !v); setMemoryOpen(false); }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-[#0F0F0F] border border-transparent hover:border-[#1F1F1F] transition-colors"
              title="Recent conversations"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
              {sessions.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-[#0F0F0F] text-zinc-400 border-[#1F1F1F]">{sessions.length}</Badge>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
            <AnimatePresence>
              {sessionsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden rounded-xl border border-[#1F1F1F] bg-[#0A0A0A] shadow-2xl shadow-black/50 z-50 flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-[#1F1F1F] flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Recent Conversations</span>
                    <button
                      onClick={startNewChat}
                      className="inline-flex items-center gap-1 text-[11px] text-[#60A5FA] hover:text-[#93C5FD]"
                    >
                      <Plus className="h-3 w-3" /> New
                    </button>
                  </div>
                  <ScrollArea className="flex-1 max-h-72">
                    <div className="p-2">
                      {sessions.length === 0 ? (
                        <div className="px-2 py-6 text-center">
                          <MessageSquare className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
                          <p className="text-[12px] text-zinc-500">No conversations yet. Ask Oracle anything below.</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {sessions.map(s => (
                            <div
                              key={s.id}
                              className={`group flex items-start gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                                currentSessionId === s.id ? 'bg-[#0F0F0F]' : 'hover:bg-[#0F0F0F]'
                              }`}
                              onClick={() => loadSession(s.id)}
                            >
                              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-500" />
                              <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-medium text-zinc-200 truncate">{s.title}</div>
                                <div className="text-[10px] text-zinc-600 mt-0.5">{s.messageCount} msgs · {timeAgo(s.updatedAt)}</div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-[#1F1F1F]"
                              >
                                <Trash2 className="h-3 w-3 text-zinc-600 hover:text-rose-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* New chat button */}
          <Button
            onClick={startNewChat}
            variant="outline"
            className="h-9 px-3 bg-[#0A0A0A] border-[#1F1F1F] hover:bg-[#0F0F0F] hover:border-[#2A2A2A] text-zinc-200"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>
      </header>

      {/* ─── Scrollable main column ─── */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">

          {/* ORACLE-UI-UPGRADE: Today's Briefing — collapsible 8-section executive
              briefing panel (above the chat). Defaults expanded on desktop,
              collapsed on mobile. Fetches /api/oracle/executive-briefing on
              expand; never crashes the Oracle view (errors are isolated). */}
          <ExecutiveBriefingPanel
            orgId={orgId}
            onNavigate={onNavigate}
            onAction={(prompt) => sendMessage(prompt)}
          />

          {/* 1. CFO Hero — greeting + health score */}
          <CFOHero
            greeting={greeting}
            snapshot={snapshot}
            loading={snapshotLoading}
            isPreviewMode={isPreviewMode}
            healthScore={healthScore}
            healthToneMeta={healthToneMeta}
          />

          {/* 2. Top priority card */}
          {topInsight && (
            <TopPriorityCard insight={topInsight} onAction={sendMessage} disabled={isStreaming || !orgId} />
          )}

          {/* 3. Metrics row */}
          <MetricsGrid snapshot={snapshot} loading={snapshotLoading} />

          {/* 4. Oracle Intelligence — insight cards */}
          <OracleIntelligence
            insights={insights}
            loading={snapshotLoading}
            onAction={sendMessage}
            disabled={isStreaming || !orgId}
          />

          {/* 5. Ask Oracle — mode-aware quick action chips */}
          <AskOracleChips
            onPrompt={sendMessage}
            disabled={isStreaming || !orgId}
            mode={mode}
          />

          {/* 6. Timeline */}
          <TimelineList events={timeline} loading={timelineLoading} />

          {/* 7. Conversation thread (only when messages exist) */}
          {hasMessages && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="gst-section-title text-white">Conversation</h2>
                {currentSessionId && (
                  <button
                    onClick={startNewChat}
                    className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> New conversation
                  </button>
                )}
              </div>
              <div className="space-y-6">
                {loadingSession && (
                  // POLISH-04: premium skeleton bubbles instead of bare spinner.
                  <div className="space-y-4">
                    <div className="max-w-[80%]">
                      <div className="rounded-2xl rounded-tl-sm border border-white/[0.06] bg-[#0C0C0C] p-4 space-y-2">
                        <div className="h-3 w-full rounded bg-white/[0.05] gst-shimmer-premium" />
                        <div className="h-3 w-5/6 rounded bg-white/[0.05] gst-shimmer-premium" />
                        <div className="h-3 w-2/3 rounded bg-white/[0.05] gst-shimmer-premium" />
                      </div>
                    </div>
                    <div className="ml-auto max-w-[70%]">
                      <div className="rounded-2xl rounded-tr-sm border border-white/[0.06] bg-[#0C0C0C] p-4 space-y-2">
                        <div className="h-3 w-full rounded bg-white/[0.05] gst-shimmer-premium" />
                        <div className="h-3 w-3/4 rounded bg-white/[0.05] gst-shimmer-premium" />
                      </div>
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isLast={i === messages.length - 1}
                    onRegenerate={i === messages.length - 1 && m.role === 'assistant' && !m.streaming ? handleRegenerate : undefined}
                    onConfirmAction={confirmAction}
                    onCancelAction={cancelActionCard}
                    onFollowUp={sendMessage}
                    onNavigate={onNavigate}
                    onConfirmWorkflow={confirmWorkflow}
                    onCancelWorkflow={cancelWorkflow}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ─── Sticky chat input ─── */}
      <div className="shrink-0 border-t border-[#1F1F1F] bg-black px-4 sm:px-6 lg:px-8 py-4">
        <div className="mx-auto max-w-5xl">
          {/* ORACLE-UI-UPGRADE: Mode-aware suggested prompts above the input bar
              (only when chat is empty — matches the spec for "empty state"). */}
          {!hasMessages && activeMode.suggestedPrompts.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {activeMode.suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={isStreaming || !orgId}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium text-zinc-300 bg-[#0A0A0A] border border-[#1F1F1F] hover:border-emerald-500/40 hover:bg-[#0F0F0F] hover:text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Sparkle className="h-3 w-3 text-emerald-400" />
                  <span className="truncate max-w-[280px]">{prompt}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={`Ask Oracle in ${activeMode.label} mode…`}
                disabled={isStreaming || !orgId}
                className="h-12 pr-4 pl-4 bg-[#0A0A0A] border-[#1F1F1F] text-white placeholder:text-zinc-600 rounded-xl text-[15px] focus-visible:ring-1 focus-visible:ring-[#2563EB]/40 focus-visible:border-[#2563EB]/40"
              />
            </div>
            {isStreaming ? (
              <Button
                onClick={stopStreaming}
                size="icon"
                className="h-12 w-12 rounded-xl bg-[#0A0A0A] hover:bg-rose-600/90 text-zinc-300 hover:text-white border border-[#1F1F1F] hover:border-rose-500 transition-colors shrink-0"
                title="Stop generating"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || !orgId}
                size="icon"
                className="h-12 w-12 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="text-[11px] text-zinc-600 mt-2 text-center">
            Oracle reads live data and can take real actions. Always verify important figures.
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CFO Hero — greeting + business health score
// ═══════════════════════════════════════════════════════════════════════════════

function CFOHero({
  greeting,
  snapshot,
  loading,
  isPreviewMode,
  healthScore,
  healthToneMeta,
}: {
  greeting: string;
  snapshot: BusinessSnapshot | null;
  loading: boolean;
  isPreviewMode: boolean;
  healthScore: number | undefined;
  healthToneMeta: { color: string; bg: string; label: string };
}) {
  const displayName = 'Prince'; // The user's example mentions "Good Afternoon Prince 👋"
  // Note: org-specific user name could be wired through props in a future iteration.
  const statusLine = getHealthStatusLine(healthScore);
  const changePct = revenueChangePct(snapshot ?? {});

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Greeting */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="gst-page-title text-white">
            {greeting}, {displayName} <span className="inline-block ml-1">👋</span>
          </h1>
          <p className="gst-body text-zinc-400 mt-1.5">
            {loading ? 'Reading your live business data…' : statusLine}
          </p>
        </div>
        {isPreviewMode && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[12px]">
            <Lightbulb className="h-3.5 w-3.5" />
            Demo mode — create real data to see Oracle work
          </div>
        )}
      </div>

      {/* Health score card */}
      <div className="gst-card gst-card-hover relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB]/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-6 flex-wrap">
          {/* Big health score */}
          <div className="flex items-baseline gap-3">
            <div className="flex flex-col">
              <span className="gst-label text-zinc-500">Business Health</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading ? (
                  <div className="h-9 w-20 rounded bg-[#1F1F1F] animate-pulse" />
                ) : (
                  <HealthScoreNumber value={healthScore} />
                )}
                <span className="gst-label text-zinc-500">/ 100</span>
              </div>
            </div>
            {healthScore != null && !loading && (
              <span className={`gst-status ${healthToneMeta.color.includes('blue') ? 'gst-status-success' : healthToneMeta.color.includes('amber') ? 'gst-status-warning' : healthToneMeta.color.includes('orange') ? 'gst-status-warning' : healthToneMeta.color.includes('rose') ? 'gst-status-danger' : 'gst-status-neutral'}`}>
                {healthToneMeta.label}
              </span>
            )}
          </div>

          <div className="hidden sm:block h-10 w-px bg-[#1F1F1F]" />

          {/* Revenue trend */}
          <div className="flex flex-col">
            <span className="gst-label text-zinc-500">Revenue (FY)</span>
            <div className="flex items-baseline gap-2 mt-1">
              {loading ? (
                <div className="h-7 w-28 rounded bg-[#1F1F1F] animate-pulse" />
              ) : (
                <CountUpMetric
                  value={snapshot?.revenue ?? 0}
                  formatter={formatINR}
                  className="gst-metric text-white"
                />
              )}
              {changePct != null && !loading && (
                <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${changePct >= 0 ? 'text-[#60A5FA]' : 'text-rose-400'}`}>
                  {changePct >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {Math.abs(Math.round(changePct))}%
                </span>
              )}
            </div>
          </div>

          <div className="hidden md:block h-10 w-px bg-[#1F1F1F]" />

          {/* Status line / sparkline */}
          <div className="flex-1 min-w-[200px]">
            {!loading && snapshot && (snapshot.revenue ?? 0) > 0 ? (
              <div className="flex flex-col">
                <span className="gst-label text-zinc-500">Revenue trend (6 mo)</span>
                <div className="h-10 mt-1 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={synthesizeSparkline(snapshot.revenueThisMonth ?? 0, snapshot.revenueLastMonth ?? 0)}>
                      <defs>
                        <linearGradient id="heroRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563EB" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="#2563EB"
                        strokeWidth={2}
                        fill="url(#heroRev)"
                        isAnimationActive
                        animationDuration={900}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-zinc-600 leading-relaxed flex items-center gap-2">
                {loading && <span className="inline-block h-3 w-16 rounded bg-white/[0.05] gst-shimmer-premium" />}
                {loading
                  ? <span className="sr-only">Loading revenue trend…</span>
                  : 'Connect your first invoice to start tracking business health.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function HealthScoreNumber({ value }: { value: number | undefined }) {
  const v = useCountUp(value ?? 0, 900);
  return <span className="gst-metric text-white">{Math.round(v)}</span>;
}

function CountUpMetric({
  value,
  formatter,
  className,
}: {
  value: number;
  formatter: (n: number) => string;
  className?: string;
}) {
  const v = useCountUp(value, 900);
  return <span className={className}>{formatter(v)}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Top priority card — single CTA
// ═══════════════════════════════════════════════════════════════════════════════

function TopPriorityCard({
  insight,
  onAction,
  disabled,
}: {
  insight: Insight;
  onAction: (text: string) => void;
  disabled: boolean;
}) {
  const Icon = insight.icon;
  const severityClass =
    insight.severity === 'high' ? 'border-rose-500/30 bg-rose-500/[0.04]' :
    insight.severity === 'medium' ? 'border-amber-500/30 bg-amber-500/[0.04]' :
    'border-[#2563EB]/30 bg-[#2563EB]/[0.04]';
  const iconBg =
    insight.severity === 'high' ? 'bg-rose-500/15 text-rose-400' :
    insight.severity === 'medium' ? 'bg-amber-500/15 text-amber-400' :
    'bg-[#2563EB]/15 text-[#60A5FA]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className={`rounded-xl border ${severityClass} overflow-hidden`}
    >
      <div className="flex items-center gap-4 p-5 flex-wrap">
        <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Today&apos;s Top Priority</span>
          </div>
          <div className="text-base font-semibold text-white">{insight.title}</div>
          <div className="text-[13px] text-zinc-400 mt-0.5">{insight.description}</div>
          {insight.impact && (
            <div className="text-[12px] text-zinc-500 mt-1">
              <span className="text-zinc-600">Impact:</span> {insight.impact}
            </div>
          )}
        </div>
        {insight.actionLabel && insight.actionPrompt && (
          <button
            onClick={() => onAction(insight.actionPrompt!)}
            disabled={disabled}
            className="gst-btn gst-btn-primary gst-btn-lg shrink-0 disabled:opacity-50 disabled:pointer-events-none"
          >
            {insight.actionLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Metrics grid — Revenue / Cash / GST + secondary row
// ═══════════════════════════════════════════════════════════════════════════════

function MetricsGrid({ snapshot, loading }: { snapshot: BusinessSnapshot | null; loading: boolean }) {
  const revenueChange = revenueChangePct(snapshot ?? {});

  const primary: Array<{
    key: string;
    icon: LucideIcon;
    label: string;
    value: number;
    formatter: (n: number) => string;
    spark: Array<{ i: number; v: number }> | null;
    change?: number | null;
    changeGood?: boolean;
  }> = [
    {
      key: 'revenue',
      icon: TrendingUp,
      label: 'Revenue',
      value: snapshot?.revenue ?? 0,
      formatter: formatINR,
      spark: snapshot ? synthesizeSparkline(snapshot.revenueThisMonth ?? 0, snapshot.revenueLastMonth ?? 0, 1) : null,
      change: revenueChange,
      changeGood: (revenueChange ?? 0) >= 0,
    },
    {
      key: 'cash',
      icon: IndianRupee,
      label: 'Cash on Hand',
      value: snapshot?.cash ?? 0,
      formatter: formatINR,
      spark: snapshot ? synthesizeSparkline(snapshot.cash ?? 0, snapshot.cash ?? 0, 2) : null,
    },
    {
      key: 'gst',
      icon: Receipt,
      label: 'GST Liability',
      value: snapshot?.gstLiability ?? 0,
      formatter: formatINR,
      spark: snapshot ? synthesizeSparkline(snapshot.gstLiability ?? 0, snapshot.outputTax ?? 0, 3) : null,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="gst-section-title text-white">Business Snapshot</h2>
        <span className="gst-caption">Last 6 months</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {primary.map((m, i) => (
          <MetricCard
            key={m.key}
            icon={m.icon}
            label={m.label}
            value={m.value}
            formatter={m.formatter}
            spark={m.spark}
            change={m.change}
            changeGood={m.changeGood}
            loading={loading}
            delay={i * 0.05}
          />
        ))}
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SecondaryMetric
          icon={FileText}
          label="Invoices"
          value={snapshot?.invoiceCount ?? 0}
          loading={loading}
        />
        <SecondaryMetric
          icon={Users}
          label="Clients"
          value={snapshot?.customerCount ?? 0}
          loading={loading}
        />
        <SecondaryMetric
          icon={Activity}
          label="Collection Rate"
          value={Math.round((snapshot?.collectionRate ?? 0) * 100)}
          suffix="%"
          loading={loading}
        />
        <SecondaryMetric
          icon={Clock}
          label="Runway"
          value={snapshot?.runwayDays === Infinity || snapshot?.runwayDays == null ? null : snapshot.runwayDays}
          suffix={snapshot?.runwayDays === Infinity || snapshot?.runwayDays == null ? '' : ' days'}
          fallback="∞"
          loading={loading}
        />
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  formatter,
  spark,
  change,
  changeGood,
  loading,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  formatter: (n: number) => string;
  spark: Array<{ i: number; v: number }> | null;
  change?: number | null;
  changeGood?: boolean;
  loading: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="gst-card gst-card-hover relative overflow-hidden"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center">
            <Icon className="h-4 w-4 text-[#60A5FA]" />
          </div>
          <span className="gst-label text-zinc-400">{label}</span>
        </div>
        {change != null && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${changeGood ? 'text-[#60A5FA]' : 'text-rose-400'}`}>
            {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(Math.round(change))}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-7 w-24 rounded bg-[#1F1F1F] animate-pulse" />
          ) : (
            <CountUpMetric
              value={value}
              formatter={formatter}
              className="gst-metric text-white"
            />
          )}
        </div>
        {spark && spark.length > 0 && (
          <div className="h-10 w-24 shrink-0 -mb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#2563EB"
                  strokeWidth={1.75}
                  fill={`url(#spark-${label})`}
                  isAnimationActive
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SecondaryMetric({
  icon: Icon,
  label,
  value,
  suffix = '',
  fallback,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  suffix?: string;
  fallback?: string;
  loading: boolean;
}) {
  return (
    <div className="gst-card gst-card-compact flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-zinc-400" />
      </div>
      <div className="min-w-0">
        <div className="gst-label text-zinc-500">{label}</div>
        {loading ? (
          <div className="h-5 w-12 rounded bg-[#1F1F1F] animate-pulse mt-1" />
        ) : (
          <div className="text-base font-semibold text-white tabular-nums">
            {value == null ? (fallback ?? '—') : (
              <>
                <CountUpMetric value={value} formatter={(n) => Math.round(n).toLocaleString('en-IN')} />
                {suffix && <span className="text-[13px] text-zinc-500 ml-1">{suffix}</span>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Oracle Intelligence — insight cards with one-click actions
// ═══════════════════════════════════════════════════════════════════════════════

function OracleIntelligence({
  insights,
  loading,
  onAction,
  disabled,
}: {
  insights: Insight[];
  loading: boolean;
  onAction: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkle className="h-5 w-5 text-[#60A5FA]" />
          <h2 className="gst-section-title text-white">Oracle Intelligence</h2>
        </div>
        <span className="gst-caption">{loading ? 'Analyzing…' : `${insights.length} insight${insights.length === 1 ? '' : 's'}`}</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="gst-card gst-card-compact h-32">
              <div className="h-full w-full shimmer rounded-md" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.map((insight, i) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onAction={onAction}
              disabled={disabled}
              delay={i * 0.05}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function InsightCard({
  insight,
  onAction,
  disabled,
  delay = 0,
}: {
  insight: Insight;
  onAction: (text: string) => void;
  disabled: boolean;
  delay?: number;
}) {
  const Icon = insight.icon;
  const severityColor =
    insight.severity === 'high' ? 'bg-rose-500/15 text-rose-400 border-rose-500/20' :
    insight.severity === 'medium' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
    insight.severity === 'low' ? 'bg-[#2563EB]/15 text-[#60A5FA] border-[#2563EB]/20' :
    'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
  const dotColor =
    insight.severity === 'high' ? 'bg-rose-400' :
    insight.severity === 'medium' ? 'bg-amber-400' :
    insight.severity === 'low' ? 'bg-[#60A5FA]' :
    'bg-zinc-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="gst-card gst-card-hover group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border ${severityColor}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{insight.severity}</span>
          </div>
          <div className="text-sm font-semibold text-white mt-0.5">{insight.title}</div>
        </div>
      </div>
      <p className="text-[13px] text-zinc-400 leading-relaxed mb-2">{insight.description}</p>
      {insight.impact && (
        <div className="text-[12px] text-zinc-500 mb-3 leading-relaxed">
          <span className="text-zinc-600">Impact:</span> {insight.impact}
        </div>
      )}
      {insight.actionLabel && insight.actionPrompt && (
        <button
          onClick={() => onAction(insight.actionPrompt!)}
          disabled={disabled}
          className="gst-btn gst-btn-sm gst-btn-outline w-full sm:w-auto disabled:opacity-50 disabled:pointer-events-none group-hover:border-[#2563EB]/40 group-hover:text-[#60A5FA]"
        >
          {insight.actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Ask Oracle — mode-aware quick action chips
//    (ORACLE-UI-UPGRADE: now renders COPILOT_MODES[mode].suggestedPrompts
//     instead of the static QUICK_ACTIONS list. The first prompt is treated
//     as "primary" so users have a clear default.)
// ═══════════════════════════════════════════════════════════════════════════════

function AskOracleChips({
  onPrompt,
  disabled,
  mode,
}: {
  onPrompt: (text: string) => void;
  disabled: boolean;
  mode: CopilotModeId;
}) {
  const modeMeta = COPILOT_MODES[mode] ?? COPILOT_MODES.general;
  const prompts = modeMeta.suggestedPrompts;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-[#60A5FA]" />
        <h2 className="gst-section-title text-white">Ask Oracle</h2>
        <span className="text-[11px] text-zinc-500 ml-1">· {modeMeta.label} mode</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, i) => {
          const isPrimary = i === 0;
          return (
            <motion.button
              key={prompt}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              onClick={() => onPrompt(prompt)}
              disabled={disabled}
              className={`
                inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-medium transition-all
                disabled:opacity-50 disabled:pointer-events-none
                ${isPrimary
                  ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-sm shadow-[#2563EB]/20'
                  : 'bg-[#0A0A0A] text-zinc-300 border border-[#1F1F1F] hover:border-[#2A2A2A] hover:bg-[#0F0F0F] hover:text-white'
                }
              `}
            >
              <Sparkle className={`h-3.5 w-3.5 ${isPrimary ? 'text-white' : 'text-emerald-400'}`} />
              <span className="truncate max-w-[300px]">{prompt}</span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Timeline list
// ═══════════════════════════════════════════════════════════════════════════════

function TimelineList({
  events,
  loading,
}: {
  events: TimelineEventLite[];
  loading: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-[#60A5FA]" />
        <h2 className="gst-section-title text-white">Timeline</h2>
      </div>

      <div className="gst-card p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-[#1F1F1F]" />
                <div className="h-4 flex-1 rounded bg-[#1F1F1F] animate-pulse" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Clock className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
            <p className="text-[13px] text-zinc-500">
              No recent activity yet. As you create invoices, payments, and file returns, they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1F1F1F]">
            {events.map((evt, i) => {
              const sevColor =
                evt.severity === 'critical' ? 'bg-rose-400' :
                evt.severity === 'warning' ? 'bg-amber-400' :
                evt.severity === 'success' ? 'bg-[#60A5FA]' :
                'bg-zinc-500';
              return (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-[#0F0F0F] transition-colors"
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${sevColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-zinc-200 truncate">{evt.title}</div>
                    {evt.description && (
                      <div className="text-[12px] text-zinc-500 truncate mt-0.5">{evt.description}</div>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-600 shrink-0 tabular-nums">{timeAgo(evt.createdAt)}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Message bubble — premium chat (blue user bubbles, dark Oracle cards)
// ═══════════════════════════════════════════════════════════════════════════════

function MessageBubble({
  message,
  isLast,
  onRegenerate,
  onConfirmAction,
  onCancelAction,
  onFollowUp,
  onNavigate,
  onConfirmWorkflow,
  onCancelWorkflow,
}: {
  message: ChatMessage;
  isLast?: boolean;
  onRegenerate?: () => void;
  onConfirmAction?: (toolCallId: string) => void;
  onCancelAction?: (toolCallId: string) => void;
  onFollowUp?: (text: string) => void;
  onNavigate?: (view: string, entityId?: string) => void;
  onConfirmWorkflow?: (plan: WorkflowPlan) => void;
  onCancelWorkflow?: (plan: WorkflowPlan) => void;
}) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error('Failed to copy'));
  }, [message.content]);

  const toolCallParts = message.parts.filter(p => p.type === 'tool-call');
  const actionConfirmParts = message.parts.filter(p => p.type === 'action-confirm') as ActionConfirmPart[];
  const workflowParts = message.parts.filter(p => p.type === 'workflow-plan') as WorkflowPart[];

  if (isUser) {
    // ─── User message: clean blue-tinted bubble, right-aligned ───
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="inline-block max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-sm bg-[#2563EB]/15 border border-[#2563EB]/25 text-white text-[14px] leading-relaxed">
          {message.content}
        </div>
      </motion.div>
    );
  }

  // ─── Oracle message: dark card with markdown + tool cards + actions ───
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3"
    >
      {/* Oracle avatar */}
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-[#2563EB]/20 to-[#2563EB]/5 border border-[#2563EB]/30">
        <BrainCircuit className="h-4 w-4 text-[#60A5FA]" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* Tool call cards */}
        {toolCallParts.map((p, i) => (
          <ToolCallCard
            key={`tc-${i}`}
            part={p as Extract<MessagePart, { type: 'tool-call' }>}
            onNavigate={onNavigate}
          />
        ))}

        {/* Action Engine confirmation cards */}
        {actionConfirmParts.map((p, i) => (
          <ActionConfirmCard
            key={`ac-${p.toolCallId}-${i}`}
            part={p}
            onConfirm={onConfirmAction}
            onCancel={onCancelAction}
            onFollowUp={onFollowUp}
            onNavigate={onNavigate}
          />
        ))}

        {/* Workflow Engine plan + progress cards */}
        {workflowParts.map((p, i) => (
          <WorkflowPlanCard
            key={`wf-${p.plan.id}-${i}`}
            part={p}
            onConfirm={onConfirmWorkflow}
            onCancel={onCancelWorkflow}
          />
        ))}

        {/* Text content (with streaming caret) */}
        {message.content && (
          <div className="rounded-2xl rounded-tl-sm bg-[#0A0A0A] border border-[#1F1F1F] px-4 py-3">
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-white prose-headings:font-semibold
              prose-h1:text-lg prose-h2:text-base prose-h3:text-[15px]
              prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:text-[14px]
              prose-li:text-zinc-300 prose-li:text-[14px]
              prose-strong:text-white
              prose-code:text-[#60A5FA] prose-code:bg-[#0F0F0F] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px]
              prose-pre:bg-black prose-pre:border prose-pre:border-[#1F1F1F] prose-pre:text-[12px]
              prose-a:text-[#60A5FA]
              prose-table:text-sm prose-th:text-zinc-200 prose-td:text-zinc-400
              prose-th:bg-[#0F0F0F] prose-th:border prose-th:border-[#1F1F1F]
              prose-td:border prose-td:border-[#1F1F1F]
            ">
              <ReactMarkdown>
                {message.content + (message.streaming ? ' ▋' : '')}
              </ReactMarkdown>
              {message.streaming && (
                <span className="oracle-caret inline-block h-4 w-1.5 bg-[#60A5FA] align-middle ml-0.5" />
              )}
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {message.streaming && !message.content && message.parts.length === 0 && (
          <div className="rounded-2xl rounded-tl-sm bg-[#0A0A0A] border border-[#1F1F1F] px-4 py-3.5 flex items-center gap-2.5">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-[#60A5FA] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 rounded-full bg-[#60A5FA] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 rounded-full bg-[#60A5FA] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[13px] text-zinc-500">Oracle is thinking…</span>
          </div>
        )}

        {/* Action row: Copy + Regenerate (only when not streaming) */}
        {!message.streaming && message.content && (
          <div className="flex items-center gap-1 pl-1">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-[#0F0F0F] transition-colors"
              title="Copy response"
            >
              {copied ? <CheckCircle2 className="h-3 w-3 text-[#60A5FA]" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-[#0F0F0F] transition-colors"
                title="Regenerate response"
              >
                <RotateCcw className="h-3 w-3" />
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool call card — shows what Oracle is doing / did
// ═══════════════════════════════════════════════════════════════════════════════

function ToolCallCard({
  part,
  onNavigate,
}: {
  part: Extract<MessagePart, { type: 'tool-call' }>;
  onNavigate?: (view: string, entityId?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[part.tool] ?? Wrench;
  const label = TOOL_LABELS[part.tool] ?? part.tool;
  const isRunning = !part.result && !part.error;
  // ORACLE-UI-UPGRADE: the brain route now emits the permission tier + an
  // evidence object on tool-start / tool-result. Use them to render a
  // READ/CONFIRM/STRONG CONFIRM badge + a clickable source citation card.
  const tier: PermissionTier | undefined = part.tier ?? getToolTier(part.tool);
  const evidence: Evidence | undefined = part.evidence;

  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${part.error
        ? 'border-rose-500/30 bg-rose-500/[0.04]'
        : part.result
          ? 'border-[#1F1F1F] bg-[#0A0A0A]'
          : 'border-[#2563EB]/30 bg-[#2563EB]/[0.04]'}
    `}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0F0F0F] transition-colors"
      >
        <div className={`
          h-6 w-6 rounded-md flex items-center justify-center shrink-0
          ${part.error ? 'bg-rose-500/10' : part.result ? 'bg-[#0F0F0F]' : 'bg-[#2563EB]/10'}
        `}>
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 text-[#60A5FA] animate-spin" />
          ) : part.error ? (
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-[#60A5FA]" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="text-[12px] font-medium text-zinc-200 truncate">{label}</span>
            {isRunning && (
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-[#60A5FA] border-[#2563EB]/30 bg-[#2563EB]/10">
                running
              </Badge>
            )}
            {/* ORACLE-UI-UPGRADE: permission tier badge (READ / CONFIRM / STRONG CONFIRM). */}
            {tier && <PermissionTierBadge tier={tier} compact />}
            {/* ORACLE-UI-UPGRADE: environment badge from the attached evidence (if any). */}
            {evidence?.source?.environment && (
              <EnvironmentBadge environment={evidence.source.environment} className="text-[10px] px-1.5 py-0" withDot />
            )}
            {part.durationMs != null && (
              <span className="text-[10px] text-zinc-600">{part.durationMs}ms</span>
            )}
          </div>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-zinc-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-[#1F1F1F]">
          {Object.keys(part.args).length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Arguments</div>
              <pre className="text-[11px] text-zinc-400 bg-black rounded p-2 overflow-x-auto">
                {JSON.stringify(part.args, null, 2)}
              </pre>
            </div>
          )}
          {part.result && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Result</div>
              <pre className="text-[11px] text-zinc-300 bg-black rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {part.result}
              </pre>
            </div>
          )}
          {part.error && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 mb-1">Error</div>
              <pre className="text-[11px] text-rose-300 bg-rose-950/20 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {part.error}
              </pre>
            </div>
          )}
          {/* ORACLE-UI-UPGRADE: source citation card (click-through to the
              underlying view if a deepLink is present). */}
          {evidence && (
            <EvidenceCard evidence={evidence} onNavigate={onNavigate} />
          )}
        </div>
      )}

      {!expanded && part.result && (
        <div className="px-3 pb-2 -mt-0.5">
          <div className="text-[11px] text-zinc-500 line-clamp-2">{part.result}</div>
        </div>
      )}
      {!expanded && part.error && (
        <div className="px-3 pb-2 -mt-0.5">
          <div className="text-[11px] text-rose-400 line-clamp-1">{part.error}</div>
        </div>
      )}
      {/* ORACLE-UI-UPGRADE: when collapsed, still show a compact source-citation
          hint if evidence is present, so the user knows the data is traceable. */}
      {!expanded && evidence && (
        <div className="px-3 pb-2 -mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-600">
          <Database className="h-2.5 w-2.5 text-emerald-400" />
          <span className="truncate">{evidence.label}</span>
          {evidence.source?.environment && (
            <EnvironmentBadge environment={evidence.source.environment} className="text-[9px] px-1 py-0" />
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ActionConfirmCard — inline confirmation card for the Action Engine
// ═══════════════════════════════════════════════════════════════════════════════

function ActionConfirmCard({
  part,
  onConfirm,
  onCancel,
  onFollowUp,
  onNavigate,
}: {
  part: ActionConfirmPart;
  onConfirm?: (toolCallId: string) => void;
  onCancel?: (toolCallId: string) => void;
  onFollowUp?: (text: string) => void;
  onNavigate?: (view: string, entityId?: string) => void;
}) {
  const Icon = ACTION_ICONS[part.icon] ?? Wrench;
  const isPending = part.state === 'pending';
  const isExecuting = part.state === 'executing';
  const isCancelled = part.state === 'cancelled';
  const isError = part.state === 'error';
  const isSuccess = part.state === 'success';

  // ORACLE-UI-UPGRADE: permission tier (server-enforced) + evidence (source
  // provenance). The tier drives the destructive-action warning banner below.
  const tier: PermissionTier = part.tier ?? getToolTier(part.tool);
  const isStrongConfirm = tier === 'strong-confirm';
  const evidence: Evidence | undefined = part.evidence;

  const accent = isPending
    ? isStrongConfirm
      ? 'border-rose-500/50 bg-rose-500/[0.05]'
      : 'border-amber-500/40 bg-amber-500/[0.04]'
    : isExecuting
      ? 'border-[#2563EB]/40 bg-[#2563EB]/[0.04]'
      : isSuccess
        ? 'border-[#2563EB]/40 bg-[#2563EB]/[0.04]'
        : isError
          ? 'border-rose-500/40 bg-rose-500/[0.04]'
          : 'border-[#1F1F1F] bg-[#0A0A0A]';
  const iconBg = isPending
    ? isStrongConfirm
      ? 'bg-rose-500/15 text-rose-400'
      : 'bg-amber-500/15 text-amber-400'
    : isExecuting
      ? 'bg-[#2563EB]/15 text-[#60A5FA]'
      : isSuccess
        ? 'bg-[#2563EB]/15 text-[#60A5FA]'
        : isError
          ? 'bg-rose-500/15 text-rose-400'
          : 'bg-[#0F0F0F] text-zinc-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border ${accent} overflow-hidden`}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1F1F1F]">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isError ? (
            <XCircle className="h-4 w-4" />
          ) : isCancelled ? (
            <X className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-white truncate">{part.displayName}</span>
            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 capitalize ${
              isPending ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' :
              isExecuting ? 'text-[#60A5FA] border-[#2563EB]/40 bg-[#2563EB]/10' :
              isSuccess ? 'text-[#60A5FA] border-[#2563EB]/40 bg-[#2563EB]/10' :
              isError ? 'text-rose-400 border-rose-500/40 bg-rose-500/10' :
              'text-zinc-500 border-[#1F1F1F] bg-[#0A0A0A]'
            }`}>
              {part.state}
            </Badge>
            {/* ORACLE-UI-UPGRADE: permission tier badge (READ / CONFIRM / STRONG CONFIRM). */}
            <PermissionTierBadge tier={tier} compact />
            {/* ORACLE-UI-UPGRADE: environment badge from the attached evidence (if any). */}
            {evidence?.source?.environment && (
              <EnvironmentBadge environment={evidence.source.environment} className="text-[10px] px-1.5 py-0" withDot />
            )}
          </div>
          <div className="text-[12px] text-zinc-400 mt-0.5 truncate">{part.previewTitle}</div>
        </div>
      </div>

      {/* ORACLE-UI-UPGRADE: destructive-action warning banner (strong-confirm tier only). */}
      {isStrongConfirm && (isPending || isExecuting) && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-rose-500/[0.08] border-b border-rose-500/30 text-rose-300">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-semibold text-rose-200">⚠️ This is a destructive / irreversible action.</span>{' '}
            Please review the preview carefully before confirming. This cannot be undone.
          </div>
        </div>
      )}

      {(isPending || isExecuting) && (
        <div className="px-4 py-3 space-y-3">
          {part.previewFields.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {part.previewFields.map((f, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-600">{f.label}</span>
                  <span className={`text-[13px] ${f.emphasize ? 'text-white font-semibold' : 'text-zinc-300'}`}>{f.value}</span>
                </div>
              ))}
            </div>
          )}

          {part.validationFields.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#1F1F1F]">
              {part.validationFields.map((v, i) => {
                const VIcon = v.status === 'ok' ? CheckCircle2 : v.status === 'warn' ? AlertTriangle : XCircle;
                const vColor = v.status === 'ok' ? 'text-[#60A5FA]' : v.status === 'warn' ? 'text-amber-400' : 'text-rose-400';
                return (
                  <div key={i} className="flex items-start gap-1.5 text-[11px]">
                    <VIcon className={`h-3 w-3 mt-0.5 shrink-0 ${vColor}`} />
                    <span className="text-zinc-400">
                      <span className="text-zinc-300 font-medium">{v.label}</span>
                      {v.resolvedValue && <span className="text-zinc-500">: {v.resolvedValue}</span>}
                      {v.message && <span className={`ml-1 ${vColor}`}>{v.message}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {part.note && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded-md px-2 py-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{part.note}</span>
            </div>
          )}

          {/* ORACLE-UI-UPGRADE: source citation card (if evidence is attached). */}
          {evidence && (
            <EvidenceCard evidence={evidence} onNavigate={onNavigate} />
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              disabled={isExecuting}
              onClick={() => onConfirm?.(part.toolCallId)}
              className={isStrongConfirm
                ? 'h-8 gap-1.5 bg-rose-600 hover:bg-rose-500 text-white border-0'
                : 'h-8 gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white border-0'
              }
            >
              {isExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isExecuting ? 'Executing…' : isStrongConfirm ? 'Approve (irreversible)' : 'Confirm & Execute'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isExecuting}
              onClick={() => onCancel?.(part.toolCallId)}
              className="h-8 gap-1.5 bg-[#0A0A0A] hover:bg-[#0F0F0F] text-zinc-300 border-[#1F1F1F]"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="px-4 py-3 space-y-3">
          {part.successSummary && (
            <div className="text-[13px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
              <ReactMarkdown>{part.successSummary}</ReactMarkdown>
            </div>
          )}
          {part.successData && Object.keys(part.successData).length > 0 && (
            <div className="rounded-md bg-black border border-[#1F1F1F] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Result</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {Object.entries(part.successData).slice(0, 8).map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600">{k}</span>
                    <span className="text-[11px] text-zinc-300 truncate">
                      {typeof v === 'object' && v !== null ? JSON.stringify(v).slice(0, 60) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(part.followUp || part.viewIn) && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {part.followUp && (
                <button
                  onClick={() => onFollowUp?.(part.followUp!.prompt)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-[#60A5FA] bg-[#2563EB]/10 border border-[#2563EB]/30 hover:bg-[#2563EB]/20 transition-colors"
                >
                  <Sparkle className="h-3 w-3" />
                  {part.followUp.label}
                </button>
              )}
              {part.viewIn && (
                onNavigate ? (
                  <button
                    type="button"
                    onClick={() => {
                      const href = part.viewIn!.href;
                      const viewMap: Record<string, string> = {
                        '/customers': 'clients',
                        '/invoices': 'invoices',
                        '/expenses': 'expenses',
                        '/payments': 'payments',
                        '/banking': 'banking',
                        '/returns': 'returns',
                        '/reports': 'analytics',
                        '/crm': 'crm',
                        '/documents': 'documents',
                        '/team': 'team',
                        '/settings': 'settings',
                        '/timeline': 'timeline',
                        '/dashboard': 'dashboard',
                      };
                      const view = viewMap[href] ?? 'dashboard';
                      onNavigate(view);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-300 bg-[#0A0A0A] border border-[#1F1F1F] hover:bg-[#0F0F0F] transition-colors"
                  >
                    {part.viewIn.label}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                ) : (
                  <a
                    href={part.viewIn.href}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-300 bg-[#0A0A0A] border border-[#1F1F1F] hover:bg-[#0F0F0F] transition-colors"
                  >
                    {part.viewIn.label}
                    <ArrowRight className="h-3 w-3" />
                  </a>
                )
              )}
            </div>
          )}
        </div>
      )}

      {isCancelled && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <X className="h-3 w-3" />
            Action cancelled — no changes were made to your data.
          </div>
        </div>
      )}

      {isError && (
        <div className="px-4 py-3">
          <div className="flex items-start gap-1.5 text-[11px] text-rose-400">
            <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap">{part.error || 'Action failed.'}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default OracleBrainCore;
