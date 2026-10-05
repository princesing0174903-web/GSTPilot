// GET /api/autonomous/memory — Enterprise Memory: unified searchable memory
import { NextRequest, NextResponse } from 'next/server';
import { searchEnterpriseMemory } from '@/lib/autonomous/memory';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);
    const result = await searchEnterpriseMemory(query, limit);
    return NextResponse.json(
      { ...result, query: query ?? null, tagline: AUTONOMOUS_TAGLINE },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Memory] Error:', error);
    return NextResponse.json({ error: 'Failed to search memory', tagline: AUTONOMOUS_TAGLINE }, { status: 500 });
  }
}
