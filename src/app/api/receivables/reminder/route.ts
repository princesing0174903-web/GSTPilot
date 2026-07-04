import { NextResponse } from 'next/server';
import { sendReminder, sendBulkReminders } from '@/lib/invoices/receivables';
import type { ReceivableRisk } from '@/lib/invoices/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      id?: string;
      bulk?: boolean;
      minDaysOverdue?: number;
      riskLevel?: ReceivableRisk;
      channel?: 'whatsapp' | 'email' | 'sms';
    };

    if (body.bulk) {
      const result = await sendBulkReminders({
        minDaysOverdue: body.minDaysOverdue,
        riskLevel: body.riskLevel,
      });
      return NextResponse.json({
        success: true,
        ...result,
        message: `I've sent reminders to ${result.sent} clients with ${result.totalAmount} outstanding.`,
      });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'id is required (or set bulk:true)' }, { status: 400 });
    }
    const rec = await sendReminder(body.id, body.channel ?? 'whatsapp');
    return NextResponse.json({
      success: true,
      receivable: rec,
      message: `I've sent a ${body.channel ?? 'whatsapp'} reminder to ${rec.customerName} (reminder #${rec.reminderCount}).`,
    });
  } catch (err) {
    console.error('[API /receivables/reminder] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send reminder' },
      { status: 500 },
    );
  }
}
