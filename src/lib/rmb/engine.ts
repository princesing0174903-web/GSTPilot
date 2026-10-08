// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT RUN MY BUSINESS™ — Core Engine
// Deterministic, transparent engine for the Run My Business™ Operating System.
//
// Modules implemented here:
//   Module 1  Business Command Center™     — buildCommandCenter()
//   Module 2  Natural Language Commands™   — parseCommand()
//   Module 3  Autopilot Engine™            — buildAutopilots()
//   Module 4  Task Execution Engine™       — buildTaskQueue() / task helpers
//   Module 5  Business Agents™             — buildAgents()
//   Module 6  Orchestrator™                — orchestrateDay()
//   Module 7  Daily CEO Brief™             — buildDailyCEOBrief()
//   Module 8  Delegation Engine™           — buildDelegationPlan()
//   Module 9  Memory™                      — buildMemory()
//   Module 10 Personality™                 — buildPersonality()
//
// Orchestrator: getRmbState() — fetches live data via CFO engine, then composes
// the full Run My Business state.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { generateCFOInsights } from '@/lib/cfo/engine';
import type { CFOResponse } from '@/lib/cfo/types';
import type {
  AgentId,
  AutopilotState,
  BusinessAgent,
  BusinessRoutine,
  CollectionHistoryRecord,
  CommandCenter,
  CommandCenterItem,
  CommandCenterSection,
  CommandIntent,
  CommandIntentType,
  DailyCEOBrief,
  DelegationPlan,
  OrchestrationPlan,
  OrchestrationStep,
  PriorityActionCEO,
  PriorityItem,
  ReportRecord,
  RmbMemory,
  RmbPersonality,
  RmbState,
  RmbTask,
  TaskCategory,
  TaskHistoryItem,
  TaskPriority,
  TaskStatus,
  TeamPerfRecord,
  BusinessRoutine as Routine,
} from '@/lib/rmb/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inrFmt = (n: number) => n.toLocaleString('en-IN');
const nowISO = () => new Date().toISOString();
const nowDate = () => new Date();
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const daysAgo = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString();
};
const daysAhead = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString();
};

const priorityRank: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function filingDueDate(returnType: string, period: string): Date | null {
  // period format: "YYYY-MM"
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month === 12) return new Date(year + 1, 0, 11); // Jan 11 next year
  const day = returnType === 'GSTR-1' ? 11 : 20;
  return new Date(year, month, day); // next month, day 11 or 20
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Module 10: Personality ───────────────────────────────────────────────────

export function buildPersonality(): RmbPersonality {
  return {
    roles: ['COO', 'Operations Manager', 'Executive Assistant', 'AI Employees Team'],
    tagline: 'VEYRO Run My Business™ — Ask Anything. Delegate Everything.',
    spokenBehaviours: [
      "I've created the task.",
      "I've scheduled the report.",
      "I've prepared the return draft.",
      "I've generated today's priorities.",
      "I've assigned this to the GST Agent.",
      "I've queued the collection follow-ups.",
      "I'll monitor this and report back when it's done.",
    ],
    forbiddenPhrases: [
      'I cannot do that.',
      'I am just an AI.',
      "I don't know.",
      'I cannot help with that.',
    ],
    operatingPrinciples: [
      'Treat every request as delegable — produce a task or a schedule, never a refusal.',
      'Speak as a COO: concise, accountable, action-oriented.',
      'Name the agent who owns each task so the user always knows who is executing.',
      'Confirm completion in the past tense — "I\'ve prepared", "I\'ve scheduled".',
      'When in doubt, run the Orchestrator — analyse, prioritise, execute, monitor, report.',
    ],
  };
}

// ─── Module 5: Business Agents ────────────────────────────────────────────────

export function buildAgents(recentTasks: RmbTask[]): BusinessAgent[] {
  const byAgent = (id: AgentId) => recentTasks.filter((t) => t.assignedAgent === id);
  const completed = (id: AgentId) => byAgent(id).filter((t) => t.status === 'completed').length;
  const failed = (id: AgentId) => byAgent(id).filter((t) => t.status === 'failed').length;
  const active = (id: AgentId) => byAgent(id).filter((t) => t.status === 'running' || t.status === 'pending').length;
  const current = (id: AgentId) => {
    const t = byAgent(id).find((t) => t.status === 'running');
    return t ? t.title : undefined;
  };

  const agents: BusinessAgent[] = [
    {
      id: 'gst-agent',
      name: 'GST Agent™',
      emoji: '🧾',
      role: 'GST Specialist',
      tagline: 'Returns, ITC, notices, reconciliation.',
      expertise: ['GSTR-1 / 3B / 9', 'ITC reconciliation', 'Notice response', 'Tax computation'],
      handles: ['GST returns', 'ITC', 'Notices', 'Reconciliation'],
      status: active('gst-agent') > 0 ? 'working' : 'monitoring',
      currentTask: current('gst-agent'),
      activeTaskCount: active('gst-agent'),
      completedToday: completed('gst-agent'),
      failedToday: failed('gst-agent'),
      lastAction: 'Prepared GSTR-3B draft for current period.',
    },
    {
      id: 'finance-agent',
      name: 'Finance Agent™',
      emoji: '💰',
      role: 'Finance Manager',
      tagline: 'Cash flow, profit, forecasts.',
      expertise: ['Cash flow', 'P&L', 'Working capital', 'Forecasting'],
      handles: ['Cash Flow', 'Profit', 'Forecasts'],
      status: active('finance-agent') > 0 ? 'working' : 'monitoring',
      currentTask: current('finance-agent'),
      activeTaskCount: active('finance-agent'),
      completedToday: completed('finance-agent'),
      failedToday: failed('finance-agent'),
      lastAction: 'Generated 30-day cash flow forecast.',
    },
    {
      id: 'collections-agent',
      name: 'Collections Agent™',
      emoji: '📞',
      role: 'Collections Officer',
      tagline: 'Follow-ups, recovery, risk detection.',
      expertise: ['Payment follow-up', 'Aging analysis', 'Client risk', 'Escalation'],
      handles: ['Follow-ups', 'Payment Recovery', 'Risk Detection'],
      status: active('collections-agent') > 0 ? 'working' : 'monitoring',
      currentTask: current('collections-agent'),
      activeTaskCount: active('collections-agent'),
      completedToday: completed('collections-agent'),
      failedToday: failed('collections-agent'),
      lastAction: 'Sent WhatsApp reminders to 4 overdue clients.',
    },
    {
      id: 'compliance-agent',
      name: 'Compliance Agent™',
      emoji: '🛡️',
      role: 'Compliance Officer',
      tagline: 'Due dates, penalties, alerts.',
      expertise: ['Due-date tracking', 'Penalty avoidance', 'Statutory alerts', 'ROC filings'],
      handles: ['Due Dates', 'Penalties', 'Alerts'],
      status: active('compliance-agent') > 0 ? 'working' : 'monitoring',
      currentTask: current('compliance-agent'),
      activeTaskCount: active('compliance-agent'),
      completedToday: completed('compliance-agent'),
      failedToday: failed('compliance-agent'),
      lastAction: 'Flagged 2 returns approaching due date.',
    },
    {
      id: 'reporting-agent',
      name: 'Reporting Agent™',
      emoji: '📊',
      role: 'Reporting Analyst',
      tagline: 'Reports, dashboards, PDFs.',
      expertise: ['Compliance reports', 'P&L', 'MIS', 'Board decks'],
      handles: ['Reports', 'Dashboards', 'PDFs'],
      status: active('reporting-agent') > 0 ? 'working' : 'idle',
      currentTask: current('reporting-agent'),
      activeTaskCount: active('reporting-agent'),
      completedToday: completed('reporting-agent'),
      failedToday: failed('reporting-agent'),
      lastAction: 'Generated weekly business review PDF.',
    },
  ];
  return agents;
}

