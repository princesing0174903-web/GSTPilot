// GET /api/dev/repositories — list code repositories
import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/software-factory/engine';

export async function GET() {
  try {
    const repositories = await getRepositories();
    return NextResponse.json({ ok: true, repositories, count: repositories.length });
  } catch (err) {
    console.error('[/api/dev/repositories]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load repositories' }, { status: 500 });
  }
}
