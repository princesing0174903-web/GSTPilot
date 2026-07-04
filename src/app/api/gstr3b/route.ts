// GET  /api/gstr3b?gstin=XXX&period=YYYY-MM — Get GSTR-3B draft/status.
// (prepare/file/status are sub-routes)

import { NextResponse } from 'next/server';
import { getGstr3bDraft } from '@/lib/gstn/gstr3b';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gstin = (searchParams.get('gstin') ?? '').toUpperCase().trim();
  const period = searchParams.get('period') ?? undefined;
  if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
  if (!period) return NextResponse.json({ error: 'period is required (YYYY-MM)' }, { status: 400 });
  try {
    const draft = await getGstr3bDraft(gstin, period);
    if (!draft) {
      return NextResponse.json({ error: 'No GSTR-3B draft found. POST to /api/gstr3b/prepare first.', gstin, period }, { status: 404 });
    }
    return NextResponse.json(draft, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch GSTR-3B', detail: String(err) }, { status: 500 });
  }
}