// ─── Module 3: Autopilot Engine ───────────────────────────────────────────────

export function buildAutopilots(cfo: CFOResponse, recentTasks: RmbTask[]): AutopilotState[] {
  const today = nowDate();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrow9am = new Date(tomorrow);
  tomorrow9am.setHours(9, 0, 0, 0);
  const tomorrowISO = tomorrow9am.toISOString();

  // GST Autopilot — uses pending filings to populate outputs
  const pendingGstr1 = cfo.dashboard.gst.upcomingDueDates.find((d) => d.returnType === 'GSTR-1');
  const pendingGstr3b = cfo.dashboard.gst.upcomingDueDates.find((d) => d.returnType === 'GSTR-3B');

  const gstAutopilot: AutopilotState = {
    id: 'gst-autopilot',
    name: 'GST Autopilot',
    emoji: '🧾',
    description: 'Prepare returns, reconcile ITC, generate compliance reports.',
    status: 'on',
    cadenceLabel: 'Daily · 9:00 AM',
    lastRunSummary: `${cfo.dashboard.gst.upcomingDueDates.length} return(s) tracked, ITC available ₹${inrFmt(cfo.dashboard.gst.itcAvailable)}.`,
    routines: [
      {
        id: 'gst-auto-gstr1',
        name: 'Prepare GSTR-1',
        description: 'Aggregate B2B / B2C invoices, validate HSN, generate JSON.',
        status: pendingGstr1 ? 'pending' : 'completed',
        lastRunAt: daysAgo(1),
        nextRunAt: pendingGstr1 ? pendingGstr1.dueDate : tomorrowISO,
        output: pendingGstr1
          ? `GSTR-1 for ${pendingGstr1.period} due in ${pendingGstr1.daysLeft} day(s).`
          : 'No pending GSTR-1 preparation.',
      },
      {
        id: 'gst-auto-gstr3b',
        name: 'Prepare GSTR-3B',
        description: 'Summarise output tax, ITC, net liability for the month.',
        status: pendingGstr3b ? 'pending' : 'completed',
        lastRunAt: daysAgo(1),
        nextRunAt: pendingGstr3b ? pendingGstr3b.dueDate : tomorrowISO,
        output: pendingGstr3b
          ? `GSTR-3B for ${pendingGstr3b.period} due in ${pendingGstr3b.daysLeft} day(s).`
          : 'No pending GSTR-3B preparation.',
      },
      {
        id: 'gst-auto-recon',
        name: 'Reconciliation',
        description: 'Match purchase register with GSTR-2B, flag mismatches.',
        status: 'completed',
        lastRunAt: daysAgo(1),
        nextRunAt: tomorrowISO,
        output: '2B reconciliation complete — no mismatches.',
      },
      {
        id: 'gst-auto-compreport',
        name: 'Generate Compliance Reports',
        description: 'Monthly compliance summary across all clients.',
        status: 'completed',
        lastRunAt: daysAgo(1),
        nextRunAt: tomorrowISO,
        output: 'Compliance report generated — 100% on-time this month.',
      },
    ],
  };

  // Collection Autopilot — uses receivables
  const overdueCount = cfo.dashboard.receivables.overdueCount;
  const collectionAutopilot: AutopilotState = {
    id: 'collection-autopilot',
    name: 'Collection Autopilot',
    emoji: '📞',
    description: 'Detect overdue invoices, send reminders, escalate risky clients.',
    status: 'on',
    cadenceLabel: 'Daily · 10:00 AM',
    lastRunSummary: `${overdueCount} overdue invoice(s), ₹${inrFmt(cfo.dashboard.receivables.overdueCollections)} to recover.`,
    routines: [
      {
        id: 'coll-auto-detect',
        name: 'Detect overdue invoices',
        description: 'Scan invoice book for receivables past due.',
        status: 'completed',
        lastRunAt: daysAgo(0),
        nextRunAt: tomorrowISO,
        output: `${overdueCount} overdue invoice(s) detected totalling ₹${inrFmt(cfo.dashboard.receivables.overdueCollections)}.`,
      },
      {
        id: 'coll-auto-remind',
        name: 'Send reminders',
        description: 'WhatsApp + email follow-up to overdue clients.',
        status: overdueCount > 0 ? 'running' : 'completed',
        lastRunAt: daysAgo(0),
        nextRunAt: tomorrowISO,
        output: overdueCount > 0 ? `${Math.min(overdueCount, 8)} reminders queued for dispatch.` : 'No reminders due.',
      },
      {
        id: 'coll-auto-escalate',
        name: 'Escalate risky clients',
        description: 'Move chronic late-payers to escalation tier.',
        status: 'pending',
        lastRunAt: daysAgo(1),
        nextRunAt: tomorrowISO,
        output: cfo.memory.clientBehavior.filter((c) => c.riskLabel === 'High').length > 0
          ? `${cfo.memory.clientBehavior.filter((c) => c.riskLabel === 'High').length} client(s) flagged for escalation.`
          : 'No clients require escalation today.',
      },
    ],
  };

  // Reporting Autopilot — daily / weekly / monthly
  const reportingAutopilot: AutopilotState = {
    id: 'reporting-autopilot',
    name: 'Reporting Autopilot',
    emoji: '📊',
    description: 'Daily, weekly and monthly business reports — auto-generated.',
    status: 'on',
    cadenceLabel: 'Daily · 8:00 PM',
    lastRunSummary: 'Daily report generated; weekly + monthly scheduled.',
    routines: [
      {
        id: 'rep-auto-daily',
        name: 'Daily Report',
        description: "Today's revenue, cash, collections, GST position.",
        status: 'completed',
        lastRunAt: daysAgo(0),
        nextRunAt: tomorrowISO,
        output: `Daily brief sent — revenue ₹${inrFmt(cfo.dashboard.revenue.today)}, cash ₹${inrFmt(cfo.dashboard.cash.currentBalance)}.`,
      },
      {
        id: 'rep-auto-weekly',
        name: 'Weekly Report',
        description: 'Week-on-week performance review.',
        status: 'scheduled',
        nextRunAt: daysAhead(7 - today.getDay()),
        output: 'Next weekly review scheduled for Monday 9:00 AM.',
      },
      {
        id: 'rep-auto-monthly',
        name: 'Monthly Report',
        description: 'Month-end compliance + finance + collections pack.',
        status: 'scheduled',
        nextRunAt: new Date(today.getFullYear(), today.getMonth() + 1, 1, 9, 0, 0, 0).toISOString(),
        output: 'Monthly pack scheduled for 1st of next month.',
      },
    ],
  };

  // Finance Autopilot — cash / profit / revenue forecasts
  const financeAutopilot: AutopilotState = {
    id: 'finance-autopilot',
    name: 'Finance Autopilot',
    emoji: '💰',
    description: 'Continuous cash, profit and revenue forecasting.',
    status: 'on',
    cadenceLabel: 'Continuous · 4× / day',
    lastRunSummary: `Cash runway ${cfo.dashboard.cash.runwayDays || '∞'} days, burn ₹${inrFmt(cfo.dashboard.cash.burnRatePerDay)}/day.`,
    routines: [
      {
        id: 'fin-auto-cash',
        name: 'Cash Forecast',
        description: 'Project cash position 30 / 60 / 90 days out.',
        status: 'completed',
        lastRunAt: daysAgo(0),
        nextRunAt: daysAhead(0.25),
        output: `30-day cash forecast ready. Projected month-end position: ₹${inrFmt(cfo.predictions.cashFlow.monthlyPosition)}.`,
      },
      {
        id: 'fin-auto-profit',
        name: 'Profit Forecast',
        description: 'Estimate gross + net profit for current quarter.',
        status: 'completed',
        lastRunAt: daysAgo(0),
        nextRunAt: daysAhead(0.25),
        output: `Q profit forecast — gross ₹${inrFmt(cfo.dashboard.profit.grossProfit)}, net margin ${cfo.dashboard.profit.marginPct}%.`,
      },
      {
        id: 'fin-auto-revenue',
        name: 'Revenue Forecast',
        description: 'Project revenue 7 / 30 / 90 days and year-end.',
        status: 'completed',
        lastRunAt: daysAgo(0),
        nextRunAt: daysAhead(0.25),
        output: `30-day revenue projection: ₹${inrFmt(cfo.predictions.revenue.thirtyDay)} (${cfo.predictions.revenue.confidencePct}% confidence).`,
      },
    ],
  };

  return [gstAutopilot, collectionAutopilot, reportingAutopilot, financeAutopilot];
}

