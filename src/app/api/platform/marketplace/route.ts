// GET /api/platform/marketplace — marketplace catalog + installs
import { NextResponse } from 'next/server';
import { getMarketplaceSummary, MARKETPLACE_CATALOG } from '@/lib/platform/marketplace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const summary = await getMarketplaceSummary();
    return NextResponse.json(
      { ...summary, catalog: MARKETPLACE_CATALOG },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Platform': 'true' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute marketplace summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
