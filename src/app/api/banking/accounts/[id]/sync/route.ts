// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Account Sync API (TASK 12)
//
// POST /api/banking/accounts/:id/sync?organizationId=...   → syncAccount(id, orgId, uid)
//
// Pulls the latest transactions from the configured bank provider (MockProvider
// now, Setu/RazorpayX later) and persists them to the local DB.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { syncAccount } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const { id } = await params;
    const result = await syncAccount(id, orgId, uid);
    if (!result.synced) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return friendlyApiError(err, 'Failed to sync bank account.');
  }
}
