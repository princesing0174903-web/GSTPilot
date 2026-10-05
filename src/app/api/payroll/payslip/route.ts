import { NextResponse } from 'next/server';
import { generatePayslip, markPayrollPaid } from '@/lib/invoices/payroll';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { id: string; action?: 'generate' | 'pay' };
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (body.action === 'pay') {
      const payroll = await markPayrollPaid(body.id);
      return NextResponse.json({
        success: true,
        payroll,
        message: `I've marked ${payroll.employeeName}'s salary as paid (${payroll.netSalary} via bank).`,
      });
    }
    const payroll = await generatePayslip(body.id);
    return NextResponse.json({
      success: true,
      payroll,
      message: `I've generated the payslip for ${payroll.employeeName} — net ${payroll.netSalary}.`,
    });
  } catch (err) {
    console.error('[API /payroll/payslip] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate payslip' },
      { status: 500 },
    );
  }
}
