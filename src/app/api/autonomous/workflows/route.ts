// GET /api/autonomous/workflows — Autonomous Workflows: active + templates
import { NextResponse } from 'next/server';
import { loadActiveWorkflows, WORKFLOW_TEMPLATES } from '@/lib/autonomous/workflows';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const activeWorkflows = await loadActiveWorkflows(12);
    return NextResponse.json(
      {
        activeWorkflows,
        templates: WORKFLOW_TEMPLATES,
        total: activeWorkflows.length,
        tagline: AUTONOMOUS_TAGLINE,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Workflows] Error:', error);
    return NextResponse.json({ error: 'Failed to load workflows', tagline: AUTONOMOUS_TAGLINE }, { status: 500 });
  }
}
