import { NextRequest, NextResponse } from 'next/server';
import { getGraphState, executeQuery, QUICK_GRAPH_QUERIES } from '@/lib/graph/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/graph/query
// Body: { text: string }
// Returns: GraphQueryResult — intent + answer + bullets + relatedNodeIds + spokenAck
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text ?? '').toString().trim();

    if (!text) {
      return NextResponse.json(
        { error: 'Missing "text" in request body.' },
        { status: 400 },
      );
    }

    const state = await getGraphState();
    const result = executeQuery(text, state);

    return NextResponse.json(
      { ...result, quickQueries: QUICK_GRAPH_QUERIES },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    );
  } catch (err) {
    console.error('[graph/query] POST error', err);
    return NextResponse.json(
      { error: 'Failed to execute graph query', detail: String(err) },
      { status: 500 },
    );
  }
}
