import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/banking-intel/forecast?horizon=7d|30d&orgId=
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get('orgId') || 'preview-org';
    const horizonRaw = sp.get('horizon');
    const horizon: '7d' | '30d' = horizonRaw === '30d' ? '30d' : '7d';

    const service = await getBankingService();
    const forecast = await service.forecastCashFlow(orgId, horizon);
    return NextResponse.json({ ok: true, forecast });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/forecast GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
