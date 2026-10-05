// POST /api/ewaybill — Generate / Extend / Cancel E-Way Bill.
// GET  /api/ewaybill?ewbNo=XXX&organizationId=ORG — Get E-Way Bill status.
//
// SECURITY:
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`
//     (passed via the query string on GET, JSON body on POST).

import { NextResponse } from 'next/server';
import { generateEWayBill, extendEWayBill, cancelEWayBill, getEWayBillStatus } from '@/lib/gstn/ewaybill';
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
    const ewbNo = searchParams.get('ewbNo');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required.', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const member = await requireOrgMembership(uid, organizationId);
    if (member instanceof NextResponse) return member;

    if (!ewbNo) return NextResponse.json({ error: 'ewbNo is required' }, { status: 400 });
    const result = await getEWayBillStatus(ewbNo);
    if (!result) return NextResponse.json({ error: 'E-Way Bill not found' }, { status: 404 });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return friendlyApiError(error, 'Failed to fetch E-Way Bill status.');
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

    if (body.action === 'extend') {
      const result = await extendEWayBill(body.ewbNo as string, body.extraDays as number, body.reason as string);
      return NextResponse.json({ ok: true, result, message: `I've extended E-Way Bill ${body.ewbNo} by ${body.extraDays} days. Valid till ${new Date(result.validUpto).toLocaleString('en-IN')}.` }, { status: 200 });
    }
    if (body.action === 'cancel') {
      const result = await cancelEWayBill(body.ewbNo as string, body.reason as string);
      return NextResponse.json({ ok: true, result, message: `I've cancelled E-Way Bill ${body.ewbNo}.` }, { status: 200 });
    }
    // Default: generate
    const result = await generateEWayBill({
      supplierGstin: body.supplierGstin as string,
      recipientGstin: body.recipientGstin as string,
      documentNo: body.documentNo as string,
      documentDate: body.documentDate as string,
      transactionType: body.transactionType as 'regular' | 'bill_from' | 'bill_to' | 'combined',
      supplyType: body.supplyType as 'intra' | 'inter',
      subSupplyType: body.subSupplyType as string,
      fromState: body.fromState as string,
      toState: body.toState as string,
      totalValue: body.totalValue as number,
      cgst: body.cgst as number,
      sgst: body.sgst as number,
      igst: body.igst as number,
      cess: body.cess as number,
      transporterId: body.transporterId as string | undefined,
      vehicleNo: body.vehicleNo as string | undefined,
      distanceKm: body.distanceKm as number,
    });
    return NextResponse.json({
      ok: true,
      result,
      message: `I've generated your E-Way Bill. EWB No: ${result.ewbNo}. Valid till ${new Date(result.validUpto).toLocaleString('en-IN')}.`,
    }, { status: 200 });
  } catch (error) {
    return friendlyApiError(error, 'Failed to process E-Way Bill request.');
  }
}
