// GET /api/platform/billing — billing summary (MRR, ARR, invoices, usage)
import { NextResponse } from 'next/server';
import { getBillingSummary } from '@/lib/platform/billing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const billing = await getBillingSummary();
    return NextResponse.json(billing, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Platform': 'true' } });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute billing summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
