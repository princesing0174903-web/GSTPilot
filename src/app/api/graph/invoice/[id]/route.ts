import { NextRequest, NextResponse } from 'next/server';
import { getGraphState, buildInvoiceSubgraph } from '@/lib/graph/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/graph/invoice/:id — invoice subgraph with payment status + linked return/payment.
// Returns: InvoiceSubgraph (graph + paymentStatus + amountPaid + amountDue +
//          linkedReturn + linkedPayment + insights)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Missing invoice id' },
        { status: 400 },
      );
    }
    const state = await getGraphState();
    const sub = buildInvoiceSubgraph(state, id);
    if (!sub) {
      return NextResponse.json(
        { error: `Invoice "${id}" not found in graph` },
        { status: 404 },
      );
    }
    return NextResponse.json(sub, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[graph/invoice] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load invoice subgraph', detail: String(err) },
      { status: 500 },
    );
  }
}
