// POST /api/dev/deploy — deploy a project
import { NextResponse } from 'next/server';
import { deployProject } from '@/lib/software-factory/engine';
import type { DeployRequest } from '@/lib/software-factory/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeployRequest;
    if (!body.projectId || !body.environment) {
      return NextResponse.json({ ok: false, error: 'projectId and environment are required.' }, { status: 400 });
    }
    const deployment = await deployProject({ projectId: body.projectId, environment: body.environment, strategy: body.strategy });
    return NextResponse.json({ ok: true, deployment });
  } catch (err) {
    console.error('[/api/dev/deploy]', err);
    return NextResponse.json({ ok: false, error: 'Deployment failed — see server logs.' }, { status: 500 });
  }
}
