// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Accounts API (TASK 12)
//
// GET  /api/banking/accounts?organizationId=...   → listAccounts(orgId)
// POST /api/banking/accounts                       → createAccount({...body, orgId, uid})
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { ensureSeeded, listAccounts, createAccount } from '@/lib/banking-prisma';
import { swrCache, invalidateRoute } from '@/lib/cache/swr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 15s SWR cache — accounts list is read on every banking page mount. The
// list changes only when the user adds/edits/deletes an account (POST/PATCH/
// DELETE below), which invalidates the cache explicitly.
const ACCOUNTS_CACHE_TTL_MS = 15_000;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    await ensureSeeded(orgId);
    const result = await swrCache(
      '/api/banking/accounts',
      orgId,
      ACCOUNTS_CACHE_TTL_MS,
      () => listAccounts(orgId),
      { forceRefresh },
    );
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
    // Invalidate the accounts cache for this org so the next GET sees the new
    // account immediately.
    invalidateRoute('/api/banking/accounts', orgId);
    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (err) {
    return friendlyApiError(err, 'Failed to add bank account.');
  }
}
