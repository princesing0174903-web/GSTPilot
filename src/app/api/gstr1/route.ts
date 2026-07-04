// GET  /api/gstr1?gstin=XXX&period=YYYY-MM — Get GSTR-1 draft/status.
// POST /api/gstr1/prepare — Prepare GSTR-1 draft (B2B/B2C/Exports/CD notes + JSON).
// POST /api/gstr1/file — File the prepared GSTR-1 with GSTN.
// GET  /api/gstr1/status?gstin=XXX&period=YYYY-MM — Get filing status.

import { NextResponse } from 'next/server';
import { prepareGstr1, getGstr1Draft, fileGstr1, getGstr1Status } from '@/lib/gstn/gstr1';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gstin = (searchParams.get('gstin') ?? '').toUpperCase().trim();
  const period = searchParams.get('period') ?? undefined;
  if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
  try {
    if (!period) {
      return NextResponse.json({ error: 'period is required (YYYY-MM)' }, { status: 400 });
    }
    const draft = await getGstr1Draft(gstin, period);
    if (!draft) {
      return NextResponse.json({ error: 'No GSTR-1 draft found. POST to /api/gstr1/prepare first.', gstin, period }, { status: 404 });
    }
    return NextResponse.json(draft, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch GSTR-1', detail: String(err) }, { status: 500 });
  }
}
