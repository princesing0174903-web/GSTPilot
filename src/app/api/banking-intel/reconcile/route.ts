import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/banking-intel/reconcile — reconciliation summary
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId') || 'preview-org';
    const service = await getBankingService();
    const summary = await service.getReconcileSummary(orgId);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/reconcile GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/banking-intel/reconcile
// Body: { orgId?, transactionId? }
//   - If transactionId is provided → reconcileOne (returns { ok, result })
//   - Otherwise → reconcileAll (returns { ok, results })
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { transactionId } = body ?? {};

    const service = await getBankingService();

    if (transactionId && typeof transactionId === 'string') {
      const result = await service.reconcileOne(orgId, transactionId);
      return NextResponse.json({ ok: true, result });
    }

    const results = await service.reconcileAll(orgId);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/reconcile POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
