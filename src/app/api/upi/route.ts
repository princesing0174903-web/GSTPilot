import { NextResponse } from 'next/server';
import { getUPITransactions, getLinkedVpas } from '@/lib/banking/upi';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const direction = url.searchParams.get('direction') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 200;

    const [transactions, vpas] = await Promise.all([
      getUPITransactions({ direction, status, limit }),
      getLinkedVpas(),
    ]);
    return NextResponse.json({ ...transactions, vpas });
  } catch (err) {
    console.error('[API /upi] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load UPI transactions', transactions: [], total: 0, hasLiveData: false, vpas: [] },
      { status: 500 },
    );
  }
}
