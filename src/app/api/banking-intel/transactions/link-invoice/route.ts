import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/banking-intel/transactions/link-invoice
// Body: { orgId?, transactionId, invoiceId, matchType? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { transactionId, invoiceId, matchType } = body ?? {};

    if (!transactionId || !invoiceId) {
      return NextResponse.json(
        { ok: false, error: 'transactionId and invoiceId are required' },
        { status: 400 },
      );
    }

    const allowed = ['manual', 'exact', 'fuzzy'];
    const mt =
      typeof matchType === 'string' && allowed.includes(matchType)
        ? (matchType as 'manual' | 'exact' | 'fuzzy')
        : undefined;

    const service = await getBankingService();
    const transaction = await service.linkInvoice(
      orgId,
      transactionId,
      invoiceId,
      mt,
    );
    return NextResponse.json({ ok: true, transaction });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions/link-invoice POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
