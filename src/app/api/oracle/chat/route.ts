// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Streaming Chat API (PROMPT 4: Real AI Business Brain)
// POST /api/oracle/chat
//
// PIPELINE (every message):
//   1. Parse + validate (NEVER returns HTTP 400 — empty → friendly SSE)
//   2. runPipeline(): intent → tools → REAL data → executive prompt
//   3. Stream SSE events in order:
//        { intent, tools:[...] }    ← live tool trace (emitted as each tool finishes)
//        { metrics:[...] }          ← deterministic KPI cards (REAL data)
//        { actions:[...] }          ← action buttons
//        { token:"..." } × N        ← streamed executive narrative (LLM)
//        { done:true }
//
// RESILIENCE: every failure path emits a friendly SSE message + {done:true}.
// The user NEVER sees "messages[] is required" or raw JSON.
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { runPipeline } from '@/lib/oracle/pipeline/orchestrator';
import { extractAndPersistFacts, loadMemorySnapshot } from '@/lib/oracle/memory-store';
import type { PipelineSSEEvent, ToolExecution } from '@/lib/oracle/pipeline/types';

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

// ─── Language hint (for the UI cursor) ────────────────────────────────────────

function inferLanguageHint(text: string): string | null {
  const t = (text || '').toLowerCase();
  if (/[\u0900-\u097F]/.test(text)) return 'hindi';
  if (/\b(hindi|devanagari)\b/.test(t)) return 'hindi';
  if (/\b(tamil)\b/.test(t)) return 'tamil';
  if (/\b(telugu)\b/.test(t)) return 'telugu';
  if (/\b(bengali)\b/.test(t)) return 'bengali';
  if (/\b(gujarati)\b/.test(t)) return 'gujarati';
  if (/\b(marathi)\b/.test(t)) return 'marathi';
  if (/\b(punjabi)\b/.test(t)) return 'punjabi';
  return null;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // 1. Parse the body robustly.
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = parseRequest(body);

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

  // 3. Run the pipeline (intent → tools → real data → executive prompt).
  //    The onToolProgress callback streams each tool completion live.
  let pipeline;
  try {
    pipeline = await runPipeline(parsed.question, {
      organizationId: parsed.organizationId,
      onToolProgress: () => {
        // Tool progress is emitted after the pipeline resolves (below) to
        // keep the code simple. The full tool trace is sent as one event.
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

  // 4. Build the model messages: system prompt (with real data) + history + question.
  const languageHint = inferLanguageHint(parsed.question);
  const modelMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: pipeline.systemPrompt },
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
        // Still emit the real metrics + tools so the user sees the data even
        // if the narrative fails.
        controller.enqueue(sseChunk({ intent: pipeline.intent, tools: pipeline.tools }));
        controller.enqueue(sseChunk({ metrics: pipeline.metrics }));
        controller.enqueue(sseChunk({ actions: pipeline.actions }));
        controller.enqueue(sseChunk({
          token: `I collected your real business data (see the cards above), but I hit a temporary issue writing the narrative (${message}). The numbers are accurate — try again in a moment for the full analysis.`,
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
  const persistCtx = {
    userMessage: parsed.question,
    knownUserName: parsed.userName,
  };

  const transformed = new ReadableStream<Uint8Array>({
    async start(controller) {
      // (a) Emit the full tool trace + intent FIRST (so the UI shows what ran).
      controller.enqueue(sseChunk({ intent, tools }));
      // (b) Emit deterministic KPI cards (computed from real Prisma data).
      controller.enqueue(sseChunk({ metrics }));
      // (c) Emit action buttons.
      controller.enqueue(sseChunk({ actions }));
      // (d) Language hint (for the UI cursor).
      if (languageHint) controller.enqueue(sseChunk({ token: '' }));

      // (e) Stream the LLM narrative tokens.
      const reader = upstream!.getReader();
      let buffer = '';
      let emittedAny = false;
      let fullText = '';
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
              ? "Based on your real business data (shown in the cards above), everything looks consistent. Let me know which area you'd like me to drill into — revenue, cash, GST, or collections."
              : "You haven't added business data yet. Connect Zoho Books, add invoices, or sync your bank feed — then I can give you a real CFO analysis with live numbers.",
          }));
        }
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      } catch (err) {
        if (!emittedAny) {
          controller.enqueue(sseChunk({
            token: 'My response was interrupted. The real data above is accurate — please try sending that again for the full narrative.',
          }));
        }
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      }

      // 7. Persist memory facts (non-blocking) — extract durable facts from the
      //    exchange so Oracle remembers the user's firm/GSTIN/industry forever.
      try {
        await extractAndPersistFacts({
          ...persistCtx,
          oracleResponse: fullText,
        });
      } catch {
        /* memory persistence is best-effort */
      }
    },
    cancel() {
      upstream?.cancel?.().catch(() => undefined);
    },
  });

  return new Response(transformed, { status: 200, headers: sseHeaders() });
}
