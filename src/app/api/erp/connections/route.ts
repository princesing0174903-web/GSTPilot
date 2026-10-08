// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — Connections List API
//
// GET /api/erp/connections?organizationId=xxx
//   Returns: { ok: true, connections: ERPConnection[] }
//
// One-shot read of all ERP connections for an org. The client hook uses
// real-time subscriptions instead, but this route is useful for server-side
// renders + diagnostics.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getConnections } from '@/lib/erp-provider/service';
import { ERPError, friendlyERPError } from '@/lib/erp-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId query param is required.' },
        { status: 400 },
      );
    }

    const connections = await getConnections(organizationId);
    return NextResponse.json({ ok: true, connections });
  } catch (err) {
    const statusCode = err instanceof ERPError ? err.statusCode : 500;
    const code = err instanceof ERPError ? err.code : 'UNKNOWN';
    console.error('[api/erp/connections] error:', code, friendlyERPError(err));
    return NextResponse.json(
      { ok: false, error: friendlyERPError(err), code },
      { status: statusCode },
    );
  }
}
