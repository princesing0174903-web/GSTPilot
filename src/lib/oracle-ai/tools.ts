// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ Intelligence Layer — Tool Calling Framework
//
// A registry of tools the AI agents can invoke. Each tool declares its
// parameters, category, and an async executor. The engine detects tool calls
// in the LLM response (via a lightweight JSON protocol in the system prompt),
// runs them, and emits `tool-call` / `tool-result` stream events.
//
// Built-in tools (read-side, safe):
//   • query-business-context  — pulls VEYRO AI Context Engine snapshot
//   • search-knowledge        — searches the firm's curated knowledge base
//   • search-memory           — searches VEYRO AI Memory (oracle-core/memory)
//   • fetch-financials        — pulls invoice/expense/payment stats
//   • fetch-receivables       — pulls receivables aging summary
//   • fetch-payables          — pulls payables summary
//   • fetch-gst-returns       — pulls GSTR filing history
//   • fetch-notices           — pulls GST notices
//   • create-artifact         — produces a table/chart/report artifact
//   • create-task             — enqueues a background task
//   • list-tasks              — lists the task queue
//   • update-task             — updates a task's status/progress
//
// Write-side tools (would require approval) are stubbed for Phase 2.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ArtifactData,
  ArtifactKind,
  ToolContext,
  ToolDefinition,
  ToolExecutionResult,
} from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Registry ────────────────────────────────────────────────────────────────

const REGISTRY = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  REGISTRY.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return REGISTRY.get(name);
}

export function listRegisteredTools(): ToolDefinition[] {
  return Array.from(REGISTRY.values());
}

