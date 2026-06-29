// GET /api/dev/builds — list build records
import { NextResponse } from 'next/server';
import { getBuilds } from '@/lib/software-factory/engine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const builds = await getBuilds(projectId);
    return NextResponse.json({ ok: true, builds, count: builds.length });
  } catch (err) {
    console.error('[/api/dev/builds]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load builds' }, { status: 500 });
  }
}
