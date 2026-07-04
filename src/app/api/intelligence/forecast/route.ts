import { NextResponse } from 'next/server';
import { getIntelligence } from '@/lib/invoices/intelligence';
import { getInvoices } from '@/lib/invoices/invoices';
import { getExpenses } from '@/lib/invoices/expenses';
import { getReceivables } from '@/lib/invoices/receivables';
import { getPayables } from '@/lib/invoices/payables';
import { getPayments } from '@/lib/invoices/payments';
import { getPayroll } from '@/lib/invoices/payroll';
import { getAnalytics } from '@/lib/invoices/analytics';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [invoices, expenses, receivables, payables, payments, payroll] = await Promise.all([
      getInvoices({ limit: 500 }),
      getExpenses({ limit: 500 }),
      getReceivables({ limit: 500 }),
      getPayables({ limit: 500 }),
      getPayments({ limit: 500 }),
      getPayroll(),
    ]);

    const analytics = await getAnalytics({
      invoices,
      expenses,
      receivables,
      payroll,
    });

    const intelligence = await getIntelligence({
      invoices,
      expenses,
      receivables,
      payables,
      payments,
      payroll,
      analytics,
    });

    return NextResponse.json({
      success: true,
      intelligence,
    });
  } catch (err) {
    console.error('[API /intelligence/forecast] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute revenue intelligence' },
      { status: 500 },
    );
  }
}
