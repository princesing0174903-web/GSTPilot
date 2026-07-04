// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Jobs API
//
// POST /api/ai/jobs          — queue a new job (server-side, then trigger process)
// GET  /api/ai/jobs?orgId=   — list jobs for an org
//
// The client normally writes jobs directly to Firestore via the service layer
// (createJob). This server-side endpoint exists for:
//   • Clients that prefer the API route over direct Firestore writes
//   • Server-initiated generations (e.g. scheduled, webhook-triggered)
//   • A single audit-logged entry point
//
// After queuing, the route fires POST /api/ai/jobs/process internally so the
// background processor picks the job up immediately.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { queueJob } from '@/lib/ai-pipeline/server/processor';
import { listJobs } from '@/lib/ai-pipeline/service';
import type { GenAssetType, GenProviderName, GenJobInput, GenJobStatus } from '@/lib/ai-pipeline/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_MODELS: Record<GenAssetType, string> = {
  text: 'mock-text-pro',
  image: 'mock-image-v2',
  video: 'mock-video-1',
  audio: 'mock-audio-v1',
  code: 'mock-code-pro',
  structured: 'mock-structured-v1',
};

// ─── POST: queue a new job ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organizationId,
      createdBy,
      assetType,
      provider,
      model,
      input,
      draftId,
      maxRetries,
    } = body as {
      organizationId: string;
      createdBy: { uid: string; name: string; email: string };
      assetType: GenAssetType;
      provider?: GenProviderName;
      model?: string;
      input: GenJobInput;
      draftId?: string | null;
      maxRetries?: number;
    };

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }
    if (!createdBy?.uid) {
      return NextResponse.json({ error: 'createdBy.uid is required' }, { status: 400 });
    }
    if (!assetType) {
      return NextResponse.json({ error: 'assetType is required' }, { status: 400 });
    }
    if (!input?.prompt || input.prompt.trim().length < 3) {
      return NextResponse.json({ error: 'input.prompt must be at least 3 characters' }, { status: 400 });
    }

    const jobId = await queueJob(organizationId, {
      createdBy,
      assetType,
      provider: provider ?? 'mock',
      model: model ?? DEFAULT_MODELS[assetType],
      input,
      draftId: draftId ?? null,
      maxRetries: maxRetries ?? 3,
    });

    // Fire-and-forget: nudge the processor to pick it up immediately.
    try {
      const base = new URL(req.url).origin;
      await fetch(`${base}/api/ai/jobs/process`, { method: 'POST' });
    } catch {
      // Non-fatal — the background tick (5s) will catch it.
    }

    return NextResponse.json({ ok: true, jobId }, { status: 201 });
  } catch (err) {
    console.error('[api/ai/jobs] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// ─── GET: list jobs for an org ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('orgId');
    const status = searchParams.get('status') as GenJobStatus | null;
    const limitCount = searchParams.get('limit');

    if (!organizationId) {
      return NextResponse.json({ error: 'orgId query param is required' }, { status: 400 });
    }

    const jobs = await listJobs(organizationId, {
      status: status ?? undefined,
      limitCount: limitCount ? Number(limitCount) : undefined,
    });

    return NextResponse.json({ ok: true, jobs });
  } catch (err) {
    console.error('[api/ai/jobs] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
