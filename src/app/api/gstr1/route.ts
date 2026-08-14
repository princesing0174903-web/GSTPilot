// GET  /api/gstr1?gstin=XXX&period=YYYY-MM&organizationId=ORG — Get GSTR-1 draft/status.
// POST /api/gstr1/prepare — Prepare GSTR-1 draft (B2B/B2C/Exports/CD notes + JSON).
// POST /api/gstr1/file — File the prepared GSTR-1 with GSTN.
// GET  /api/gstr1/status?gstin=XXX&period=YYYY-MM&organizationId=ORG — Get filing status.
//
// SECURITY:
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`
//     (passed via the query string on GET routes).

import { NextResponse } from 'next/server';
import { getGstr1Draft } from '@/lib/gstn/gstr1';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') ?? '';
    const gstin = (searchParams.get('gstin') ?? '').toUpperCase().trim();
    const period = searchParams.get('period') ?? undefined;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required.', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const member = await requireOrgMembership(uid, organizationId);
    if (member instanceof NextResponse) return member;

    if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
    if (!period) {
      return NextResponse.json({ error: 'period is required (YYYY-MM)' }, { status: 400 });
    }
    const draft = await getGstr1Draft(gstin, period);
    if (!draft) {
      return NextResponse.json({ error: 'No GSTR-1 draft found. POST to /api/gstr1/prepare first.', gstin, period }, { status: 404 });
    }
    return NextResponse.json(draft, { status: 200 });
  } catch (error) {
    return friendlyApiError(error, 'Failed to fetch GSTR-1 draft.');
  }
}
