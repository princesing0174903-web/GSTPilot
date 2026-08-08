// POST /api/gst/search — Search GSTIN, verify taxpayer status, persist to DB.
// GET  /api/gst/search?gstin=XXX — Get cached profile.
//
// NOTE: This is a LEGACY route that uses the old offline mock library
// (@/lib/gstn/gstsearch). It returns DEMO data (no real GSTN lookup). The
// new architecture lives at /api/gst/verify-gstin (auth-gated, provider-aware,
// returns a `source: 'demo'|'live'|'sandbox'` badge). This route is kept for
// backward compatibility with the GSTNLivePage component but is now auth-gated
// so anonymous requests cannot access it.

import { NextResponse } from 'next/server';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { searchGstin, getCachedProfile, listSearchedProfiles } from '@/lib/gstn/gstsearch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const gstin = searchParams.get('gstin');
    if (gstin) {
      const cached = await getCachedProfile(gstin);
      if (!cached) return NextResponse.json({ error: 'Profile not found. POST to search first.' }, { status: 404 });
      return NextResponse.json({ ...cached, mode: 'demo' }, { status: 200 });
    }
    const all = await listSearchedProfiles();
    return NextResponse.json({ profiles: all, count: all.length, mode: 'demo' }, { status: 200 });
  } catch (err) {
    return friendlyApiError(err, 'Failed to fetch profiles.');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    let body: { gstin?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const gstin = (body.gstin ?? '').toUpperCase().trim();
    if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
    try {
      const result = await searchGstin(gstin);
      return NextResponse.json({
        ok: true,
        profile: result,
        mode: 'demo',
        message: `I've searched GSTIN ${gstin} — ${result.legalName} (${result.status}).`,
      }, { status: 200 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }
  } catch (err) {
    return friendlyApiError(err, 'GSTIN search failed.');
  }
}
