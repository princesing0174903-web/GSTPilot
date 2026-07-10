// POST /api/execution-cloud/jobs
// Enqueue a background job. Returns the queued job with a stable id.

import { NextResponse } from 'next/server';
import { enqueueJob } from '@/lib/execution-cloud/engine';
import type { JobActionRequest, JobActionResponse } from '@/lib/execution-cloud/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: JobActionRequest;
  try {
    body = (await request.json()) as JobActionRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, priority, scheduledFor } = body;
  if (!type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }

  try {
    const job = enqueueJob({ type, priority, scheduledFor });
    const response: JobActionResponse = {
      ok: true,
      job,
      message: `Job ${job.id} enqueued in ${job.queue} (${job.status}, priority ${job.priority}).`,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[execution-cloud/jobs] POST failed:', err);
    return NextResponse.json(
      { error: 'Failed to enqueue job', detail: String(err) },
      { status: 500 },
    );
  }
}
