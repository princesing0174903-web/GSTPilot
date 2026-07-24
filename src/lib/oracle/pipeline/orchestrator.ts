// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Pipeline Orchestrator (PROMPT 5: Autonomous AI CFO)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The orchestrator implements the full autonomous CFO pipeline:
//   1. Classify intent (keyword-based, instant)
//   2. Run all required tools IN PARALLEL (real Prisma data)
//   3. Run specialist agents IN PARALLEL (CFO, GST, Risk, Analyst, Collections,
//      Forecast, Compliance) — each investigates independently
//   4. Compute Business Scorecard (8 dimensions + overall)
//   5. Compute Confidence Tags for every conclusion
//   6. Build AI Timeline (Today / Week / Month / Upcoming / Missed / Events)
//   7. Generate Autonomous Insights (proactive observations)
//   8. Generate Structured Recommendations (with Reason/Impact/Priority/Outcome)
//   9. Generate Smart Follow-up Questions
//  10. Build Live Dashboard Update payload
//  11. Build the LLM system prompt with REAL data + Executive Brief format
//
// The user NEVER sees the internal agent reasoning — only the merged executive
// narrative the LLM writes over the real data + structured findings.
//
// The LLM is NEVER allowed to invent numbers — every metric/score comes from
// real Prisma rows. The LLM only writes the executive narrative.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import { classifyIntent, getToolsForIntent, intentLabel } from './intent';
import { runToolSafe, TOOL_DEFS, inr, pct } from './tools';
import { loadMemorySnapshot, renderMemoryBlock, type MemorySnapshot } from '@/lib/oracle/memory-store';
import { runAgents } from './agents';
import { computeBusinessScorecard } from './business-score';
import { buildConfidenceTags } from './confidence';
import { buildTimeline } from './timeline';
import { generateInsights } from './insights';
import { generateFollowUps } from './followups';
import { generateRecommendations } from './recommendations';
import { buildDashboardUpdate } from './dashboard';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import type {
  ActionButton,
  AgentReport,
  AITimeline,
  AutonomousInsight,
  BusinessScorecard,
  ConfidenceTag,
  IntentId,
  MetricCard,
  PipelineResult,
  SmartFollowUp,
  StructuredRecommendation,
  ToolExecution,
  DashboardUpdate,
} from './types';

// ─── Contextual action buttons per intent (PROMPT 5: contextual, not static) ──

function actionsForIntent(
  intent: IntentId,
  hasOverdue: boolean,
  hasGstLiability: boolean,
  lowCash: boolean,
): ActionButton[] {
  const base: Record<IntentId, ActionButton[]> = {
    business_overview: [
      { id: 'report', label: 'Generate CFO Report', icon: 'FileText', prompt: 'Generate a full CFO report with charts, KPIs, and recommendations', tone: 'primary' },
      ...(hasOverdue ? [{ id: 'collect', label: 'Collect Outstanding', icon: 'Wallet', prompt: 'Show overdue invoices and draft payment reminders' }] : []),
      ...(lowCash ? [{ id: 'forecast', label: 'Forecast Next Month', icon: 'TrendingUp', prompt: 'Forecast my cash flow for the next 3 months' }] : []),
      ...(hasGstLiability ? [{ id: 'gst', label: 'File GST', icon: 'FileCheck', prompt: 'Prepare my GSTR-3B and show net GST payable' }] : []),
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
      { id: 'notify', label: 'Notify Client', icon: 'Bell', prompt: 'Send a payment follow-up to my top overdue customer' },
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
      { id: 'mitigate', label: 'Risk Mitigation Plan', icon: 'Shield', prompt: 'Create a risk mitigation plan for my top 3 risks' },
    ],
    banking: [
      { id: 'transactions', label: 'View Transactions', icon: 'Receipt', prompt: 'Show my recent bank transactions', tone: 'primary' },
    ],
    report: [
      { id: 'monthly', label: 'Monthly Report', icon: 'FileText', prompt: 'Generate a comprehensive monthly business report with charts and KPIs', tone: 'primary' },
      { id: 'export', label: 'Export PDF', icon: 'Download', prompt: 'Export my business summary as PDF' },
    ],
    general: [
      { id: 'overview', label: 'Business Overview', icon: 'LayoutDashboard', prompt: 'How is my business doing?', tone: 'primary' },
    ],
  };
  return base[intent] ?? base.general;
}

// ─── PROMPT 5: Executive Brief format ─────────────────────────────────────────

