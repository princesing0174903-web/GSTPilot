// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ABOS™ — GET /api/abos
// Returns the full Autonomous Business Operating System state.
// Phase 7 — Think. Decide. Execute. Grow Automatically.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getAbosState } from '@/lib/abos/engine';

export async function GET() {
  try {
    const state = await getAbosState(null);
    return NextResponse.json(state);
  } catch (err) {
    console.error('[/api/abos] error:', err);
    return NextResponse.json(
      { error: 'Failed to build ABOS state', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
