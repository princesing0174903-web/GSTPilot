import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import type { BankingTransaction } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/banking-intel/transactions/[id] — fetch one transaction
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const orgId = req.nextUrl.searchParams.get('orgId') || 'preview-org';
    const service = await getBankingService();
    const transaction = await service.getTransaction(orgId, id);
    if (!transaction) {
      return NextResponse.json(
        { ok: false, error: 'Transaction not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, transaction });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions/[id] GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/banking-intel/transactions/[id] — partial update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';

    // Strip routing / org fields — service only accepts BankingTransaction patches.
    const patch: Partial<BankingTransaction> = { ...body };
    delete (patch as Record<string, unknown>).orgId;
    delete (patch as Record<string, unknown>).id;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No patch fields provided' },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const transaction = await service.updateTransaction(orgId, id, patch);
    return NextResponse.json({ ok: true, transaction });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions/[id] PATCH]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/banking-intel/transactions/[id] — delete a transaction
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sp = req.nextUrl.searchParams;
    // orgId may come from query (REST DELETE) or body — prefer query, fall back to preview-org.
    const orgId = sp.get('orgId') || 'preview-org';

    // If the client sent a body with orgId, prefer that for parity with POST/PATCH routes.
    let bodyOrg: string | undefined;
    try {
      const body = await req.json().catch(() => null);
      if (body && typeof body.orgId === 'string') bodyOrg = body.orgId;
    } catch {
      /* no body — fine */
    }

    const finalOrgId = bodyOrg || orgId;
    const service = await getBankingService();
    await service.deleteTransaction(finalOrgId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions/[id] DELETE]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
