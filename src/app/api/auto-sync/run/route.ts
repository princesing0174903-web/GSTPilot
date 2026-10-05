// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — PHASE 2B · MODULE 1 — Auto Sync Engine API
//
// POST /api/auto-sync/run → run all due syncs now (manual tick of the engine)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { runDueSyncs } from '@/lib/connections/auto-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const triggered = await runDueSyncs();
    return NextResponse.json({ ok: true, triggered });
  } catch (error) {
    console.error('POST /api/auto-sync/run error:', error);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
