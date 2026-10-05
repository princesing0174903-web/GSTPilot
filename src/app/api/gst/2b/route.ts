// GET  /api/gst/2b?gstin=XXX&period=YYYY-MM — Get stored GSTR-2B.
// POST /api/gst/2b — Download latest GSTR-2B (legacy offline mock).
//
// NOTE: This is a LEGACY route that uses the old offline mock library
// (@/lib/gstn/gstr2b). It returns DEMO data (no real GSTN call). The new
// architecture lives at /api/gst/sync-2b (auth-gated, provider-aware,
// idempotent, returns a `mode` badge). This route is kept for backward
// compatibility with the GSTNLivePage component but is now auth-gated so
// anonymous requests cannot access it or destroy synced data.

import { NextResponse } from 'next/server';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { downloadGstr2b, getStoredGstr2b } from '@/lib/gstn/gstr2b';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const gstin = (searchParams.get('gstin') ?? '').toUpperCase().trim();
    const period = searchParams.get('period') ?? undefined;
    if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
    try {
      const data = await getStoredGstr2b(gstin, period);
      if (!data) {
        return NextResponse.json({ error: 'GSTR-2B not downloaded yet. POST to /api/gst/2b to download.', gstin, period }, { status: 404 });
      }
      return NextResponse.json({ ...data, mode: 'demo' }, { status: 200 });
    } catch (err) {
      return friendlyApiError(err, 'Failed to fetch GSTR-2B.');
    }
  } catch (err) {
    return friendlyApiError(err, 'Failed to fetch GSTR-2B.');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

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
        mode: 'demo',
        message: `I've downloaded your GSTR-2B for ${period}. ${result.invoiceCount} invoices, ₹${result.eligibleITC.toLocaleString('en-IN')} eligible ITC, ${result.ineligibleITC > 0 ? `₹${result.ineligibleITC.toLocaleString('en-IN')} ineligible.` : 'all eligible.'}`,
      }, { status: 200 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }
  } catch (err) {
    return friendlyApiError(err, 'GSTR-2B download failed.');
  }
}
