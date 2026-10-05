// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Invoices API
//
// GET /api/billing/invoices?organizationId=...
//   Returns the org's billing invoices (newest first, up to 100).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getInvoices } from '@/lib/billing-provider/service';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required.' },
        { status: 400 },
      );
    }
    const invoices = await getInvoices(organizationId);
    return NextResponse.json({ ok: true, invoices });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/invoices] error:', code, friendlyBillingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBillingError(err), code },
      { status: statusCode },
    );
  }
}
