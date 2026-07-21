import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/banking-intel/accounts/sync — trigger a sync for one account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { accountId } = body ?? {};

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'accountId is required' },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const account = await service.syncAccount(orgId, accountId);
    return NextResponse.json({ ok: true, account });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/accounts/sync POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
