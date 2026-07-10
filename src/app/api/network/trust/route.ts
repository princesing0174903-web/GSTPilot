// GET /api/network/trust
// Returns the Trust Network™ summary (avg scores, distribution, top trusted + at-risk nodes).

import { NextResponse } from 'next/server';
import { getTrustNetworkSummary } from '@/lib/network/trust';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const summary = await getTrustNetworkSummary();
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
    });
  } catch (error) {
    console.error('[Network trust] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load trust summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
