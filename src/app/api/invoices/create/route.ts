import { NextResponse } from 'next/server';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { createInvoice } from '@/lib/invoices/invoices';
import type { CreateInvoiceInput } from '@/lib/invoices/types';

export const dynamic = 'force-dynamic';

// POST /api/invoices/create — thin wrapper around the engine's createInvoice().
// Auth-required. The engine resolves buyer details from the Client row.
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

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
      message: `I've created Invoice ${invoice.invoiceNo} for ${invoice.clientName} (₹${invoice.total} total).`,
    });
  } catch (err) {
    console.error('[API /invoices/create] error:', err);
    return friendlyApiError(err, 'We could not create this invoice right now. Please try again.');
  }
}