export function listToolSchemas(): {
  name: string;
  description: string;
  category: string;
  requiresApproval: boolean;
  parameters: { name: string; type: string; description: string; required: boolean; enum?: string[] }[];
}[] {
  return listRegisteredTools().map((t) => ({
    name: t.name,
    description: t.description,
    category: t.category,
    requiresApproval: t.requiresApproval ?? false,
    parameters: t.parameters.map((p) => ({
      name: p.name,
      type: p.type,
      description: p.description,
      required: p.required,
      enum: p.enum,
    })),
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function artifact(
  kind: ArtifactKind,
  title: string,
  data: ArtifactData,
): { kind: ArtifactKind; title: string; data: ArtifactData } {
  return { kind, title, data };
}

async function safeDynamic<T>(importer: () => Promise<T>): Promise<T | null> {
  try {
    return await importer();
  } catch {
    return null;
  }
}

// ─── Built-in Tool: query-business-context ──────────────────────────────────

registerTool({
  name: 'query-business-context',
  description:
    'Pull a live snapshot of the firm\'s business context — invoices, returns, bank accounts, recent activity, and all 17 connected Oracle modules. Use this before answering any question that depends on current business state.',
  category: 'data',
  parameters: [
    { name: 'scope', type: 'enum', description: 'Which slice of context to pull', required: false, enum: ['full', 'financials', 'compliance', 'operations'] },
  ],
  async execute(_args, ctx): Promise<ToolExecutionResult> {
    try {
      const mod = await safeDynamic(() => import('@/lib/oracle-core/context'));
      if (!mod) {
        return { ok: false, error: 'Context engine unavailable' };
      }
      const ctxSnapshot = await mod.gatherBusinessContext(ctx.firmId);
      const formatted = mod.formatContextForPrompt(ctxSnapshot);
      return {
        ok: true,
        result: { context: ctxSnapshot, formatted, tokensEstimate: Math.ceil(formatted.length / 4) },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'context fetch failed' };
    }
  },
});

// ─── Built-in Tool: search-knowledge ────────────────────────────────────────

registerTool({
  name: 'search-knowledge',
  description: 'Search the firm\'s curated knowledge base (GST, compliance, finance entries). Returns matching entries with title, content snippet, and category.',
  category: 'research',
  parameters: [
    { name: 'query', type: 'string', description: 'The search query', required: true },
    { name: 'category', type: 'enum', description: 'Filter by category', required: false, enum: ['gst', 'compliance', 'finance', 'operations', 'legal', 'general'] },
    { name: 'limit', type: 'number', description: 'Max results (default 5)', required: false },
  ],
  async execute(args, ctx): Promise<ToolExecutionResult> {
    try {
      const q = String(args.query ?? '').trim();
      const category = args.category as string | undefined;
      const limit = Math.min(20, Number(args.limit ?? 5));
      if (!q) return { ok: false, error: 'query is required' };

      const where: { firmId: string; OR: { title?: { contains: string }; content?: { contains: string } }[]; category?: string } = {
        firmId: ctx.firmId,
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      };
      if (category) where.category = category;

      const rows = await db.oracleAIKnowledge.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        take: limit,
      });

      return {
        ok: true,
        result: rows.map((r) => ({
          id: r.id,
          title: r.title,
          snippet: r.content.slice(0, 280),
          category: r.category,
          confidence: r.confidence,
          source: r.source,
        })),
        citations: rows.slice(0, 3).map((r) => ({
          title: r.title,
          url: r.source ?? undefined,
          snippet: r.content.slice(0, 180),
        })),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'knowledge search failed' };
    }
  },
});

// ─── Built-in Tool: search-memory ───────────────────────────────────────────

registerTool({
  name: 'search-memory',
  description: 'Search VEYRO AI Memory — the long-term store of past decisions, conversations, and learned facts about the business.',
  category: 'research',
  parameters: [
    { name: 'query', type: 'string', description: 'The search query', required: true },
    { name: 'limit', type: 'number', description: 'Max results (default 5)', required: false },
  ],
  async execute(args, ctx): Promise<ToolExecutionResult> {
    try {
      const q = String(args.query ?? '').trim();
      const limit = Math.min(20, Number(args.limit ?? 5));
      if (!q) return { ok: false, error: 'query is required' };
      const mod = await safeDynamic(() => import('@/lib/oracle-core/memory'));
      if (!mod) return { ok: false, error: 'memory engine unavailable' };
      const results = await mod.searchMemory({ query: q, firmId: ctx.firmId, limit });
      return { ok: true, result: results };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'memory search failed' };
    }
  },
});

// ─── Built-in Tool: fetch-financials ────────────────────────────────────────

registerTool({
  name: 'fetch-financials',
  description: 'Pull a summary of the firm\'s financials — invoices, purchases, expenses, payments, TDS, payroll. Returns counts and totals.',
  category: 'data',
  parameters: [],
  async execute(_args, ctx): Promise<ToolExecutionResult> {
    try {
      const [invMod, purMod, expMod, payMod] = await Promise.all([
        safeDynamic(() => import('@/lib/invoices/invoices')),
        safeDynamic(() => import('@/lib/invoices/purchases')),
        safeDynamic(() => import('@/lib/invoices/expenses')),
        safeDynamic(() => import('@/lib/invoices/payments')),
      ]);
      const [inv, pur, exp, pay] = await Promise.all([
        invMod ? invMod.getInvoiceStats() : Promise.resolve(null),
        purMod ? purMod.getPurchaseStats() : Promise.resolve(null),
        expMod ? expMod.getExpenseStats() : Promise.resolve(null),
        payMod ? payMod.getPaymentStats() : Promise.resolve(null),
      ]);
      const summary = {
        invoices: inv,
        purchases: pur,
        expenses: exp,
        payments: pay,
        firmId: ctx.firmId,
      };
      // Produce a metric artifact for visual context
      const totalInv = (inv as { total?: number } | null)?.total ?? 0;
      return {
        ok: true,
        result: summary,
        artifacts: [
          artifact('metric', 'Total Invoiced', {
            label: 'Total Invoiced',
            value: `₹${Math.round(totalInv).toLocaleString('en-IN')}`,
            delta: 0,
            sparkline: true,
          }),
        ],
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'financials fetch failed' };
    }
  },
});

// ─── Built-in Tool: fetch-receivables ───────────────────────────────────────

registerTool({
  name: 'fetch-receivables',
  description: 'Pull the receivables aging summary — outstanding invoices bucketed by age (0-30, 31-60, 61-90, 90+ days).',
  category: 'data',
  parameters: [],
  async execute(_args, _ctx): Promise<ToolExecutionResult> {
    try {
      const mod = await safeDynamic(() => import('@/lib/invoices/receivables'));
      if (!mod) return { ok: false, error: 'receivables module unavailable' };
      const summary = await mod.getReceivablesSummary();
      return { ok: true, result: summary };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'receivables fetch failed' };
    }
  },
});

