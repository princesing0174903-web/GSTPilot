import { NextResponse } from 'next/server';
import { getReconcileState, runReconciliation } from '@/lib/banking/reconcile';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getReconcileState();
    return NextResponse.json(state);
  } catch (err) {
    console.error('[API /banking/reconcile] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load reconciliation state', summary: null, matches: [], exceptions: [], hasLiveData: false },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const result = await runReconciliation();
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've reconciled your bank transactions — ${result.matched} matches, ${result.exceptions} exceptions flagged.`,
    });
  } catch (err) {
    console.error('[API /banking/reconcile] POST error:', err);
    return NextResponse.json({ error: 'Failed to run reconciliation' }, { status: 500 });
  }
}
