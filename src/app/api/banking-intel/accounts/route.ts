import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/banking-intel/accounts — list all bank accounts for an org
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const orgId = searchParams.get('orgId') || 'preview-org';
    const service = await getBankingService();
    const accounts = await service.listAccounts(orgId);
    return NextResponse.json({ ok: true, accounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/accounts GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/banking-intel/accounts — connect a new bank account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const {
      bankName,
      accountName,
      accountMasked,
      accountType,
      ifsc,
      currency,
      balance,
      upiHandle,
    } = body ?? {};

    if (!bankName || !accountName || !accountMasked || !accountType) {
      return NextResponse.json(
        { ok: false, error: 'bankName, accountName, accountMasked and accountType are required' },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const account = await service.createAccount(orgId, {
      bankName,
      accountName,
      accountMasked,
      accountType,
      ifsc,
      currency,
      balance: typeof balance === 'number' ? balance : Number(balance) || 0,
      upiHandle,
    });
    return NextResponse.json({ ok: true, account }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/accounts POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
