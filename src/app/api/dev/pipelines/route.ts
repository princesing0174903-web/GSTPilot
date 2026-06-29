// GET /api/dev/pipelines — list CI/CD pipelines
import { NextResponse } from 'next/server';
import { getPipelines } from '@/lib/software-factory/engine';

export async function GET() {
  try {
    const pipelines = await getPipelines();
    return NextResponse.json({ ok: true, pipelines, count: pipelines.length });
  } catch (err) {
    console.error('[/api/dev/pipelines]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load pipelines' }, { status: 500 });
  }
}
