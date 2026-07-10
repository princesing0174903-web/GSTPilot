// GET  /api/gst/2b?gstin=XXX&period=YYYY-MM — Get stored GSTR-2B.
// POST /api/gst/2b/sync — Download latest GSTR-2B from GSTN.
// GET  /api/gst/2b/periods?gstin=XXX — List all downloaded periods.

import { NextResponse } from 'next/server';
import { downloadGstr2b, getStoredGstr2b, listStoredGstr2bPeriods } from '@/lib/gstn/gstr2b';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gstin = (searchParams.get('gstin') ?? '').toUpperCase().trim();
  const period = searchParams.get('period') ?? undefined;
  if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
  try {
    const data = await getStoredGstr2b(gstin, period);
    if (!data) {
      return NextResponse.json({ error: 'GSTR-2B not downloaded yet. POST to /api/gst/2b/sync to download.', gstin, period }, { status: 404 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch GSTR-2B', detail: String(err) }, { status: 500 });
  }
}

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
    const result = await downloadGstr2b(gstin, period);
    return NextResponse.json({
      ok: true,
      result,
      message: `I've downloaded your GSTR-2B for ${period}. ${result.invoiceCount} invoices, ₹${result.eligibleITC.toLocaleString('en-IN')} eligible ITC, ${result.ineligibleITC > 0 ? `₹${result.ineligibleITC.toLocaleString('en-IN')} ineligible.` : 'all eligible.'}`,
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
