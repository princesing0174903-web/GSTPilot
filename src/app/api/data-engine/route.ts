// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — PHASE 2A · Data Engine API
//
// GET /api/data-engine → 8-card payload for the Real Data Platform dashboard.
//   • Cards: revenue, cashPosition, itcAvailable, complianceScore, collections,
//            pendingReturns, pendingNotices, topClients
//   • syncSummary: lastSyncedAt, totalRecords, gstnStatus, bankStatus
//   • When no data: hasData=false, all cards hasData=false (label '—'), syncSummary null
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { computeLiveDataEngine } from '@/lib/connections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // PHASE 2B: trigger lazy sync-on-read so dashboard data is always fresh
    try {
      const { triggerLazySync } = await import('@/lib/connections/auto-sync');
      triggerLazySync();
    } catch {
      /* ignore */
    }

    const payload = await computeLiveDataEngine();
    return NextResponse.json(payload);
  } catch (error) {
    console.error('GET /api/data-engine error:', error);
    // Graceful fallback — never 500. Return the "no data" shape.
    return NextResponse.json({
      hasData: false,
      hasGstn: false,
      hasBank: false,
      cards: {
        revenue: { value: 0, label: '—', sublabel: '', hasData: false },
        cashPosition: { value: 0, label: '—', sublabel: '', hasData: false },
        itcAvailable: { value: 0, label: '—', sublabel: '', hasData: false },
        complianceScore: { value: 0, label: '—', sublabel: '', hasData: false },
        collections: { value: 0, label: '—', sublabel: '', hasData: false },
        pendingReturns: { value: 0, label: '—', sublabel: '', hasData: false },
        pendingNotices: { value: 0, label: '—', sublabel: '', hasData: false },
        topClients: { value: [], label: '—', sublabel: '', hasData: false },
      },
      syncSummary: null,
      computedAt: new Date().toISOString(),
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
