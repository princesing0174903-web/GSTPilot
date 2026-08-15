// GET /api/bank/collections
// Returns the collections recovery state — open cases, recovered, escalated, total outstanding.

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { buildCollectionsState } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const collections = await buildCollectionsState();
    return NextResponse.json({ ok: true, collections });
  } catch (err) {
    return friendlyApiError(err, 'Failed to load collections.');
  }
}