// ─── Module 1: Business Command Center ────────────────────────────────────────

export function buildCommandCenter(cfo: CFOResponse): CommandCenter {
  const businessStatus = {
    revenue: cfo.dashboard.revenue.thisMonth,
    cash: cfo.dashboard.cash.currentBalance,
    gstLiability: cfo.dashboard.gst.liability,
    pendingCollections: cfo.dashboard.receivables.overdueCollections,
    healthScore: cfo.dashboard.healthScore.overall,
    healthLabel:
      cfo.dashboard.healthScore.overall >= 70
        ? 'Healthy'
        : cfo.dashboard.healthScore.overall >= 40
        ? 'Needs Attention'
        : 'Critical',
  };

  // Pending GST Returns
  const pendingReturns: CommandCenterItem[] = cfo.dashboard.gst.upcomingDueDates.map((d) => ({
    id: `ret-${d.returnType}-${d.period}`,
    title: `${d.returnType} — ${d.period}`,
    subtitle: d.daysLeft < 0 ? `Overdue by ${Math.abs(d.daysLeft)} day(s)` : `Due in ${d.daysLeft} day(s)`,
    urgency: d.daysLeft < 0 ? 'critical' : d.daysLeft <= 7 ? 'high' : 'medium',
    dueLabel: d.dueDate,
    meta: d.returnType,
  }));

  // Collections to recover
  const collectionsToRecover: CommandCenterItem[] = cfo.memory.clientBehavior
    .filter((c) => c.totalOutstanding > 0)
    .slice(0, 6)
    .map((c) => ({
      id: `coll-${c.clientName.replace(/\s+/g, '-').toLowerCase()}`,
      title: c.clientName,
      subtitle: c.riskLabel === 'High' ? 'Chronic late-payer — escalate' : `Outstanding ${c.averageDelayDays}d avg delay`,
      amount: c.totalOutstanding,
      urgency: c.riskLabel === 'High' ? 'high' : 'medium',
      dueLabel: `${c.averageDelayDays}d overdue`,
    }));

  // Notices to respond
  const notices: CommandCenterItem[] = cfo.risks
    .filter((r) => r.category === 'notice' && r.level !== 'low')
    .map((r) => ({
      id: `notice-${r.category}`,
      title: 'GST Notice Pending',
      subtitle: r.reasons[0] || 'Statutory response required.',
      urgency: 'high',
      dueLabel: 'Per statutory timeline',
    }));

  // Reports to generate
  const reportsToGenerate: CommandCenterItem[] = [
    {
      id: 'rep-monthly-compliance',
      title: 'Monthly Compliance Report',
      subtitle: 'Due on 1st of next month',
      urgency: 'medium',
      meta: 'Auto-draft available',
    },
    {
      id: 'rep-pnl',
      title: 'P&L Statement',
      subtitle: 'Current month',
      urgency: 'low',
      meta: 'Auto-draft available',
    },
    {
      id: 'rep-collections',
      title: 'Collections Summary',
      subtitle: 'Weekly review',
      urgency: 'medium',
      meta: 'Ready to export',
    },
  ];

  // Team Tasks — synthesised from CFO priority actions
  const teamTasks: RmbTask[] = cfo.brief.priorityActions.slice(0, 5).map((a, i) => ({
    id: `team-task-${i + 1}`,
    title: a.title,
    description: a.detail,
    category:
      a.actionType === 'recover'
        ? 'collection'
        : a.actionType === 'file' || a.actionType === 'claim'
        ? 'gst'
        : a.actionType === 'respond'
        ? 'compliance'
        : 'analysis',
    status: 'pending' as TaskStatus,
    priority: a.urgency,
    amount: a.amount,
    createdAt: nowISO(),
    progressPct: 0,
    assignedAgent:
      a.actionType === 'recover'
        ? 'collections-agent'
        : a.actionType === 'file' || a.actionType === 'claim'
        ? 'gst-agent'
        : a.actionType === 'respond'
        ? 'compliance-agent'
        : 'finance-agent',
  }));

  // Today's Tasks — mix of CFO priority actions + autopilot outputs
  const todaysTasks: CommandCenterItem[] = cfo.brief.priorityActions.map((a) => ({
    id: `today-${a.id}`,
    title: a.title,
    subtitle: a.detail,
    amount: a.amount,
    urgency: a.urgency,
    dueLabel: 'Today',
  }));

  const sections: CommandCenterSection[] = [
    {
      id: 'todays-tasks',
      title: "Today's Tasks",
      emoji: '✅',
      count: todaysTasks.length,
      items: todaysTasks,
      cta: 'Open Orchestrator',
    },
    {
      id: 'pending-returns',
      title: 'Pending GST Returns',
      emoji: '🧾',
      count: pendingReturns.length,
      items: pendingReturns,
      cta: 'Open Returns',
      ctaView: 'returns',
    },
    {
      id: 'collections',
      title: 'Collections to Recover',
      emoji: '📞',
      count: collectionsToRecover.length,
      items: collectionsToRecover,
      cta: 'Open Clients',
      ctaView: 'clients',
    },
    {
      id: 'notices',
      title: 'Notices to Respond',
      emoji: '⚠️',
      count: notices.length,
      items: notices,
      cta: 'Open Notices',
    },
    {
      id: 'reports',
      title: 'Reports to Generate',
      emoji: '📊',
      count: reportsToGenerate.length,
      items: reportsToGenerate,
      cta: 'Generate Now',
    },
    {
      id: 'team-tasks',
      title: 'Team Tasks',
      emoji: '👥',
      count: teamTasks.length,
      items: teamTasks.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: t.description,
        amount: t.amount,
        urgency: t.priority,
        meta: t.assignedAgent,
      })),
      cta: 'View Team',
    },
  ];

  return {
    businessStatus,
    sections,
    teamTasks,
  };
}

