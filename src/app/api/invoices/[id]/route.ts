import { NextResponse } from 'next/server';
import { getInvoice } from '@/lib/invoices/invoices';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    return NextResponse.json({ invoice });
  } catch (err) {
    console.error('[API /invoices/:id] error:', err);
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 });
  }
}
