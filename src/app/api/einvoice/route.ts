// POST /api/einvoice/generate — Generate IRN + QR.
// POST /api/einvoice/cancel — Cancel IRN.
// GET  /api/einvoice/status?irn=XXX&organizationId=ORG — Get IRN status.
// (All three via route handlers based on method + body.action)
//
// SECURITY:
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`
//     (passed via the query string on GET, JSON body on POST).

import { NextResponse } from 'next/server';
import { generateEInvoice, cancelEInvoice, getEInvoiceStatus } from '@/lib/gstn/einvoice';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') ?? '';
    const irn = searchParams.get('irn');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required.', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const member = await requireOrgMembership(uid, organizationId);
    if (member instanceof NextResponse) return member;

    if (!irn) return NextResponse.json({ error: 'irn is required' }, { status: 400 });
    const result = await getEInvoiceStatus(irn);
    if (!result) return NextResponse.json({ error: 'IRN not found' }, { status: 404 });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return friendlyApiError(error, 'Failed to fetch E-Invoice status.');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    let body: Record<string, unknown> & { action?: string; organizationId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { organizationId } = body;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required.', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const member = await requireOrgMembership(uid, organizationId);
    if (member instanceof NextResponse) return member;

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
  } catch (error) {
    return friendlyApiError(error, 'Failed to process E-Invoice request.');
  }
}