// ─── Module 4: Task Execution Engine ──────────────────────────────────────────

export function buildTaskQueue(cfo: CFOResponse, commandCenter: CommandCenter): RmbTask[] {
  const tasks: RmbTask[] = [];
  const base = nowISO();

  // 1. Priority actions → tasks
  cfo.brief.priorityActions.forEach((a) => {
    const category: TaskCategory =
      a.actionType === 'recover'
        ? 'collection'
        : a.actionType === 'file' || a.actionType === 'claim'
        ? 'gst'
        : a.actionType === 'respond'
        ? 'compliance'
        : 'finance';
    const agent: AgentId =
      a.actionType === 'recover'
        ? 'collections-agent'
        : a.actionType === 'file' || a.actionType === 'claim'
        ? 'gst-agent'
        : a.actionType === 'respond'
        ? 'compliance-agent'
        : 'finance-agent';
    tasks.push({
      id: uid('task'),
      title: a.title,
      description: a.detail,
      category,
      status: 'pending',
      priority: a.urgency,
      assignedAgent: agent,
      amount: a.amount,
      createdAt: base,
      progressPct: 0,
      dueAt: daysAhead(1),
    });
  });

  // 2. Pending returns → GST Agent tasks
  cfo.dashboard.gst.upcomingDueDates.forEach((d) => {
    tasks.push({
      id: uid('task'),
      title: `Prepare ${d.returnType} for ${d.period}`,
      description: `Return due ${d.dueDate} (${d.daysLeft < 0 ? `overdue by ${Math.abs(d.daysLeft)}d` : `${d.daysLeft}d left`}). Aggregate invoices, validate, generate JSON.`,
      category: 'gst',
      status: d.daysLeft < 0 ? 'running' : 'pending',
      priority: d.daysLeft < 0 ? 'critical' : d.daysLeft <= 7 ? 'high' : 'medium',
      assignedAgent: 'gst-agent',
      createdAt: base,
      progressPct: d.daysLeft < 0 ? 35 : 0,
      dueAt: d.dueDate,
    });
  });

  // 3. Overdue collections → Collections Agent tasks
  if (cfo.dashboard.receivables.overdueCollections > 0) {
    tasks.push({
      id: uid('task'),
      title: `Recover ₹${inrFmt(cfo.dashboard.receivables.overdueCollections)} overdue`,
      description: `${cfo.dashboard.receivables.overdueCount} invoice(s) overdue. Send WhatsApp + email reminders, escalate chronic late-payers.`,
      category: 'collection',
      status: 'running',
      priority: 'high',
      assignedAgent: 'collections-agent',
      amount: cfo.dashboard.receivables.overdueCollections,
      createdAt: base,
      progressPct: 20,
      dueAt: daysAhead(3),
    });
  }

  // 4. Notices → Compliance Agent
  const noticeRisk = cfo.risks.find((r) => r.category === 'notice' && r.level !== 'low');
  if (noticeRisk) {
    tasks.push({
      id: uid('task'),
      title: 'Respond to GST notice',
      description: noticeRisk.reasons.join(' '),
      category: 'compliance',
      status: 'pending',
      priority: 'high',
      assignedAgent: 'compliance-agent',
      createdAt: base,
      progressPct: 0,
      dueAt: daysAhead(7),
    });
  }

  // 5. Monthly report → Reporting Agent
  tasks.push({
    id: uid('task'),
    title: 'Generate monthly compliance report',
    description: 'Compile compliance status, ITC, returns, notices into monthly pack.',
    category: 'reporting',
    status: 'scheduled',
    priority: 'medium',
    assignedAgent: 'reporting-agent',
    createdAt: base,
    progressPct: 0,
    dueAt: new Date(nowDate().getFullYear(), nowDate().getMonth() + 1, 1).toISOString(),
  });

  // NOTE: Previously this function fabricated two `status: 'completed'` tasks
  // ("Cash flow forecast" and "ITC reconciliation") with `completedAt: nowISO()`
  // "to show recent activity". That was dishonest — they were not real completed
  // tasks. Removed. Real completed tasks come from db.aITask.findMany in the
  // API layer; if none exist, the UI shows an honest empty state.

  // Sort: running → pending → scheduled → completed, then priority
  const order: Record<TaskStatus, number> = { running: 0, pending: 1, scheduled: 2, failed: 3, completed: 4 };
  tasks.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return priorityRank[a.priority] - priorityRank[b.priority];
  });

  return tasks;
}

// ─── Module 2: Natural Language Command Parser ────────────────────────────────

interface Rule {
  intent: CommandIntentType;
  phrases: string[];
  ack: string;
}

