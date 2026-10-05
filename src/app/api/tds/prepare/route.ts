import { NextResponse } from 'next/server';
import { prepareChallan, markChallanPaid, prepareTDSReturn } from '@/lib/invoices/tds';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      action: 'challan' | 'pay_challan' | 'return';
      section?: string;
      challanDate?: string;
      challanNo?: string;
      returnPeriod?: string;
    };

    if (body.action === 'challan') {
      const result = await prepareChallan({
        section: body.section,
        challanDate: body.challanDate,
      });
      return NextResponse.json({
        success: true,
        ...result,
        message: `I've prepared challan ${result.challanNo} for ${result.count} TDS records totalling ${result.totalAmount}.`,
      });
    }

    if (body.action === 'pay_challan') {
      if (!body.challanNo) {
        return NextResponse.json({ error: 'challanNo is required for pay_challan' }, { status: 400 });
      }
      const result = await markChallanPaid(body.challanNo);
      return NextResponse.json({
        success: true,
        ...result,
        message: `I've marked challan ${body.challanNo} as paid — ${result.updated} records updated.`,
      });
    }

    if (body.action === 'return') {
      if (!body.returnPeriod) {
        return NextResponse.json({ error: 'returnPeriod is required for return' }, { status: 400 });
      }
      const result = await prepareTDSReturn({
        returnPeriod: body.returnPeriod,
        challanNo: body.challanNo,
      });
      return NextResponse.json({
        success: true,
        ...result,
        message: `I've prepared your TDS return for ${body.returnPeriod} — ${result.filed} records filed totalling ${result.totalTDS}.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[API /tds/prepare] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to prepare TDS' },
      { status: 500 },
    );
  }
}
