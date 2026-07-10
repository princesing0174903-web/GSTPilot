// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Disconnect API
//
// POST /api/erp/disconnect
//   Body: { organizationId, connectionId, encryptedConnection }
//   Returns: { ok: true }
//
// Invalidates the token server-side + cascade-deletes all ERP data for the
// connection (customers, vendors, invoices, inventory, ledgers, payments,
// bank transactions, taxes, sync jobs, and the connection doc itself).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { performDisconnect } from '@/lib/erp-provider/server/scheduler';
import { ERPError, friendlyERPError } from '@/lib/erp-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, connectionId, encryptedConnection } = body as {
      organizationId?: string;
      connectionId?: string;
      encryptedConnection?: string | null;
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    if (!connectionId) {
      return NextResponse.json({ ok: false, error: 'connectionId is required' }, { status: 400 });
    }

    await performDisconnect(organizationId, connectionId, encryptedConnection ?? null);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const statusCode = err instanceof ERPError ? err.statusCode : 500;
    const code = err instanceof ERPError ? err.code : 'UNKNOWN';
    console.error('[api/erp/disconnect] error:', code, friendlyERPError(err));
    return NextResponse.json(
      { ok: false, error: friendlyERPError(err), code },
      { status: statusCode },
    );
  }
}
