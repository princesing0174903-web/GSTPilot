import { NextResponse } from 'next/server';
import { sendInvoice } from '@/lib/invoices/invoices';
import type { SendChannel } from '@/lib/invoices/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { id: string; channel?: SendChannel };
    if (!body.id) {
      return NextResponse.json({ error: 'Invoice id is required' }, { status: 400 });
    }
    const invoice = await sendInvoice(body.id, body.channel ?? 'email');
    return NextResponse.json({
      success: true,
      invoice,
      message: `I've sent Invoice ${invoice.invoiceNo} to ${invoice.clientName} via ${body.channel ?? 'email'} — PDF and payment link generated.`,
    });
  } catch (err) {
    console.error('[API /invoices/send] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send invoice' },
      { status: 500 },
    );
  }
}
