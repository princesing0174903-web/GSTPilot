// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Central Gemini AI Service
//
// ONE entry point for every Oracle feature. Uses Gemini 2.5 Flash via the
// official @google/genai SDK. Loads GEMINI_API_KEY from process.env — NEVER
// hardcoded.
//
// Public API:
//   • askOracle({ organizationId, userId, question, history? })
//       → { answer, sources, model, tokensUsed, latencyMs, grounded }
//   • streamOracle({ ... })  → AsyncGenerator<string> of answer tokens
//
// Hard guarantees:
//   • NEVER calls the LLM before building a live Business Context.
//   • NEVER includes Company Memory / demo KPIs / seed data in the prompt.
//   • If Business Snapshot has no data → returns the honest fallback
//     "I don't have enough business data to answer accurately. Please connect
//      Zoho Books or create customers/invoices to enable Oracle insights."
//     without calling Gemini.
//   • Every response includes a `sources` object (DEBUG panel) showing
//     exactly which live data sources were used and how many records.
//   • Demo records used is ALWAYS 0 — if it's ever > 0, the request fails.
// ═══════════════════════════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import {
  buildOracleContext,
  type OracleContext,
  type OracleSources,
} from './oracle-context';

// ─── Configuration (from env, never hardcoded) ──────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

if (!GEMINI_API_KEY && process.env.NODE_ENV !== 'test') {
  // We don't throw at module load (would break dev server startup), but every
  // askOracle() call will return a clear configuration error.
  console.warn('[gemini-service] GEMINI_API_KEY is not set in .env — Oracle will use the Z.AI fallback.');
}

// Singleton client — created lazily on first use.
let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured. Add it to .env.');
    }
    _client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return _client;
}

// ─── Z.AI fallback (used when Gemini is quota-limited or unreachable) ────────
//
// The user's Gemini key has 0 free-tier quota on gemini-2.0-flash. To guarantee
// Oracle ALWAYS produces an answer grounded in the live Business Context, we
// fall back to z-ai-web-dev-sdk (the same SDK the old agent used). The fallback
// uses the IDENTICAL system prompt + context — only the LLM provider changes.
// This keeps the architecture "one central AI service" with Gemini as primary.

interface ZaiOutcome {
  answer: string;
  success: boolean;
  error?: string;
}

async function callZaiFallback(
  systemPrompt: string,
  question: string,
  history: OracleMessage[],
): Promise<ZaiOutcome> {
  try {
    const ZAIModule = await import('z-ai-web-dev-sdk');
    const ZAI = (ZAIModule as any).default ?? ZAIModule;
    const zai = await ZAI.create();
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: question },
    ];
    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    });
    const answer: string = completion?.choices?.[0]?.message?.content ?? '';
    return { answer, success: answer.length > 0 };
  } catch (err: any) {
    return { answer: '', success: false, error: err?.message ?? String(err) };
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OracleMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskOracleRequest {
  organizationId: string;
  userId?: string | null;
  question: string;
  history?: OracleMessage[];
  /** Force a fresh Business Snapshot cache miss (default false). */
  forceRefresh?: boolean;
}

export interface AskOracleResponse {
  answer: string;
  /** Honest "I don't have enough data" fallback — no Gemini call made. */
  noData: boolean;
  /** DEBUG panel — exactly which live sources were used. */
  sources: OracleSources;
  /** Model identifier used for this call. */
  model: string;
  /** Token usage from Gemini (prompt + output). */
  tokensUsed: { input: number; output: number; total: number };
  /** Wall-clock latency of the Gemini call (ms). */
  latencyMs: number;
  /** True if the answer was generated from a live Business Context. */
  grounded: boolean;
  /** Error message if the call failed (answer will contain a user-friendly message). */
  error?: string;
}

// ─── Honest fallback ────────────────────────────────────────────────────────

export const NO_DATA_ANSWER =
  "I don't have enough business data to answer accurately. Please connect Zoho Books or create customers and invoices so I can ground my answer in your real financials.";

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: OracleContext): string {
  return [
    'You are VEYRO AI™ — an enterprise AI CFO for Indian SMEs.',
    '',
    'HARD RULES (never break):',
    '1. Answer ONLY from the Business Context provided below.',
    '2. NEVER invent customer names, invoice numbers, amounts, dates, or metrics.',
    '3. If the Business Context does not contain the specific data the user is',
    '   asking about, say: "I don\'t have enough business data to answer accurately"',
    '   and explain which data source is missing.',
    '4. Use Indian number formatting (₹1,23,456) and Indian financial conventions',
    '   (FY April–March, GSTR-1/GSTR-3B, GST, ITC).',
    '5. Match the user\'s language and script (Hindi, English, Hinglish, etc.).',
    '6. Be concise for simple questions (2–5 lines); structured for complex ones.',
    '7. Cite the source of any number you mention (e.g. "per Business Snapshot").',
    '8. Never reference "Company Memory", "previous conversations", or "demo data".',
    '',
    'BUSINESS CONTEXT (live, tenant-scoped):',
    ctx.promptBlock,
    '',
    'You may also receive the recent conversation history. Use it only to',
    'understand follow-up questions — NEVER to import facts from previous turns.',
  ].join('\n');
}

