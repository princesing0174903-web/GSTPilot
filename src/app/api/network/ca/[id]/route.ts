// GET /api/network/ca/:id — CA Network Detail (Module 10)
import { NextResponse } from 'next/server';
import { getNetworkState, buildCADetail } from '@/lib/network/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const state = await getNetworkState();
    const detail = buildCADetail(state, id);
    if (!detail) {
      return NextResponse.json({ error: 'CA not found in network' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    console.error('[/api/network/ca/:id] failed:', err);
    return NextResponse.json(
      { error: 'Failed to load CA detail', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
