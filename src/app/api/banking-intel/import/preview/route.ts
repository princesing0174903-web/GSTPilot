import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import type { ImportFormat } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_FORMATS: ImportFormat[] = ['csv', 'excel', 'pdf'];

// POST /api/banking-intel/import/preview
// Body: { orgId?, format: 'csv'|'excel'|'pdf', rawContent: string, accountId? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { format, rawContent, accountId } = body ?? {};

    if (!format || !ALLOWED_FORMATS.includes(format as ImportFormat)) {
      return NextResponse.json(
        {
          ok: false,
          error: `format is required and must be one of: ${ALLOWED_FORMATS.join(', ')}`,
        },
        { status: 400 },
      );
    }
    if (typeof rawContent !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'rawContent (string) is required' },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const preview = await service.previewImport(
      orgId,
      format as ImportFormat,
      rawContent,
      accountId || undefined,
    );
    return NextResponse.json({ ok: true, preview });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/import/preview POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
