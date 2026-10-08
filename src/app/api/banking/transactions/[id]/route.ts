// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Transaction Detail API (TASK 12)
//
// PATCH  /api/banking/transactions/:id?organizationId=...   → updateTransaction(id, orgId, body, uid)
// DELETE /api/banking/transactions/:id                       → deleteTransaction(id, orgId, uid)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { updateTransaction, deleteTransaction } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
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
    const body = await req.json();
    const transaction = await updateTransaction(id, orgId, body, uid);
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
    }
    return NextResponse.json(transaction);
  } catch (err) {
    return friendlyApiError(err, 'Failed to update transaction.');
  }
}

export async function DELETE(
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
    await deleteTransaction(id, orgId, uid);
    return NextResponse.json({ success: true, message: 'Transaction deleted.' });
  } catch (err) {
    return friendlyApiError(err, 'Failed to delete transaction.');
  }
}
