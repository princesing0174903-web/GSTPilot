// POST /api/gstr3b/prepare — Prepare GSTR-3B draft (output tax, ITC, interest, late fee).

import { NextResponse } from 'next/server';
import { prepareGstr3b } from '@/lib/gstn/gstr3b';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { gstin?: string; period?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const gstin = (body.gstin ?? '').toUpperCase().trim();
  const period = body.period ?? new Date().toISOString().slice(0, 7);
  if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
  try {
    const draft = await prepareGstr3b(gstin, period);
    return NextResponse.json({
      ok: true,
      draft,
      message: `I've prepared your GSTR-3B for ${period}. Output tax ₹${draft.outputTax.toLocaleString('en-IN')}, ITC ₹${draft.itcClaimed.toLocaleString('en-IN')}, net liability ₹${draft.netTaxPayable.toLocaleString('en-IN')}${draft.interest > 0 ? `, interest ₹${draft.interest.toLocaleString('en-IN')}, late fee ₹${draft.lateFee.toLocaleString('en-IN')}` : ''}.`,
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