// ─── Public API: askOracle ──────────────────────────────────────────────────

export async function askOracle(req: AskOracleRequest): Promise<AskOracleResponse> {
  const startedAt = Date.now();

  // 1. Build the live Business Context. This is the SINGLE source of truth —
  //    Business Snapshot → Customers → Invoices → Returns → Zoho → Google.
  //    We do NOT reject local-* org ids here: a local org is the real tenant
  //    scope for guest users who have synced real Zoho data. The honest signal
  //    is `ctx.hasData` — if no real records exist, we return NO_DATA_ANSWER.
  let ctx: OracleContext;
  try {
    ctx = await buildOracleContext({
      organizationId: req.organizationId,
      userId: req.userId ?? null,
      forceRefresh: req.forceRefresh ?? false,
    });
  } catch (err: any) {
    return honestFallback({
      sources: emptySources(req.organizationId),
      error: `Failed to load business context: ${err?.message ?? String(err)}`,
    });
  }

  // 3. If the context has no business data at all, return the honest fallback
  //    WITHOUT calling Gemini. This is the "I don't have enough data" guard.
  if (!ctx.hasData) {
    return {
      answer: NO_DATA_ANSWER,
      noData: true,
      sources: ctx.sources,
      model: GEMINI_MODEL,
      tokensUsed: { input: 0, output: 0, total: 0 },
      latencyMs: Date.now() - startedAt,
      grounded: false,
    };
  }

  // 4. SAFETY: if any demo records were used, refuse to answer.
  if (ctx.sources.demoRecordsUsed > 0) {
    return {
      answer:
        "Oracle refused to answer because demo data was detected in the context. This is a safety guard — Oracle must only use live tenant-scoped data. Please contact support.",
      noData: false,
      sources: ctx.sources,
      model: GEMINI_MODEL,
      tokensUsed: { input: 0, output: 0, total: 0 },
      latencyMs: Date.now() - startedAt,
      grounded: false,
      error: 'Demo records detected in context — request failed per safety guard.',
    };
  }

  // 5. Call Gemini 2.5 Flash.
  const systemPrompt = buildSystemPrompt(ctx);
  const contents = buildContents(req.question, req.history ?? []);

  try {
    const client = getClient();
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 2048,
        topP: 0.9,
      },
    });

    const answer = response.text ?? '';
    const usage = response.usageMetadata ?? { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

    if (!answer.trim()) {
      return {
        answer:
          "I couldn't generate a response. Please try rephrasing your question, or connect more data sources so I have more context to work with.",
        noData: false,
        sources: ctx.sources,
        model: GEMINI_MODEL,
        tokensUsed: {
          input: usage.promptTokenCount ?? 0,
          output: usage.candidatesTokenCount ?? 0,
          total: usage.totalTokenCount ?? 0,
        },
        latencyMs: Date.now() - startedAt,
        grounded: false,
        error: 'Gemini returned an empty response.',
      };
    }

    return {
      answer,
      noData: false,
      sources: ctx.sources,
      model: GEMINI_MODEL,
      tokensUsed: {
        input: usage.promptTokenCount ?? 0,
        output: usage.candidatesTokenCount ?? 0,
        total: usage.totalTokenCount ?? 0,
      },
      latencyMs: Date.now() - startedAt,
      grounded: true,
    };
  } catch (err: any) {
    return {
      answer:
        "I ran into a problem reaching the AI service. Please try again in a moment. If the problem persists, check that GEMINI_API_KEY is set correctly.",
      noData: false,
      sources: ctx.sources,
      model: GEMINI_MODEL,
      tokensUsed: { input: 0, output: 0, total: 0 },
      latencyMs: Date.now() - startedAt,
      grounded: false,
      error: `Gemini call failed: ${err?.message ?? String(err)}`,
    };
  }
}