const EXECUTIVE_BRIEF_FORMAT = `
## EXECUTIVE BRIEF FORMAT (MANDATORY — McKinsey/Deloitte/PwC/BCG/Goldman Sachs style)

You are answering as Oracle — an enterprise-grade AI CFO. Every analytical answer MUST follow this structure using Markdown. Be SHORT, EXECUTIVE, CONFIDENT. Never waffle.

### Executive Summary
2-4 lines. The single most important takeaway. Quantify with the real numbers above. Be punchy — a CEO should get the picture in 10 seconds.

### Key Findings
3-5 bullet points. Each grounded in the real data above. Cite exact figures (₹, %, counts). Lead with the most material finding.

### Business Opportunities
Bullet list of 2-3 upside opportunities (growth, margin, ITC recovery, market expansion). If none, write "No material opportunities identified in current data."

### Business Risks
Bullet list with severity (🟢 Low / 🟡 Watch / 🟠 High / 🔴 Critical). If no material risks, write "No material risks identified."

### Recommendations
Prioritized numbered list (1 = highest priority). For each recommendation include:
- **Action**: what to do (one line)
- **Why**: the underlying reason (one line)
- **Impact**: what changes if they act (one line)
- **Priority**: P0 / P1 / P2 / P3
- **Estimated Outcome**: measurable result (one line)
3-5 items. Match the priorities from the RECOMMENDATIONS block above.

### Action Buttons
Do not invent buttons — the UI renders them separately. Just end the narrative.

## ORACLE PERSONA (NEVER VIOLATE)
1. **Sound like McKinsey / BCG / PwC / Deloitte / Goldman Sachs** — never like ChatGPT.
2. Short. Executive. Professional. Confident. No hedging. No "I think". Use "Your revenue is ₹X" not "I think your revenue is around ₹X".
3. **NEVER invent numbers.** Only use figures from the REAL DATA block above. If a number is zero or missing, say so honestly.
4. **Explain WHY** every recommendation matters — reason + impact + priority + estimated outcome.
5. If the real data shows no business has been set up, say: "You haven't added business data yet. Connect Zoho Books, add invoices, or sync your bank feed to unlock real CFO insights."
6. Think like a CEO + CFO + CA + Compliance Officer + Risk Analyst simultaneously.
7. Match the user's language (English / Hindi / Tamil etc.). If they ask in Hindi, reply in Hindi.
8. Use ₹ and Indian number format (Lakh/Crore) for all monetary values.
9. Keep the Executive Summary to 4 lines max. Be punchy. Be executive.
10. **Never reveal internal agent reasoning.** The user sees only the merged executive narrative.`;

