import { NextRequest, NextResponse } from 'next/server';
import { getGraphState, buildClientSubgraph } from '@/lib/graph/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/graph/client/:id — client subgraph (2-hop BFS) + risk + chain + insights
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const state = await getGraphState();
    const sub = buildClientSubgraph(state, id);
    if (!sub) {
      return NextResponse.json(
        { error: `Client "${id}" not found in graph` },
        { status: 404 },
      );
    }
    return NextResponse.json(sub, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[graph/client] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load client subgraph', detail: String(err) },
      { status: 500 },
    );
  }
}
