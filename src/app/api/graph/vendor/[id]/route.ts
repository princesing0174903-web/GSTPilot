import { NextRequest, NextResponse } from 'next/server';
import { getGraphState, buildVendorSubgraph } from '@/lib/graph/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/graph/vendor/:id — vendor subgraph with reliability + spend stats.
// Returns: VendorSubgraph (graph + totalSpend + pendingPayables + overdueBills +
//          reliabilityScore + riskForVendor + insights)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Missing vendor id' },
        { status: 400 },
      );
    }
    const state = await getGraphState();
    const sub = buildVendorSubgraph(state, id);
    if (!sub) {
      return NextResponse.json(
        { error: `Vendor "${id}" not found in graph` },
        { status: 404 },
      );
    }
    return NextResponse.json(sub, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[graph/vendor] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load vendor subgraph', detail: String(err) },
      { status: 500 },
    );
  }
}