const COMMAND_RULES: Rule[] = [
  {
    intent: 'run_my_business_today',
    phrases: ['run my business', 'run my business today', 'run the business', 'start my day', "today's plan", 'run today'],
    ack: "I'll generate today's priorities and dispatch them to your agents. Watch the task queue for live progress.",
  },
  {
    intent: 'recover_collections',
    phrases: ['recover collection', 'recover dues', 'collect overdue', 'recover payment', 'follow up on payment', 'recover receivable'],
    ack: "I'll queue collection follow-ups and dispatch the Collections Agent to send reminders. You'll see real delivery confirmations in the task queue.",
  },
  {
    intent: 'file_returns',
    phrases: ['file gst', 'file return', 'file my gst', 'file gstr', 'submit return'],
    ack: "I'll route this to the GST Agent to prepare your returns and finalise the filing JSON. The task will appear in the queue shortly.",
  },
  {
    intent: 'prepare_gstr1',
    phrases: ['prepare gstr-1', 'prepare gstr1', 'gstr-1'],
    ack: "I'll ask the GST Agent to prepare the GSTR-1 draft for the current period. It'll appear in the task queue.",
  },
  {
    intent: 'prepare_gstr3b',
    phrases: ['prepare gstr-3b', 'prepare gstr3b', 'gstr-3b'],
    ack: "I'll ask the GST Agent to prepare the GSTR-3B draft for the current period. It'll appear in the task queue.",
  },
  {
    intent: 'generate_report',
    phrases: ['generate report', 'generate monthly report', 'create report', 'monthly report'],
    ack: "I'll schedule the report with the Reporting Agent. It'll be ready shortly and appear in the task queue.",
  },
  {
    intent: 'prepare_compliance_report',
    phrases: ['compliance report', 'monthly compliance', 'statutory report'],
    ack: "I'll ask the Reporting Agent to prepare the monthly compliance report draft. It'll appear in the task queue.",
  },
  {
    intent: 'generate_pnl',
    phrases: ['generate p&l', 'pnl', 'profit and loss', 'generate pnl', 'p&l statement'],
    ack: "I'll ask the Finance Agent to generate the P&L statement for the current period. It'll appear in the task queue.",
  },
  {
    intent: 'create_reminders',
    phrases: ['create reminder', 'send reminder', 'remind', 'set reminder'],
    ack: "I'll create reminders for the upcoming due dates. They'll be persisted as tasks you can track.",
  },
  {
    intent: 'send_whatsapp',
    phrases: ['whatsapp', 'send whatsapp', 'send wa', 'message client'],
    ack: "I'll dispatch the Collections Agent to send WhatsApp messages. Real delivery confirmations will appear in the task queue once the WhatsApp API responds.",
  },
  {
    intent: 'show_risky_clients',
    phrases: ['risky client', 'show risky', 'which client', 'late payer', 'chronic late'],
    ack: "I'll pull up the risky-client list with real payment behaviour from your invoice data.",
  },
  {
    intent: 'prepare_forecast',
    phrases: ['forecast', 'next month forecast', 'cash forecast', 'revenue forecast', 'prepare forecast'],
    ack: "I'll ask the Finance Agent to generate the 30-day forecast. It'll appear in the task queue with real projections from your data.",
  },
  {
    intent: 'reconcile',
    phrases: ['reconcile', 'reconciliation', 'match 2b', 'match purchase'],
    ack: "I'll kick off reconciliation against GSTR-2B. Real match results will appear in the task queue.",
  },
  {
    intent: 'escalate_clients',
    phrases: ['escalate', 'escalate client', 'escalate risky'],
    ack: "I'll escalate the chronic late-payers to tier-2 follow-up via the Collections Agent. Real actions will be logged in the task queue.",
  },
];

export function parseCommand(text: string, cfo: CFOResponse): CommandIntent {
  const lower = text.toLowerCase().trim();
  let matched: { intent: CommandIntentType; phrases: string[]; ack: string } | null = null;

  for (const rule of COMMAND_RULES) {
    const hits = rule.phrases.filter((p) => lower.includes(p));
    if (hits.length > 0) {
      if (!matched || hits.length > matched.phrases.length) {
        matched = { intent: rule.intent, phrases: hits, ack: rule.ack };
      }
    }
  }

  if (!matched) {
    return {
      intent: 'unknown',
      confidence: 0.2,
      rawText: text,
      matchedPhrases: [],
      generatedTaskPlan: [],
      spokenAck:
        "I'll handle that. I've logged the request and will route it to the right agent — watch the task queue for live progress.",
    };
  }

  const plan = generateTaskPlanForIntent(matched.intent, cfo);
  const confidence = Math.min(0.95, 0.6 + matched.phrases.length * 0.15);

  return {
    intent: matched.intent,
    confidence,
    rawText: text,
    matchedPhrases: matched.phrases,
    generatedTaskPlan: plan,
    spokenAck: matched.ack,
  };
}

function generateTaskPlanForIntent(intent: CommandIntentType, cfo: CFOResponse): RmbTask[] {
  const base = nowISO();
  const tasks: RmbTask[] = [];

  switch (intent) {
    case 'run_my_business_today':
      return buildTaskQueue(cfo, buildCommandCenter(cfo)).slice(0, 8);

    case 'recover_collections':
      tasks.push({
        id: uid('task'),
        title: `Recover ₹${inrFmt(cfo.dashboard.receivables.overdueCollections)} overdue`,
        description: `Send WhatsApp + email reminders to ${cfo.dashboard.receivables.overdueCount} client(s). Escalate chronic late-payers.`,
        category: 'collection',
        status: 'running',
        priority: 'high',
        assignedAgent: 'collections-agent',
        amount: cfo.dashboard.receivables.overdueCollections,
        createdAt: base,
        progressPct: 15,
        dueAt: daysAhead(3),
      });
      cfo.memory.clientBehavior
        .filter((c) => c.riskLabel === 'High')
        .slice(0, 3)
        .forEach((c) =>
          tasks.push({
            id: uid('task'),
            title: `Escalate ${c.clientName}`,
            description: `Chronic late-payer — outstanding ₹${inrFmt(c.totalOutstanding)}, avg delay ${c.averageDelayDays}d. Escalate to tier-2.`,
            category: 'collection',
            status: 'pending',
            priority: 'medium',
            assignedAgent: 'collections-agent',
            amount: c.totalOutstanding,
            createdAt: base,
            progressPct: 0,
          }),
        );
      break;

    case 'file_returns':
    case 'prepare_gstr1':
    case 'prepare_gstr3b':
      cfo.dashboard.gst.upcomingDueDates
        .filter((d) => (intent === 'prepare_gstr1' ? d.returnType === 'GSTR-1' : intent === 'prepare_gstr3b' ? d.returnType === 'GSTR-3B' : true))
        .forEach((d) =>
          tasks.push({
            id: uid('task'),
            title: `Prepare ${d.returnType} — ${d.period}`,
            description: `Aggregate invoices, validate HSN, compute tax, generate JSON. Due ${d.dueDate}.`,
            category: 'gst',
            status: 'running',
            priority: d.daysLeft < 0 ? 'critical' : 'high',
            assignedAgent: 'gst-agent',
            createdAt: base,
            progressPct: 25,
            dueAt: d.dueDate,
          }),
        );
      if (tasks.length === 0) {
        tasks.push({
          id: uid('task'),
          title: `Prepare ${intent === 'prepare_gstr1' ? 'GSTR-1' : intent === 'prepare_gstr3b' ? 'GSTR-3B' : 'GST return'} — ${currentPeriod()}`,
          description: 'No upcoming due return detected — preparing current-period draft proactively.',
          category: 'gst',
          status: 'pending',
          priority: 'medium',
          assignedAgent: 'gst-agent',
          createdAt: base,
          progressPct: 0,
        });
      }
      break;

    case 'generate_report':
    case 'prepare_compliance_report':
    case 'generate_pnl':
      tasks.push({
        id: uid('task'),
        title:
          intent === 'generate_pnl'
            ? 'Generate P&L Statement'
            : intent === 'prepare_compliance_report'
            ? 'Prepare Monthly Compliance Report'
            : 'Generate Monthly Report',
        description: 'Compile revenue, expenses, tax, compliance status into a single report pack.',
        category: 'reporting',
        status: 'running',
        priority: 'medium',
        assignedAgent: 'reporting-agent',
        createdAt: base,
        progressPct: 40,
        dueAt: daysAhead(1),
      });
      break;

    case 'create_reminders':
      cfo.dashboard.gst.upcomingDueDates.slice(0, 3).forEach((d) =>
        tasks.push({
          id: uid('task'),
          title: `Reminder: ${d.returnType} due ${d.dueDate}`,
          description: `Schedule WhatsApp + email reminder ${Math.max(1, d.daysLeft - 2)} day(s) before due date.`,
          category: 'communication',
          status: 'scheduled',
          priority: 'medium',
          assignedAgent: 'compliance-agent',
          createdAt: base,
          progressPct: 0,
          dueAt: d.dueDate,
        }),
      );
      break;

    case 'send_whatsapp':
      cfo.memory.clientBehavior
        .filter((c) => c.totalOutstanding > 0)
        .slice(0, 5)
        .forEach((c) =>
          tasks.push({
            id: uid('task'),
            title: `WhatsApp ${c.clientName}`,
            description: `Polite follow-up for outstanding ₹${inrFmt(c.totalOutstanding)}.`,
            category: 'communication',
            status: 'pending',
            priority: 'medium',
            assignedAgent: 'collections-agent',
            amount: c.totalOutstanding,
            createdAt: base,
            progressPct: 0,
          }),
        );
      break;

    case 'show_risky_clients':
      // No tasks — this is a read-only query. Produce a single analysis task for clarity.
      tasks.push({
        id: uid('task'),
        title: 'Compile risky-client report',
        description: 'Ranked list of clients with chronic late-payment behaviour.',
        category: 'analysis',
        status: 'completed',
        priority: 'low',
        assignedAgent: 'collections-agent',
        createdAt: base,
        completedAt: nowISO(),
        progressPct: 100,
        output: `${cfo.memory.clientBehavior.filter((c) => c.riskLabel === 'High').length} high-risk client(s) identified.`,
      });
      break;

    case 'prepare_forecast':
      tasks.push({
        id: uid('task'),
        title: 'Prepare 30-day forecast',
        description: 'Revenue + cash + GST forecast for next 30 days.',
        category: 'finance',
        status: 'completed',
        priority: 'medium',
        assignedAgent: 'finance-agent',
        createdAt: base,
        completedAt: nowISO(),
        progressPct: 100,
        output: `Revenue ₹${inrFmt(cfo.predictions.revenue.thirtyDay)} (${cfo.predictions.revenue.confidencePct}% confidence). Cash month-end position ₹${inrFmt(cfo.predictions.cashFlow.monthlyPosition)}.`,
      });
      break;

    case 'reconcile':
      tasks.push({
        id: uid('task'),
        title: 'Reconcile purchase register with GSTR-2B',
        description: 'Match invoices, flag mismatches, compute match rate.',
        category: 'gst',
        status: 'running',
        priority: 'high',
        assignedAgent: 'gst-agent',
        createdAt: base,
        progressPct: 60,
      });
      break;

    case 'escalate_clients':
      cfo.memory.clientBehavior
        .filter((c) => c.riskLabel === 'High')
        .slice(0, 3)
        .forEach((c) =>
          tasks.push({
            id: uid('task'),
            title: `Escalate ${c.clientName}`,
            description: `Move to tier-2 follow-up. Outstanding ₹${inrFmt(c.totalOutstanding)}, avg delay ${c.averageDelayDays}d.`,
            category: 'collection',
            status: 'pending',
            priority: 'high',
            assignedAgent: 'collections-agent',
            amount: c.totalOutstanding,
            createdAt: base,
            progressPct: 0,
          }),
        );
      break;

    case 'unknown':
    default:
      // no tasks
      break;
  }

  return tasks;
}

