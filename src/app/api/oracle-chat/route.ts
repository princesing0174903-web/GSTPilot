// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Streaming API
// POST /api/oracle-chat
//
// Streams Server-Sent Events to the client as the agent:
//   1. Selects tools
//   2. Executes them in parallel (tool_call + tool_result events)
//   3. Streams LLM tokens
//   4. Emits structured sections (executive_summary, analysis, evidence)
//   5. Emits actions, confidence, sources, insights, followups
//   6. done
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { runOracleAgent } from '@/lib/oracle-chat/agent';
import type { OracleChatRequest, OracleStreamEvent } from '@/lib/oracle-chat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sse(event: OracleStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) — must happen BEFORE the SSE stream starts. ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  let body: OracleChatRequest;
  try {
    body = (await req.json()) as OracleChatRequest;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return new Response('Message is required', { status: 400 });
  }

  // Validate org membership (body may carry orgId / organizationId / firmId).
  const orgId0 = (body as any).orgId || (body as any).organizationId || (body as any).firmId || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  const conversationId = body.conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: OracleStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(sse(event)));
        } catch {
          // controller may be closed
        }
      };

      try {
        await runOracleAgent({ ...body, message }, conversationId, { onEvent: send });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Agent failed';
        send({ type: 'error', message: msg });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
