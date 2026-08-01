// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Accounts API (TASK 12)
//
// GET  /api/banking/accounts?organizationId=...   → listAccounts(orgId)
// POST /api/banking/accounts                       → createAccount({...body, orgId, uid})
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { ensureSeeded, listAccounts, createAccount } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    await ensureSeeded(orgId);
    const result = await listAccounts(orgId);
    return NextResponse.json(result);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load bank accounts.');
  }
}

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
    const account = await createAccount({
      ...body,
      organizationId: orgId,
      createdBy: uid,
    });
    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (err) {
    return friendlyApiError(err, 'Failed to add bank account.');
  }
}
