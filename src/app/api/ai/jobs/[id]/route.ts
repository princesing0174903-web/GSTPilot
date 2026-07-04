// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Single Job
//
// GET /api/ai/jobs/[id]?orgId=  — fetch a single job by id
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/ai-pipeline/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params;
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('orgId');

    if (!organizationId) {
      return NextResponse.json({ error: 'orgId query param is required' }, { status: 400 });
    }
    if (!jobId) {
      return NextResponse.json({ error: 'job id is required' }, { status: 400 });
    }

    const job = await getJob(organizationId, jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    console.error('[api/ai/jobs/[id]] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
