// GET /api/network/payments
// Returns the Global Payments Network™ summary (volumes, methods, currencies, reconciliation).

import { NextResponse } from 'next/server';
import { getPaymentsNetworkSummary } from '@/lib/network/payments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const summary = await getPaymentsNetworkSummary();
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
    });
  } catch (error) {
    console.error('[Network payments] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load payments summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
