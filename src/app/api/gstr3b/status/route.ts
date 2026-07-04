// GET /api/gstr3b/status?gstin=XXX&period=YYYY-MM — Get GSTR-3B filing status.

import { NextResponse } from 'next/server';
import { getGstr3bStatus } from '@/lib/gstn/gstr3b';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gstin = (searchParams.get('gstin') ?? '').toUpperCase().trim();
  const period = searchParams.get('period') ?? undefined;
  if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
  if (!period) return NextResponse.json({ error: 'period is required (YYYY-MM)' }, { status: 400 });
  try {
    const status = await getGstr3bStatus(gstin, period);
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
