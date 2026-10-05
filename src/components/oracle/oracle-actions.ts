'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Action Engine Library (Phase 3 — Agent Engine™)
//
// Oracle does not just answer — it executes. Every response ends with 3 large
// glass Action Cards. Clicking a card spawns an Oracle Task that runs through
// a simulated execution lifecycle and is surfaced in the Agent Execution Panel.
//
// This module is the single source of truth for action metadata:
//   • Icon + tint (for cards & agent panel)
//   • Execution step templates (the timeline shown while running)
//   • Completion result templates
//   • Navigation target (AppView) on completion
//   • Estimated execution duration (ms) for the simulated progress
//
// NOTE: This module is client-safe (only pure data + lucide icons).
// ═══════════════════════════════════════════════════════════════════════════════

import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  FileText,
  FileCheck2,
  Landmark,
  ListChecks,
  Mail,
  MessageSquare,
  PiggyBank,
  Receipt,
  Send,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { OracleActionCard, OracleActionKind, OracleTaskStep } from './oracle-types';

// ─── Action Metadata ─────────────────────────────────────────────────────────

export interface ActionMeta {
  kind: OracleActionKind;
  /** Short label used in chips / fallback cards */
  label: string;
  /** Longer label for the action card */
  title: string;
  /** One-line description of what Oracle does */
  description: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Tailwind text color class, e.g. 'text-blue-500' */
  colorClass: string;
  /** Tailwind background tint class, e.g. 'bg-blue-500/[0.10]' */
  tintClass: string;
  /** Tailwind border tint class */
  borderClass: string;
  /** Navigation target (AppView) when the task completes */
  resultView?: string;
  /** Estimated execution duration in ms (simulated) */
  durationMs: number;
  /** Ordered execution steps — the timeline shown while running */
  steps: string[];
  /** Result template — {count} and {amount} are substituted at runtime */
  resultTemplate: string;
}

