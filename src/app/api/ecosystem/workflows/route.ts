// GET /api/ecosystem/workflows
// Low-Code Studio workflows + run stats. Real triggers, real steps, real runs.

import { NextResponse } from 'next/server';
import { listWorkflows } from '@/lib/ecosystem/lowcode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId') ?? undefined;
    const workflows = await listWorkflows(orgId);
    return NextResponse.json(
      { total: workflows.length, workflows },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem workflows] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load low-code workflows', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
