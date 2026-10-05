// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Streaming Chat API (PROMPT 5: Autonomous AI CFO)
// POST /api/oracle/chat
//
// PIPELINE (every message):
//   1. Parse + validate (NEVER returns HTTP 400 — empty → friendly SSE)
//   2. runPipeline():
//        intent → tools → real data → multi-agent reasoning → business scorecard
//        → confidence tags → AI timeline → autonomous insights
//        → structured recommendations → smart follow-ups → live dashboard update
//   3. Stream SSE events in order:
//        { intent, tools:[...] }    ← live tool trace
//        { metrics:[...] }          ← deterministic KPI cards (REAL data)
//        { agents:[...] }           ← PROMPT 5: agent findings (internal, shown as insights)
//        { confidences:[...] }      ← PROMPT 5: confidence tags
//        { scorecard }              ← PROMPT 5: business scorecard
//        { timeline:[...] }         ← PROMPT 5: AI timeline items
//        { insights:[...] }         ← PROMPT 5: autonomous insights
//        { recommendations:[...] }  ← PROMPT 5: structured recommendations
//        { followUps:[...] }        ← PROMPT 5: smart follow-up questions
//        { dashboard }              ← PROMPT 5: live dashboard update
//        { actions:[...] }          ← action buttons
//        { token:"..." } × N        ← streamed executive narrative (LLM)
//        { done:true }
//
// RESILIENCE: every failure path emits a friendly SSE message + {done:true}.
// The user NEVER sees "messages[] is required" or raw JSON.
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { runPipeline } from '@/lib/oracle/pipeline/orchestrator';
import { extractAndPersistFacts } from '@/lib/oracle/memory-store';
import type { PipelineSSEEvent, ToolExecution } from '@/lib/oracle/pipeline/types';
import { getContextSnapshot, storeConversationMemory } from '@/lib/oracle/brain/memory-engine';
import { hybridSearch } from '@/lib/oracle/brain/semantic-search';
import { logDecision } from '@/lib/oracle/brain/decision-log';
import { createAutonomousTaskFromInsight } from '@/lib/oracle/brain/task-engine';
import { generateRemindersFromSnapshot } from '@/lib/oracle/brain/reminder-engine';
import { recordLearning, inferPreferencesFromBehavior } from '@/lib/oracle/brain/learning-engine';
import { rateLimit, rateLimitedResponse, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { parseBody, schemas } from '@/lib/validation';

/** Render the Brain context snapshot as a system-prompt block. */
function renderBrainContextBlock(ctx: {
  businessFacts: { title: string; summary?: string | null }[];
  userPreferences: { title: string; summary?: string | null }[];
  openDecisions: { title: string; recommendation?: string }[];
  activeTasks: { title: string; priority?: string }[];
  relevantMemories: { title: string; summary?: string | null; content?: string }[];
  learnings: { pattern: string; observation?: string }[];
}): string {
  const lines: string[] = ['## PERSISTENT BRAIN MEMORY (PROMPT 6 — AI Business Brain)'];
  lines.push('You remember everything across sessions. Use the memories below to ground your answer:');

  if (ctx.relevantMemories.length > 0) {
    lines.push('');
    lines.push('### Relevant memories for this question (semantic search):');
    for (const m of ctx.relevantMemories.slice(0, 5)) {
      const body = (m.summary || m.content || '').slice(0, 200);
      lines.push(`- ${m.title}: ${body}`);
    }
  }

  if (ctx.businessFacts.length > 0) {
    lines.push('');
    lines.push('### Known business facts:');
    for (const f of ctx.businessFacts.slice(0, 6)) {
      lines.push(`- ${f.title}${f.summary ? `: ${f.summary.slice(0, 150)}` : ''}`);
    }
  }

  if (ctx.userPreferences.length > 0) {
    lines.push('');
    lines.push('### User preferences (adapt your style accordingly):');
    for (const p of ctx.userPreferences.slice(0, 4)) {
      lines.push(`- ${p.title}${p.summary ? `: ${p.summary.slice(0, 120)}` : ''}`);
    }
  }

  if (ctx.openDecisions.length > 0) {
    lines.push('');
    lines.push('### Open recommendations (decisions pending your action):');
    for (const d of ctx.openDecisions.slice(0, 4)) {
      lines.push(`- ${d.title}${d.recommendation ? ` — ${d.recommendation.slice(0, 100)}` : ''}`);
    }
  }

  if (ctx.activeTasks.length > 0) {
    lines.push('');
    lines.push('### Active tasks:');
    for (const t of ctx.activeTasks.slice(0, 5)) {
      lines.push(`- [${(t.priority || 'med').toUpperCase()}] ${t.title}`);
    }
  }

  if (ctx.learnings.length > 0) {
    lines.push('');
    lines.push('### What you have learned about this user (adapt behaviour):');
    for (const l of ctx.learnings.slice(0, 4)) {
      lines.push(`- ${l.pattern}${l.observation ? ` — ${l.observation.slice(0, 120)}` : ''}`);
    }
  }

  return lines.join('\n');
}

/** Detect intent from the question for memory routing. */
function detectMemoryIntent(question: string): string {
  const q = question.toLowerCase();
  if (/what.*(did|do).*we.*(discuss|talk)|previous.*(gst|conversation)|last (week|month)|continue.*(yesterday|previous)|recommend.*before|pending task|what should i do today/.test(q)) {
    return 'memory_recall';
  }
  return 'general';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

function sseChunk(obj: PipelineSSEEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

const FRIENDLY_ERROR =
  "I'm having trouble reaching my reasoning service right now. Your data is safe — please try again in a moment.";

const FRIENDLY_EMPTY =
  "I didn't catch a question in that message. Could you tell me what you'd like to know about your business — revenue, cash, GST, customers, or compliance?";

// ─── Request parsing (robust — never throws, never 400s) ──────────────────────

interface ParsedRequest {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  organizationId?: string;
  userName?: string;
  userId?: string;
  ok: boolean;
}

function parseRequest(body: unknown): ParsedRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const rawMessages = Array.isArray(b.messages) ? b.messages : [];
  const messages = rawMessages
    .filter((m): m is { role?: string; content?: string } => typeof m === 'object' && m !== null)
    .map((m) => ({
      role: (m.role === 'user' ? 'user' : m.role === 'oracle' || m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : '',
    }))
    .filter((m) => m.content.trim().length > 0);

  // Legacy single-message shape.
  if (messages.length === 0 && typeof b.message === 'string' && b.message.trim()) {
    messages.push({ role: 'user', content: b.message });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const question = lastUser?.content ?? '';
  const history = messages.slice(0, messages.length > 0 ? -1 : 0).filter((m) => m.role === 'user' || m.role === 'assistant');

  const ctx = (b.context ?? {}) as Record<string, unknown>;
  const mem = (b.memory ?? {}) as Record<string, unknown>;

  return {
    question,
    history,
    organizationId: typeof ctx.organizationId === 'string' ? ctx.organizationId : undefined,
    userName: typeof mem.userName === 'string' ? mem.userName : undefined,
    userId: typeof mem.userId === 'string' ? mem.userId : undefined,
    ok: question.trim().length > 0,
  };
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) — must happen BEFORE the SSE stream starts. ──
  // Returns a normal JSON 401/403 — never inside the SSE stream.
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  // ── SECURITY (POLISH-06): rate limit per IP — 20 Oracle requests/min. ──
  // The Oracle pipeline is expensive (Prisma queries + LLM call + memory
  // writes). Unauthenticated flooders would exhaust the sandbox budget.
  const rl = rateLimit(req, RATE_LIMIT_PRESETS.oracle, 'oracle-chat');
  if (rl.denied) {
    // Return a friendly SSE so the UI's stream parser can render the message
    // instead of treating it as a network error.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sseChunk({
          token: "You're sending messages too quickly — please wait a moment and try again.",
        }));
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: sseHeaders(),
    });
  }

  // 1. Parse + validate the body via zod (defensive — caps message length,
  //    blocks weird types from being smuggled into the pipeline).
  const [rawBody, validationErr] = await parseBody(req, schemas.oracleChat);
  if (validationErr) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sseChunk({
          token: "I couldn't read your message — please try sending it again.",
        }));
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: sseHeaders() });
  }
  const parsed = parseRequest(rawBody);

  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) — org membership check. ──
  // Now that we have the parsed body, verify the caller belongs to the
  // organization they're asking about. Returns 403 as JSON (not SSE).
  const orgId0 = parsed.organizationId ?? '';
  const orgResult = await requireOrgMembership(uid, orgId0);
  if (orgResult instanceof NextResponse) return orgResult;

  // 2. Empty / malformed → friendly SSE (NEVER HTTP 400).
  if (!parsed.ok) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sseChunk({ token: FRIENDLY_EMPTY }));
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: sseHeaders() });
  }

  // 3. Run the pipeline (intent → tools → agents → scores → insights → prompt).
  let pipeline;
  try {
    pipeline = await runPipeline(parsed.question, {
      organizationId: parsed.organizationId,
      onToolProgress: () => {
        // Tool progress is emitted after the pipeline resolves (below).
      },
    });
  } catch (err) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sseChunk({ token: FRIENDLY_ERROR }));
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: sseHeaders() });
  }

  // 4. PROMPT 6: Retrieve persistent Brain memory context (parallel — fast).
  //    This gives Oracle long-term recall: previous conversations, business facts,
  //    user preferences, open decisions, active tasks, and learned behaviours.
  const firmId = parsed.organizationId || 'preview-org';
  const memoryIntent = detectMemoryIntent(parsed.question);
  let brainBlock = '';
  let brainContext: Awaited<ReturnType<typeof getContextSnapshot>> | null = null;
  try {
    // For memory-recall intents, run a deeper semantic search.
    const [ctx, semanticHits] = await Promise.all([
      getContextSnapshot(firmId, parsed.question),
      memoryIntent === 'memory_recall'
        ? hybridSearch({ firmId, query: parsed.question, topK: 8, minScore: 0.1 })
        : Promise.resolve([]),
    ]);
    brainContext = ctx;
    // For memory-recall, override relevantMemories with deeper search results.
    if (semanticHits.length > 0) {
      ctx.relevantMemories = semanticHits.map((r) => r.memory);
    }
    brainBlock = renderBrainContextBlock({
      businessFacts: ctx.businessFacts,
      userPreferences: ctx.userPreferences,
      openDecisions: ctx.openDecisions,
      activeTasks: ctx.activeTasks,
      relevantMemories: ctx.relevantMemories,
      learnings: ctx.learnings,
    });
  } catch {
    // Brain memory is best-effort — never block the response.
  }

  // 5. Build the model messages: system prompt (with real data + Brain memory) + history + question.
  const fullSystemPrompt = brainBlock
    ? `${pipeline.systemPrompt}\n\n${brainBlock}`
    : pipeline.systemPrompt;
  const modelMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: fullSystemPrompt },
    ...parsed.history.slice(-8).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: parsed.question },
  ];

  // 5. Acquire the upstream LLM stream.
  let upstream: ReadableStream<Uint8Array> | null = null;
  try {
    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      messages: modelMessages,
      stream: true,
      thinking: { type: 'disabled' },
    });
    if (result && typeof (result as ReadableStream<Uint8Array>).getReader === 'function') {
      upstream = result as ReadableStream<Uint8Array>;
    } else {
      // Non-streaming fallback.
      const text =
        (result as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message
          ?.content ?? '';
      upstream = new ReadableStream<Uint8Array>({
        start(controller) {
          if (text) controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Still emit ALL the real structured data so the user sees the analysis
        // even if the narrative fails.
        controller.enqueue(sseChunk({ intent: pipeline.intent, tools: pipeline.tools }));
        controller.enqueue(sseChunk({ metrics: pipeline.metrics }));
        controller.enqueue(sseChunk({ agents: pipeline.agents.findings }));
        controller.enqueue(sseChunk({ confidences: pipeline.confidences }));
        controller.enqueue(sseChunk({ scorecard: pipeline.scorecard }));
        controller.enqueue(sseChunk({ timeline: pipeline.timeline.items }));
        controller.enqueue(sseChunk({ insights: pipeline.insights }));
        controller.enqueue(sseChunk({ recommendations: pipeline.recommendations }));
        controller.enqueue(sseChunk({ followUps: pipeline.followUps }));
        controller.enqueue(sseChunk({ dashboard: pipeline.dashboard }));
        controller.enqueue(sseChunk({ actions: pipeline.actions }));
        controller.enqueue(sseChunk({
          token: `I collected your real business data and ran the full multi-agent analysis (see the cards and scores above), but I hit a temporary issue writing the narrative (${message}). The numbers and findings are accurate — try again in a moment for the full executive brief.`,
        }));
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: sseHeaders() });
  }

  // 6. Transform the upstream stream into our SSE pipeline stream.
  const decoder = new TextDecoder();
  const tools: ToolExecution[] = pipeline.tools;
  const metrics = pipeline.metrics;
  const actions = pipeline.actions;
  const intent = pipeline.intent;
  const agentFindings = pipeline.agents.findings;
  const confidences = pipeline.confidences;
  const scorecard = pipeline.scorecard;
  const timelineItems = pipeline.timeline.items;
  const insights = pipeline.insights;
  const recommendations = pipeline.recommendations;
  const followUps = pipeline.followUps;
  const dashboard = pipeline.dashboard;
  const persistCtx = {
    userMessage: parsed.question,
    knownUserName: parsed.userName,
  };

  // Server-side stream watchdog timer (cleared in start's finally + in cancel).
  // If the upstream LLM stalls and never closes the stream, we force-close after
  // 120s so the client is never left waiting forever.
  let streamWatchdog: ReturnType<typeof setTimeout> | null = null;

  const transformed = new ReadableStream<Uint8Array>({
    async start(controller) {
      // (a) Emit the full tool trace + intent FIRST (so the UI shows what ran).
      controller.enqueue(sseChunk({ intent, tools }));
      // (b) Emit deterministic KPI cards (computed from real Prisma data).
      controller.enqueue(sseChunk({ metrics }));
      // (c) PROMPT 5: Emit agent findings (shown as insights panel).
      controller.enqueue(sseChunk({ agents: agentFindings }));
      // (d) PROMPT 5: Emit confidence tags.
      controller.enqueue(sseChunk({ confidences }));
      // (e) PROMPT 5: Emit business scorecard.
      controller.enqueue(sseChunk({ scorecard }));
      // (f) PROMPT 5: Emit AI timeline.
      controller.enqueue(sseChunk({ timeline: timelineItems }));
      // (g) PROMPT 5: Emit autonomous insights.
      controller.enqueue(sseChunk({ insights }));
      // (h) PROMPT 5: Emit structured recommendations.
      controller.enqueue(sseChunk({ recommendations }));
      // (i) PROMPT 5: Emit smart follow-up questions.
      controller.enqueue(sseChunk({ followUps }));
      // (j) PROMPT 5: Emit live dashboard update (auto-updates the right panel).
      controller.enqueue(sseChunk({ dashboard }));
      // (k) Emit action buttons.
      controller.enqueue(sseChunk({ actions }));

      // (l) Stream the LLM narrative tokens.
      const reader = upstream!.getReader();
      let buffer = '';
      let emittedAny = false;
      let fullText = '';
      let closed = false;

      // Idempotent finish — enqueues {done:true} + closes the controller once.
      const safeFinish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.enqueue(sseChunk({ done: true }));
          controller.close();
        } catch { /* controller already closed — non-fatal */ }
      };

      // Watchdog — force-close the stream if the upstream LLM stalls.
      streamWatchdog = setTimeout(safeFinish, 120_000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]' || !data) continue;
            try {
              const json = JSON.parse(data);
              const token: string =
                json?.choices?.[0]?.delta?.content ??
                json?.choices?.[0]?.message?.content ??
                '';
              if (token) {
                emittedAny = true;
                fullText += token;
                controller.enqueue(sseChunk({ token }));
              }
            } catch {
              /* partial JSON — resolves on next read */
            }
          }
        }
        // Flush trailing buffer.
        const tail = buffer.trim();
        if (tail.startsWith('data:')) {
          const data = tail.slice(5).trim();
          if (data && data !== '[DONE]') {
            try {
              const json = JSON.parse(data);
              const token: string =
                json?.choices?.[0]?.delta?.content ??
                json?.choices?.[0]?.message?.content ??
                '';
              if (token) {
                emittedAny = true;
                fullText += token;
                controller.enqueue(sseChunk({ token }));
              }
            } catch { /* ignore */ }
          }
        }
        if (!emittedAny) {
          controller.enqueue(sseChunk({
            token: pipeline.hasRealData
              ? "Based on your real business data (shown in the cards and scores above), everything looks consistent. Let me know which area you'd like me to drill into — revenue, cash, GST, or collections."
              : "You haven't added business data yet. Connect Zoho Books, add invoices, or sync your bank feed — then I can give you a real CFO analysis with live numbers.",
          }));
        }
        safeFinish();
      } catch (err) {
        if (!emittedAny && !closed) {
          try {
            controller.enqueue(sseChunk({
              token: 'My response was interrupted. The real data and scores above are accurate — please try sending that again for the full executive brief.',
            }));
          } catch { /* controller may be closed */ }
        }
        safeFinish();
      } finally {
        if (streamWatchdog) {
          clearTimeout(streamWatchdog);
          streamWatchdog = null;
        }
      }

      // 7. Persist memory (non-blocking) — both legacy OracleMemory facts AND
      //    the new PROMPT 6 Brain memory (conversation record + decisions + tasks).
      try {
        await extractAndPersistFacts(orgId0, {
          ...persistCtx,
          oracleResponse: fullText,
        });
      } catch {
        /* memory persistence is best-effort */
      }

      // PROMPT 6: Store the full conversation in the Brain + log decisions +
      // auto-create tasks from insights + generate reminders. All best-effort.
      try {
        // (a) Store the conversation as a persistent Brain memory (with embedding).
        const topics = (pipeline.insights || [])
          .slice(0, 4)
          .map((i) => i.headline);
        const actions = (pipeline.actions || [])
          .slice(0, 4)
          .map((a) => a.label);
        const summary = fullText
          ? fullText.slice(0, 200).replace(/\s+/g, ' ').trim()
          : parsed.question.slice(0, 200);
        await storeConversationMemory({
          firmId,
          userId: parsed.userId,
          conversationId: `chat-${Date.now()}`,
          userMessage: parsed.question,
          oracleResponse: fullText || '(no response)',
          intent: pipeline.intent,
          topics,
          actions,
          result: summary,
          summary,
          createdAt: new Date(),
        }).catch(() => undefined);

        // (b) Log each structured recommendation as an explainable decision.
        for (const rec of (pipeline.recommendations || []).slice(0, 3)) {
          await logDecision({
            firmId,
            userId: parsed.userId,
            title: rec.title,
            recommendation: rec.actionPrompt || rec.title,
            reason: rec.reason || 'Derived from real business data analysis.',
            evidence: (rec as { evidence?: string[] }).evidence || [
              `Priority: ${rec.priority}`,
              `Impact: ${rec.impact || 'N/A'}`,
            ],
            expectedOutcome: rec.estimatedOutcome || rec.impact || 'See impact assessment.',
            confidence: (rec as { confidence?: number }).confidence ?? 70,
            priority: rec.priority,
          }).catch(() => undefined);
        }

        // (c) Auto-create tasks from critical/warn insights (autonomous tasks).
        for (const insight of (pipeline.insights || [])
          .filter((i) => i.severity === 'critical' || i.severity === 'warn')
          .slice(0, 2)) {
          await createAutonomousTaskFromInsight(firmId, {
            headline: insight.headline,
            detail: insight.detail,
            severity: insight.severity,
            actionPrompt: insight.actionPrompt,
          }).catch(() => undefined);
        }

        // (d) Generate proactive reminders from the snapshot (deduped).
        const snap = (pipeline as { snapshot?: { overdueInvoiceCount?: number; gstLiability?: number; cash?: number; runwayDays?: number; receivables?: number } }).snapshot;
        if (snap) {
          await generateRemindersFromSnapshot(firmId, {
            gstLiability: snap.gstLiability,
            cashBalance: snap.cash,
            overdueInvoices: [], // snapshot doesn't break out per-invoice; reminder engine handles aggregate
          }).catch(() => undefined);
        }

        // (e) Record a frequent-query learning signal (Oracle notices repeated topics).
        if (parsed.userId && pipeline.intent) {
          await inferPreferencesFromBehavior(firmId, parsed.userId, {
            kind: 'frequent_query',
            detail: parsed.question.slice(0, 80),
          }).catch(() => undefined);
        }
      } catch {
        /* Brain persistence is best-effort — never block the response */
      }
    },
    cancel() {
      if (streamWatchdog) {
        clearTimeout(streamWatchdog);
        streamWatchdog = null;
      }
      upstream?.cancel?.().catch(() => undefined);
    },
  });

  return new Response(transformed, { status: 200, headers: sseHeaders() });
}