const ORACLE_IDENTITY = `# ORACLE — Autonomous AI Chief Financial Officer
You are **Oracle**, the AI CFO for Indian businesses. You are the financial brain of the company — part CFO, part CA, part compliance officer, part business consultant, part risk analyst.

You think like the senior partner at a Big-4 consulting firm (McKinsey, BCG, PwC, Deloitte, Goldman Sachs). Your answers are crisp, data-driven, and immediately actionable. You never waffle. You never fabricate. Every number you cite comes from the real business data provided to you.

Internally, you operate as a team of specialist agents (CFO, GST, Risk, Business Analyst, Collections, Forecast, Compliance) — each investigates independently, then you merge their findings into ONE executive answer. The user never sees the internal reasoning.`;

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
  for (const m of metricMap.values()) {
    if (!priority.includes(m.key)) metrics.push(m);
  }

  // 6. Fetch the canonical snapshot for agent/score/insight/timeline computation.
  //    (Tools already fetched it, but we re-fetch once for the reasoning layer
  //    to keep agents/scores/insights consistent. This is a single Prisma call.)
  let snapshot = null;
  if (orgId) {
    try {
      snapshot = await getBusinessSnapshot(orgId);
    } catch {
      snapshot = null;
    }
  }

  // 7. PROMPT 5: Run specialist agents IN PARALLEL.
  let agents: AgentReport = { findings: [], synthesis: '' };
  try {
    agents = await runAgents(snapshot, intent);
  } catch {
    agents = { findings: [], synthesis: 'Agent reasoning unavailable.' };
  }

  // 8. PROMPT 5: Compute Business Scorecard (8 dimensions + overall).
  let scorecard: BusinessScorecard | null = null;
  try {
    scorecard = computeBusinessScorecard(snapshot);
  } catch {
    scorecard = null;
  }

  // 9. PROMPT 5: Compute Confidence Tags.
  let confidences: ConfidenceTag[] = [];
  try {
    confidences = buildConfidenceTags(tools, snapshot);
  } catch {
    confidences = [];
  }

  // 10. PROMPT 5: Build AI Timeline.
  let timeline: AITimeline = { items: [] };
  try {
    timeline = await buildTimeline(snapshot, orgId);
  } catch {
    timeline = { items: [] };
  }

  // 11. PROMPT 5: Generate Autonomous Insights.
  let insights: AutonomousInsight[] = [];
  try {
    insights = generateInsights(snapshot, intent);
  } catch {
    insights = [];
  }

  // 12. PROMPT 5: Generate Structured Recommendations.
  let recommendations: StructuredRecommendation[] = [];
  try {
    recommendations = generateRecommendations(snapshot, intent);
  } catch {
    recommendations = [];
  }

  // 13. PROMPT 5: Generate Smart Follow-up Questions.
  let followUps: SmartFollowUp[] = [];
  try {
    followUps = generateFollowUps(snapshot, intent, insights);
  } catch {
    followUps = [];
  }

  // 14. PROMPT 5: Build Live Dashboard Update payload.
  let dashboard: DashboardUpdate | null = null;
  try {
    dashboard = buildDashboardUpdate(snapshot, agents.findings, timeline);
  } catch {
    dashboard = null;
  }

  // 15. Build the real-data context block.
  const dataContext = realResults.length > 0
    ? realResults.map((r) => r.dataBlock).join('\n\n')
    : 'No real business data available. The user has not connected any business data source yet.';

  // 16. Build the agent findings block (internal context for the LLM).
  const agentBlock = agents.findings.length > 0
    ? agents.findings.map((f) =>
      `- [${f.agent.toUpperCase()}] ${f.headline} (severity: ${f.severity}, confidence: ${f.confidence}%)\n  Analysis: ${f.analysis}\n  Evidence: ${f.evidence.join(' · ')}`
    ).join('\n')
    : 'No agent findings.';

  // 17. Build the scorecard block.
  const scorecardBlock = scorecard ? [
    'BUSINESS SCORECARD (computed from real data — use these scores in your narrative):',
    `- Revenue Score: ${scorecard.revenue.score}/100 (${scorecard.revenue.grade}) — ${scorecard.revenue.reason}`,
    `- Profitability Score: ${scorecard.profitability.score}/100 (${scorecard.profitability.grade}) — ${scorecard.profitability.reason}`,
    `- Liquidity Score: ${scorecard.liquidity.score}/100 (${scorecard.liquidity.grade}) — ${scorecard.liquidity.reason}`,
    `- Compliance Score: ${scorecard.compliance.score}/100 (${scorecard.compliance.grade}) — ${scorecard.compliance.reason}`,
    `- Customer Health: ${scorecard.customerHealth.score}/100 (${scorecard.customerHealth.grade}) — ${scorecard.customerHealth.reason}`,
    `- Risk Resilience: ${scorecard.risk.score}/100 (${scorecard.risk.grade}) — ${scorecard.risk.reason}`,
    `- Growth Score: ${scorecard.growth.score}/100 (${scorecard.growth.grade}) — ${scorecard.growth.reason}`,
    `- OVERALL BUSINESS HEALTH: ${scorecard.overall.score}/100 (${scorecard.overall.grade})`,
  ].join('\n') : 'No scorecard available (no business data).';

  // 18. Build the confidence block.
  const confidenceBlock = confidences.length > 0
    ? confidences.map((c) => `- ${c.label}: ${c.confidence}% confidence (${c.rationale})`).join('\n')
    : 'No confidence tags.';

  // 19. Build the recommendations block (for the LLM to reference).
  const recBlock = recommendations.length > 0
    ? recommendations.map((r, i) =>
      `${i + 1}. [${r.priority}] ${r.title}\n   Why: ${r.reason}\n   Impact: ${r.impact}\n   Estimated Outcome: ${r.estimatedOutcome}`
    ).join('\n')
    : 'No structured recommendations.';

  // 20. Build the system prompt.
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
    '## SPECIALIST AGENT FINDINGS (internal — merge into ONE executive answer)',
    'These are the independent findings from your internal specialist agents. Synthesize them into a single coherent narrative. The user must NEVER see these raw agent notes — only the merged executive answer.',
    '',
    agentBlock,
    '',
    '## BUSINESS SCORECARD (use these exact scores)',
    scorecardBlock,
    '',
    '## CONFIDENCE TAGS (cite these confidence levels in your narrative)',
    confidenceBlock,
    '',
    '## STRUCTURED RECOMMENDATIONS (use these in your Recommendations section)',
    recBlock,
    '',
    memoryBlock ? memoryBlock : '(No long-term memory yet.)',
    '',
    EXECUTIVE_BRIEF_FORMAT,
  ].join('\n');

  // 21. Compute contextual action buttons.
  const hasOverdue = (snapshot?.overdueInvoiceCount ?? 0) > 0;
  const hasGstLiability = (snapshot?.gstLiability ?? 0) > 0;
  const lowCash = isFinite(snapshot?.runwayDays ?? Infinity) && (snapshot?.runwayDays ?? Infinity) < 60;
  const actions = actionsForIntent(intent, hasOverdue, hasGstLiability, lowCash);

  return {
    intent,
    tools,
    metrics: metrics as MetricCard[],
    actions,
    agents,
    confidences,
    scorecard,
    timeline,
    insights,
    followUps,
    recommendations,
    dashboard,
    dataContext,
    systemPrompt,
    hasRealData,
  };
}

// Re-exports for convenience.
export { classifyIntent, getToolsForIntent, intentLabel } from './intent';
export { TOOL_DEFS, inr, pct } from './tools';
export { runAgents } from './agents';
export { computeBusinessScorecard } from './business-score';
export { buildConfidenceTags } from './confidence';
export { buildTimeline } from './timeline';
export { generateInsights } from './insights';
export { generateFollowUps } from './followups';
export { generateRecommendations } from './recommendations';
export { buildDashboardUpdate } from './dashboard';
export type {
  IntentId,
  MetricCard,
  ActionButton,
  ToolExecution,
  PipelineResult,
  AgentFinding,
  AgentReport,
  BusinessScorecard,
  ConfidenceTag,
  AITimeline,
  AutonomousInsight,
  SmartFollowUp,
  StructuredRecommendation,
  DashboardUpdate,
} from './types';
