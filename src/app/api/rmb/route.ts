import { NextResponse } from 'next/server';
import { getRmbState } from '@/lib/rmb/engine';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/rmb — full Run My Business™ state
export async function GET() {
  try {
    let user: { name?: string } | null = null;
    try {
      const session = await getServerSession();
      const name = session?.user?.name ?? undefined;
      user = name ? { name } : null;
    } catch {
      // next-auth not configured in this env — engine works without it
    }
    const state = await getRmbState(user);
    return NextResponse.json(state, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[rmb] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load Run My Business state', detail: String(err) },
      { status: 500 },
    );
  }
}
