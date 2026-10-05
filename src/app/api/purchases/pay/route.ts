import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { payPurchaseBill } from '@/lib/invoices/purchases';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-tenant scoping — P3-AUTH-FIX
//
// PurchaseBill has no direct firmId — resolve through the related Client.firmId
// then requireOrgMembership before mutating. 404 (not 403) for orphan bills to
// avoid leaking existence. Mirrors /api/payments PATCH + /api/invoices/[id]
// pattern.
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await req.json() as { id: string; amount: number; mode?: 'upi' | 'bank' | 'rtgs' | 'neft' | 'imps'; referenceNo?: string };
    if (!body.id || body.amount == null) {
      return NextResponse.json({ error: 'id and amount are required' }, { status: 400 });
    }

    // ── 2. AUTHORIZATION — fetch bill + resolve tenant via Client.firmId ──
    const existing = await db.purchaseBill.findUnique({
      where: { id: body.id },
      select: { id: true, client: { select: { firmId: true } } },
    });
    // 404 (not 403) for orphan bills — never reveal existence.
    const firmId = existing?.client?.firmId;
    if (!firmId) {
      return NextResponse.json({ error: 'Purchase bill not found' }, { status: 404 });
    }
    const memberResult = await requireOrgMembership(uid, firmId);
    if (memberResult instanceof NextResponse) return memberResult;

    const bill = await payPurchaseBill(body.id, body.amount, body.mode ?? 'bank', body.referenceNo);
    return NextResponse.json({
      success: true,
      bill,
      message: `I've paid ${body.amount} for bill ${bill.billNo} via ${body.mode ?? 'bank'} — ${bill.paymentStatus}.`,
    });
  } catch (err) {
    console.error('[API /purchases/pay] error:', err);
    return friendlyApiError(err, 'We could not pay the purchase bill right now. Please try again.');
  }
}
