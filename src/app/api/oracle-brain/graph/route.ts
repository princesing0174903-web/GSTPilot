// GET /api/oracle-brain/graph — Oracle Business Graph.
import { NextResponse } from 'next/server';
import { buildBusinessGraph } from '@/lib/oracle-intelligence/business-graph';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const graph = await buildBusinessGraph();
    return NextResponse.json(graph);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[oracle-brain/graph] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
