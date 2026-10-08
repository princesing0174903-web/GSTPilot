// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — PHASE 2B · MODULE 1 — Auto Sync Engine API
//
// GET  /api/sync-queue → list sync queue items + schedules + auto-sync status
// POST /api/sync-queue → process the queue now (manual tick)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import {
  getSyncQueue,
  getSyncSchedules,
  getAutoSyncStatus,
  processQueue,
  retryFailedSyncs,
} from '@/lib/connections/auto-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [queue, schedules, status] = await Promise.all([
      getSyncQueue(50),
      getSyncSchedules(),
      getAutoSyncStatus(),
    ]);
    return NextResponse.json({ ok: true, queue, schedules, status });
  } catch (error) {
    console.error('GET /api/sync-queue error:', error);
    return NextResponse.json({ ok: true, queue: [], schedules: [], status: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === 'retry-failed') {
      const retried = await retryFailedSyncs();
      return NextResponse.json({ ok: true, retried });
    }

    // Default: process the queue
    const processed = await processQueue();
    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    console.error('POST /api/sync-queue error:', error);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
