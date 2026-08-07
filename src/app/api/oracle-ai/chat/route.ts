// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/oracle-ai/chat — Streaming chat with the Oracle AI engine
//
// Request body:
//   {
//     sessionId: string,
//     message: string,
//     agentId?: string,        // override the session's agent for this turn
//     model?: string,          // override the model (e.g. "glm-4.6")
//     dryRun?: boolean,        // skip LLM, only run reasoning + tools
//     attachments?: { name, type, size, dataUri? }[]
//   }
//
// Response: text/event-stream of StreamEvent JSON chunks.
// Each line: `data: {...}\n\n`. The client consumes these via EventSource-like
// fetch streaming (see src/components/oracle-ai/useOracleAIChat.ts).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { streamChat } from '@/lib/oracle-ai/engine';
import { rateLimit, rateLimitedResponse, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { parseBody, schemas } from '@/lib/validation';
import type { ChatRequest } from '@/lib/oracle-ai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // ── SECURITY (POLISH-06): rate limit per IP — 20 Oracle requests/min. ──
  const rl = rateLimit(req, RATE_LIMIT_PRESETS.oracle, 'oracle-ai-chat');
  if (rl.denied) return rateLimitedResponse(rl.retryAfterSec, 'You have sent too many messages to Oracle. Please wait a moment and try again.');

  let ctx;
  try {
    ctx = await resolveOracleAICtx(req);
  } catch (err) {
    return toErrorResponse(err);
  }

  // ── SECURITY (POLISH-06): zod validation on the request body. ──
  const [parsed, validationErr] = await parseBody(req, schemas.oracleAiChat);
  if (validationErr) return validationErr;

  const chatReq: ChatRequest = {
    sessionId: parsed.sessionId,
    message: parsed.message,
    agentId: parsed.agentId,
    model: parsed.model,
    dryRun: Boolean(parsed.dryRun),
    attachments: parsed.attachments,
  };

  if (!chatReq.sessionId || !chatReq.message) {
    return new Response(JSON.stringify({ error: 'sessionId and message are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const stream = await streamChat(chatReq, { firmId: ctx.firmId, userId: ctx.uid });
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Oracle-AI-Stream': 'true',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
