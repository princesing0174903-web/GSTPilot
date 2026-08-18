import { NextResponse } from 'next/server';
import { createPurchaseBill } from '@/lib/invoices/purchases';
import { db } from '@/lib/db';
import { logActivity, getOptionalUserId } from '@/lib/activity-logger';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-tenant scoping — P3-AUTH-FIX
//
// Mirrors /api/purchases POST: requireAuth → resolve tenantId from header/body
// → requireOrgMembership → verify clientId (if provided) belongs to the org
// before creating the bill.
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await req.json();
    if (!body.vendorId || !body.billNo || body.taxableValue == null) {
      return NextResponse.json(
        { error: 'vendorId, billNo, and taxableValue are required' },
        { status: 400 },
      );
    }

    // ── 2. AUTHORIZATION — resolve tenantId, verify membership ─────────────
    // Priority: x-gstpilot-orgid header → body.organizationId → body.firmId.
    const headerOrgId = req.headers.get('x-gstpilot-orgid');
    let tenantId: string | null =
      (typeof headerOrgId === 'string' && headerOrgId.trim()) ||
      (typeof body.organizationId === 'string' && body.organizationId.trim()) ||
      (typeof body.firmId === 'string' && body.firmId.trim()) ||
      null;

    // Best-effort fallback: if no tenantId provided but clientId is, resolve
    // the org from the Client row. We still require membership in that org.
    if (!tenantId && body.clientId) {
      try {
        const client = await db.client.findUnique({
          where: { id: body.clientId },
          select: { firmId: true },
        });
        if (client?.firmId) tenantId = client.firmId;
      } catch {
        /* ignore — best-effort */
      }
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'organizationId (or firmId) is required' },
        { status: 400 },
      );
    }
    const memberResult = await requireOrgMembership(uid, tenantId);
    if (memberResult instanceof NextResponse) return memberResult;

    // Verify the target client belongs to the caller's org (prevents cross-tenant
    // bill creation via a spoofed clientId). clientId is optional.
    if (body.clientId) {
      const client = await db.client.findFirst({
        where: { id: body.clientId, firmId: tenantId },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json(
          { error: 'Client not found in this organization', code: 'CLIENT_NOT_FOUND' },
          { status: 404 },
        );
      }
    }

    const bill = await createPurchaseBill(body);

    // Business Timeline event — "Purchase bill created"
    // Use the verified tenantId (not the spoofable body param).
    const organizationId: string = tenantId;

    const userId = await getOptionalUserId(req);
    await logActivity({
      organizationId,
      userId,
      type: 'purchase_created',
      title: 'Purchase Bill Created',
      description: `Purchase bill ${bill.billNo} recorded from ${bill.vendorName} — taxable ₹${Number(bill.taxableValue).toLocaleString('en-IN')}, ${bill.itcEligible ? `₹${Number(bill.itcAmount).toLocaleString('en-IN')} eligible ITC` : 'ITC blocked'}.`,
      entityType: 'purchase_bill',
      entityId: bill.id,
      clientId: body.clientId ?? null,
      metadata: {
        billNo: bill.billNo,
        vendorName: bill.vendorName,
        vendorGstin: bill.vendorGstin ?? null,
        taxableValue: Number(bill.taxableValue),
        gstAmount: Number(bill.gstAmount),
        total: Number(bill.total),
        itcEligible: bill.itcEligible,
        itcAmount: Number(bill.itcAmount),
      },
    });

    return NextResponse.json({
      success: true,
      bill,
      message: `I've recorded the purchase bill ${bill.billNo} from ${bill.vendorName} — ${bill.itcEligible ? `detected ${bill.itcAmount} eligible ITC` : 'ITC blocked'}.`,
    });
  } catch (err) {
    console.error('[API /purchases/create] error:', err);
    return friendlyApiError(err, 'We could not record the purchase bill right now. Please try again.');
  }
}
