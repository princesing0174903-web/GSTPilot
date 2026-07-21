// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Action Confirmation API
// POST /api/oracle/brain/confirm
//
// Called by the OracleBrain UI when the user clicks "Confirm & Execute" or
// "Cancel" on an action confirmation card. Delegates to the generic Action
// Engine — this endpoint has zero knowledge of specific actions.
//
// Request body:
//   {
//     confirmed: boolean,         // true = execute, false = cancel
//     toolCallId: string,         // from the action-confirm SSE event
//     tool: string,               // action name (e.g. "createInvoice")
//     args: Record<string, any>,  // action parameters
//     orgId: string,              // tenant scope
//     sessionId?: string,         // for persistence
//     userId?: string,
//   }
//
// Response (200):
//   If confirmed === true and execution succeeds:
//     { ok: true, success: true, action, displayName, summary, result,
//       artifacts, followUp, viewIn, refreshedContext, messageId }
//   If confirmed === true but execution fails:
//     { ok: false, success: false, action, displayName, summary, refreshedContext: {} }
//   If confirmed === false:
//     { ok: true, cancelled: true, action, toolCallId }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeAndRefresh, cancelAction, type ActionContext } from '@/lib/oracle/action-engine';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const confirmed: boolean = Boolean(body.confirmed);
  const toolCallId: string = body.toolCallId ? String(body.toolCallId) : '';
  const tool: string = String(body.tool ?? body.action ?? '').trim();
  const args: Record<string, any> = body.args && typeof body.args === 'object' ? body.args : {};
  const orgId: string = String(body.orgId ?? '').trim();
  const sessionId: string | undefined = body.sessionId ? String(body.sessionId) : undefined;
  const userId: string | undefined = body.userId ? String(body.userId) : undefined;

  if (!tool) {
    return NextResponse.json({ ok: false, error: 'tool is required' }, { status: 400 });
  }
  if (!orgId) {
    return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 });
  }

  const ctx: ActionContext = { orgId, userId, sessionId, toolCallId };

  // ─── Cancellation ─────────────────────────────────────────────────────────
  if (!confirmed) {
    const cancelResult = await cancelAction(tool, toolCallId, ctx);
    // Persist a small assistant note about the cancellation
    if (sessionId) {
      try {
        await db.oracleAIMessage.create({
          data: {
            sessionId,
            firmId: orgId,
            userId,
            role: 'assistant',
            content: `Action cancelled: ${tool}. No changes were made to your data.`,
            status: 'completed',
            model: 'glm-4.6',
            parts: JSON.stringify([{ type: 'tool-call', tool, args, cancelled: true }]),
          },
        });
        await db.oracleAISession.update({
          where: { id: sessionId },
          data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
        }).catch(() => {});
      } catch (e) {
        console.warn('[confirm] cancel message persist failed:', (e as Error).message);
      }
    }
    return NextResponse.json(cancelResult);
  }

  // ─── Execution ────────────────────────────────────────────────────────────
  const result = await executeAndRefresh(tool, args, ctx);

  // Persist the success (or failure) as an assistant message in the conversation
  // so it shows up in the chat thread and is replayed on session reload.
  let messageId: string | undefined;
  if (sessionId) {
    try {
      const parts = [{
        type: 'tool-call',
        tool,
        args,
        result: result.result,
        executed: true,
        success: result.success,
        artifacts: result.artifacts,
        followUp: result.followUp,
        viewIn: result.viewIn,
      }];
      const msg = await db.oracleAIMessage.create({
        data: {
          sessionId,
          firmId: orgId,
          userId,
          role: 'assistant',
          content: result.summary,
          status: 'completed',
          model: 'glm-4.6',
          parts: JSON.stringify(parts),
        },
      });
      messageId = msg.id;
      await db.oracleAISession.update({
        where: { id: sessionId },
        data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
      }).catch(() => {});
    } catch (e) {
      console.warn('[confirm] success message persist failed:', (e as Error).message);
    }
  }

  return NextResponse.json({
    ...result,
    messageId,
  });
}
