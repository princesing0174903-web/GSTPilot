// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — PHASE 2B · MODULE 6 — Observability Dashboard API
//
// GET /api/system-health → full System Health™ payload for the observability screen
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getSystemHealth } from '@/lib/connections/observability';
import { triggerLazySync } from '@/lib/connections/auto-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Lazy sync-on-read
    triggerLazySync();
    const health = await getSystemHealth();
    return NextResponse.json({ ok: true, health });
  } catch (error) {
    console.error('GET /api/system-health error:', error);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
