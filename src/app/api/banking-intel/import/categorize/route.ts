import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import type { ImportPreview } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/banking-intel/import/categorize
// Body: { orgId?, preview: ImportPreview }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { preview } = body ?? {};

    if (!preview || typeof preview !== 'object' || !Array.isArray(preview.rows)) {
      return NextResponse.json(
        { ok: false, error: 'preview (ImportPreview) is required' },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const updated = await service.categorizeImport(
      orgId,
      preview as ImportPreview,
    );
    return NextResponse.json({ ok: true, preview: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/import/categorize POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
