// POST /api/ecosystem/run-workflow
// Run a low-code workflow. Real step execution, real run counter, audit-logged.

import { NextResponse } from 'next/server';
import { runWorkflow } from '@/lib/ecosystem/lowcode';
import { invalidateEcosystemCache } from '@/lib/ecosystem/orchestrator';
import { logApiUsage } from '@/lib/ecosystem/api-gateway';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const workflowId: string = body.workflowId ?? body.id ?? '';
    if (!workflowId) return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
    const context: Record<string, unknown> = body.context ?? {};

    const result = await runWorkflow(workflowId, context);
    invalidateEcosystemCache();

    await logApiUsage({
      endpoint: '/api/ecosystem/run-workflow',
      method: 'POST',
      statusCode: 200,
      responseMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: result.success, stepsExecuted: result.stepsExecuted },
      { headers: { 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem run-workflow] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run workflow', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
