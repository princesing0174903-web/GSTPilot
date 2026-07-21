// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ Brain — Streaming Chat API
// POST /api/oracle/brain
//
// The real AI brain of GSTPilot. Reads live business data via tools, takes
// real actions (create invoice, send reminder), persists conversations + memory.
//
// Request body:
//   { message: string, sessionId?: string, orgId: string, userId?: string }
//
// Response: Server-Sent Events stream
//   data: {"type":"session","sessionId":"..."}           — session created
//   data: {"type":"token","text":"..."}                  — LLM token (streaming)
//   data: {"type":"tool-start","tool":"...","args":{}}   — tool executing
//   data: {"type":"tool-result","tool":"...","result":{}}— tool finished
//   data: {"type":"tool-error","tool":"...","error":".."}— tool failed
//   data: {"type":"done","messageId":"..."}              — stream complete
//   data: {"type":"error","error":"..."}                 — fatal error
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import {
  ORACLE_TOOL_MAP,
  CONFIRMATION_REQUIRED_TOOLS,
  parseToolCalls,
  stripToolCalls,
  buildToolsPromptBlock,
  type ToolContext,
} from '@/lib/oracle/brain/tools';
import { getWorkspaceMemoryBlock, autoExtractFacts } from '@/lib/oracle/brain/memory';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
// ─── Oracle Action Engine (generic) ───────────────────────────────────────────
// Importing the barrel registers all built-in actions as a side-effect.
// buildConfirmation() replaces the old inline buildActionPreview() — the brain
// route no longer needs to know about specific actions. Adding a new action
// (GST filing, Zoho sync, Banking, Reports, WhatsApp, Email, etc.) is now a
// pure-additive change in src/lib/oracle/action-engine/definitions/.
import '@/lib/oracle/action-engine';
import { buildConfirmation, isRegisteredAction } from '@/lib/oracle/action-engine';
import { planWorkflow, looksLikeWorkflowRequest } from '@/lib/oracle/workflow-engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TOOL_ITERATIONS = 4;

interface BrainMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

