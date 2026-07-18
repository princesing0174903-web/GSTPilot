// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/oracle/real-data?userId=<firebase_uid>
// Returns the aggregated real data snapshot for Oracle.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { buildRealDataSnapshot, formatRealDataContextBlock } from '@/lib/oracle/real-data';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  // AUDIT-DUP-1 fix: pass organizationId through so buildRealDataSnapshot can
  // attach the canonical Business Snapshot (cash/revenue/expenses/ITC) and
  // avoid duplicating those aggregates from connector data.
  const organizationId = request.nextUrl.searchParams.get('organizationId') ?? undefined;

  try {
    const snapshot = await buildRealDataSnapshot(userId, organizationId);
    const contextBlock = formatRealDataContextBlock(snapshot);
    return NextResponse.json({ snapshot, contextBlock });
  } catch (err) {
    console.error('[Oracle Real Data] Error:', err);
    return NextResponse.json({ error: 'Failed to build real data snapshot' }, { status: 500 });
  }
}
