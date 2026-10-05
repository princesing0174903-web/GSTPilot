import { NextResponse } from 'next/server';
import { schedulePayment } from '@/lib/invoices/payables';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { id: string; scheduledDate: string };
    if (!body.id || !body.scheduledDate) {
      return NextResponse.json({ error: 'id and scheduledDate are required' }, { status: 400 });
    }
    const payable = await schedulePayment(body.id, body.scheduledDate);
    return NextResponse.json({
      success: true,
      payable,
      message: `I've scheduled the payment to ${payable.vendorName} for ${body.scheduledDate}.`,
    });
  } catch (err) {
    console.error('[API /payables/schedule] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to schedule payment' },
      { status: 500 },
    );
  }
}
