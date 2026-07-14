// GET /api/oracle-brain/timeline — Oracle unified activity timeline.
import { NextRequest, NextResponse } from 'next/server';
import { buildTimeline } from '@/lib/oracle-intelligence/timeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 500) : 100;
    const timeline = await buildTimeline(limit);
    return NextResponse.json(timeline);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[oracle-brain/timeline] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