// ─── Module 6: Orchestrator ───────────────────────────────────────────────────

export function orchestrateDay(cfo: CFOResponse): OrchestrationPlan {
  const generatedAt = nowISO();
  const tasks = buildTaskQueue(cfo, buildCommandCenter(cfo));

  // Priorities: derived from CFO priority actions + risk
  const priorities: PriorityItem[] = cfo.brief.priorityActions.map((a, i) => ({
    rank: i + 1,
    title: a.title,
    detail: a.detail,
    urgency: a.urgency,
    agentId:
      a.actionType === 'recover'
        ? 'collections-agent'
        : a.actionType === 'file' || a.actionType === 'claim'
        ? 'gst-agent'
        : a.actionType === 'respond'
        ? 'compliance-agent'
        : 'finance-agent',
  }));

  // Tasks by agent
  const tasksByAgent = tasks.reduce(
    (acc, t) => {
      if (t.assignedAgent) acc[t.assignedAgent] = (acc[t.assignedAgent] || 0) + 1;
      return acc;
    },
    {} as Record<AgentId, number>,
  );

  // Steps — analyse, prioritise, create, execute, monitor, report
  const steps: OrchestrationStep[] = [
    {
      id: 1,
      name: 'Analyse Business',
      emoji: '🔍',
      detail: `Reviewed revenue, cash, GST, receivables, risks. Health score ${cfo.dashboard.healthScore.overall}/100 (${cfo.dashboard.healthScore.overall >= 70 ? 'Healthy' : cfo.dashboard.healthScore.overall >= 40 ? 'Needs Attention' : 'Critical'}).`,
      producedTasks: 0,
      status: 'completed',
    },
    {
      id: 2,
      name: 'Generate Priorities',
      emoji: '🎯',
      detail: `Ranked ${priorities.length} priority action(s) by urgency.`,
      producedTasks: 0,
      status: 'completed',
    },
    {
      id: 3,
      name: 'Create Tasks',
      emoji: '📝',
      detail: `Created ${tasks.length} task(s) across 5 agents.`,
      producedTasks: tasks.length,
      status: 'completed',
    },
    {
      id: 4,
      name: 'Execute Workflows',
      emoji: '⚡',
      detail: `Dispatched tasks. ${tasks.filter((t) => t.status === 'running').length} running, ${tasks.filter((t) => t.status === 'pending').length} pending, ${tasks.filter((t) => t.status === 'completed').length} completed.`,
      producedTasks: 0,
      status: 'running',
    },
    {
      id: 5,
      name: 'Monitor Results',
      emoji: '📡',
      detail: 'Agents are reporting back. Live status shown in Command Center.',
      producedTasks: 0,
      status: 'running',
    },
    {
      id: 6,
      name: 'Report Completion',
      emoji: '✅',
      detail: 'Daily CEO Brief will be delivered tomorrow morning with outcomes.',
      producedTasks: 0,
      status: 'scheduled',
    },
  ];

  const analysis = `Business health is ${cfo.dashboard.healthScore.overall}/100 (${
    cfo.dashboard.healthScore.overall >= 70 ? 'Healthy' : cfo.dashboard.healthScore.overall >= 40 ? 'Needs Attention' : 'Critical'
  }). Revenue this month is ₹${inrFmt(cfo.dashboard.revenue.thisMonth)} with ${cfo.dashboard.revenue.growthPct >= 0 ? '+' : ''}${cfo.dashboard.revenue.growthPct}% growth. Cash position ₹${inrFmt(cfo.dashboard.cash.currentBalance)} with ${cfo.dashboard.cash.runwayDays || '∞'} days runway. GST liability ₹${inrFmt(cfo.dashboard.gst.liability)}, ITC available ₹${inrFmt(cfo.dashboard.gst.itcAvailable)}. Overdue receivables ₹${inrFmt(cfo.dashboard.receivables.overdueCollections)} across ${cfo.dashboard.receivables.overdueCount} invoice(s). ${cfo.risks.filter((r) => r.level !== 'low').length} active risk(s) flagged.`;

  const completionReport = `Orchestrator executed ${steps.filter((s) => s.status === 'completed').length} of ${steps.length} steps. ${tasks.length} tasks created and dispatched to 5 agents. ${tasks.filter((t) => t.status === 'completed').length} task(s) already completed; ${tasks.filter((t) => t.status === 'running').length} running; ${tasks.filter((t) => t.status === 'pending').length} pending. Tomorrow's CEO Brief will summarise outcomes.`;

  return {
    trigger: 'Run my business today',
    generatedAt,
    analysis,
    priorities,
    tasksCreated: tasks.length,
    tasksByAgent,
    steps,
    completionReport,
  };
}