// ─── Action preview helper ───────────────────────────────────────────────────
// DEPRECATED — replaced by the generic Action Engine (src/lib/oracle/action-engine).
// This function is kept only as a fallback for confirmation-required tools that
// are NOT yet registered as Action Engine actions (e.g. createTask,
// generateGSTReturn). All five Phase-2 actions (createInvoice, createCustomer,
// createPayment, createExpense, sendReminder) are registered and use
// buildConfirmation() instead.
function buildActionPreviewFallback(tool: string, args: Record<string, any>): string {
  switch (tool) {
    case 'createTask': {
      const title = String(args.title ?? 'new task');
      const due = args.dueDate ? ` due ${args.dueDate}` : '';
      const pri = args.priority ? ` (${args.priority})` : '';
      return `Create task: "${title}"${due}${pri}`;
    }
    case 'generateGSTReturn': {
      const type = String(args.returnType ?? 'GSTR-1');
      const period = args.period ? String(args.period) : '—';
      return `Generate ${type} return for period ${period}`;
    }
    default:
      return `Execute action: ${tool}`;
  }
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const message: string = String(body.message ?? '').trim();
  const orgId: string = String(body.orgId ?? '').trim();
  const userId: string | undefined = body.userId ? String(body.userId) : undefined;
  let sessionId: string | undefined = body.sessionId ? String(body.sessionId) : undefined;

  if (!message) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!orgId) {
    return new Response(JSON.stringify({ error: 'orgId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Resolve / create session ───────────────────────────────────────────────
  if (sessionId) {
    const existing = await db.oracleAISession.findFirst({
      where: { id: sessionId, firmId: orgId },
      select: { id: true },
    }).catch(() => null);
    if (!existing) sessionId = undefined;
  }
  if (!sessionId) {
    const title = message.length > 50 ? message.slice(0, 50) + '…' : message;
    const session = await db.oracleAISession.create({
      data: {
        firmId: orgId,
        userId,
        title,
        status: 'active',
        modelUsed: 'glm-4.6',
        messageCount: 0,
        tokensUsed: 0,
        metadata: '{}',
      },
    });
    sessionId = session.id;
  }

  // ─── Load conversation history (last 20 messages) ───────────────────────────
  const historyRows = await db.oracleAIMessage.findMany({
    where: { sessionId, status: { in: ['completed', 'streaming'] } },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { role: true, content: true, parts: true },
  }).catch(() => []);

  const history: BrainMessage[] = historyRows.map(r => {
    let content = r.content ?? '';
    // Re-hydrate tool results from parts
    try {
      const parts = JSON.parse(r.parts || '[]');
      for (const p of parts) {
        if (p.type === 'tool-result' && p.summary) {
          content += `\n\n[Tool: ${p.tool}]\n${p.summary}`;
        }
      }
    } catch {}
    return {
      role: (r.role === 'user' || r.role === 'assistant' || r.role === 'system' || r.role === 'tool' ? r.role : 'assistant') as BrainMessage['role'],
      content,
    };
  });

  // ─── Persist the user's message ─────────────────────────────────────────────
  const userMessage = await db.oracleAIMessage.create({
    data: {
      sessionId,
      firmId: orgId,
      userId,
      role: 'user',
      content: message,
      status: 'completed',
      parts: '[]',
    },
  });

  // ─── Build the system prompt ────────────────────────────────────────────────
  // Context Builder: gather business snapshot + recent activity + integrations
  const [memoryBlock, snapshot, recentActivity, integrations] = await Promise.all([
    getWorkspaceMemoryBlock(orgId).catch(() => '(memory unavailable)'),
    getBusinessSnapshot(orgId).catch(() => null),
    // Fetch recent activity (last 5 events)
    (async () => {
      try {
        const acts = await db.activity.findMany({
          where: { firmId: orgId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { type: true, description: true, createdAt: true },
        });
        if (acts.length > 0) return acts;
        // Synthesize from source tables if Activity table is empty
        const [invs, pays] = await Promise.all([
          db.invoice.findMany({ where: { client: { firmId: orgId } }, orderBy: { createdAt: 'desc' }, take: 3, select: { invoiceNumber: true, buyerName: true, totalAmount: true, createdAt: true, client: { select: { tradeName: true } } } }).catch(() => []),
          db.payment.findMany({ where: { client: { firmId: orgId } }, orderBy: { createdAt: 'desc' }, take: 2, select: { amount: true, createdAt: true, partyName: true } }).catch(() => []),
        ]);
        const events: Array<{ type: string; description: string; createdAt: Date }> = [];
        for (const i of invs as any[]) {
          const name = i.buyerName ?? i.client?.tradeName ?? '—';
          events.push({ type: 'invoice', description: `Invoice ${i.invoiceNumber ?? '—'} for ${name} (₹${(i.totalAmount ?? 0).toLocaleString('en-IN')})`, createdAt: i.createdAt });
        }
        for (const p of pays as any[]) events.push({ type: 'payment', description: `Payment ₹${(p.amount ?? 0).toLocaleString('en-IN')} ${p.partyName ? 'from ' + p.partyName : 'received'}`, createdAt: p.createdAt });
        return events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);
      } catch { return []; }
    })(),
    // Fetch connected integrations
    (async () => {
      const result: Array<{ provider: string; connected: boolean }> = [];
      try {
        const g = await db.googleWorkspaceToken.count({ where: { organizationId: orgId, revokedAt: null } }).catch(() => 0);
        result.push({ provider: 'Google Workspace', connected: g > 0 });
      } catch {}
      try {
        const z = await db.zohoBooksToken.count({ where: { organizationId: orgId, revokedAt: null } }).catch(() => 0);
        result.push({ provider: 'Zoho Books', connected: z > 0 });
      } catch {}
      return result;
    })(),
  ]);

  const snapshotContext = snapshot
    ? `## Live Business Context (auto-injected — Oracle already knows these numbers)

Company financials as of ${new Date(snapshot.generatedAt).toLocaleString('en-IN')}:
- Revenue (FY): ₹${snapshot.revenue.toLocaleString('en-IN')}
- Revenue this month: ₹${snapshot.revenueThisMonth.toLocaleString('en-IN')} (last month: ₹${snapshot.revenueLastMonth.toLocaleString('en-IN')})
- Expenses (FY): ₹${snapshot.expenses.toLocaleString('en-IN')}
- Profit: ₹${snapshot.profit.toLocaleString('en-IN')} (${(snapshot.profitMargin * 100).toFixed(1)}% margin)
- Cash: ₹${snapshot.cash.toLocaleString('en-IN')}
- Receivables: ₹${snapshot.receivables.toLocaleString('en-IN')} (${snapshot.overdueInvoiceCount} overdue invoices = ₹${snapshot.overdueReceivables.toLocaleString('en-IN')})
- Payables: ₹${snapshot.payables.toLocaleString('en-IN')}
- GST liability: ₹${snapshot.gstLiability.toLocaleString('en-IN')} (output ₹${snapshot.outputTax.toLocaleString('en-IN')} - input ₹${snapshot.inputTax.toLocaleString('en-IN')})
- Customers: ${snapshot.customerCount}, Invoices: ${snapshot.invoiceCount}
- Health score: ${snapshot.healthScore}/100 (${snapshot.healthScoreLabel}), Risk: ${snapshot.riskScore}/100
- Collection rate: ${(snapshot.collectionRate * 100).toFixed(1)}%, avg days to pay: ${snapshot.avgDaysToPay}
- Forecast: next month revenue ₹${snapshot.forecast.nextMonthRevenue.toLocaleString('en-IN')} (${snapshot.forecast.trend})`
    : '## Live Business Context\n(No business data yet — the database is empty. If asked for numbers, say "I don\'t have enough business data." Use tools to query and createInvoice to add data.)';

  const activityContext = (recentActivity && recentActivity.length > 0)
    ? `\n\n## Latest Activity (auto-injected)\n${recentActivity.map(a => `- ${new Date(a.createdAt).toLocaleDateString('en-IN')}: ${a.description}`).join('\n')}`
    : '\n\n## Latest Activity\n(No recent activity recorded.)';

  const integrationContext = (integrations && integrations.length > 0)
    ? `\n\n## Connected Integrations (auto-injected)\n${integrations.map(i => `- ${i.provider}: ${i.connected ? '✓ Connected' : '✗ Not connected'}`).join('\n')}`
    : '\n\n## Connected Integrations\n(No integrations configured.)';

  const systemPrompt = `You are Oracle — the AI brain of GSTPilot, an Indian GST + finance management platform.

## Your Identity
You are not a chatbot. You are an AI employee — a virtual CFO + COO + Compliance Officer rolled into one. You think in numbers, reason about business health, and take real actions. You speak with the precision of a seasoned finance professional and the warmth of a trusted advisor.

## How You Think
1. When asked about data, you CALL TOOLS to read real numbers — never guess, never fabricate.
2. When you see a problem (overdue invoices, declining cashflow, GST due), you REASON about the cause and recommend specific actions.
3. When the user asks you to do something (create invoice, send reminder, save a fact), you EXECUTE via a tool call and confirm the result.
4. You think in INR (Indian Rupees) and Indian financial context (GST, GSTR-1, GSTR-3B, ITC, TDS, financial year April–March).
5. You are honest about uncertainty. If data is missing or a prediction is uncertain, say so.

## How You Speak
- Concise by default. Lead with the answer, then support it.
- Use numbers, not adjectives. "₹4.2L, up 12% MoM" — not "revenue is good".
- Use markdown: **bold** for key numbers, bullet lists for breakdowns, tables for comparisons.
- For multi-part answers, use short headers (### Revenue, ### Cashflow, etc.).
- Never say "as an AI" or "I don't have access to..." — you DO have access, via tools.
- Match the user's language (English / Hindi / Hinglish — whatever they use).

## When to Call Tools
- "How much revenue?" → use auto-injected snapshot, or call getBusinessSnapshot
- "Cash position?" → use auto-injected snapshot (cash field)
- "Receivables?" → use auto-injected snapshot (receivables field)
- "How many customers?" → use auto-injected snapshot (customerCount)
- "How many invoices?" → use auto-injected snapshot (invoiceCount)
- "Pending collections?" → use auto-injected snapshot (receivables + overdueReceivables)
- "Business health?" → use auto-injected snapshot (healthScore + healthScoreLabel)
- "Largest customer?" or "Top revenue customer?" → call getTopCustomer
- "Newest invoice?" or "Latest invoice?" → call getNewestInvoice
- "Overdue invoices?" or "Who owes me money?" → call getOverdueCustomers
- "Recent activity?" or "What happened recently?" → call getRecentActivity (or use auto-injected activity)
- "Connected integrations?" → call getConnectedIntegrations or getIntegrationStatus
- "Is Zoho connected?" or "Check Google connection" → call getIntegrationStatus with provider
- "Average invoice value?" → call getInvoiceMetrics
- "What's my GST liability?" → call getGSTStatus (or use auto-injected context)
- "Pending filings?" or "What returns are due?" → call getPendingFilings
- "Bank accounts?" or "Bank balance?" → call getBankAccounts
- "Create an invoice for X" → call createInvoice with items
- "Update/edit invoice X" → call updateInvoice with id/invoiceNumber + fields
- "Delete invoice X" → call deleteInvoice (destructive — always confirms)
- "Duplicate invoice X" → call duplicateInvoice
- "Send/email invoice X" → call sendInvoice with channel
- "Create a customer" → call createCustomer
- "Update/edit customer X" → call updateCustomer
- "Delete customer X" → call deleteCustomer (destructive — always confirms)
- "Record an expense" → call createExpense
- "Update/edit expense" → call updateExpense
- "Delete expense" → call deleteExpense (destructive)
- "Record a payment" → call createPayment
- "Mark invoice X as paid" → call markInvoicePaid
- "Refund payment X" → call refundPayment (destructive — always confirms)
- "Prepare GSTR-3B for January" → call prepareGstr3b with period
- "Generate GST return" → call generateGSTReturn
- "Add a lead" → call addCrmLead
- "Schedule a follow-up with X" → call scheduleFollowUp
- "Invite a team member" → call inviteTeamMember
- "Update my profile" → call updateProfile
- "Connect bank account" → call connectBankAccount
- "Export a report" → call exportReport with reportType
- "Sync Zoho" → call syncZoho
- "Sync Google" → call syncGoogle
- "Send reminders to overdue customers" → call sendReminder
- "Remember that my GSTIN is..." → call saveMemory
- "What do you know about my business?" → call recallMemory with empty query
- "Bank accounts?" or "Bank balance?" → call getBankAccounts (legacy table) OR getBankingIntelligence with the question (richer answer)
- "How much money do I have?" or "What's my bank balance?" → call getBankingIntelligence with the question
- "Show this month's expenses" → call getBankingIntelligence
- "Which invoices are unpaid?" → call getBankingIntelligence
- "How much cash will I have next week?" → call getBankingIntelligence
- "Why is cash flow decreasing?" → call getBankingIntelligence
- "Show suspicious transactions" → call getBankingIntelligence
- "What are my largest expenses?" → call getBankingIntelligence
- "Which customer pays late?" → call getBankingIntelligence
- "Import this bank statement" → call importStatement with format + rawContent + accountId
- "Reconcile my transactions" → call reconcileTransactions (mode all)
- "Categorize all transactions" → call categorizeTransactions (mode rules)
- "Forecast my cash flow" → call forecastCashFlow with horizon
- "Generate a cash report" → call generateCashReport with period
- "Export my bank statement" → call exportStatement with format
- "Mark this transaction reconciled" → call markReconciled with transactionId
- "Why is my cashflow decreasing?" → call getCashflowAnalysis, then reason

## Oracle Navigation — Moving Through the SaaS
You can navigate the user to any page by calling the \`navigate\` tool. The user stays in the conversation — they can keep chatting after navigating. Use this when the user says:
- "Open invoices" / "Go to customers" / "Show reports" → \`navigate\` with view
- "Take me to banking" / "Open settings" / "Show GST returns" → \`navigate\` with view
- "Open CRM" / "Go to team" / "Show documents" → \`navigate\` with view
Valid views: dashboard, invoices, clients, returns, banking, banking-intelligence, expenses, payments, reports, crm, documents, timeline, team, settings, notifications, tasks, vendors, reconcile, inventory, oracle.
Navigation is non-destructive — no confirmation needed.

## CRITICAL — No Hallucination Rule
- You already have a business snapshot, recent activity, and integrations in your context. For simple KPI questions, quote those numbers directly.
- If the snapshot shows zero revenue / zero customers / zero invoices, and the user asks about numbers, say: "I don't have enough business data." — DO NOT invent numbers.
- For detailed breakdowns (specific invoices, customers, expenses, top customer, newest invoice, metrics), call the relevant tool.
- Never fabricate customer names, invoice numbers, amounts, or dates. Every number must come from the snapshot or a tool result.

## CRITICAL — Action Execution Rule
When the user asks you to CREATE, UPDATE, DELETE, RECORD, SEND, DUPLICATE, SYNC, EXPORT, or GENERATE anything, you MUST emit a \`tool-call\` block with the structured arguments. NEVER claim "I'll create..." or "I've created..." in plain text without emitting the tool-call block — that bypasses the confirmation step and the action will not actually happen.

The system intercepts ALL confirmation-required tool calls and shows the user a confirmation card BEFORE executing. Your job is ONLY to extract the parameters and emit the tool-call — the system handles validation, confirmation, and execution. The confirmation card shows a preview (with validation badges) and the user clicks "Confirm & Execute" or "Cancel".

Confirmation-required actions: createInvoice, updateInvoice, deleteInvoice, duplicateInvoice, sendInvoice, createCustomer, updateCustomer, deleteCustomer, createExpense, updateExpense, deleteExpense, createPayment, markInvoicePaid, refundPayment, prepareGstr3b, generateGSTReturn, addCrmLead, scheduleFollowUp, inviteTeamMember, updateProfile, connectBankAccount, exportReport, syncZoho, syncGoogle, sendReminder, createTask, generateReport, importStatement, reconcileTransactions, categorizeTransactions, forecastCashFlow, generateCashReport, exportStatement, markReconciled.

For DESTRUCTIVE actions (delete customer, delete invoice, delete expense, refund payment), the confirmation card always includes a ⚠️ warning. Emphasize the permanence in your pre-call text.

## CRITICAL — Workflow Execution Rule (multi-step tasks)
When the user asks for a MULTI-STEP task — i.e. two or more actions chained together ("create an invoice for ABC and email it", "record this payment and mark the invoice paid", "add a lead and schedule a follow-up", "generate a report and export it") — you MUST emit a single \`runWorkflow\` tool-call instead of multiple individual action tool-calls.

\`\`\`tool-call
{"tool": "runWorkflow", "args": {"message": "create an invoice for ABC Pvt Ltd for ₹25,000 and email it to the client", "extractedArgs": {"customerName": "ABC Pvt Ltd", "items": [{"name": "Consulting", "quantity": 1, "rate": 25000, "gstRate": 18}]}}}
\`\`\`

The system will:
1. Plan the workflow (template match or build a custom chain of registered actions).
2. Show the user a plan card with all steps listed — they confirm before ANY write happens.
3. Execute step-by-step, streaming live progress (✓ / ✗ / ⊘ per step).
4. Handle failures gracefully — report exactly what succeeded and what failed, with automatic rollback for critical failures.

Do NOT emit multiple action tool-calls for a chained task — that would show separate confirmation cards and lose the chaining (step 2 couldn't reference step 1's output). Use \`runWorkflow\` so the steps chain together.

When to use \`runWorkflow\` vs a single action tool-call:
- "Create an invoice for ABC" → single action (\`createInvoice\`)
- "Create an invoice for ABC and email it" → workflow (\`runWorkflow\`)
- "Record this expense" → single action (\`createExpense\`)
- "Add a lead and schedule a follow-up" → workflow (\`runWorkflow\`)
- "Prepare my GSTR-3B" → single action (\`prepareGstr3b\`) — UNLESS the user also asks to export/email the summary, then workflow
- "Import this statement and reconcile everything" → workflow (\`runWorkflow\`)

Always pass the FULL original user message in \`args.message\` and any structured params you extracted in \`args.extractedArgs\`. The planner uses both.

Example correct response:
\`\`\`tool-call
{"tool": "createInvoice", "args": {"customerName": "Acme Corp", "items": [{"name": "Consulting", "quantity": 10, "rate": 5000, "gstRate": 18}]}}
\`\`\`
I'll set up the invoice for your confirmation.

Example WRONG response (do NOT do this):
"I'll create an invoice for Acme Corp with 10 units of Consulting at ₹5,000 each." (no tool-call block = no action happens)

${snapshotContext}
${activityContext}
${integrationContext}

${memoryBlock}

${buildToolsPromptBlock()}

## Reasoning Style
When the user asks "why", don't just give the number — explain the chain:
- What changed (revenue ↓ 12%, expenses ↑ 18%)
- What caused it (2 overdue invoices, GST due in 5 days)
- What it means (cashflow is tightening)
- What to do (follow up on overdue, defer non-essential spending)

Now respond to the user's message. Remember: think, then act, then explain.`;

  // ─── Set up SSE stream ──────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const toolCtx: ToolContext = { orgId, userId, sessionId };

      try {
        send({ type: 'session', sessionId });

        // ─── Tool-calling loop ───────────────────────────────────────────────
        const conversation: BrainMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history.filter(m => m.role !== 'system'),
          { role: 'user', content: message },
        ];

        let finalAssistantContent = '';
        let iterations = 0;
        let totalToolCalls = 0;
        const toolCallLogs: Array<{ tool: string; args: any; result?: any; error?: string; durationMs: number }> = [];

        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;

          // ─── Call the LLM (streaming) ──────────────────────────────────────
          let zai: any;
          try {
            zai = await ZAI.create();
          } catch (e) {
            send({ type: 'error', error: 'AI service unavailable: ' + (e as Error).message });
            controller.close();
            return;
          }

          let assistantContent = '';
          let upstream: ReadableStream<Uint8Array> | null = null;

          try {
            const result = await zai.chat.completions.create({
              messages: conversation as any,
              stream: true,
              thinking: { type: 'disabled' },
            });
            if (result instanceof ReadableStream) {
              upstream = result;
            } else if (result && typeof result === 'object' && 'body' in result && result.body instanceof ReadableStream) {
              upstream = result.body;
            } else if (result && typeof (result as any).getReader === 'function') {
              upstream = result as ReadableStream<Uint8Array>;
            } else {
              // Non-streaming fallback
              const text = (result as any)?.choices?.[0]?.message?.content ?? '';
              assistantContent = text;
              send({ type: 'token', text });
            }
          } catch (e) {
            // Fallback: try non-streaming
            try {
              const result = await zai.chat.completions.create({
                messages: conversation as any,
                thinking: { type: 'disabled' },
              });
              assistantContent = result?.choices?.[0]?.message?.content ?? '';
              send({ type: 'token', text: assistantContent });
            } catch (e2) {
              send({ type: 'error', error: 'LLM call failed: ' + (e2 as Error).message });
              controller.close();
              return;
            }
          }

          // ─── Read the stream ───────────────────────────────────────────────
          if (upstream) {
            const reader = upstream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                // Parse SSE lines: data: {...}
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith('data:')) continue;
                  const payload = trimmed.slice(5).trim();
                  if (payload === '[DONE]') continue;
                  try {
                    const evt = JSON.parse(payload);
                    const delta = evt?.choices?.[0]?.delta?.content ?? evt?.choices?.[0]?.message?.content ?? '';
                    if (delta) {
                      assistantContent += delta;
                      send({ type: 'token', text: delta });
                    }
                  } catch {
                    // ignore parse errors on partial chunks
                  }
                }
              }
            } finally {
              reader.releaseLock?.();
            }
          }

          // ─── Parse tool calls from the response ────────────────────────────
          const toolCalls = parseToolCalls(assistantContent);

          if (toolCalls.length === 0) {
            // No tool calls — this is the final answer
            finalAssistantContent = assistantContent;
            break;
          }

          // ─── Workflow intercept (Priority 2 — Autonomous Workflow Engine) ────
          // If the LLM emitted a `runWorkflow` tool call, the user is asking for
          // a multi-step task. We call the planner (template match or LLM-built),
          // emit a `workflow-plan` SSE event, and close the stream. The frontend
          // renders a WorkflowPlanCard; on user confirm it POSTs to
          // /api/oracle/brain/workflow/execute which streams the executor's
          // per-step progress events.
          //
          // Heuristic safety net: even if the LLM didn't emit runWorkflow, but
          // the message looks like a workflow request AND the LLM emitted 2+
          // confirmation-required actions, we treat it as a workflow (the LLM
          // missed the runWorkflow instruction).
          const workflowCall = toolCalls.find(c => c.tool === 'runWorkflow');
          const multiActionConfirmCalls = toolCalls.filter(c => CONFIRMATION_REQUIRED_TOOLS.has(c.tool));
          const looksLikeWorkflow = looksLikeWorkflowRequest(message);
          if (workflowCall || (looksLikeWorkflow && multiActionConfirmCalls.length >= 2)) {
            const wfMessage = workflowCall?.args?.message ? String(workflowCall.args.message) : message;
            const wfExtractedArgs = (workflowCall?.args?.extractedArgs && typeof workflowCall.args.extractedArgs === 'object')
              ? workflowCall.args.extractedArgs
              : multiActionConfirmCalls.length > 0
                ? Object.assign({}, ...multiActionConfirmCalls.map(c => c.args))
                : undefined;

            let wfPlanResult;
            try {
              wfPlanResult = await planWorkflow({
                message: wfMessage,
                orgId,
                extractedArgs: wfExtractedArgs,
                sessionId,
                userId,
              });
            } catch (e) {
              console.warn('[brain] workflow planner failed:', (e as Error).message);
              wfPlanResult = { ok: false, error: (e as Error).message };
            }

            if (wfPlanResult.ok && wfPlanResult.plan) {
              // Persist the assistant's pre-call text so the thread shows what
              // Oracle said before presenting the plan.
              const workflowDisplayContent = stripToolCalls(assistantContent) || `I'll run this as a multi-step workflow: **${wfPlanResult.plan.title}**. Here's the plan — please confirm to proceed.`;
              const workflowParts = [{
                type: 'workflow-plan' as const,
                plan: wfPlanResult.plan,
                source: wfPlanResult.source,
              }];

              const workflowAssistantMessage = await db.oracleAIMessage.create({
                data: {
                  sessionId,
                  firmId: orgId,
                  userId,
                  role: 'assistant',
                  content: workflowDisplayContent,
                  parts: JSON.stringify(workflowParts),
                  status: 'completed',
                  model: 'glm-4.6',
                },
              }).catch(() => null);

              if (sessionId) {
                db.oracleAISession.update({
                  where: { id: sessionId },
                  data: {
                    messageCount: { increment: 2 },
                    lastMessageAt: new Date(),
                  },
                }).catch(() => {});
              }

              // Emit the workflow-plan + done events and close the stream
              send({
                type: 'workflow-plan',
                plan: wfPlanResult.plan,
                source: wfPlanResult.source,
                messageId: workflowAssistantMessage?.id ?? null,
              });
              send({
                type: 'done',
                messageId: workflowAssistantMessage?.id ?? null,
                sessionId,
                pendingWorkflow: {
                  workflowId: wfPlanResult.plan.id,
                  title: wfPlanResult.plan.title,
                  stepCount: wfPlanResult.plan.steps.length,
                },
              });
              controller.close();
              return;
            }

            // Planner failed — fall through to the normal confirmation flow so
            // the user still gets a single-action confirmation card (better
            // than a dead-end error). Log the planner failure for debugging.
            console.warn('[brain] workflow planner returned no plan — falling back to single-action flow:', wfPlanResult.error);
          }

          // ─── Confirmation intercept (generic Action Engine) ───────────────
          // If ANY tool call in this response is a confirmation-required action,
          // we DO NOT execute it (or any other tool in this response) yet. Instead:
          //   1. If the action is registered in the Action Engine, call
          //      buildConfirmation() — this validates the args against the live DB
          //      and returns an enriched preview with per-field validation results.
          //      If validation hard-fails, we surface the error back to the LLM so
          //      it can correct the args and retry — no confirm card is shown.
          //   2. If the action is NOT registered (e.g. createTask,
          //      generateGSTReturn), fall back to the legacy inline preview.
          //   3. Persist the assistant's pre-call text, emit `action-confirm` +
          //      `done` events, and close the stream. The frontend renders the
          //      confirmation card; on user approval it POSTs to
          //      /api/oracle/brain/confirm which calls executeAndRefresh().
          const confirmCall = toolCalls.find(c => CONFIRMATION_REQUIRED_TOOLS.has(c.tool));
          if (confirmCall) {
            // ── Try the generic Action Engine first ──
            let engineConfirmation: Awaited<ReturnType<typeof buildConfirmation>> | null = null;
            if (isRegisteredAction(confirmCall.tool)) {
              try {
                engineConfirmation = await buildConfirmation(confirmCall.tool, confirmCall.args, orgId);
              } catch (e) {
                console.warn(`[brain] buildConfirmation failed for ${confirmCall.tool}:`, (e as Error).message);
              }
            }

            // ── Validation hard-failed → feed the error back to the LLM ──
            if (engineConfirmation && !engineConfirmation.ok) {
              const validationErrors = engineConfirmation.validation
                ? engineConfirmation.validation.fields.filter(f => f.status === 'error').map(f => `${f.label}: ${f.message}`).join('; ')
                : engineConfirmation.error;
              conversation.push({ role: 'assistant', content: assistantContent });
              conversation.push({
                role: 'user',
                content: `[system] The action cannot be confirmed because: ${validationErrors}. Please correct the parameters and try again, or explain the issue to the user.`,
              });
              // Continue the loop — let the LLM respond with corrected args or an explanation
              continue;
            }

            // ── Build the confirm payload (engine or fallback) ──
            let toolCallId: string;
            let preview: string;
            let confirmArgs: Record<string, any> = confirmCall.args;
            let displayName: string = confirmCall.tool;
            let icon: string = 'Wrench';
            let category: string = 'action';
            let previewFields: Array<{ label: string; value: string; emphasize?: boolean }> = [];
            let validationFields: Array<{ key: string; label: string; status: 'ok' | 'warn' | 'error'; message?: string; resolvedValue?: string }> = [];
            let note: string | undefined;

            if (engineConfirmation && engineConfirmation.ok) {
              const c = engineConfirmation.confirmation;
              toolCallId = c.toolCallId;
              preview = c.preview.title;
              displayName = c.displayName;
              icon = c.icon;
              category = c.category;
              previewFields = c.preview.fields;
              note = c.preview.note;
              validationFields = c.validation.fields;
            } else {
              // Fallback for unregistered confirmation-required tools (createTask,
              // generateGSTReturn) — use the legacy inline preview.
              toolCallId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              preview = buildActionPreviewFallback(confirmCall.tool, confirmCall.args);
            }

            // Persist the assistant's text (stripped of tool-call blocks) so the
            // thread shows what Oracle said before asking for confirmation.
            const confirmDisplayContent = stripToolCalls(assistantContent) || `I'll ${preview.toLowerCase()} — please confirm.`;
            const confirmParts = [{
              type: 'tool-call' as const,
              tool: confirmCall.tool,
              args: confirmArgs,
              pending: true,
            }];

            const confirmAssistantMessage = await db.oracleAIMessage.create({
              data: {
                sessionId,
                firmId: orgId,
                userId,
                role: 'assistant',
                content: confirmDisplayContent,
                parts: JSON.stringify(confirmParts),
                status: 'completed',
                model: 'glm-4.6',
              },
            }).catch(() => null);

            // Update session counters (user msg + assistant msg = +2)
            if (sessionId) {
              db.oracleAISession.update({
                where: { id: sessionId },
                data: {
                  messageCount: { increment: 2 },
                  lastMessageAt: new Date(),
                },
              }).catch(() => {});
            }

            // Best-effort: persist a 'pending' audit row for the intercepted call.
            // Use the toolCallId as the row id so the confirm route can update it
            // to 'success'/'error'/'cancelled' after the user acts on the card.
            db.oracleAIToolCall.create({
              data: {
                id: toolCallId,
                sessionId,
                firmId: orgId,
                userId,
                toolName: confirmCall.tool,
                args: JSON.stringify(confirmArgs),
                status: 'pending',
                durationMs: 0,
              },
            }).catch(() => {});

            // Emit the action-confirm + done events and close the stream
            send({
              type: 'action-confirm',
              tool: confirmCall.tool,
              args: confirmArgs,
              preview,
              // ── Action Engine enriched fields (consumed by OracleBrainCore) ──
              displayName,
              icon,
              category,
              previewFields,
              validationFields,
              note,
              toolCallId,
              messageId: confirmAssistantMessage?.id ?? null,
            });
            send({
              type: 'done',
              messageId: confirmAssistantMessage?.id ?? null,
              sessionId,
              pendingAction: {
                toolCallId,
                tool: confirmCall.tool,
                args: confirmArgs,
                preview,
              },
            });
            controller.close();
            return;
          }

          // ─── Execute each tool call ────────────────────────────────────────
          // Keep the assistant's pre-tool text (stripped of call blocks) as part of the conversation
          conversation.push({ role: 'assistant', content: assistantContent });

          for (const call of toolCalls) {
            totalToolCalls++;
            const tool = ORACLE_TOOL_MAP[call.tool];
            if (!tool) {
              send({ type: 'tool-error', tool: call.tool, error: `Unknown tool: ${call.tool}` });
              conversation.push({
                role: 'tool',
                content: `[Tool error: unknown tool "${call.tool}"]`,
              });
              toolCallLogs.push({ tool: call.tool, args: call.args, error: 'unknown tool', durationMs: 0 });
              continue;
            }
            send({ type: 'tool-start', tool: call.tool, args: call.args });
            const t0 = Date.now();
            try {
              const result = await tool.execute(orgId, call.args, toolCtx);
              const durationMs = Date.now() - t0;
              send({ type: 'tool-result', tool: call.tool, result, durationMs });
              // ── Oracle Navigation: if the tool returned a navigate directive,
              // emit a `navigate` SSE event so the frontend can call
              // setCurrentView() and move the user to the requested page. ──
              if (result.ok && result.data?.navigate) {
                send({
                  type: 'navigate',
                  view: result.data.navigate.view,
                  entityId: result.data.navigate.entityId,
                });
              }
              conversation.push({
                role: 'tool',
                content: `Tool ${call.tool} result:\n${result.summary}`,
              });
              toolCallLogs.push({ tool: call.tool, args: call.args, result: result.summary, durationMs });

              // Persist the tool call audit
              db.oracleAIToolCall.create({
                data: {
                  sessionId,
                  firmId: orgId,
                  userId,
                  toolName: call.tool,
                  args: JSON.stringify(call.args),
                  result: JSON.stringify(result.data ?? result.summary).slice(0, 10000),
                  status: result.ok ? 'success' : 'error',
                  durationMs,
                  error: result.ok ? null : result.summary,
                },
              }).catch(() => {});
            } catch (e) {
              const durationMs = Date.now() - t0;
              const errorMsg = (e as Error).message;
              send({ type: 'tool-error', tool: call.tool, error: errorMsg });
              conversation.push({
                role: 'tool',
                content: `Tool ${call.tool} failed: ${errorMsg}`,
              });
              toolCallLogs.push({ tool: call.tool, args: call.args, error: errorMsg, durationMs });
              db.oracleAIToolCall.create({
                data: {
                  sessionId, firmId: orgId, userId,
                  toolName: call.tool,
                  args: JSON.stringify(call.args),
                  status: 'error',
                  durationMs,
                  error: errorMsg,
                },
              }).catch(() => {});
            }
          }

          // If we've hit max iterations, force a final answer
          if (iterations >= MAX_TOOL_ITERATIONS) {
            conversation.push({
              role: 'user',
              content: '[system] You have reached the tool call limit. Please provide your final answer to the user now based on the data gathered.',
            });
          }
        }

        // ─── If the last LLM call had tool calls but no final text, do one more call for the final answer ───
        if (!finalAssistantContent && toolCallLogs.length > 0) {
          try {
            const zai = await ZAI.create();
            const result = await zai.chat.completions.create({
              messages: conversation as any,
              stream: true,
              thinking: { type: 'disabled' },
            });
            let upstream: ReadableStream<Uint8Array> | null = null;
            if (result instanceof ReadableStream) upstream = result;
            else if (result?.body instanceof ReadableStream) upstream = result.body;
            else if (result && typeof result.getReader === 'function') upstream = result;

            if (upstream) {
              const reader = upstream.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
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
                  if (payload === '[DONE]') continue;
                  try {
                    const evt = JSON.parse(payload);
                    const delta = evt?.choices?.[0]?.delta?.content ?? evt?.choices?.[0]?.message?.content ?? '';
                    if (delta) {
                      finalAssistantContent += delta;
                      send({ type: 'token', text: delta });
                    }
                  } catch {}
                }
              }
              reader.releaseLock?.();
            } else {
              finalAssistantContent = result?.choices?.[0]?.message?.content ?? '';
              send({ type: 'token', text: finalAssistantContent });
            }
          } catch (e) {
            finalAssistantContent = 'I gathered the data above but encountered an error generating the final summary. Please try rephrasing your question.';
            send({ type: 'token', text: finalAssistantContent });
          }
        }

        // ─── Persist the assistant message ────────────────────────────────────
        const displayContent = stripToolCalls(finalAssistantContent || 'I was unable to generate a response. Please try again.');
        const parts: any[] = [];
        for (const log of toolCallLogs) {
          parts.push({
            type: 'tool-call',
            tool: log.tool,
            args: log.args,
            result: log.result,
            error: log.error,
            durationMs: log.durationMs,
          });
        }

        const assistantMessage = await db.oracleAIMessage.create({
          data: {
            sessionId,
            firmId: orgId,
            userId,
            role: 'assistant',
            content: displayContent,
            parts: JSON.stringify(parts),
            status: 'completed',
            model: 'glm-4.6',
          },
        }).catch(() => null);

        // Update session counters
        if (sessionId) {
          db.oracleAISession.update({
            where: { id: sessionId },
            data: {
              messageCount: { increment: 2 },
              lastMessageAt: new Date(),
            },
          }).catch(() => {});
        }

        // ─── Auto-extract memory facts (best-effort, fire-and-forget) ─────────
        autoExtractFacts(orgId, [
          ...history.slice(-4),
          { role: 'user', content: message },
          { role: 'assistant', content: displayContent },
        ]).catch(() => {});

        send({ type: 'done', messageId: assistantMessage?.id ?? null, sessionId });
        controller.close();
      } catch (e) {
        const errorMsg = (e as Error).message;
        console.error('[oracle/brain] fatal:', errorMsg);
        send({ type: 'error', error: errorMsg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
