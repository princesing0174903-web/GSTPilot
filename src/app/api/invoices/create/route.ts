import { NextResponse } from 'next/server';
import { createInvoice } from '@/lib/invoices/invoices';
import type { CreateInvoiceInput } from '@/lib/invoices/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateInvoiceInput;
    if (!body.clientId || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'clientId and at least one line item are required' },
        { status: 400 },
      );
    }
    const invoice = await createInvoice(body);
    return NextResponse.json({
      success: true,
      invoice,
      message: `I've created Invoice ${invoice.invoiceNo} for ${invoice.clientName} (${invoice.total} total).`,
    });
  } catch (err) {
    console.error('[API /invoices/create] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create invoice' },
      { status: 500 },
    );
  }
}
