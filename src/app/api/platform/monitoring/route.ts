// GET /api/platform/monitoring — enterprise monitoring metrics
import { NextResponse } from 'next/server';
import { getMonitoringSummary } from '@/lib/platform/monitoring';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const summary = await getMonitoringSummary();
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Platform': 'true' } });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute monitoring summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
