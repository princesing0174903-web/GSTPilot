// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Pipeline Orchestrator (PROMPT 4)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The orchestrator implements the full pipeline:
//   1. Classify intent (keyword-based, instant)
//   2. Run all required tools IN PARALLEL (real Prisma data)
//   3. Merge deterministic KPI cards from tool results
//   4. Build the LLM system prompt with REAL data + executive format
//   5. Compute action buttons based on intent
//
// The LLM is NEVER allowed to invent numbers — every metric in the response
// comes from real Prisma rows. The LLM only reasons over the real data and
// writes the executive narrative.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import { classifyIntent, getToolsForIntent, intentLabel } from './intent';
import { runToolSafe, TOOL_DEFS } from './tools';
import { loadMemorySnapshot, renderMemoryBlock, type MemorySnapshot } from '@/lib/oracle/memory-store';
import type {
  ActionButton,
  IntentId,
  MetricCard,
  PipelineResult,
  ToolExecution,
} from './types';

// ─── Action buttons per intent ────────────────────────────────────────────────

function actionsForIntent(intent: IntentId): ActionButton[] {
  const base: Record<IntentId, ActionButton[]> = {
    business_overview: [
      { id: 'report', label: 'Generate Report', icon: 'FileText', prompt: 'Generate a full business report with charts, KPIs, and recommendations', tone: 'primary' },
      { id: 'forecast', label: 'Forecast Cash Flow', icon: 'TrendingUp', prompt: 'Forecast my cash flow for the next 3 months' },
      { id: 'collections', label: 'Collect Payments', icon: 'Wallet', prompt: 'Show overdue invoices and draft payment reminders' },
    ],
    revenue: [
      { id: 'forecast', label: 'Forecast Revenue', icon: 'TrendingUp', prompt: 'Forecast my revenue for next month with confidence', tone: 'primary' },
      { id: 'top', label: 'Top Customers', icon: 'Users', prompt: 'Show my top 5 customers by revenue' },
    ],
    cash: [
      { id: 'forecast', label: 'Cash Runway', icon: 'TrendingUp', prompt: 'How many days of cash runway do I have?', tone: 'primary' },
      { id: 'banking', label: 'Open Banking', icon: 'Wallet', prompt: 'Show my recent bank transactions' },
    ],
    gst: [
      { id: 'gstr1', label: 'File GSTR-1', icon: 'FileCheck', prompt: 'Prepare my GSTR-1 for the current period' },
      { id: 'gstr3b', label: 'File GSTR-3B', icon: 'FileCheck', prompt: 'Prepare my GSTR-3B and show net GST payable' },
      { id: 'itc', label: 'Reconcile ITC', icon: 'Search', prompt: 'Reconcile my ITC with GSTR-2B', tone: 'primary' },
    ],
    customers: [
      { id: 'risky', label: 'Risky Clients', icon: 'AlertTriangle', prompt: 'Show my most risky clients and why', tone: 'primary' },
      { id: 'top', label: 'Top Customers', icon: 'Users', prompt: 'Show my top 5 customers by revenue' },
    ],
    invoices: [
      { id: 'create', label: 'Create Invoice', icon: 'Plus', prompt: 'Help me create a new invoice', tone: 'primary' },
      { id: 'overdue', label: 'View Overdue', icon: 'Clock', prompt: 'Show all overdue invoices' },
    ],
    collections: [
      { id: 'remind', label: 'Send Reminders', icon: 'Mail', prompt: 'Draft payment reminders for all overdue invoices', tone: 'primary' },
      { id: 'collect', label: 'Collect Payment', icon: 'Wallet', prompt: 'Generate payment links for top overdue invoices' },
    ],
    compliance: [
      { id: 'deadlines', label: 'Upcoming Deadlines', icon: 'Calendar', prompt: 'Show all upcoming GST and compliance deadlines', tone: 'primary' },
      { id: 'notices', label: 'Open Notices', icon: 'AlertTriangle', prompt: 'Show all open GST notices' },
    ],
    forecast: [
      { id: 'cash', label: 'Cash Forecast', icon: 'TrendingUp', prompt: 'Forecast my cash flow for the next 3 months', tone: 'primary' },
      { id: 'revenue', label: 'Revenue Forecast', icon: 'BarChart3', prompt: 'Forecast my revenue for next quarter' },
    ],
    expenses: [
      { id: 'analyze', label: 'Analyze Expenses', icon: 'Search', prompt: 'Break down my expenses by category', tone: 'primary' },
      { id: 'reduce', label: 'Reduce Costs', icon: 'TrendingDown', prompt: 'Where can I reduce costs?' },
    ],
    profit: [
      { id: 'margin', label: 'Margin Analysis', icon: 'Percent', prompt: 'Analyze my profit margin trend', tone: 'primary' },
    ],
    risk: [
      { id: 'full', label: 'Full Risk Report', icon: 'ShieldAlert', prompt: 'Give me a full risk assessment of my business', tone: 'primary' },
    ],
    banking: [
      { id: 'transactions', label: 'View Transactions', icon: 'Receipt', prompt: 'Show my recent bank transactions', tone: 'primary' },
    ],
    report: [
      { id: 'monthly', label: 'Monthly Report', icon: 'FileText', prompt: 'Generate a comprehensive monthly business report with charts and KPIs', tone: 'primary' },
      { id: 'export', label: 'Export Excel', icon: 'Download', prompt: 'Export my business summary as Excel' },
    ],
    general: [
      { id: 'overview', label: 'Business Overview', icon: 'LayoutDashboard', prompt: 'How is my business doing?', tone: 'primary' },
    ],
  };
  return base[intent] ?? base.general;
}