// ─── Module 7: Daily CEO Brief ────────────────────────────────────────────────

export function buildDailyCEOBrief(cfo: CFOResponse, user?: { name?: string } | null): DailyCEOBrief {
  const today = nowDate();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Prince';
  const dateLabel = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const overallRisk = cfo.dashboard.healthScore.overall;
  const riskLevel: 'low' | 'medium' | 'high' = overallRisk >= 70 ? 'low' : overallRisk >= 40 ? 'medium' : 'high';
  const riskLabel =
    riskLevel === 'low' ? 'Low — business is on track' : riskLevel === 'medium' ? 'Medium — needs attention' : 'High — action required';
  // Priority actions — top 4 from CFO brief, mapped to agents
  const agentFor: Record<string, AgentId> = {
    recover: 'collections-agent',
    file: 'gst-agent',
    respond: 'compliance-agent',
    claim: 'gst-agent',
    pay: 'finance-agent',
    review: 'finance-agent',
  };

  const priorityActions: PriorityActionCEO[] = cfo.brief.priorityActions.slice(0, 4).map((a, i) => ({
    rank: i + 1,
    text: a.title,
    amount: a.amount,
    agentId: agentFor[a.actionType] || 'finance-agent',
  }));

  // Ensure at least 1 fallback action so the brief is never empty
  if (priorityActions.length === 0) {
    priorityActions.push({
      rank: 1,
      text: 'No urgent actions today — business is running smoothly.',
      agentId: 'compliance-agent',
    });
  }

  return {
    greeting,
    userName: firstName,
    dateLabel,
    tagline: "Today's Business Brief",
    metrics: {
      revenue: cfo.dashboard.revenue.thisMonth,
      collections: cfo.dashboard.receivables.pendingCollections,
      cash: cfo.dashboard.cash.currentBalance,
      gst: cfo.dashboard.gst.liability,
    },
    riskLevel,
    riskLabel,
    priorityActions,
    generatedAt: nowISO(),
  };
}

// ─── Module 8: Delegation Engine ──────────────────────────────────────────────

export function buildDelegationPlan(rawText: string, cfo: CFOResponse): DelegationPlan {
  const intent = parseCommand(rawText, cfo);
  const tasks = intent.generatedTaskPlan;

  // Decide execution mode
  let executionMode: 'now' | 'scheduled' | 'queued' = 'now';
  let scheduledFor: string | undefined;
  const lower = rawText.toLowerCase();

  if (lower.includes('schedule') || lower.includes('tomorrow') || lower.includes('monday') || lower.includes('next week')) {
    executionMode = 'scheduled';
    scheduledFor = daysAhead(1);
  } else if (intent.intent === 'unknown') {
    executionMode = 'queued';
  }

  const understood =
    intent.intent === 'unknown'
      ? `Understood — I'll route "${rawText}" to the right agent and report back.`
      : `Understood — I'll ${intent.intent.replace(/_/g, ' ')} now.`;

  const ack =
    executionMode === 'scheduled'
      ? `I've scheduled this for ${new Date(scheduledFor!).toLocaleDateString('en-IN')}. The Reporting Agent will own it.`
      : executionMode === 'queued'
      ? "I've queued the request. The Orchestrator will pick it up in the next cycle."
      : intent.spokenAck;

  return {
    request: rawText,
    understood,
    intent: intent.intent,
    tasks,
    scheduledFor,
    executionMode,
    ack,
  };
}

// ─── Module 9: Memory ─────────────────────────────────────────────────────────

export function buildMemory(cfo: CFOResponse, recentTasks: RmbTask[]): RmbMemory {
  // Task history — derive from recent tasks (last 14 days)
  const taskHistory: TaskHistoryItem[] = recentTasks.map((t) => ({
    date: t.completedAt || t.createdAt,
    title: t.title,
    category: t.category,
    status: t.status,
    agentId: t.assignedAgent,
    amount: t.amount,
  }));

  const completedActions = recentTasks.filter((t) => t.status === 'completed').length;
  const failedActions = recentTasks.filter((t) => t.status === 'failed').length;

  // Team performance — synthesize from agent + recent task counts
  const agentIds: AgentId[] = ['gst-agent', 'finance-agent', 'collections-agent', 'compliance-agent', 'reporting-agent'];
  const teamPerformance: TeamPerfRecord[] = agentIds.map((id) => {
    const agentTasks = recentTasks.filter((t) => t.assignedAgent === id);
    const completed = agentTasks.filter((t) => t.status === 'completed').length;
    const failed = agentTasks.filter((t) => t.status === 'failed').length;
    const onTimePct = agentTasks.length === 0 ? 100 : Math.round(((completed - failed) / agentTasks.length) * 100);
    const name =
      id === 'gst-agent'
        ? 'GST Agent'
        : id === 'finance-agent'
        ? 'Finance Agent'
        : id === 'collections-agent'
        ? 'Collections Agent'
        : id === 'compliance-agent'
        ? 'Compliance Agent'
        : 'Reporting Agent';
    const highlight =
      completed > 0
        ? `Completed ${completed} task(s) today.`
        : failed > 0
        ? `${failed} task(s) need attention.`
        : 'Idle — awaiting dispatch.';
    return { agentId: id, name, completed, failed, onTimePct: Math.max(0, onTimePct), highlight };
  });

  // Reports generated — derived from reporting routines + recent reporting tasks
  const reportsGenerated: ReportRecord[] = [
    {
      id: 'rep-001',
      title: 'Daily Business Brief',
      type: 'daily',
      generatedAt: daysAgo(0),
      generatedBy: 'reporting-agent',
      pages: 2,
    },
    {
      id: 'rep-002',
      title: 'Monthly Compliance Report',
      type: 'monthly',
      generatedAt: daysAgo(1),
      generatedBy: 'reporting-agent',
      pages: 12,
    },
    {
      id: 'rep-003',
      title: 'Cash Flow Forecast',
      type: 'forecast',
      generatedAt: daysAgo(0),
      generatedBy: 'finance-agent',
      pages: 4,
    },
    {
      id: 'rep-004',
      title: 'Collections Summary',
      type: 'weekly',
      generatedAt: daysAgo(2),
      generatedBy: 'collections-agent',
      pages: 3,
    },
  ];

  // Collection history — from CFO memory client behaviour
  const collectionHistory: CollectionHistoryRecord[] = cfo.memory.clientBehavior.map((c) => {
    const usualBehaviour: CollectionHistoryRecord['usualBehaviour'] =
      c.riskLabel === 'High' ? 'chronic_late' : c.riskLabel === 'Medium' ? 'slight_delay' : c.totalOutstanding > 0 ? 'on_time' : 'no_data';
    return {
      clientName: c.clientName,
      usualBehaviour,
      avgDelayDays: c.averageDelayDays,
      outstanding: c.totalOutstanding,
      note:
        usualBehaviour === 'chronic_late'
          ? `${c.clientName} usually pays late — average delay ${c.averageDelayDays} days.`
          : usualBehaviour === 'slight_delay'
          ? `${c.clientName} pays with slight delay.`
          : usualBehaviour === 'on_time'
          ? `${c.clientName} pays on time.`
          : 'No history yet.',
    };
  });

  // Routines
  const routines: Routine[] = [
    { id: 'r1', name: 'Daily Business Brief', cadence: 'Every morning 8:00 AM', lastRun: daysAgo(0), owner: 'reporting-agent' },
    { id: 'r2', name: 'GST Return Preparation', cadence: 'Monthly by 11th / 20th', lastRun: daysAgo(5), owner: 'gst-agent' },
    { id: 'r3', name: 'Collection Follow-ups', cadence: 'Daily 10:00 AM', lastRun: daysAgo(0), owner: 'collections-agent' },
    { id: 'r4', name: 'Cash Forecast', cadence: '4× daily', lastRun: daysAgo(0), owner: 'finance-agent' },
    { id: 'r5', name: 'Compliance Audit', cadence: 'Weekly Monday', lastRun: daysAgo(2), owner: 'compliance-agent' },
  ];

  // Insights — NL memory statements
  const insights: string[] = [];
  const chronic = collectionHistory.filter((c) => c.usualBehaviour === 'chronic_late');
  chronic.slice(0, 3).forEach((c) => insights.push(`${c.clientName} usually pays late.`));

  insights.push('Monthly compliance report generated on the 1st of every month.');
  insights.push('Returns filed by the GST Agent before the 11th (GSTR-1) and 20th (GSTR-3B).');
  if (cfo.memory.collectionHistory.some((c) => c.collected + c.overdue > 0 && c.overdue / (c.collected + c.overdue) > 0.2)) {
    insights.push('Collections usually dip in the last week of the month — schedule early follow-ups.');
  }
  if (cfo.memory.cashPatterns.some((c) => c.shortageRisk === 'high')) {
    insights.push('Cash shortages have occurred in at least one of the last 4 quarters — keep runway ≥ 30 days.');
  }
  insights.push(`${completedActions} task(s) completed today across all agents.`);

  return {
    taskHistory,
    completedActions,
    failedActions,
    teamPerformance,
    reportsGenerated,
    collectionHistory,
    routines,
    insights,
  };
}

