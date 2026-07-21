import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/banking-intel/rules/apply — re-evaluate all rules against all transactions
// Body: { orgId? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';

    const service = await getBankingService();
    const result = await service.applyRules(orgId);
    return NextResponse.json({ ok: true, applied: result.applied, touched: result.touched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/rules/apply POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
