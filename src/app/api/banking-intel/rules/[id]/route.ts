import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import type { CategorizationRule } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PATCH /api/banking-intel/rules/[id]
// Body: { orgId?, ...patch }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';

    const patch: Partial<CategorizationRule> = { ...body };
    delete (patch as Record<string, unknown>).orgId;
    delete (patch as Record<string, unknown>).id;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No patch fields provided' },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const rule = await service.updateRule(orgId, id, patch);
    return NextResponse.json({ ok: true, rule });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/rules/[id] PATCH]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/banking-intel/rules/[id]
// Body: { orgId? } (optional — query param also accepted)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sp = req.nextUrl.searchParams;
    const queryOrgId = sp.get('orgId');

    let bodyOrg: string | undefined;
    try {
      const body = await req.json().catch(() => null);
      if (body && typeof body.orgId === 'string') bodyOrg = body.orgId;
    } catch {
      /* no body — fine */
    }

    const orgId = bodyOrg || queryOrgId || 'preview-org';
    const service = await getBankingService();
    await service.deleteRule(orgId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/rules/[id] DELETE]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
