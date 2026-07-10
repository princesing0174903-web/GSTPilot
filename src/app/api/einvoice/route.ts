// POST /api/einvoice/generate — Generate IRN + QR.
// POST /api/einvoice/cancel — Cancel IRN.
// GET  /api/einvoice/status?irn=XXX — Get IRN status.
// (All three via route handlers based on method + body.action)

import { NextResponse } from 'next/server';
import { generateEInvoice, cancelEInvoice, getEInvoiceStatus } from '@/lib/gstn/einvoice';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const irn = searchParams.get('irn');
  if (!irn) return NextResponse.json({ error: 'irn is required' }, { status: 400 });
  try {
    const result = await getEInvoiceStatus(irn);
    if (!result) return NextResponse.json({ error: 'IRN not found' }, { status: 404 });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown> & { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    if (body.action === 'cancel') {
      const result = await cancelEInvoice(body.irn as string, body.reason as string);
      return NextResponse.json({ ok: true, result, message: `I've cancelled IRN ${body.irn}.` }, { status: 200 });
    }
    // Default: generate
    const result = await generateEInvoice({
      sellerGstin: body.sellerGstin as string,
      buyerGstin: body.buyerGstin as string,
      invoiceNo: body.invoiceNo as string,
      invoiceDate: body.invoiceDate as string,
      invoiceValue: body.invoiceValue as number,
      taxableValue: body.taxableValue as number,
      igst: body.igst as number,
      cgst: body.cgst as number,
      sgst: body.sgst as number,
      hsnCode: body.hsnCode as string,
    });
    return NextResponse.json({
      ok: true,
      result,
      message: `I've generated your E-Invoice. IRN: ${result.irn.slice(0, 16)}… Ack: ${result.ackNo}. QR code attached.`,
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
