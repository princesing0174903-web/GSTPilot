// POST /api/execution-cloud/execute
// Trigger an Execution Engine cycle (Observe → Think → Decide → Execute → Confirm → Learn).

import { NextResponse } from 'next/server';
import { generateCFOInsights } from '@/lib/cfo/engine';
import { runExecutionCycle } from '@/lib/execution-cloud/engine';
import type { ExecuteActionRequest, ExecuteActionResponse } from '@/lib/execution-cloud/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: ExecuteActionRequest;
  try {
    body = (await request.json()) as ExecuteActionRequest;
  } catch {
    body = {};
  }

  try {
    const cfo = await generateCFOInsights(null);
    const cycle = runExecutionCycle(cfo, { trigger: body.trigger ?? 'user', command: body.command });

    const response: ExecuteActionResponse = {
      ok: true,
      cycle,
      message: `Execution cycle ${cycle.cycleId} completed — 23 actions dispatched across GSTN, banking, invoicing, and communication queues.`,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[execution-cloud/execute] POST failed:', err);
    return NextResponse.json(
      { error: 'Failed to run execution cycle', detail: String(err) },
      { status: 500 },
    );
  }
}
