// POST /api/gstr1/prepare — Prepare GSTR-1 draft.

import { NextResponse } from 'next/server';
import { prepareGstr1 } from '@/lib/gstn/gstr1';

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
    const draft = await prepareGstr1(gstin, period);
    return NextResponse.json({
      ok: true,
      draft,
      message: `I've prepared your GSTR-1 draft for ${period} — ${draft.b2bInvoices} B2B, ${draft.b2cInvoices} B2C, ${draft.exportInvoices} exports. Total taxable: ₹${draft.totalTaxableValue.toLocaleString('en-IN')}.`,
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
