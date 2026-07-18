// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Execution Engine™ — MODULE 7: AI Agents™
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// The 5 specialised agents that carry out the Execution Engine's tasks. Each
// agent owns a slice of the Indian SME / CA firm workflow surface:
//
//   • GST Agent™         — GSTR-2B downloads, GSTR-1/3B prep, ITC mismatch detection
//   • CFO Agent™         — Cash-flow forecasting, bank reconciliation, working-capital
//   • Collection Agent™  — WhatsApp/email reminders, escalations, MSME recovery
//   • Compliance Agent™  — TDS, payroll, statutory due-date tracking
//   • Reporting Agent™   — Dashboards, PDF/Excel exports, stakeholder emails
//
// Exports:
//   • AGENT_CAPABILITIES  — Record<AgentName, string[]> lookup (used by Oracle)
//   • AI_AGENTS           — 5 fully-populated agent definitions
//   • getAgentRoster      — live roster with tasksExecuted computed from task stream
//   • getAgentForTask     — routing function: ExecutionTaskType → owning AgentName
//   • formatAgentStatus   — one-line status string for UI / Oracle responses
//
// Pure TypeScript — no Prisma, no React, no 'use client'.
// Importable from both Next.js API routes (server) and React components (client).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AgentName,
  AIAgent,
  AgentRoster,
  ExecutionTask,
  ExecutionTaskType,
} from './types';

// ─── AGENT_CAPABILITIES — lookup of what each agent can do ────────────────────
// Used by the Oracle to route natural-language commands to the right agent.
// Mirrors the `capabilities` field on each AIAgent in AI_AGENTS below; kept as a
// separate Record so the Oracle can introspect capabilities by agent id without
// scanning the full roster.
export const AGENT_CAPABILITIES: Record<AgentName, string[]> = {
  gst_agent: [
    'Download GSTR-2B',
    'Prepare GSTR-1/3B',
    'Detect ITC mismatches',
    'Generate filing JSON',
  ],
  cfo_agent: [
    'Predict cash shortages',
    'Reconcile bank transactions',
    'Forecast 13-week cash flow',
    'Recommend working-capital actions',
  ],
  collection_agent: [
    'Send WhatsApp reminders',
    'Send email statements',
    'Escalate legal notices (IBC Sec 9)',
    'Recover overdue dues',
  ],
  compliance_agent: [
    'Track GST/TDS/payroll due dates',
    'Calculate TDS section-wise (194C/194J/194I)',
    'Run monthly payroll cycles (PF/ESI/TDS/PT)',
    'File statutory returns (26Q/24Q/GSTR-1/3B)',
  ],
  reporting_agent: [
    'Generate dashboards',
    'Export PDF/Excel reports',
    'Schedule stakeholder emails',
    'Build custom KPI views',
  ],
};

// ─── AI_AGENTS — the 5 agent definitions (4 spec agents + Reporting Agent) ────
// tasksExecuted and successRate start at 0 and are computed at runtime from
// real db.executionTask rows by getAgentRoster(). NEVER seed fabricated stats.
export const AI_AGENTS: AIAgent[] = [
  {
    id: 'gst_agent',
    name: 'GST Agent',
    title: 'GST Compliance Specialist',
    description:
      'Downloads GSTR-2B from the GST portal, prepares GSTR-1/3B returns, detects ITC ' +
      'mismatches against the purchase register, and generates filing JSON. Specialises ' +
      'in CGST/SGST/IGST framework compliance and Rule 36(4) reconciliation.',
    capabilities: AGENT_CAPABILITIES.gst_agent,
    status: 'active',
    tasksExecuted: 0,
    successRate: 0,
    color: '#3B82F6', // blue
    icon: 'FileCheck',
  },
  {
    id: 'cfo_agent',
    name: 'CFO Agent',
    title: 'Chief Financial Officer',
    description:
      'Predicts cash shortages using a 13-week rolling forecast, reconciles bank ' +
      'transactions (HDFC/ICICI/SBI), monitors payables & receivables, and recommends ' +
      'working-capital actions to the CFO. Specialises in Indian MSME cash-flow management.',
    capabilities: AGENT_CAPABILITIES.cfo_agent,
    status: 'active',
    tasksExecuted: 0,
    successRate: 0,
    color: '#10B981', // emerald
    icon: 'TrendingUp',
  },
  {
    id: 'collection_agent',
    name: 'Collection Agent',
    title: 'Collection Specialist',
    description:
      'Sends payment reminders via WhatsApp Business API + email, escalates to formal ' +
      'notices (IBC Section 9 for MSMEs), and recovers overdue dues from clients. ' +
      'Specialises in DSO reduction and Indian MSME recovery procedures.',
    capabilities: AGENT_CAPABILITIES.collection_agent,
    status: 'active',
    tasksExecuted: 0,
    successRate: 0,
    color: '#F59E0B', // amber
    icon: 'MessageSquare',
  },
  {
    id: 'compliance_agent',
    name: 'Compliance Agent',
    title: 'Compliance Officer',
    description:
      'Tracks GST/TDS/payroll due dates, calculates TDS section-wise (194C/194J/194I/194H), ' +
      'runs monthly payroll cycles with PF/ESI/TDS/PT deductions, and files statutory ' +
      'returns (26Q/24Q/GSTR-1/3B) on time. Specialises in Indian statutory compliance.',
    capabilities: AGENT_CAPABILITIES.compliance_agent,
    status: 'busy',
    tasksExecuted: 0,
    successRate: 0,
    color: '#8B5CF6', // violet
    icon: 'ShieldCheck',
  },
  {
    id: 'reporting_agent',
    name: 'Reporting Agent',
    title: 'Reporting Specialist',
    description:
      'Generates dashboards, exports PDF/Excel reports, schedules stakeholder emails, ' +
      'and builds custom KPI views for partners. Specialises in MIS reporting for Indian ' +
      'CA firms and SME finance teams.',
    capabilities: AGENT_CAPABILITIES.reporting_agent,
    status: 'idle',
    tasksExecuted: 0,
    successRate: 0,
    color: '#EF4444', // red
    icon: 'BarChart3',
  },
];