// ─── Built-in Tool: fetch-payables ──────────────────────────────────────────

registerTool({
  name: 'fetch-payables',
  description: 'Pull the payables summary — outstanding bills to vendors bucketed by age.',
  category: 'data',
  parameters: [],
  async execute(_args, _ctx): Promise<ToolExecutionResult> {
    try {
      const mod = await safeDynamic(() => import('@/lib/invoices/payables'));
      if (!mod) return { ok: false, error: 'payables module unavailable' };
      const summary = await mod.getPayablesSummary();
      return { ok: true, result: summary };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'payables fetch failed' };
    }
  },
});

// ─── Built-in Tool: fetch-gst-returns ───────────────────────────────────────

registerTool({
  name: 'fetch-gst-returns',
  description: 'Pull the GSTR filing history — recent GSTR-1/3B filings with status, period, and tax liability.',
  category: 'data',
  parameters: [
    { name: 'limit', type: 'number', description: 'Max results (default 10)', required: false },
  ],
  async execute(args, _ctx): Promise<ToolExecutionResult> {
    try {
      const limit = Math.min(50, Number(args.limit ?? 10));
      const rows = await db.gSTRFiling.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return { ok: true, result: rows };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'gst returns fetch failed' };
    }
  },
});

// ─── Built-in Tool: fetch-notices ───────────────────────────────────────────

registerTool({
  name: 'fetch-notices',
  description: 'Pull recent GST notices received by the firm.',
  category: 'data',
  parameters: [
    { name: 'limit', type: 'number', description: 'Max results (default 10)', required: false },
  ],
  async execute(args, _ctx): Promise<ToolExecutionResult> {
    try {
      const limit = Math.min(50, Number(args.limit ?? 10));
      // Try the Notice table if it exists; degrade gracefully.
      let rows: unknown[] = [];
      try {
        rows = await (db as unknown as { notice?: { findMany: (args: unknown) => Promise<unknown[]> } }).notice?.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
        }) ?? [];
      } catch {
        rows = [];
      }
      return { ok: true, result: rows };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'notices fetch failed' };
    }
  },
});

// ─── Built-in Tool: create-artifact ─────────────────────────────────────────

registerTool({
  name: 'create-artifact',
  description: 'Produce a rich artifact (table, chart, report, document, code, json, kanban, metric) to display alongside the answer. Use this whenever the answer is better shown visually than described in prose.',
  category: 'analysis',
  parameters: [
    { name: 'kind', type: 'enum', description: 'Artifact type', required: true, enum: ['table', 'chart', 'report', 'document', 'code', 'json', 'kanban', 'metric'] },
    { name: 'title', type: 'string', description: 'Artifact title', required: true },
    { name: 'data', type: 'string', description: 'JSON-encoded artifact payload (schema depends on kind)', required: true },
  ],
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const kind = String(args.kind) as ArtifactKind;
      const title = String(args.title);
      const dataRaw = String(args.data);
      let data: ArtifactData;
      try {
        data = JSON.parse(dataRaw) as ArtifactData;
      } catch {
        return { ok: false, error: 'data must be valid JSON' };
      }
      return {
        ok: true,
        result: { kind, title, created: true },
        artifacts: [artifact(kind, title, data)],
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'artifact creation failed' };
    }
  },
});

// ─── Built-in Tool: create-task ─────────────────────────────────────────────

