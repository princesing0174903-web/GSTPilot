import { NextResponse } from 'next/server';
import { getInvoiceCloudState } from '@/lib/invoices/oracle';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getInvoiceCloudState();
    return NextResponse.json(state);
  } catch (err) {
    console.error('[API /invoice-cloud/state] error:', err);
    return NextResponse.json(
      { error: 'Failed to load invoice cloud state', hasLiveData: false },
      { status: 500 },
    );
  }
}
