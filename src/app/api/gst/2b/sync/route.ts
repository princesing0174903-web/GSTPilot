// POST /api/gst/2b/sync — Download latest GSTR-2B (alias for POST /api/gst/2b).
//
// NOTE: This is a LEGACY route. The new architecture lives at /api/gst/sync-2b.
// Auth-gated so anonymous requests cannot access it.

import { NextResponse } from 'next/server';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { downloadGstr2b } from '@/lib/gstn/gstr2b';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
        message: `I've downloaded your latest GSTR-2B for ${period} — ${result.invoiceCount} invoices, ₹${result.eligibleITC.toLocaleString('en-IN')} eligible ITC.`,
      }, { status: 200 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }
  } catch (err) {
    return friendlyApiError(err, 'GSTR-2B sync failed.');
  }
}