registerTool({
  name: 'create-task',
  description: 'Enqueue a background task in the AI Task Queue. Use for jobs that take time (research, report generation, batch processing).',
  category: 'action',
  parameters: [
    { name: 'title', type: 'string', description: 'Task title', required: true },
    { name: 'type', type: 'enum', description: 'Task type', required: true, enum: ['reasoning', 'research', 'report', 'data-fetch', 'tool-call', 'agent-run', 'batch'] },
    { name: 'priority', type: 'number', description: 'Priority 1 (highest) to 10 (lowest), default 5', required: false },
    { name: 'payload', type: 'string', description: 'JSON-encoded task input', required: false },
  ],
  async execute(args, ctx): Promise<ToolExecutionResult> {
    try {
      const title = String(args.title);
      const type = String(args.type) as OracleAITaskType;
      const priority = Math.max(1, Math.min(10, Number(args.priority ?? 5)));
      let payload: Record<string, unknown> = {};
      try {
        payload = args.payload ? JSON.parse(String(args.payload)) : {};
      } catch {
        payload = {};
      }
      const task = await db.oracleAITask.create({
        data: {
          firmId: ctx.firmId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          messageId: ctx.messageId,
          type,
          title,
          status: 'queued',
          priority,
          payload: JSON.stringify(payload),
        },
      });
      return { ok: true, result: { taskId: task.id, status: 'queued' } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'task creation failed' };
    }
  },
});

type OracleAITaskType = 'reasoning' | 'research' | 'report' | 'data-fetch' | 'tool-call' | 'agent-run' | 'batch';

// ─── Built-in Tool: list-tasks ──────────────────────────────────────────────

registerTool({
  name: 'list-tasks',
  description: 'List tasks in the AI Task Queue, optionally filtered by status.',
  category: 'data',
  parameters: [
    { name: 'status', type: 'enum', description: 'Filter by status', required: false, enum: ['queued', 'running', 'completed', 'failed', 'cancelled'] },
    { name: 'limit', type: 'number', description: 'Max results (default 20)', required: false },
  ],
  async execute(args, ctx): Promise<ToolExecutionResult> {
    try {
      const status = args.status as string | undefined;
      const limit = Math.min(100, Number(args.limit ?? 20));
      const where: { firmId: string; status?: string } = { firmId: ctx.firmId };
      if (status) where.status = status;
      const rows = await db.oracleAITask.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        take: limit,
      });
      return { ok: true, result: rows };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'task list failed' };
    }
  },
});

// ─── Built-in Tool: update-task ─────────────────────────────────────────────

registerTool({
  name: 'update-task',
  description: 'Update a task\'s status, progress, or result. Use to reflect completion or failure of a background job.',
  category: 'action',
  parameters: [
    { name: 'taskId', type: 'string', description: 'Task ID', required: true },
    { name: 'status', type: 'enum', description: 'New status', required: true, enum: ['queued', 'running', 'completed', 'failed', 'cancelled'] },
    { name: 'progress', type: 'number', description: 'Progress 0-100', required: false },
  ],
  async execute(args, ctx): Promise<ToolExecutionResult> {
    try {
      const taskId = String(args.taskId);
      const status = String(args.status);
      const progress = Math.max(0, Math.min(100, Number(args.progress ?? 0)));
      const data: { status: string; progress: number; startedAt?: Date; completedAt?: Date } = {
        status,
        progress,
      };
      if (status === 'running') data.startedAt = new Date();
      if (status === 'completed' || status === 'failed' || status === 'cancelled') data.completedAt = new Date();
      await db.oracleAITask.updateMany({ where: { id: taskId, firmId: ctx.firmId }, data });
      return { ok: true, result: { taskId, status, progress } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'task update failed' };
    }
  },
});

// ─── Execution helper ────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolExecutionResult> {
  const tool = getTool(name);
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }
  const start = Date.now();
  try {
    const result = await tool.execute(args, ctx);
    // Persist the tool call for audit
    try {
      await db.oracleAIToolCall.create({
        data: {
          messageId: ctx.messageId,
          sessionId: ctx.sessionId,
          firmId: ctx.firmId,
          userId: ctx.userId,
          toolName: name,
          args: JSON.stringify(args),
          result: result.result ? JSON.stringify(result.result) : null,
          status: result.ok ? 'success' : 'error',
          durationMs: Date.now() - start,
          error: result.error ?? null,
        },
      });
    } catch {
      // non-fatal — audit log failure shouldn't break the chat
    }
    return result;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'tool execution failed' };
  }
}
