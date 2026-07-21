import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import type { ImportPreview } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/banking-intel/import/commit
// Body: { orgId?, preview: ImportPreview, accountId: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { preview, accountId } = body ?? {};

    if (!preview || typeof preview !== 'object' || !Array.isArray(preview.rows)) {
      return NextResponse.json(
        { ok: false, error: 'preview (ImportPreview) is required' },
        { status: 400 },
      );
    }
    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'accountId is required' },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const result = await service.commitImport(
      orgId,
      preview as ImportPreview,
      accountId,
    );
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/import/commit POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
