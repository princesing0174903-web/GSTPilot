// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Production Pipeline™ — Cancel Job
//
// POST /api/ai/jobs/[id]/cancel  { organizationId }
//
// Sets status='cancelled'. If the job is currently processing, the processor's
// onSnapshot listener detects the change and flips the CancelSignal, aborting
// the provider call. Idempotent — cancelling an already-terminal job is a no-op.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { cancelJob } from '@/lib/ai-pipeline/server/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params;
    const body = await req.json().catch(() => ({}));
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }
    if (!jobId) {
      return NextResponse.json({ error: 'job id is required' }, { status: 400 });
    }

    await cancelJob(organizationId, jobId);
    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    console.error('[api/ai/jobs/[id]/cancel] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
