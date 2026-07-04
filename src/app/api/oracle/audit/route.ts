// GET /api/oracle/audit — Security Engine™ stats + recent audit log
// Returns 24h security aggregates and the most recent audit entries.
import { NextRequest, NextResponse } from 'next/server';
import { getSecurityStats, getRecentAuditLog } from '@/lib/oracle-core/security';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : 50;
    const [stats, recent] = await Promise.all([
      getSecurityStats(),
      getRecentAuditLog(Math.min(limit, 200)),
    ]);
    return NextResponse.json({ stats, recent, total: recent.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
