import { NextRequest, NextResponse } from 'next/server';
import { getGraphState, buildBusinessSubgraph } from '@/lib/graph/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/graph/business/:id — business subgraph (1-hop from the firm node) + dependencies + risk
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const state = await getGraphState();
    const sub = buildBusinessSubgraph(state, id);
    return NextResponse.json(sub, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[graph/business] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load business subgraph', detail: String(err) },
      { status: 500 },
    );
  }
}
