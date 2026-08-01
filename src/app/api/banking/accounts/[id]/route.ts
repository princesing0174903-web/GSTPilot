// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Account Detail API (TASK 12)
//
// GET    /api/banking/accounts/:id?organizationId=...   → getAccount(id, orgId)
// PATCH  /api/banking/accounts/:id                       → updateAccount(id, orgId, body, uid)
// DELETE /api/banking/accounts/:id                       → deleteAccount(id, orgId, uid)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getAccount, updateAccount, deleteAccount } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
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
    const account = await getAccount(id, orgId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    return NextResponse.json(account);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load bank account.');
  }
}

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
    const account = await updateAccount(id, orgId, body, uid);
    if (!account) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    return NextResponse.json(account);
  } catch (err) {
    return friendlyApiError(err, 'Failed to update bank account.');
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
    await deleteAccount(id, orgId, uid);
    return NextResponse.json({ success: true, message: 'Bank account disconnected.' });
  } catch (err) {
    return friendlyApiError(err, 'Failed to disconnect bank account.');
  }
}
