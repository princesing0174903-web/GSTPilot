import { NextRequest, NextResponse } from 'next/server';
import { generateCFOInsights } from '@/lib/cfo/engine';
import { buildDelegationPlan } from '@/lib/rmb/engine';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/rmb/delegate
// Body: { rawText: string }
// Returns: DelegationPlan — understood, intent, tasks, executionMode, ack
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawText: string = (body?.rawText ?? '').toString().trim();

    if (!rawText) {
      return NextResponse.json(
        { error: 'Missing "rawText" in request body.' },
        { status: 400 },
      );
    }

    let user: { name?: string } | null = null;
    try {
      const session = await getServerSession();
      const name = session?.user?.name ?? undefined;
      user = name ? { name } : null;
    } catch {
      // ignore
    }

    const cfo = await generateCFOInsights(user);
    const plan = buildDelegationPlan(rawText, cfo);

    return NextResponse.json(plan, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[rmb/delegate] POST error', err);
    return NextResponse.json(
      { error: 'Failed to build delegation plan', detail: String(err) },
      { status: 500 },
    );
  }
}
