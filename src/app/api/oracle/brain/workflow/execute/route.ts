// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Workflow Execute API (SSE stream)
// POST /api/oracle/brain/workflow/execute
//
// Executes a WorkflowPlan step-by-step, streaming per-step progress back to the
// client as Server-Sent Events. The frontend renders a live progress card.
//
// Request body:
//   {
//     plan: WorkflowPlan,    — the plan returned by /workflow/plan
//     orgId: string,
//     sessionId?: string,
//     userId?: string,
//   }
//
// SSE events (one per line, prefixed with "data: "):
//   workflow-start           — {type, plan:{id,title,category,stepCount}}
//   workflow-step-start      — {type, stepId, label, actionName, index, total}
//   workflow-step-success    — {type, stepId, label, summary, data, durationMs}
//   workflow-step-skipped    — {type, stepId, label, reason}
//   workflow-step-failed     — {type, stepId, label, error, critical, willRollback}
//   workflow-rollback-start  — {type, stepId, actionName}
//   workflow-rollback-done   — {type, stepId, ok, summary}
//   workflow-complete        — {type, result: WorkflowResult}  ← terminal
//
// The stream closes after `workflow-complete`. The client never needs to poll.
// If the client disconnects mid-workflow, the AbortSignal fires and the
// executor halts at the next step boundary (no orphaned work).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { executeWorkflow, type WorkflowPlan } from '@/lib/oracle/workflow-engine';

export const runtime = 'nodejs';
export const maxDuration = 120; // workflows can chain several actions

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const plan: WorkflowPlan | undefined = body.plan;
  const orgId: string = String(body.orgId ?? '').trim();
  const sessionId: string | undefined = body.sessionId ? String(body.sessionId) : undefined;
  const userId: string | undefined = body.userId ? String(body.userId) : undefined;

  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    return new Response('plan is required and must have steps', { status: 400 });
  }
  if (!orgId) {
    return new Response('orgId is required', { status: 400 });
  }

  // Build the SSE stream. The executor pushes events through the controller;
  // we wire onEvent → enqueue. An AbortController tied to the request close
  // lets the executor halt cleanly on client disconnect.
  const abort = new AbortController();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Detect client disconnect → abort the executor
      request.signal.addEventListener('abort', () => {
        abort.abort();
      });

      const send = (event: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller already closed — ignore
        }
      };

      try {
        await executeWorkflow(plan, {
          orgId,
          sessionId,
          userId,
          onEvent: send,
          signal: abort.signal,
        });
      } catch (e) {
        // Fatal executor error — emit a synthetic complete event so the client
        // UI doesn't hang on a spinner forever.
        const errMsg = (e as Error).message || 'Workflow execution crashed';
        send({
          type: 'workflow-complete',
          result: {
            ok: false,
            status: 'failed',
            steps: [],
            summary: `❌ Workflow crashed: ${errMsg}`,
            completedCount: 0,
            failedCount: 1,
            skippedCount: 0,
            durationMs: 0,
          },
        });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering
    },
  });
}
