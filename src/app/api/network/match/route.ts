// POST /api/network/match — Smart Matching Engine (Module 5 + 10)
// Body: MatchRequest { intent?, query, industry?, location?, specialization?, limit? }
import { NextResponse } from 'next/server';
import { getNetworkState, computeMatches, detectMatchIntent } from '@/lib/network/engine';
import type { MatchRequest } from '@/lib/network/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MatchRequest;
    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }
    const state = await getNetworkState();
    const intent = body.intent ?? detectMatchIntent(body.query);
    const resp = computeMatches(intent, body.query, {
      industry: body.industry,
      location: body.location,
      specialization: body.specialization,
    }, state, body.limit ?? 8);
    return NextResponse.json(resp);
  } catch (err) {
    console.error('[/api/network/match] failed:', err);
    return NextResponse.json(
      { error: 'Match failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
