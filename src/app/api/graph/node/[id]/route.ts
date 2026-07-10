import { NextRequest, NextResponse } from 'next/server';
import { getGraphState, buildNodeSubgraph } from '@/lib/graph/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/graph/node/:id — generic 2-hop BFS subgraph around ANY node type.
// Returns: NodeSubgraph (centerNode + graph + riskForNode + chains + insights + rootCauseChains)
//
// Supports node IDs in any of these formats:
//   - Full ID:   "client:abc123", "invoice:xyz", "vendor:tata-steel"
//   - Entity ID: "abc123", "xyz" (will be matched on n.entityId)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Missing node id' },
        { status: 400 },
      );
    }
    const state = await getGraphState();
    const sub = buildNodeSubgraph(state, id);
    if (!sub) {
      return NextResponse.json(
        { error: `Node "${id}" not found in graph` },
        { status: 404 },
      );
    }
    return NextResponse.json(sub, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[graph/node] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load node subgraph', detail: String(err) },
      { status: 500 },
    );
  }
}
