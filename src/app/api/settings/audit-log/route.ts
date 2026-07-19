// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/audit-log
//
// GET — list recent AuditLog entries for the current organization / user.
// Returns the last 50 events (newest first). Real Prisma data — no mock entries.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveUser(request: Request): { userId: string | null } {
  const actorHeader = request.headers.get('x-gstpilot-actor');
  if (actorHeader) {
    try {
      return { userId: JSON.parse(actorHeader).uid ?? null };
    } catch { /* ignore */ }
  }
  return { userId: null };
}

export async function GET(request: Request) {
  try {
    const { userId } = resolveUser(request);
    if (!userId) {
      return NextResponse.json({ events: [] });
    }

    const events = await db.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        details: true,
        timestamp: true,
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[/api/settings/audit-log] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load audit log' },
      { status: 500 },
    );
  }
}
