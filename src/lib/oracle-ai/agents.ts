// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ Intelligence Layer — Multi-Agent Architecture
//
// Manages the agent roster: built-in personas (Oracle, CFO, Compliance, Research,
// Operations) plus firm-defined custom agents. Each agent carries a system
// prompt, allowed tools, model override, temperature, and brand color/icon.
//
// Agents are resolved at chat time by the engine — the chosen agent's system
// prompt is injected into the LLM call. The handoff mechanism lets one agent
// delegate a turn to another (emitted as an `agent-handoff` stream event).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { OracleAIAgent } from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Built-in agent personas ─────────────────────────────────────────────────
// These are seeded on first access via `ensureBuiltInAgents()`. Each is firm-
// scoped (firmId = the current firm) so different firms can edit/disable them
// independently.

interface BuiltInAgentSeed {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  model: string | null;
  color: string;
  icon: string;
  temperature: number;
}

const BUILT_IN_AGENTS: BuiltInAgentSeed[] = [
  {
    name: 'Oracle',
    role: 'Chief Intelligence Officer',
    description:
      'The primary orchestrator. Handles general strategy, synthesis across domains, and delegates to specialist agents when deeper expertise is required.',
    systemPrompt: `You are Oracle — the Chief Intelligence Officer of VEYRO.
You are calm, precise, and relentlessly useful. You think in structured steps and explain your reasoning transparently.
Your job is to either answer directly (when you have full context) or to delegate to a specialist agent (CFO, Compliance, Research, Operations) when the question demands deep domain expertise.
Always cite the data source you relied on. When you produce structured outputs (tables, charts, reports), emit them as artifacts.
Never fabricate numbers. If data is missing, say so and propose how to get it.
Match the user's language and tone. Be concise by default; expand only for complex topics.`,
    tools: ['query-business-context', 'search-knowledge', 'search-memory', 'create-artifact', 'delegate-agent'],
    model: null,
    color: 'emerald',
    icon: 'Sparkles',
    temperature: 0.4,
  },
  {
    name: 'CFO',
    role: 'Chief Financial Officer',
    description:
      'Financial reasoning specialist — cash flow, receivables, payables, working capital, GST liability, forecasts, and ROI analysis.',
    systemPrompt: `You are the AI CFO of VEYRO.
You reason like a seasoned CFO: you think in INR, in financial years, in cash conversion cycles, and in risk-adjusted returns.
Always pull live financial context before answering. Quantify everything. Show the math.
When proposing an action, give: expected ROI, payback period, risk level, and a rollback plan.
Be direct about cash problems — founders need the truth, fast. Lead with the number, then the explanation.
Format financial figures in Indian convention (₹X.XX L / Cr).`,
    tools: ['query-business-context', 'search-knowledge', 'search-memory', 'create-artifact', 'fetch-financials', 'fetch-receivables', 'fetch-payables'],
    model: null,
    color: 'teal',
    icon: 'TrendingUp',
    temperature: 0.3,
  },
  {
    name: 'Compliance',
    role: 'Compliance & GST Officer',
    description:
      'GST law, filing deadlines, notice response, and regulatory compliance specialist. Cites statute and CBIC circulars.',
    systemPrompt: `You are the Compliance Officer of VEYRO.
You are an expert in Indian GST law, CBIC circulars, GSTN procedures, and filing deadlines (GSTR-1, GSTR-3B, GSTR-9, ITC reconciliation).
Always cite the specific section, rule, or circular number when giving compliance advice. Distinguish between law, rule, circular, and practice.
When the law is ambiguous, say so explicitly. Never give false certainty on compliance — the cost of being wrong is too high.
Flag upcoming deadlines and notice-response windows. When a notice is received, propose a structured response with the legal basis.
If you are unsure of the current state of a section (GST law changes frequently), recommend verifying against the latest CBIC notification.`,
    tools: ['query-business-context', 'search-knowledge', 'search-memory', 'create-artifact', 'fetch-gst-returns', 'fetch-notices'],
    model: null,
    color: 'amber',
    icon: 'ShieldCheck',
    temperature: 0.2,
  },
  {
    name: 'Research',
    role: 'Research Analyst',
    description:
      'Deep research specialist — gathers, synthesizes, and cites information. Produces research reports as artifacts.',
    systemPrompt: `You are the Research Analyst of VEYRO.
Your job is to gather information, cross-reference multiple sources, and produce clear, citable research artifacts.
Always cite your sources (URL + title + snippet). When sources conflict, present both and explain the disagreement.
Structure research outputs as reports with: executive summary, key findings (with evidence), methodology, and confidence level.
Prefer primary sources (government sites, official filings) over secondary commentary. Note the access date for any URL citation.`,
    tools: ['search-knowledge', 'search-memory', 'create-artifact', 'web-search', 'web-read'],
    model: null,
    color: 'sky',
    icon: 'Search',
    temperature: 0.4,
  },
  {
    name: 'Operations',
    role: 'Operations Manager',
    description:
      'Workflow, task, and process specialist. Manages the task queue, schedules background jobs, and tracks execution.',
    systemPrompt: `You are the Operations Manager of VEYRO.
You turn strategy into execution: you break goals into tasks, queue background jobs, track progress, and surface blockers.
When the user asks for something to be done, create a task in the queue with a clear title, type, and priority.
Report on the status of running tasks. When a task fails, diagnose and propose a retry or escalation.
Think in workflows: dependencies, sequencing, parallelism, and checkpoints. Always confirm the next action.`,
    tools: ['query-business-context', 'search-memory', 'create-artifact', 'create-task', 'list-tasks', 'update-task'],
    model: null,
    color: 'violet',
    icon: 'Workflow',
    temperature: 0.4,
  },
];

