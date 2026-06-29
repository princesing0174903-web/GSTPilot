// GET /api/dev/deployments — list deployments
import { NextResponse } from 'next/server';
import { getDeployments } from '@/lib/software-factory/engine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const deployments = await getDeployments(projectId);
    return NextResponse.json({ ok: true, deployments, count: deployments.length });
  } catch (err) {
    console.error('[/api/dev/deployments]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load deployments' }, { status: 500 });
  }
}
