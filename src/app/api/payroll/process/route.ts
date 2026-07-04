import { NextResponse } from 'next/server';
import { processPayroll } from '@/lib/invoices/payroll';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as {
      month?: string;
      workingDays?: number;
      state?: string;
    };
    const result = await processPayroll({
      month: body.month,
      workingDays: body.workingDays,
      state: body.state,
    });
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've processed payroll for ${result.processed} employees — net ${result.totalNet} (total cost ${result.totalCost}).`,
    });
  } catch (err) {
    console.error('[API /payroll/process] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process payroll' },
      { status: 500 },
    );
  }
}