// ─── Executive system prompt ──────────────────────────────────────────────────

const EXECUTIVE_FORMAT = `
## EXECUTIVE RESPONSE FORMAT (MANDATORY)

You are answering as Oracle — an enterprise-grade AI CFO (think McKinsey, Deloitte, PwC, BCG — not ChatGPT). Every analytical answer MUST follow this structure using Markdown:

### Executive Summary
2-4 lines. The single most important takeaway. Quantify it with the real numbers above.

### Key Findings
3-5 bullet points. Each grounded in the real data above. Cite exact figures (₹, %, counts).

### Risk Assessment
If risks exist: bullet list with severity (🟢 Low / 🟡 Watch / 🟠 High / 🔴 Critical). If no material risks, write "No material risks identified."

### Recommendations
Prioritized numbered list (1 = highest priority). Each recommendation: action + rationale + expected impact. 3-5 items.

### Next Steps
2-3 concrete actions the user should take this week.

## HARD RULES (NEVER VIOLATE)
1. NEVER invent numbers. Only use figures from the REAL DATA block above.
2. If a metric is zero or missing, say so honestly. Do NOT fabricate.
3. If the real data shows no business has been set up, say: "You haven't added business data yet. Connect Zoho Books, add invoices, or sync your bank feed to unlock real CFO insights."
4. Think like a CEO + CFO + CA + Compliance Officer simultaneously.
5. Be direct and confident. No hedging. No "I think". Use "Your revenue is ₹X" not "I think your revenue is around ₹X".
6. Match the user's language (English / Hindi / Tamil etc.). If they ask in Hindi, reply in Hindi.
7. Keep the Executive Summary to 4 lines max. Be punchy. Be executive.
8. Use ₹ and Indian number format (Lakh/Crore) for all monetary values.`;

const ORACLE_IDENTITY = `# ORACLE — AI Chief Financial Officer
You are **Oracle**, the AI CFO for Indian businesses. You are the financial brain of the company — part CFO, part CA, part compliance officer, part business consultant.

You think like the senior partner at a Big-4 consulting firm. Your answers are crisp, data-driven, and immediately actionable. You never waffle. You never fabricate. Every number you cite comes from the real business data provided to you.`;

