import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/banking-intel/cashflow?from=&to=&accountId=&orgId=
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get('orgId') || 'preview-org';
    const from = sp.get('from') || undefined;
    const to = sp.get('to') || undefined;
    const accountId = sp.get('accountId') || undefined;

    const service = await getBankingService();
    const cashflow = await service.getCashFlow(orgId, { from, to, accountId });
    return NextResponse.json({ ok: true, cashflow });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/cashflow GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