export const ACTION_LIBRARY: Record<OracleActionKind, ActionMeta> = {
  'generate-gst-return': {
    kind: 'generate-gst-return',
    label: 'Generate GST Return',
    title: 'Generate GST Return',
    description: 'Oracle prepares a GSTR-3B draft from your invoice + 2B data.',
    icon: FileCheck2,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'returns',
    durationMs: 5200,
    steps: [
      'Pulling sales register from invoices',
      'Fetching GSTR-2B from GSTN',
      'Computing output tax liability',
      'Matching ITC eligibility',
      'Applying late-fee + interest if overdue',
      'Compiling draft GSTR-3B',
    ],
    resultTemplate: 'GSTR-3B draft ready. Net liability ₹{amount}. Review and approve before submission.',
  },
  'create-report': {
    kind: 'create-report',
    label: 'Generate Report',
    title: 'Generate Report',
    description: 'Oracle compiles a CFO-grade business report from your live data.',
    icon: FileText,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'business-dna',
    durationMs: 4400,
    steps: [
      'Aggregating business KPIs',
      'Computing period-over-period deltas',
      'Benchmarking against industry',
      'Identifying top 3 risks',
      'Identifying top 3 opportunities',
      'Compiling PDF brief',
    ],
    resultTemplate: 'Report ready — {count} insights flagged across compliance, cash, and growth.',
  },
  'export-pdf': {
    kind: 'export-pdf',
    label: 'Export PDF',
    title: 'Export as PDF',
    description: 'Oracle exports the current analysis as a shareable PDF brief.',
    icon: FileText,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'business-dna',
    durationMs: 2600,
    steps: [
      'Rendering analysis to PDF',
      'Embedding charts',
      'Adding footer + page numbers',
    ],
    resultTemplate: 'PDF exported. {count} pages ready to share with your team or clients.',
  },
  'recover-collections': {
    kind: 'recover-collections',
    label: 'Recover Collections',
    title: 'Recover Collections',
    description: 'Oracle identifies overdue clients and drafts recovery outreach.',
    icon: PiggyBank,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'reconcile',
    durationMs: 4800,
    steps: [
      'Scanning invoice ledger for overdue',
      'Ranking clients by exposure',
      'Drafting WhatsApp + email copy',
      'Scheduling reminder cadence',
      'Preparing recovery dashboard',
    ],
    resultTemplate: '{count} overdue clients identified. Total exposure ₹{amount}. Outreach drafts ready.',
  },
  'create-reminder': {
    kind: 'create-reminder',
    label: 'Send Reminders',
    title: 'Send Reminders',
    description: 'Oracle schedules payment + filing reminders to at-risk clients.',
    icon: Bell,
    colorClass: 'text-amber-500',
    tintClass: 'bg-amber-500/[0.10]',
    borderClass: 'border-amber-500/25',
    resultView: 'autopilot',
    durationMs: 3000,
    steps: [
      'Selecting reminder recipients',
      'Composing reminder messages',
      'Scheduling send windows',
    ],
    resultTemplate: '{count} reminders scheduled across the next 7 days.',
  },
  'create-checklist': {
    kind: 'create-checklist',
    label: 'Create Checklist',
    title: 'Generate Compliance Checklist',
    description: 'Oracle builds a sequenced compliance checklist for the period.',
    icon: ListChecks,
    colorClass: 'text-amber-500',
    tintClass: 'bg-amber-500/[0.10]',
    borderClass: 'border-amber-500/25',
    resultView: 'autopilot',
    durationMs: 3400,
    steps: [
      'Scanning due-date calendar',
      'Sequencing filings by urgency',
      'Assigning owners',
      'Compiling checklist',
    ],
    resultTemplate: 'Compliance checklist ready — {count} items, sequenced by deadline.',
  },
  'open-analytics': {
    kind: 'open-analytics',
    label: 'Open Analytics',
    title: 'Open Analytics',
    description: 'Oracle opens the analytics dashboard with this view pre-filtered.',
    icon: BarChart3,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'business-dna',
    durationMs: 1600,
    steps: ['Loading analytics workspace', 'Applying filters'],
    resultTemplate: 'Analytics workspace loaded with the relevant view.',
  },
  'generate-forecast': {
    kind: 'generate-forecast',
    label: 'Forecast Revenue',
    title: 'Forecast Revenue',
    description: 'Oracle runs a 90-day revenue + cash forecast from your history.',
    icon: TrendingUp,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'ai-predictions',
    durationMs: 4200,
    steps: [
      'Loading 90-day history',
      'Detecting seasonality',
      'Running forecast model',
      'Computing confidence bands',
      'Compiling forecast brief',
    ],
    resultTemplate: 'Forecast ready — projected {amount} next month at 78% confidence.',
  },
  'prepare-reconciliation': {
    kind: 'prepare-reconciliation',
    label: 'Prepare Reconciliation',
    title: 'Prepare 2B Reconciliation',
    description: 'Oracle runs GSTR-2B vs books reconciliation and flags mismatches.',
    icon: Receipt,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'reconcile',
    durationMs: 4600,
    steps: [
      'Fetching GSTR-2B from GSTN',
      'Loading purchase register',
      'Matching invoice-by-invoice',
      'Classifying mismatches',
      'Computing ITC at risk',
    ],
    resultTemplate: 'Reconciliation complete — {count} mismatches, ₹{amount} ITC at risk.',
  },
  'create-notice': {
    kind: 'create-notice',
    label: 'Create Notice',
    title: 'Draft Compliance Notice',
    description: 'Oracle drafts a response to a GST notice or a demand letter.',
    icon: Landmark,
    colorClass: 'text-amber-500',
    tintClass: 'bg-amber-500/[0.10]',
    borderClass: 'border-amber-500/25',
    resultView: 'autopilot',
    durationMs: 3800,
    steps: [
      'Reading notice context',
      'Pulling relevant filings',
      'Drafting rebuttal / reply',
      'Compiling annexures',
    ],
    resultTemplate: 'Notice reply drafted. Review with your CA before signing.',
  },
  'cash-flow-forecast': {
    kind: 'cash-flow-forecast',
    label: 'Cash Flow Forecast',
    title: 'Generate Cash Flow Forecast',
    description: 'Oracle builds a 13-week cash flow forecast with stress scenarios.',
    icon: PiggyBank,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'ai-cfo',
    durationMs: 5000,
    steps: [
      'Loading bank + receivables data',
      'Projecting inflows',
      'Projecting outflows',
      'Stress-testing for 3 scenarios',
      'Flagging liquidity gaps',
    ],
    resultTemplate: '13-week cash forecast ready — runway {count} weeks under base case.',
  },
  'create-task': {
    kind: 'create-task',
    label: 'Create Task',
    title: 'Create Task',
    description: 'Oracle creates a follow-up task and assigns it to the right owner.',
    icon: CalendarClock,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'tasks',
    durationMs: 2000,
    steps: ['Composing task', 'Assigning owner', 'Setting due date'],
    resultTemplate: 'Task created and assigned. Due in {count} days.',
  },
  'open-reconcile': {
    kind: 'open-reconcile',
    label: 'Open Reconciliation',
    title: 'Open Reconciliation',
    description: 'Oracle opens the reconciliation workspace.',
    icon: Receipt,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'reconcile',
    durationMs: 1400,
    steps: ['Loading reconciliation workspace'],
    resultTemplate: 'Reconciliation workspace loaded.',
  },
  'open-returns': {
    kind: 'open-returns',
    label: 'Open Returns',
    title: 'Open Returns',
    description: 'Oracle opens the returns filing queue.',
    icon: FileCheck2,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'returns',
    durationMs: 1400,
    steps: ['Loading returns queue'],
    resultTemplate: 'Returns queue loaded.',
  },
  'open-invoices': {
    kind: 'open-invoices',
    label: 'Open Invoices',
    title: 'Open Invoices',
    description: 'Oracle opens the invoice ledger.',
    icon: Receipt,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'invoices',
    durationMs: 1400,
    steps: ['Loading invoice ledger'],
    resultTemplate: 'Invoice ledger loaded.',
  },
  'open-clients': {
    kind: 'open-clients',
    label: 'Open Clients',
    title: 'Open Clients',
    description: 'Oracle opens the client roster.',
    icon: MessageSquare,
    colorClass: 'text-blue-500',
    tintClass: 'bg-blue-500/[0.10]',
    borderClass: 'border-blue-500/25',
    resultView: 'clients',
    durationMs: 1400,
    steps: ['Loading client roster'],
    resultTemplate: 'Client roster loaded.',
  },
};