// ─── Public: run the pipeline ─────────────────────────────────────────────────

export interface PipelineOptions {
  /** The organization id (tenant scope). Without this, tools return "no data". */
  organizationId?: string;
  /** Optional memory snapshot (loaded separately to avoid double-loads). */
  memory?: MemorySnapshot;
  /** Called as each tool completes (for live UI trace). */
  onToolProgress?: (execution: ToolExecution) => void;
}

export async function runPipeline(
  question: string,
  opts: PipelineOptions,
): Promise<PipelineResult> {
  const orgId = opts.organizationId ?? '';

  // 1. Classify intent.
  const intent = classifyIntent(question);
  const toolIds = getToolsForIntent(intent);

  // 2. Load memory (if not provided).
  let memory = opts.memory;
  if (!memory) {
    try {
      memory = await loadMemorySnapshot();
    } catch {
      memory = { connectedServices: [], reportsGenerated: [], recentTopics: [], facts: [] };
    }
  }

  // 3. Run all tools in parallel. Emit progress as each completes.
  const toolPromises = toolIds.map(async (id) => {
    const { execution, result } = await runToolSafe(id, orgId);
    opts.onToolProgress?.(execution);
    return { execution, result };
  });
  const toolOutputs = await Promise.all(toolPromises);

  // 4. Collect executions + results.
  const tools: ToolExecution[] = toolOutputs.map((t) => t.execution);
  const realResults = toolOutputs.filter((t) => t.result !== null).map((t) => t.result!);

  // 5. Merge deterministic metric cards (dedupe by key, keep first).
  const metricMap = new Map<string, MetricCard>();
  for (const r of realResults) {
    if (r.metrics) {
      for (const m of r.metrics) {
        if (!metricMap.has(m.key)) metricMap.set(m.key, m);
      }
    }
  }
  // Order metrics by a canonical priority for executive display.
  const priority = ['revenue', 'profit', 'cash', 'gst', 'receivables', 'collection', 'customers', 'invoices', 'expenses', 'compliance', 'health', 'forecast', 'concentration'];
  const metrics: MetricCard[] = [];
  for (const k of priority) {
    const m = metricMap.get(k);
    if (m) metrics.push(m);
  }
  // Append any remaining metrics not in the priority list.
  for (const m of metricMap.values()) {
    if (!priority.includes(m.key)) metrics.push(m);
  }

  // 6. Build the real-data context block.
  const dataContext = realResults.length > 0
    ? realResults.map((r) => r.dataBlock).join('\n\n')
    : 'No real business data available. The user has not connected any business data source yet.';

  // 7. Build the system prompt.
  const memoryBlock = renderMemoryBlock(memory);
  const hasRealData = realResults.some((r) => r.recordCount > 0);
  const intentStr = intentLabel(intent);

  const systemPrompt = [
    ORACLE_IDENTITY,
    '',
    `## CURRENT ANALYSIS: ${intentStr}`,
    `The user asked: "${question.slice(0, 300)}"`,
    '',
    '## REAL BUSINESS DATA (collected just now from your database)',
    'Every number below is REAL — pulled from your Prisma database. Use ONLY these numbers. Do NOT invent or estimate.',
    '',
    dataContext,
    '',
    memoryBlock ? memoryBlock : '(No long-term memory yet.)',
    '',
    EXECUTIVE_FORMAT,
  ].join('\n');

  // 8. Compute actions.
  const actions = actionsForIntent(intent);

  return {
    intent,
    tools,
    metrics: metrics as MetricCard[],
    actions,
    dataContext,
    systemPrompt,
    hasRealData,
  };
}

// Re-exports for convenience.
export { classifyIntent, getToolsForIntent, intentLabel } from './intent';
export { TOOL_DEFS } from './tools';
export type { IntentId, MetricCard, ActionButton, ToolExecution, PipelineResult } from './types';
