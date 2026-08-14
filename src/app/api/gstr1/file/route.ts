// POST /api/gstr1/file — File prepared GSTR-1 with GSTN.
//
// SECURITY (CRITICAL — this route can file GST returns):
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`.

import { NextResponse } from 'next/server';
import { fileGstr1 } from '@/lib/gstn/gstr1';
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

    const result = await fileGstr1(gstin, period);
    return NextResponse.json({ ok: true, result, message: result.message }, { status: 200 });
  } catch (error) {
    return friendlyApiError(error, 'Failed to file GSTR-1 return.');
  }
}
