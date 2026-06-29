// POST /api/dev/build — trigger a build
import { NextResponse } from 'next/server';
import { buildProject } from '@/lib/software-factory/engine';
import type { BuildRequest } from '@/lib/software-factory/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BuildRequest;
    if (!body.projectId) {
      return NextResponse.json({ ok: false, error: 'projectId is required.' }, { status: 400 });
    }
    const build = await buildProject({ projectId: body.projectId, trigger: body.trigger || 'manual' });
    return NextResponse.json({ ok: true, build });
  } catch (err) {
    console.error('[/api/dev/build]', err);
    return NextResponse.json({ ok: false, error: 'Build failed — see server logs.' }, { status: 500 });
  }
}
