// POST /api/pan/verify — Verify PAN status + entity type.
// (Alias for /api/gst/pan — matches the spec's requested path.)
//
// NOTE: Auth-gated so anonymous requests cannot access it.

import { NextResponse } from 'next/server';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { verifyPan } from '@/lib/gstn/pan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    let body: { pan?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const pan = (body.pan ?? '').toUpperCase().trim();
    if (!pan) return NextResponse.json({ error: 'pan is required' }, { status: 400 });
    try {
      const result = await verifyPan(pan);
      return NextResponse.json({
        ok: true,
        result,
        mode: 'demo',
        message: `I've verified PAN ${pan} — ${result.name} (${result.status}, ${result.entityType}).`,
      }, { status: 200 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }
  } catch (err) {
    return friendlyApiError(err, 'PAN verification failed.');
  }
}
