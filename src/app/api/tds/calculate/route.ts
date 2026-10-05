import { NextResponse } from 'next/server';
import { calculateTDS } from '@/lib/invoices/tds';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.deducteeName || !body.section || body.paymentAmount == null) {
      return NextResponse.json(
        { error: 'deducteeName, section, and paymentAmount are required' },
        { status: 400 },
      );
    }
    const record = await calculateTDS(body);
    return NextResponse.json({
      success: true,
      record,
      message: `I've calculated your TDS liability — Sec ${record.section} @ ${record.tdsRate}% = ${record.totalTds} on payment of ${record.paymentAmount}.`,
    });
  } catch (err) {
    console.error('[API /tds/calculate] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to calculate TDS' },
      { status: 500 },
    );
  }
}
