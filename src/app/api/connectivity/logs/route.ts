// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/connectivity/logs
// Audit-grade execution log for every connector call (auth, sync, API request).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10);
    const level = request.nextUrl.searchParams.get('level');
    const connectorId = request.nextUrl.searchParams.get('connectorId');

    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (connectorId) where.connectorId = connectorId;

    const rows = await db.connectorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { connector: { select: { provider: true, connectorKey: true } } },
    });

    const logs = rows.map((l) => ({
      id: l.id,
      connectorId: l.connectorId,
      provider: l.connector?.provider ?? 'Unknown',
      connectorKey: l.connector?.connectorKey ?? 'unknown',
      level: l.level,
      action: l.action,
      message: l.message,
      details: l.details ? JSON.parse(l.details) : null,
      durationMs: l.durationMs,
      statusCode: l.statusCode,
      createdAt: l.createdAt.toISOString(),
    }));

    return NextResponse.json({ logs, total: logs.length });
  } catch (err) {
    console.error('[Connectivity] Logs error:', err);
    return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 });
  }
}
