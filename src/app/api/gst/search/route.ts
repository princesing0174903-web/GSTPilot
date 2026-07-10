// POST /api/gst/search — Search GSTIN, verify taxpayer status, persist to DB.
// GET  /api/gst/search?gstin=XXX — Get cached profile.

import { NextResponse } from 'next/server';
import { searchGstin, getCachedProfile, listSearchedProfiles } from '@/lib/gstn/gstsearch';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gstin = searchParams.get('gstin');
  try {
    if (gstin) {
      const cached = await getCachedProfile(gstin);
      if (!cached) return NextResponse.json({ error: 'Profile not found. POST to search first.' }, { status: 404 });
      return NextResponse.json(cached, { status: 200 });
    }
    const all = await listSearchedProfiles();
    return NextResponse.json({ profiles: all, count: all.length }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch profiles', detail: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    return NextResponse.json({ ok: true, profile: result, message: `I've searched GSTIN ${gstin} — ${result.legalName} (${result.status}).` }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
