// GET /api/dev/releases — list releases
import { NextResponse } from 'next/server';
import { getReleases } from '@/lib/software-factory/engine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const releases = await getReleases(projectId);
    return NextResponse.json({ ok: true, releases, count: releases.length });
  } catch (err) {
    console.error('[/api/dev/releases]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load releases' }, { status: 500 });
  }
}
