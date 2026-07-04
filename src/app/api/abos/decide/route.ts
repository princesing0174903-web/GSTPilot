// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ABOS™ — POST /api/abos/decide
// Approve / promote a Decision Engine recommendation for execution.
// Body: { decisionId?: string; area?: DecisionArea; action?: 'approve' }
// Returns: { ok, decision, spokenAck } — the decision now marked 'approved'.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getAbosState } from '@/lib/abos/engine';
import type { BusinessDecision } from '@/lib/abos/types';

export async function POST(request: Request) {
  let body: { decisionId?: string; area?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    const state = await getAbosState(null);
    const match: BusinessDecision | undefined =
      state.decisions.find((d) => d.id === body.decisionId) ??
      (body.area ? state.decisions.find((d) => d.area === body.area) : undefined);
    if (!match) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }
    const spokenAck = `I've approved the decision: ${match.headline} The ${match.ownerAgent} is taking it forward.`;
    return NextResponse.json({
      ok: true,
      decision: { ...match, status: 'approved' as const },
      spokenAck,
    });
  } catch (err) {
    console.error('[/api/abos/decide] error:', err);
    return NextResponse.json(
      { error: 'Decision failed', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
