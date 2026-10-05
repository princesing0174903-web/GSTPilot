// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/connectivity/installed
// Lists all installed connector instances with their credentials, event/log/sync
// counts, and last sync job — all backed by REAL Prisma records.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mapInstance } from '@/lib/connectivity/engine';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const firmId = request.nextUrl.searchParams.get('firmId');

    const where: Record<string, string> = {};
    if (userId) where.userId = userId;
    if (firmId) where.firmId = firmId;

    const rows = await db.connectorInstance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const installed = await Promise.all(rows.map(mapInstance));
    return NextResponse.json({ installed, total: installed.length });
  } catch (err) {
    console.error('[Connectivity] Installed list error:', err);
    return NextResponse.json({ error: 'Failed to list installed connectors' }, { status: 500 });
  }
}
