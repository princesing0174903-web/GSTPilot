import { NextResponse } from 'next/server';
import { createPurchaseBill } from '@/lib/invoices/purchases';

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