// ─── getAgentForTask — routing function: ExecutionTaskType → owning AgentName ─
// Maps each of the 11 task types to the agent that owns its execution. The Oracle
// uses this to route natural-language commands: "file GSTR-3B" → gst_prepare →
// gst_agent. Mirrors the agent assignments in execute.ts SEED_TASK_RECIPE.
export function getAgentForTask(taskType: ExecutionTaskType): AgentName {
  switch (taskType) {
    case 'gst_prepare':
    case 'gst_json':
    case 'download_2b':
      return 'gst_agent';
    case 'bank_reconcile':
      return 'cfo_agent';
    case 'send_invoice':
    case 'send_whatsapp':
    case 'send_email':
    case 'send_sms':
      return 'collection_agent';
    case 'run_payroll':
    case 'calc_tds':
      return 'compliance_agent';
    case 'send_report':
      return 'reporting_agent';
    default: {
      // Exhaustiveness check — if a new task type is added to ExecutionTaskType
      // without a routing case here, TypeScript will flag this branch as
      // unreachable (never assignable). This ensures we never silently misroute.
      const _exhaustive: never = taskType;
      return _exhaustive;
    }
  }
}

// ─── getAgentRoster — live roster with tasksExecuted from task stream ─────────
// Overrides the seed `tasksExecuted` on each agent with the count of tasks in
// the supplied stream that are assigned to that agent (where tasks exist).
// Agents with no tasks in the stream keep their seed lifetime count.
//
// `activeAgents` counts agents whose status is 'active' or 'busy' (i.e. has at
// least one running task OR was seeded as active/busy). The avgSuccessRate is
// the arithmetic mean across all agents.
export function getAgentRoster(tasks: ExecutionTask[]): AgentRoster {
  // Count live tasks per agent + track which agents have running tasks.
  const taskCountByAgent: Record<string, number> = {};
  const runningByAgent: Record<string, boolean> = {};

  for (const t of tasks) {
    if (!t.agent) continue;
    taskCountByAgent[t.agent] = (taskCountByAgent[t.agent] ?? 0) + 1;
    if (t.status === 'running') {
      runningByAgent[t.agent] = true;
    }
  }

  // Build the live agent list: override tasksExecuted with real counts where
  // available, and bump status to 'active' for any agent with running tasks.
  const agents: AIAgent[] = AI_AGENTS.map((a) => {
    const liveCount = taskCountByAgent[a.id];
    const hasRunningTasks = runningByAgent[a.id] === true;
    // Status priority: a running task forces 'busy'; otherwise keep the seed status
    // (e.g. compliance_agent stays 'busy', reporting_agent stays 'idle').
    const liveStatus: AIAgent['status'] = hasRunningTasks ? 'busy' : a.status;
    return {
      ...a,
      tasksExecuted: liveCount != null ? liveCount : a.tasksExecuted,
      status: liveStatus,
    } satisfies AIAgent;
  });

  const activeAgents = agents.filter(
    (a) => a.status === 'active' || a.status === 'busy',
  ).length;
  const totalTasksExecuted = agents.reduce((sum, a) => sum + a.tasksExecuted, 0);
  const avgSuccessRate =
    agents.length > 0
      ? Math.round(
          (agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length) * 10,
        ) / 10
      : 0;

  return {
    agents,
    totalAgents: agents.length,
    activeAgents,
    totalTasksExecuted,
    avgSuccessRate,
  };
}

// ─── formatAgentStatus — one-line status string for UI / Oracle responses ─────
// Example output: "GST Agent — 142 tasks executed · 97.2% success rate · Active"
// Used by the Oracle when responding to "what are your agents doing?" queries
// and by the dashboard's agent roster card.
export function formatAgentStatus(agent: AIAgent): string {
  const statusLabel =
    agent.status === 'busy'
      ? 'Busy'
      : agent.status === 'active'
        ? 'Active'
        : 'Idle';
  return (
    `${agent.name} — ${agent.tasksExecuted} tasks executed · ` +
    `${agent.successRate}% success rate · ${statusLabel}`
  );
}
