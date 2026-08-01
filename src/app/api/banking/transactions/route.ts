// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Transactions API (TASK 12)
//
// GET  /api/banking/transactions?organizationId=...&accountId=...&category=...
//       &type=...&matched=true|false&source=...&search=...&fromDate=...&toDate=...
//       &limit=...&offset=...&sortBy=...&sortDir=asc|desc
//   → listTransactions({ organizationId, accountId, category, type, matched,
//                       source, search, fromDate, toDate, limit, offset,
//                       sortBy, sortDir })
//
// POST /api/banking/transactions?organizationId=...
//   body: { accountId, date, description, amount, type, category?, counterparty?,
//           referenceNo?, narration?, balance?, source?, notes? }
//   → createTransaction({ ...body, organizationId: orgId, createdBy: uid })
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { ensureSeeded, listTransactions, createTransaction } from '@/lib/banking-prisma';

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

    const sp = url.searchParams;
    const matchedParam = sp.get('matched');
    const matched =
      matchedParam === 'true' ? true :
      matchedParam === 'false' ? false :
      undefined;
    const limitParam = sp.get('limit');
    const offsetParam = sp.get('offset');

    const result = await listTransactions({
      organizationId: orgId,
      accountId: sp.get('accountId') || undefined,
      category: sp.get('category') || undefined,
      type: sp.get('type') || undefined,
      matched,
      source: sp.get('source') || undefined,
      search: sp.get('search') || undefined,
      fromDate: sp.get('fromDate') || undefined,
      toDate: sp.get('toDate') || undefined,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
      offset: offsetParam ? parseInt(offsetParam, 10) : undefined,
      sortBy: sp.get('sortBy') || undefined,
      sortDir: (sp.get('sortDir') as 'asc' | 'desc') || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load transactions.');
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
    const transaction = await createTransaction({
      ...body,
      organizationId: orgId,
      createdBy: uid,
    });
    return NextResponse.json({ success: true, transaction }, { status: 201 });
  } catch (err) {
    return friendlyApiError(err, 'Failed to create transaction.');
  }
}
