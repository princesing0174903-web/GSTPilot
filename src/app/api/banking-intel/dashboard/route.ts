import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/banking-intel/dashboard — full BankingDashboard (cards + series + breakdown)
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId') || 'preview-org';
    const service = await getBankingService();
    const dashboard = await service.getDashboard(orgId);
    return NextResponse.json({ ok: true, dashboard });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/dashboard GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
