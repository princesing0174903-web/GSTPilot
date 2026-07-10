// POST /api/ecosystem/create-workflow
// Create a low-code workflow. Real trigger + steps persisted. Audit-logged.

import { NextResponse } from 'next/server';
import { createWorkflow } from '@/lib/ecosystem/lowcode';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { invalidateEcosystemCache } from '@/lib/ecosystem/orchestrator';
import { logApiUsage } from '@/lib/ecosystem/api-gateway';
import type { WorkflowStep, WorkflowTrigger } from '@/lib/ecosystem/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const title: string = body.title ?? '';
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const organizationId = await resolveOrgId(body.organizationId);
    const workflow = await createWorkflow({
      organizationId,
      title,
      description: body.description,
      trigger: (body.trigger ?? 'manual') as WorkflowTrigger,
      triggerConfig: body.triggerConfig,
      steps: Array.isArray(body.steps) ? (body.steps as WorkflowStep[]) : [],
      createdBy: body.createdBy,
    });
    invalidateEcosystemCache();

    await logApiUsage({
      organizationId,
      endpoint: '/api/ecosystem/create-workflow',
      method: 'POST',
      statusCode: 201,
      responseMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: true, workflow },
      { status: 201, headers: { 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem create-workflow] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
