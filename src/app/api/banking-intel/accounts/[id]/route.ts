import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import type { AccountStatus } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_STATUSES: AccountStatus[] = [
  'connected',
  'disconnected',
  'syncing',
  'error',
];

// GET /api/banking-intel/accounts/[id] — fetch one account
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const orgId = searchParams.get('orgId') || 'preview-org';
    const service = await getBankingService();
    const account = await service.getAccount(orgId, id);
    if (!account) {
      return NextResponse.json(
        { ok: false, error: 'Account not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, account });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/accounts/[id] GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/banking-intel/accounts/[id] — currently only `status` updates are supported
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';

    if (typeof body.status === 'string') {
      if (!ALLOWED_STATUSES.includes(body.status as AccountStatus)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
          },
          { status: 400 },
        );
      }
      const service = await getBankingService();
      const account = await service.updateAccountStatus(
        orgId,
        id,
        body.status as AccountStatus,
      );
      return NextResponse.json({ ok: true, account });
    }

    return NextResponse.json(
      { ok: false, error: 'unsupported patch (only `status` is supported)' },
      { status: 400 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/accounts/[id] PATCH]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
