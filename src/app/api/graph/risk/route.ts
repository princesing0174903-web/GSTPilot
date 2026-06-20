import { NextResponse } from 'next/server';
import { getGraphState } from '@/lib/graph/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/graph/risk — risk graph (RiskNode[] with stats + top risks)
export async function GET() {
  try {
    const state = await getGraphState();
    return NextResponse.json(state.riskGraph, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[graph/risk] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load risk graph', detail: String(err) },
      { status: 500 },
    );
  }
}
