// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — PHASE 2A · Sync Logs API
//
// GET /api/connections/[id]/logs → recent SyncLog rows for a connection.
//   • Default limit = 20
//   • Returns { ok, logs } — never 500s
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { listSyncLogs } from '@/lib/connections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Connection id is required' },
        { status: 400 },
      );
    }

    // Allow optional ?limit= override (clamped 1..50)
    const url = new URL(req.url);
    const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;

    const logs = await listSyncLogs(id, limit);

    return NextResponse.json({
      ok: true,
      logs: logs.map((l) => ({
        id: l.id,
        connectionId: l.connectionId,
        status: l.status,
        recordsImported: l.recordsImported,
        errorsCount: l.errorsCount,
        message: l.message,
        errorDetail: l.errorDetail,
        startedAt: l.startedAt.toISOString(),
        completedAt: l.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error('GET /api/connections/[id]/logs error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
        logs: [],
      },
      { status: 500 },
    );
  }
}