// ─── Serialization ───────────────────────────────────────────────────────────

function serializeAgent(r: {
  id: string;
  firmId: string;
  name: string;
  role: string;
  description: string | null;
  systemPrompt: string;
  tools: string;
  model: string | null;
  color: string;
  icon: string;
  temperature: number;
  isBuiltIn: boolean;
  isActive: boolean;
  invocationCount: number;
  lastInvokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OracleAIAgent {
  let tools: string[] = [];
  try {
    tools = JSON.parse(r.tools) as string[];
  } catch {
    tools = [];
  }
  return {
    id: r.id,
    firmId: r.firmId,
    name: r.name,
    role: r.role,
    description: r.description,
    systemPrompt: r.systemPrompt,
    tools,
    model: r.model,
    color: r.color,
    icon: r.icon,
    temperature: r.temperature,
    isBuiltIn: r.isBuiltIn,
    isActive: r.isActive,
    invocationCount: r.invocationCount,
    lastInvokedAt: r.lastInvokedAt ? r.lastInvokedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Ensure the built-in agent personas exist for the given firm. Idempotent. */
export async function ensureBuiltInAgents(firmId: string = FIRM_ID): Promise<void> {
  for (const seed of BUILT_IN_AGENTS) {
    const existing = await db.oracleAIAgent.findFirst({
      where: { firmId, name: seed.name, isBuiltIn: true },
      select: { id: true },
    });
    if (!existing) {
      await db.oracleAIAgent.create({
        data: {
          firmId,
          name: seed.name,
          role: seed.role,
          description: seed.description,
          systemPrompt: seed.systemPrompt,
          tools: JSON.stringify(seed.tools),
          model: seed.model,
          color: seed.color,
          icon: seed.icon,
          temperature: seed.temperature,
          isBuiltIn: true,
          isActive: true,
        },
      });
    }
  }
}

/** List all active agents for a firm (built-in + custom). */
export async function listAgents(firmId: string = FIRM_ID): Promise<OracleAIAgent[]> {
  await ensureBuiltInAgents(firmId);
  const rows = await db.oracleAIAgent.findMany({
    where: { firmId, isActive: true },
    orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
  });
  return rows.map(serializeAgent);
}

/** Get a single agent by id. */
export async function getAgent(agentId: string, firmId: string = FIRM_ID): Promise<OracleAIAgent | null> {
  const row = await db.oracleAIAgent.findFirst({
    where: { id: agentId, firmId },
  });
  return row ? serializeAgent(row) : null;
}

/** Get the default agent (Oracle). */
export async function getDefaultAgent(firmId: string = FIRM_ID): Promise<OracleAIAgent> {
  await ensureBuiltInAgents(firmId);
  const row = await db.oracleAIAgent.findFirst({
    where: { firmId, name: 'Oracle', isBuiltIn: true },
  });
  if (!row) {
    // Fallback: first active agent.
    const any = await db.oracleAIAgent.findFirst({ where: { firmId, isActive: true } });
    if (!any) throw new Error('No active agents found');
    return serializeAgent(any);
  }
  return serializeAgent(row);
}

/** Increment an agent's invocation counter (called after each turn). */
export async function recordAgentInvocation(agentId: string): Promise<void> {
  await db.oracleAIAgent.update({
    where: { id: agentId },
    data: {
      invocationCount: { increment: 1 },
      lastInvokedAt: new Date(),
    },
  });
}

/** Create a custom agent. */
export async function createCustomAgent(
  input: {
    name: string;
    role: string;
    description?: string;
    systemPrompt: string;
    tools?: string[];
    model?: string | null;
    color?: string;
    icon?: string;
    temperature?: number;
  },
  firmId: string = FIRM_ID,
): Promise<OracleAIAgent> {
  const row = await db.oracleAIAgent.create({
    data: {
      firmId,
      name: input.name,
      role: input.role,
      description: input.description ?? null,
      systemPrompt: input.systemPrompt,
      tools: JSON.stringify(input.tools ?? []),
      model: input.model ?? null,
      color: input.color ?? 'emerald',
      icon: input.icon ?? 'Sparkles',
      temperature: input.temperature ?? 0.4,
      isBuiltIn: false,
      isActive: true,
    },
  });
  return serializeAgent(row);
}
