// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Process Trigger
//
// POST /api/ai/jobs/process
//
// Kicks the background processor to pick up queued jobs. Called by the client
// (fire-and-forget) immediately after creating a job so generation starts
// within ~100ms instead of waiting for the next 5s tick.
//
// Also starts the long-running background interval (idempotent) so future
// queued jobs (retries, etc.) get picked up automatically.
//
// This route is SERVER-ONLY — it imports the processor which imports the
// provider (node:crypto) + Firestore.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { startBackgroundProcessor, processPendingJobs, providerHealthCheck } from '@/lib/ai-pipeline/server/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    // Start the background interval (idempotent — safe to call on every request).
    startBackgroundProcessor();

    // Pick up queued jobs immediately (don't wait for the next tick).
    const result = await processPendingJobs();

    const health = await providerHealthCheck();

    return NextResponse.json({
      ok: true,
      pickedUp: result.pickedUp,
      activeCount: result.activeCount,
      provider: health,
    });
  } catch (err) {
    console.error('[api/ai/jobs/process] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    startBackgroundProcessor();
    const result = await processPendingJobs();
    const health = await providerHealthCheck();
    return NextResponse.json({ ok: true, ...result, provider: health });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
