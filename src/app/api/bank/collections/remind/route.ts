// POST /api/bank/collections/remind
// Schedule WhatsApp + Email + SMS reminders for all overdue invoices.

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { remindCollections } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const res = await remindCollections();
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    return friendlyApiError(err, 'Failed to schedule reminders.');
  }
}
