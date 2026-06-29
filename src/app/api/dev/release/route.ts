// POST /api/dev/release — create a release
import { NextResponse } from 'next/server';
import { releaseProject } from '@/lib/software-factory/engine';
import type { ReleaseRequest } from '@/lib/software-factory/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReleaseRequest;
    if (!body.projectId || !body.channel) {
      return NextResponse.json({ ok: false, error: 'projectId and channel are required.' }, { status: 400 });
    }
    const release = await releaseProject({ projectId: body.projectId, channel: body.channel, strategy: body.strategy, releaseNotes: body.releaseNotes });
    return NextResponse.json({ ok: true, release });
  } catch (err) {
    console.error('[/api/dev/release]', err);
    return NextResponse.json({ ok: false, error: 'Release failed — see server logs.' }, { status: 500 });
  }
}
