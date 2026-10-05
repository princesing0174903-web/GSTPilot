// POST /api/gstr3b/prepare — Prepare GSTR-3B draft (output tax, ITC, interest, late fee).
//
// SECURITY:
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`.

import { NextResponse } from 'next/server';
import { prepareGstr3b } from '@/lib/gstn/gstr3b';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    let body: { organizationId?: string; gstin?: string; period?: string };
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

    const gstin = (body.gstin ?? '').toUpperCase().trim();
    const period = body.period ?? new Date().toISOString().slice(0, 7);
    if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });

    const draft = await prepareGstr3b(gstin, period);
    return NextResponse.json({
      ok: true,
      draft,
      message: `I've prepared your GSTR-3B for ${period}. Output tax ₹${draft.outputTax.toLocaleString('en-IN')}, ITC ₹${draft.itcClaimed.toLocaleString('en-IN')}, net liability ₹${draft.netTaxPayable.toLocaleString('en-IN')}${draft.interest > 0 ? `, interest ₹${draft.interest.toLocaleString('en-IN')}, late fee ₹${draft.lateFee.toLocaleString('en-IN')}` : ''}.`,
    }, { status: 200 });
  } catch (error) {
    return friendlyApiError(error, 'Failed to prepare GSTR-3B draft.');
  }
}
