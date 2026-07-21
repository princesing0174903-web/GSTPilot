import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_KINDS = ['invoice', 'payment', 'expense', 'refund', 'receipt'] as const;
type CandidateKind = (typeof ALLOWED_KINDS)[number];

// POST /api/banking-intel/reconcile/mark
// Body: { orgId?, transactionId, candidateId?, candidateKind? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { transactionId, candidateId, candidateKind } = body ?? {};

    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'transactionId is required' },
        { status: 400 },
      );
    }

    let kind: CandidateKind | undefined;
    if (candidateKind !== undefined && candidateKind !== null) {
      if (!ALLOWED_KINDS.includes(candidateKind as CandidateKind)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid candidateKind. Allowed: ${ALLOWED_KINDS.join(', ')}`,
          },
          { status: 400 },
        );
      }
      kind = candidateKind as CandidateKind;
    }

    const service = await getBankingService();
    const transaction = await service.markReconciled(
      orgId,
      transactionId,
      candidateId,
      kind,
    );
    return NextResponse.json({ ok: true, transaction });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/reconcile/mark POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
