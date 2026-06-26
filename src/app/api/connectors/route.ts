// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/connectors?userId=<firebase_uid>
// Lists all data connections for a user.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const connections = await db.dataConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { syncedRecords: true } } },
    });

    const result = connections.map((c) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      label: c.label,
      identifier: c.identifier,
      metadata: c.metadata ? JSON.parse(c.metadata) : {},
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      syncInterval: c.syncInterval,
      errorMessage: c.errorMessage,
      recordCount: c._count.syncedRecords,
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({ connections: result });
  } catch (err) {
    console.error('[Connectors] List error:', err);
    return NextResponse.json({ error: 'Failed to list connections' }, { status: 500 });
  }
}
