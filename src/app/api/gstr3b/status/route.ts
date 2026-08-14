// GET /api/gstr3b/status?gstin=XXX&period=YYYY-MM&organizationId=ORG — Get GSTR-3B filing status.
//
// SECURITY:
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`.

import { NextResponse } from 'next/server';
import { getGstr3bStatus } from '@/lib/gstn/gstr3b';
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
    if (!period) return NextResponse.json({ error: 'period is required (YYYY-MM)' }, { status: 400 });

    const status = await getGstr3bStatus(gstin, period);
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    return friendlyApiError(error, 'Failed to fetch GSTR-3B filing status.');
  }
}
