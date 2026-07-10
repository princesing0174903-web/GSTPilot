// GET /api/dev/tests — list test runs
import { NextResponse } from 'next/server';
import { getTests } from '@/lib/software-factory/engine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const tests = await getTests(projectId);
    return NextResponse.json({ ok: true, tests, count: tests.length });
  } catch (err) {
    console.error('[/api/dev/tests]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load test runs' }, { status: 500 });
  }
}
