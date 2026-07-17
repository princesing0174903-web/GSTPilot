import { NextResponse } from 'next/server';
import { createPurchaseBill } from '@/lib/invoices/purchases';
import { db } from '@/lib/db';
import { logActivity, getOptionalUserId } from '@/lib/activity-logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.vendorId || !body.billNo || body.taxableValue == null) {
      return NextResponse.json(
        { error: 'vendorId, billNo, and taxableValue are required' },
        { status: 400 },
      );
    }
    const bill = await createPurchaseBill(body);

    // Business Timeline event — "Purchase bill created"
    // Resolve the orgId from (in priority order): body.organizationId,
    // body.clientId → Client.firmId, or the vendor's client mapping.
    // Best-effort: if no orgId can be resolved, the activity is skipped.
    let organizationId: string | null =
      typeof body.organizationId === 'string' && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;

    if (!organizationId && body.clientId) {
      try {
        const client = await db.client.findUnique({
          where: { id: body.clientId },
          select: { firmId: true },
        });
        if (client?.firmId) organizationId = client.firmId;
      } catch {
        // ignore — best-effort
      }
    }

    if (organizationId) {
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
    }

    return NextResponse.json({
      success: true,
      bill,
      message: `I've recorded the purchase bill ${bill.billNo} from ${bill.vendorName} — ${bill.itcEligible ? `detected ${bill.itcAmount} eligible ITC` : 'ITC blocked'}.`,
    });
  } catch (err) {
    console.error('[API /purchases/create] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to record purchase bill' },
      { status: 500 },
    );
  }
}
