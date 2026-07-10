// GET /api/command/workflows
// Returns coordinated workflows + summary.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { getWorkflows, getWorkflowSummary, WORKFLOW_TEMPLATES } from '@/lib/command-network';

export async function GET(_request: NextRequest) {
  try {
    const [workflows, summary] = await Promise.all([
      getWorkflows(30),
      getWorkflowSummary(),
    ]);
    return NextResponse.json({ ok: true, workflows, summary, templates: WORKFLOW_TEMPLATES });
  } catch (err) {
    console.error('[command/workflows] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load workflows';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