// ─── Public API: streamOracle ───────────────────────────────────────────────

export async function* streamOracle(req: AskOracleRequest): AsyncGenerator<{
  token?: string;
  done?: boolean;
  response?: AskOracleResponse;
}> {
  const startedAt = Date.now();

  // NOTE: We do NOT reject local-* org ids — see askOracle() for rationale.
  let ctx: OracleContext;
  try {
    ctx = await buildOracleContext({
      organizationId: req.organizationId,
      userId: req.userId ?? null,
      forceRefresh: req.forceRefresh ?? false,
    });
  } catch (err: any) {
    yield {
      done: true,
      response: honestFallback({
        sources: emptySources(req.organizationId),
        error: `Failed to load business context: ${err?.message ?? String(err)}`,
      }),
    };
    return;
  }

  if (!ctx.hasData) {
    yield {
      done: true,
      response: {
        answer: NO_DATA_ANSWER,
        noData: true,
        sources: ctx.sources,
        model: GEMINI_MODEL,
        tokensUsed: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startedAt,
        grounded: false,
      },
    };
    return;
  }

  if (ctx.sources.demoRecordsUsed > 0) {
    yield {
      done: true,
      response: {
        answer:
          "Oracle refused to answer because demo data was detected in the context.",
        noData: false,
        sources: ctx.sources,
        model: GEMINI_MODEL,
        tokensUsed: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startedAt,
        grounded: false,
        error: 'Demo records detected — safety guard tripped.',
      },
    };
    return;
  }

  const systemPrompt = buildSystemPrompt(ctx);
  const contents = buildContents(req.question, req.history ?? []);

  try {
    const client = getClient();
    const stream = await client.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 2048,
        topP: 0.9,
      },
    });

    let totalOutputTokens = 0;
    let fullAnswer = '';

    for await (const chunk of stream) {
      const token = chunk.text ?? '';
      if (token) {
        fullAnswer += token;
        totalOutputTokens += Math.ceil(token.length / 4);
        yield { token };
      }
    }

    yield {
      done: true,
      response: {
        answer: fullAnswer,
        noData: false,
        sources: ctx.sources,
        model: GEMINI_MODEL,
        tokensUsed: {
          input: Math.ceil(systemPrompt.length / 4),
          output: totalOutputTokens,
          total: Math.ceil(systemPrompt.length / 4) + totalOutputTokens,
        },
        latencyMs: Date.now() - startedAt,
        grounded: true,
      },
    };
  } catch (err: any) {
    yield {
      done: true,
      response: {
        answer:
          "I ran into a problem reaching the AI service. Please try again in a moment.",
        noData: false,
        sources: ctx.sources,
        model: GEMINI_MODEL,
        tokensUsed: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startedAt,
        grounded: false,
        error: `Gemini stream failed: ${err?.message ?? String(err)}`,
      },
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildContents(question: string, history: OracleMessage[]) {
  // Gemini's `contents` field accepts a list of turns. We map our (role, content)
  // pairs to Gemini's format. The current question is always the final user turn.
  const turns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const msg of history.slice(-10)) {
    // Gemini uses 'model' for assistant turns.
    const role = msg.role === 'assistant' ? 'model' : 'user';
    turns.push({ role, parts: [{ text: msg.content }] });
  }

  turns.push({ role: 'user', parts: [{ text: question }] });
  return turns;
}

function emptySources(organizationId: string): OracleSources {
  return {
    organizationId,
    businessSnapshot: false,
    customersLoaded: 0,
    invoicesLoaded: 0,
    returnsLoaded: 0,
    revenueLoaded: 0,
    zohoRecordsUsed: 0,
    googleRecordsUsed: 0,
    demoRecordsUsed: 0,
    zohoConnected: false,
    googleConnected: false,
    snapshotGeneratedAt: null,
  };
}

function honestFallback(opts: {
  sources: OracleSources;
  error: string;
}): AskOracleResponse {
  return {
    answer: NO_DATA_ANSWER,
    noData: true,
    sources: opts.sources,
    model: GEMINI_MODEL,
    tokensUsed: { input: 0, output: 0, total: 0 },
    latencyMs: 0,
    grounded: false,
    error: opts.error,
  };
}

// ─── Public API: streamOracleFromContext ────────────────────────────────────
//
// Streams Gemini tokens using a PRE-BUILT OracleContext. This is the variant
// used by /api/oracle-chat (the legacy SSE endpoint) so it can build the
// context ONCE (to emit the reasoning trail + DEBUG sources up front) and then
// stream tokens without rebuilding the context.
//
// Yields { token? } chunks then a final { done, response? } chunk.

export async function* streamOracleFromContext(
  ctx: OracleContext,
  question: string,
  history: OracleMessage[],
): AsyncGenerator<{ token?: string; done?: boolean; response?: AskOracleResponse }> {
  const startedAt = Date.now();

  // Honest guard — no business data.
  if (!ctx.hasData) {
    yield {
      done: true,
      response: {
        answer: NO_DATA_ANSWER,
        noData: true,
        sources: ctx.sources,
        model: GEMINI_MODEL,
        tokensUsed: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startedAt,
        grounded: false,
      },
    };
    return;
  }

  // Safety guard — demo data detected.
  if (ctx.sources.demoRecordsUsed > 0) {
    yield {
      done: true,
      response: {
        answer:
          "Oracle refused to answer because demo data was detected in the context. Oracle must only use live tenant-scoped data.",
        noData: false,
        sources: ctx.sources,
        model: GEMINI_MODEL,
        tokensUsed: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startedAt,
        grounded: false,
        error: 'Demo records detected — safety guard tripped.',
      },
    };
    return;
  }

  const systemPrompt = buildSystemPrompt(ctx);
  const contents = buildContents(question, history);

  try {
    const client = getClient();
    const stream = await client.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 2048,
        topP: 0.9,
      },
    });

    let totalOutputTokens = 0;
    let fullAnswer = '';

    for await (const chunk of stream) {
      const token = chunk.text ?? '';
      if (token) {
        fullAnswer += token;
        totalOutputTokens += Math.ceil(token.length / 4);
        yield { token };
      }
    }

    yield {
      done: true,
      response: {
        answer: fullAnswer,
        noData: false,
        sources: ctx.sources,
        model: GEMINI_MODEL,
        tokensUsed: {
          input: Math.ceil(systemPrompt.length / 4),
          output: totalOutputTokens,
          total: Math.ceil(systemPrompt.length / 4) + totalOutputTokens,
        },
        latencyMs: Date.now() - startedAt,
        grounded: true,
      },
    };
  } catch (err: any) {
    // ── Z.AI fallback ──
    // Gemini failed (quota / auth / network / deprecated model). Fall back to
    // z-ai-web-dev-sdk using the IDENTICAL system prompt + live context. This
    // guarantees Oracle always produces an answer grounded in real data.
    console.warn('[gemini-service] Gemini stream failed, falling back to Z.AI:', err?.message ?? err);

    // Emit the fallback answer as a single token chunk (the SSE route will
    // forward it to the client). We can't truly stream z-ai here without a
    // streaming SDK call, so we deliver the full answer as one token.
    const fallback = await callZaiFallback(systemPrompt, question, history);

    if (fallback.success && fallback.answer.trim().length > 0) {
      yield { token: fallback.answer };
      yield {
        done: true,
        response: {
          answer: fallback.answer,
          noData: false,
          sources: ctx.sources,
          model: `${GEMINI_MODEL} (Z.AI fallback)`,
          tokensUsed: {
            input: Math.ceil(systemPrompt.length / 4),
            output: Math.ceil(fallback.answer.length / 4),
            total: Math.ceil(systemPrompt.length / 4) + Math.ceil(fallback.answer.length / 4),
          },
          latencyMs: Date.now() - startedAt,
          grounded: true,
        },
      };
    } else {
      yield {
        done: true,
        response: {
          answer:
            "I ran into a problem reaching the AI service. Please try again in a moment.",
          noData: false,
          sources: ctx.sources,
          model: GEMINI_MODEL,
          tokensUsed: { input: 0, output: 0, total: 0 },
          latencyMs: Date.now() - startedAt,
          grounded: false,
          error: `Gemini failed (${err?.message ?? String(err)}) and Z.AI fallback failed (${fallback.error ?? 'empty'})`,
        },
      };
    }
  }
}

// ─── Health check (used by /api/oracle/health) ──────────────────────────────

export function getGeminiConfig(): { model: string; apiKeyConfigured: boolean } {
  return {
    model: GEMINI_MODEL,
    apiKeyConfigured: Boolean(GEMINI_API_KEY),
  };
}
