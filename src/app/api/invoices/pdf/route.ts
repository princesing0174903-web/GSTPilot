import { NextResponse } from 'next/server';
import { generatePdf } from '@/lib/invoices/invoices';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id: string };
    if (!body.id) {
      return NextResponse.json({ error: 'Invoice id is required' }, { status: 400 });
    }
    const result = await generatePdf(body.id);
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've generated the PDF and payment link for Invoice ${result.invoice.invoiceNo}.`,
    });
  } catch (err) {
    console.error('[API /invoices/pdf] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate PDF' },
      { status: 500 },
    );
  }
}
