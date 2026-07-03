// GET /api/network/benchmark
// Returns the Industry Benchmarking™ summary (5 industries × 7 metrics, percentiles).

import { NextResponse } from 'next/server';
import { getBenchmarkingSummary } from '@/lib/network/benchmark';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const summary = await getBenchmarkingSummary();
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
    });
  } catch (error) {
    console.error('[Network benchmark] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load benchmark summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
