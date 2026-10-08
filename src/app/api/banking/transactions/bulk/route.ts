// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Bulk Transaction Update API (TASK 12)
//
// POST /api/banking/transactions/bulk?organizationId=...
//   body: { ids: string[], patch: { category?, notes?, status?, matched?, ... } }
//   → bulkUpdateTransactions(ids, orgId, patch, uid)
//
// Used by the transactions table's bulk-action toolbar (categorize, mark
// reconciled, etc.).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { bulkUpdateTransactions } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const body = await req.json();
    const { ids, patch } = body as { ids: string[]; patch: Record<string, unknown> };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids (non-empty array) is required.' },
        { status: 400 },
      );
    }
    if (!patch || typeof patch !== 'object') {
      return NextResponse.json(
        { error: 'patch (object) is required.' },
        { status: 400 },
      );
    }

    const result = await bulkUpdateTransactions(ids, orgId, patch, uid);
    return NextResponse.json({ success: true, updated: result.updated });
  } catch (err) {
    return friendlyApiError(err, 'Failed to bulk-update transactions.');
  }
}
