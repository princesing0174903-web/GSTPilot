import { NextRequest, NextResponse } from 'next/server';
import { generateCFOInsights } from '@/lib/cfo/engine';
import { orchestrateDay } from '@/lib/rmb/engine';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/rmb/orchestrate
// Body: { trigger?: string }  (default: "Run my business today")
// Returns: OrchestrationPlan — analyse → prioritise → create tasks → execute → monitor → report
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const trigger = (body?.trigger ?? 'Run my business today').toString();

    let user: { name?: string } | null = null;
    try {
      const session = await getServerSession();
      const name = session?.user?.name ?? undefined;
      user = name ? { name } : null;
    } catch {
      // ignore
    }

    const cfo = await generateCFOInsights(user);
    const plan = orchestrateDay(cfo);
    plan.trigger = trigger;

    return NextResponse.json(plan, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[rmb/orchestrate] POST error', err);
    return NextResponse.json(
      { error: 'Failed to orchestrate', detail: String(err) },
      { status: 500 },
    );
  }
}
