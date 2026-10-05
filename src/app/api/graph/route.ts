import { NextResponse } from 'next/server';
import { getGraphState } from '@/lib/graph/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/graph — full Business Graph™ state
export async function GET() {
  try {
    const state = await getGraphState();
    return NextResponse.json(state, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[graph] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load Business Graph state', detail: String(err) },
      { status: 500 },
    );
  }
}