// ─── Action-Kind Detection (from free-text labels) ───────────────────────────
// Used to map LLM-proposed action card titles → OracleActionKind. Falls back
// to 'create-report' which is the safest generic action.

export function detectActionKind(label: string): OracleActionKind {
  const l = label.toLowerCase();
  if (l.includes('gstr') || l.includes('return') || l.includes('3b') || l.includes('1b')) return 'generate-gst-return';
  if (l.includes('reconcil') || l.includes('2b') || l.includes('2a') || l.includes('match')) return 'prepare-reconciliation';
  if (l.includes('recover') || l.includes('collection') || l.includes('overdue') || l.includes('receivable')) return 'recover-collections';
  if (l.includes('forecast') && (l.includes('cash') || l.includes('flow'))) return 'cash-flow-forecast';
  if (l.includes('forecast') || l.includes('predict') || l.includes('revenue')) return 'generate-forecast';
  if (l.includes('notice') || l.includes('scn') || l.includes('show cause') || l.includes('reply')) return 'create-notice';
  if (l.includes('reminder') || l.includes('send') || l.includes('whatsapp') || l.includes('email')) return 'create-reminder';
  if (l.includes('checklist') || l.includes('compliance')) return 'create-checklist';
  if (l.includes('export') || l.includes('pdf')) return 'export-pdf';
  if (l.includes('analytics') || l.includes('dashboard')) return 'open-analytics';
  if (l.includes('invoice')) return 'open-invoices';
  if (l.includes('client')) return 'open-clients';
  if (l.includes('task')) return 'create-task';
  if (l.includes('report')) return 'create-report';
  return 'create-report';
}

// ─── Action-Kind → Icon (for quick lookup in chips) ──────────────────────────

export function actionIcon(kind: OracleActionKind): LucideIcon {
  return ACTION_LIBRARY[kind]?.icon ?? FileText;
}

// ─── Build Oracle Task Steps from ActionMeta ─────────────────────────────────
// Converts the ActionMeta.steps string[] into OracleTaskStep[] with all steps
// marked 'pending' (the executor flips them to 'active' then 'done' as it runs).

export function buildInitialSteps(kind: OracleActionKind): OracleTaskStep[] {
  const meta = ACTION_LIBRARY[kind];
  if (!meta) return [];
  return meta.steps.map((label) => ({ label, state: 'pending' as const }));
}

// ─── Result Formatter ────────────────────────────────────────────────────────
// Substitutes {count} and {amount} placeholders with values derived from the
// Business Memory. When ctx doesn't supply real values, we use 0 (honest
// empty) instead of fabricating random numbers — the caller should pass real
// counts/amounts if it wants them shown.

export function formatActionResult(
  kind: OracleActionKind,
  ctx: { count?: number; amount?: number },
): string {
  const meta = ACTION_LIBRARY[kind];
  if (!meta) return 'Task completed.';
  const count = ctx.count ?? 0;
  const amount = ctx.amount ?? 0;
  // Templates already include the ₹ prefix where needed, so we only substitute
  // the raw number. If a template uses {amount} without a ₹ prefix, we add one.
  const amountStr = amount.toLocaleString('en-IN');
  return meta.resultTemplate
    .replace('{count}', String(count))
    .replace('₹{amount}', `₹${amountStr}`)
    .replace('{amount}', amountStr);
}

// ─── Outreach Channel Icons (used in recover-collections cards) ──────────────

export const OUTREACH_ICONS: Record<'whatsapp' | 'email' | 'reminder', LucideIcon> = {
  whatsapp: MessageSquare,
  email: Mail,
  reminder: Bell,
};

// ─── Default Action Card Set ─────────────────────────────────────────────────
// Fallback 3 action cards shown when the LLM doesn't propose any (e.g. on
// error or when the response is an investigation). Keeps the "always 3 cards"
// contract intact.

export const DEFAULT_ACTION_CARDS: OracleActionCard[] = [
  {
    kind: 'create-report',
    title: 'Generate Business Report',
    description: 'Compile a CFO-grade brief from your live business memory.',
    impact: 'Surfaces top 3 risks + opportunities',
  },
  {
    kind: 'recover-collections',
    title: 'Recover Overdue Collections',
    description: 'Identify overdue clients and draft recovery outreach.',
    impact: 'Unblocks cash within 7 days',
  },
  {
    kind: 'prepare-reconciliation',
    title: 'Prepare 2B Reconciliation',
    description: 'Match GSTR-2B vs books and flag ITC at risk.',
    impact: 'Prevents ITC reversal',
  },
];

// Suppress unused-import warnings for icons reserved for future expansion.
void AlertTriangle;
void Send;
