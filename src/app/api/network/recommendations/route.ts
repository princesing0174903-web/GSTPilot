// GET /api/network/recommendations — top recommendations for the current user (Module 10)
import { NextResponse } from 'next/server';
import { getNetworkState } from '@/lib/network/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const state = await getNetworkState();
    return NextResponse.json({
      recommendations: state.recommendations,
      myNetwork: state.myNetwork,
      myBusiness: state.myBusiness,
      generatedAt: state.generatedAt,
    });
  } catch (err) {
    console.error('[/api/network/recommendations] failed:', err);
    return NextResponse.json(
      { error: 'Failed to load recommendations', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
