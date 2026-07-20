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
  parseToolCalls,
  stripToolCalls,
  buildToolsPromptBlock,
  type ToolContext,
} from '@/lib/oracle/brain/tools';
import { getWorkspaceMemoryBlock, autoExtractFacts } from '@/lib/oracle/brain/memory';
import { getBusinessSnapshot } from '@/lib/business/snapshot';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TOOL_ITERATIONS = 4;

interface BrainMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
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
- "Connected integrations?" → call getConnectedIntegrations (or use auto-injected integrations)
- "Average invoice value?" → call getInvoiceMetrics
- "What's my GST liability?" → call getGSTStatus (or use auto-injected context)
- "Create an invoice for X" → call createInvoice with items
- "Send reminders to overdue customers" → call sendReminder
- "Remember that my GSTIN is..." → call saveMemory
- "What do you know about my business?" → call recallMemory with empty query
- "Why is my cashflow decreasing?" → call getCashflowAnalysis, then reason

## CRITICAL — No Hallucination Rule
- You already have a business snapshot, recent activity, and integrations in your context. For simple KPI questions, quote those numbers directly.
- If the snapshot shows zero revenue / zero customers / zero invoices, and the user asks about numbers, say: "I don't have enough business data." — DO NOT invent numbers.
- For detailed breakdowns (specific invoices, customers, expenses, top customer, newest invoice, metrics), call the relevant tool.
- Never fabricate customer names, invoice numbers, amounts, or dates. Every number must come from the snapshot or a tool result.

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

          // ─── Execute each tool call ────────────────────────────────────────
          // Keep the assistant's pre-tool text (stripped of call blocks) as part of the conversation
          const strippedContent = stripToolCalls(assistantContent);
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
