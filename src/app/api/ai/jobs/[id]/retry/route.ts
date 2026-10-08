// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Production Pipeline™ — Retry Job
//
// POST /api/ai/jobs/[id]/retry  { organizationId, freshAttempt? }
//
// Retries a failed or cancelled job.
//   • freshAttempt=false (default): resets the existing job to 'queued'
//     (preserves retryCount for audit). The processor picks it up again.
//   • freshAttempt=true: creates a NEW job with the same input + full retry
//     budget, linking the old job's id in previousAttemptIds.
//
// After retrying, the route fires POST /api/ai/jobs/process internally so the
// processor picks the job up immediately.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { retryJob } from '@/lib/ai-pipeline/server/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params;
    const body = await req.json().catch(() => ({}));
    const { organizationId, freshAttempt } = body as { organizationId?: string; freshAttempt?: boolean };

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }
    if (!jobId) {
      return NextResponse.json({ error: 'job id is required' }, { status: 400 });
    }

    const newJobId = await retryJob(organizationId, jobId, { freshAttempt: freshAttempt === true });

    // Nudge the processor to pick it up immediately.
    try {
      const base = new URL(req.url).origin;
      await fetch(`${base}/api/ai/jobs/process`, { method: 'POST' });
    } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true, jobId: newJobId });
  } catch (err) {
    console.error('[api/ai/jobs/[id]/retry] error:', err);
    const status = err && typeof err === 'object' && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status },
    );
  }
}
