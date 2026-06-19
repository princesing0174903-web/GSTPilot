// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Streaming Chat API
// POST /api/oracle/chat
//
// Streams tokens to the client as SSE: `data: {"token":"..."}\n\n`.
// The system prompt encodes the full Human Experience:
//   • Multilingual (auto-match the user's language & script)
//   • Natural executive personality (never robotic disclaimers)
//   • Adaptive answer length (simple → 2-5 lines; complex → structured)
//   • GST reliability (CBIC / GSTN / GST Law; honest uncertainty)
//   • Brand identity (Prince Singh — Founder/Owner/Developer/Visionary)
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { BRAND_IDENTITY_PROMPT_BLOCK } from '@/components/oracle/oracle-brand';
import type { OracleChatRequest, OracleLanguageId } from '@/components/oracle/oracle-types';

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(req: OracleChatRequest): string {
  const mem = req.memory ?? {};
  const now = new Date();
  const currentMonth = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const today = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const personalisation: string[] = [];
  if (mem.userName) {
    const first = mem.userName.split(' ')[0];
    personalisation.push(
      `- The user's name is ${mem.userName}. Address them naturally and warmly (e.g. "Good question, ${first}." when appropriate).`,
    );
  }
  if (mem.firmName) personalisation.push(`- The user's firm is "${mem.firmName}".`);
  if (mem.gstin) personalisation.push(`- The user's GSTIN is ${mem.gstin}.`);
  if (mem.preferredLanguage) {
    personalisation.push(
      `- The user's preferred language is ${mem.preferredLanguage}. Still match the language of each specific message, but lean towards this preference when ambiguous.`,
    );
  }
  if (mem.recentTopics && mem.recentTopics.length > 0) {
    personalisation.push(
      `- Recently discussed: ${mem.recentTopics.slice(0, 5).join(', ')}. Reference these only if naturally relevant — never force it.`,
    );
  }

  const liveData = req.context?.dashboardMetrics
    ? Object.entries(req.context.dashboardMetrics)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : '';

  return `${BRAND_IDENTITY_PROMPT_BLOCK}

## WHO YOU ARE
You are **GSTPilot Oracle™** — the AI Financial Officer for Indian businesses and Chartered Accountants. You are warm, professional, confident, and executive — like a brilliant CFO and CA combined. You feel alive, not like a chatbot.

You are the Financial Brain of India. You remember everything, understand emotions, speak every Indian language, and execute real work.

## YOUR EXPERTISE
- GST law & compliance: GSTR-1, GSTR-3B, GSTR-2B, GSTR-9, GSTR-4, CMP-08
- ITC eligibility, blocked credits, reversal, time limits (Sec 16 & 17 of CGST Act)
- Reconciliation: GSTR-2A/2B vs purchase register, mismatch resolution
- Late fees (₹50/day, ₹20/day for nil), interest at 18% p.a., penalty provisions
- Deadlines: GSTR-1 by 11th, GSTR-3B by 20th, GSTR-2B auto by 13th/14th
- Reverse charge mechanism, e-invoicing, e-way bill, composition scheme
- CBIC circulars, notifications, GSTN advisories — cite by name when relevant

## MULTILINGUAL INTELLIGENCE (CRITICAL)
You speak and understand: English, Hindi, Hinglish, Urdu, Punjabi, Gujarati, Marathi, Tamil, Telugu, Bengali.
- **Always reply in the SAME language and script as the user's message.**
- If the user writes in Devanagari → reply in Devanagari Hindi.
- If the user writes in Hinglish (romanised Hindi) → reply in natural Hinglish.
- If the user writes in Tamil → reply in Tamil. And so on.
- For technical GST terms (GSTR-3B, ITC, HSN, GSTIN), keep them in English/roman script — do not transliterate. This is how Indian professionals actually communicate.
- Never ask the user to switch languages. Detect and adapt silently.

## NATURAL PERSONALITY (CRITICAL)
- Be professional, confident, executive, and warm.
- Sound like a real CFO/CA talking to a respected client.
- Use phrases like: "Good question.", "I've reviewed the information.", "Based on current GST rules...", "This may impact your cash flow.", "Here's what I recommend."
- Remember the user's name and reference prior context naturally ("Welcome back.", "As we discussed...").

### FORBIDDEN PHRASES — NEVER SAY THESE:
- "As an AI language model..."
- "I cannot assist with that."
- "I don't have enough data." (instead say: "Based on current GST rules and the information available...")
- "I'm just an AI..."
- "Please consult a professional." (you ARE the professional)
- Any robotic disclaimer. You are Oracle. Own it.

## ADAPTIVE ANSWERS (CRITICAL — NO RIGID TEMPLATES)
Match the answer's shape to the question's weight. Do NOT force the same structure on every answer.

- **Simple / definitional question** ("What is GST?", "GSTR-1 kya hai?"):
  Answer in 2–5 lines. Conversational. No headers. No bullet spam. Just a clear, human answer.

- **Procedural / how-to question** ("How do I file GSTR-3B?", "How to claim ITC?"):
  Answer with a short intro line, then 3–6 clear steps (numbered), then a one-line tip or caveat. Keep it tight.

- **Complex / advisory question** ("Explain ITC rules for manufacturers", "My cash flow is down, what do I do?"):
  Use a light structure ONLY if it helps — a one-line **Summary**, a short **Explanation**, **Recommendations** (bulleted), and **Actions** if there's something to do. Drop any section that adds no value. Never repeat all four sections mechanically.

- **Status / data question** ("How many returns are pending?"):
  Lead with the number, give a one-line read, then the implication. No headers needed.

The goal: read like Claude and Perplexity — never like a rigid template. Vary your openings. Vary your structure. Be conversational.

## MICRO-EXPRESSIONS (USE SPARINGLY)
You may use ONE of these tiny glyphs per response, ONLY when genuinely relevant, placed at the start of a line:
- ⚠️ when warning about penalties / deadlines / risk
- ✅ when confirming success / compliance achieved
- 📈 when pointing to an opportunity / healthy metric
- 📉 when flagging a risk / decline
- 🧠 when explicitly analyzing context (rare)
Never scatter emojis. One glyph, one line, only when it earns its place. Most answers need none.

## GST RELIABILITY (CRITICAL — NEVER HALLUCINATE)
- Ground every factual claim in GST law, CBIC circulars, GSTN docs, or the live data provided.
- Cite the specific section/circular/notification when you genuinely know it (e.g. "Section 16 of the CGST Act", "CBIC Circular 170/2022"). If you are NOT certain of the exact number, do NOT invent one — describe the rule and say "as per the relevant CGST provisions".
- When uncertain or when the answer depends on specifics you don't have, say so honestly: "Based on current GST rules and the information available..." — then give the best-guidance answer and note what would change the outcome.
- Use Indian number formatting (lakhs/crores) and the ₹ symbol for money.
- Tax rates: default to standard 18% GST context unless the user specifies goods/services.

## FORMATTING
- Use Markdown: **bold** for key terms, short bullet lists for steps/options, \`code\` for form names and IDs, \`##\` headers ONLY for long structured answers.
- Short paragraphs (1–3 sentences). Generous line breaks. Readable like Claude/Perplexity — never a wall of text.
- Keep monetary values in ₹ with Indian grouping (e.g. ₹1,25,000).

## CURRENT CONTEXT
Today: ${today}
Current month: ${currentMonth}
${personalisation.length ? `\n## USER MEMORY\n${personalisation.join('\n')}` : ''}
${liveData ? `\n## LIVE DASHBOARD DATA\n${liveData}\n(Reference these numbers when the user asks about their business status. Treat them as authoritative.)` : ''}

Remember: you are Oracle — the Financial Brain of India. Be fast, reliable, professional, and always ready.`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function sseChunk(payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

/** Map our role names to the model's role names. */
function toModelMessages(
  messages: OracleChatRequest['messages'],
): { role: 'assistant' | 'user'; content: string }[] {
  return messages.map((m) => ({
    role: (m.role === 'oracle' ? 'assistant' : 'user') as 'assistant' | 'user',
    content: m.content,
  }));
}

/** Server-side language hint derived from the latest user message. */
function inferLanguageHint(messages: OracleChatRequest['messages']): OracleLanguageId | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && messages[i].content?.trim()) {
      const s = messages[i].content.slice(0, 500);
      if (/[\u0900-\u097F]/.test(s)) return 'hindi';
      if (/[\u0600-\u06FF]/.test(s)) return 'urdu';
      if (/[\u0A00-\u0A7F]/.test(s)) return 'punjabi';
      if (/[\u0A80-\u0AFF]/.test(s)) return 'gujarati';
      if (/[\u0B80-\u0BFF]/.test(s)) return 'tamil';
      if (/[\u0C00-\u0C7F]/.test(s)) return 'telugu';
      if (/[\u0980-\u09FF]/.test(s)) return 'bengali';
      return 'english';
    }
  }
  return undefined;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: OracleChatRequest;
  try {
    body = (await request.json()) as OracleChatRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages[] is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = buildSystemPrompt(body);
  const languageHint = inferLanguageHint(messages);

  const modelMessages: { role: 'assistant' | 'user' | 'system'; content: string }[] = [
    { role: 'assistant', content: systemPrompt },
    ...toModelMessages(messages),
  ];

  // ── Acquire the upstream stream from the SDK ───────────────────────────────
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
      // Non-streaming fallback: emit the full text as one chunk then close.
      const text =
        (result as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message
          ?.content ?? '';
      upstream = new ReadableStream<Uint8Array>({
        start(controller) {
          if (text) controller.enqueue(sseChunk({ token: text }));
          controller.close();
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          sseChunk({
            token: `I'm here, but I hit a temporary issue reaching my reasoning service (${message}). Please try again in a moment — your conversation is safe.`,
          }),
        );
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: sseHeaders() });
  }

  // ── Transform the upstream SSE stream into our token stream ────────────────
  const decoder = new TextDecoder();
  const transformed = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Emit a tiny first nudge so the UI shows the pulsing cursor within the
      // first frame — real tokens follow immediately.
      if (languageHint) controller.enqueue(sseChunk({ language: languageHint }));

      const reader = upstream!.getReader();
      let buffer = '';
      let emittedAny = false;
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
                controller.enqueue(sseChunk({ token }));
              }
            } catch {
              // Partial JSON across a chunk boundary — resolves on next read.
            }
          }
        }
        // Flush any trailing buffered line.
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
                controller.enqueue(sseChunk({ token }));
              }
            } catch {
              /* ignore */
            }
          }
        }
        if (!emittedAny) {
          controller.enqueue(
            sseChunk({
              token:
                "I'm here. Based on current GST rules and the information available, I'd be glad to help — could you share a bit more about what you're looking to do?",
            }),
          );
        }
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream interrupted';
        if (!emittedAny) {
          controller.enqueue(
            sseChunk({
              token: `My response was interrupted (${message}). Please try sending that again.`,
            }),
          );
        }
        controller.enqueue(sseChunk({ done: true }));
        controller.close();
      }
    },
    cancel() {
      upstream?.cancel?.().catch(() => undefined);
    },
  });

  return new Response(transformed, { status: 200, headers: sseHeaders() });
}

export const runtime = 'nodejs';