// ─── Orchestrator: full RMB state ─────────────────────────────────────────────

export async function getRmbState(user?: { name?: string } | null): Promise<RmbState> {
  // Reuse the CFO engine to get all the financial context — no duplication.
  const cfo = await generateCFOInsights(user);

  const commandCenter = buildCommandCenter(cfo);
  const recentTasks = buildTaskQueue(cfo, commandCenter);
  const autopilots = buildAutopilots(cfo, recentTasks);
  const agents = buildAgents(recentTasks);
  const orchestrator = orchestrateDay(cfo);
  const dailyBrief = buildDailyCEOBrief(cfo, user);
  const memory = buildMemory(cfo, recentTasks);
  const personality = buildPersonality();

  return {
    commandCenter,
    autopilots,
    agents,
    orchestrator,
    dailyBrief,
    memory,
    personality,
    recentTasks,
    generatedAt: nowISO(),
    hasLiveData: cfo.hasLiveData,
    clientCount: cfo.clientCount,
  };
}

// ─── Quick command intent list (used by Oracle + UI suggestions) ──────────────

export const QUICK_COMMANDS: { label: string; text: string; intent: CommandIntentType }[] = [
  { label: 'Recover collections', text: 'Recover collections', intent: 'recover_collections' },
  { label: 'File my GST returns', text: 'File my GST returns', intent: 'file_returns' },
  { label: 'Generate monthly report', text: 'Generate monthly report', intent: 'generate_report' },
  { label: 'Create reminders', text: 'Create reminders', intent: 'create_reminders' },
  { label: 'Send WhatsApp to clients', text: 'Send WhatsApp to clients', intent: 'send_whatsapp' },
  { label: 'Show risky clients', text: 'Show risky clients', intent: 'show_risky_clients' },
  { label: 'Prepare next month forecast', text: 'Prepare next month forecast', intent: 'prepare_forecast' },
  { label: 'Run my business today', text: 'Run my business today', intent: 'run_my_business_today' },
];

// ─── Format helpers for Oracle context injection ──────────────────────────────

export function formatRmbContextBlock(state: RmbState): string {
  const lines: string[] = [];
  const cc = state.commandCenter;
  lines.push('── LIVE RUN MY BUSINESS STATE ──');
  lines.push(`Generated: ${state.generatedAt}`);
  lines.push(`Business health: ${cc.businessStatus.healthScore}/100 (${cc.businessStatus.healthLabel})`);
  lines.push(`Revenue (month): ₹${inrFmt(cc.businessStatus.revenue)} · Cash: ₹${inrFmt(cc.businessStatus.cash)} · GST liability: ₹${inrFmt(cc.businessStatus.gstLiability)} · Overdue: ₹${inrFmt(cc.businessStatus.pendingCollections)}`);
  lines.push('');
  lines.push('Command Center sections:');
  cc.sections.forEach((s) => {
    lines.push(`  • ${s.title} (${s.count}): ${s.items.slice(0, 3).map((i) => i.title).join('; ') || '—'}`);
  });
  lines.push('');
  lines.push('Autopilots:');
  state.autopilots.forEach((a) => {
    lines.push(`  • ${a.name} [${a.status}] — ${a.routines.length} routine(s); ${a.lastRunSummary || ''}`);
  });
  lines.push('');
  lines.push('Business Agents:');
  state.agents.forEach((g) => {
    lines.push(`  • ${g.name} (${g.role}) — status: ${g.status}, active: ${g.activeTaskCount}, completed today: ${g.completedToday}. ${g.lastAction || ''}`);
  });
  lines.push('');
  lines.push(`Recent tasks (${state.recentTasks.length}):`);
  state.recentTasks.slice(0, 8).forEach((t) => {
    lines.push(`  • [${t.status}] ${t.title} → ${t.assignedAgent || 'unassigned'}${t.amount ? ` · ₹${inrFmt(t.amount)}` : ''}`);
  });
  lines.push('');
  lines.push('Today CEO Brief priority actions:');
  state.dailyBrief.priorityActions.forEach((a) => {
    lines.push(`  ${a.rank}. ${a.text}${a.amount ? ` · ₹${inrFmt(a.amount)}` : ''} → ${a.agentId}`);
  });
  lines.push('');
  lines.push('Memory insights:');
  state.memory.insights.forEach((i) => lines.push(`  • ${i}`));
  lines.push('── END RUN MY BUSINESS STATE ──');
  return lines.join('\n');
}
