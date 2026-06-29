// POST /api/dev/rollback — roll back a release
import { NextResponse } from 'next/server';
import { rollbackProject } from '@/lib/software-factory/engine';
import type { RollbackRequest } from '@/lib/software-factory/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RollbackRequest;
    if (!body.projectId || !body.releaseId) {
      return NextResponse.json({ ok: false, error: 'projectId and releaseId are required.' }, { status: 400 });
    }
    const release = await rollbackProject({ projectId: body.projectId, releaseId: body.releaseId });
    return NextResponse.json({ ok: true, release });
  } catch (err) {
    console.error('[/api/dev/rollback]', err);
    return NextResponse.json({ ok: false, error: 'Rollback failed — see server logs.' }, { status: 500 });
  }
}
