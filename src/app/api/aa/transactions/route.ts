import { NextResponse } from 'next/server';
import { fetchAAData } from '@/lib/banking/aggregator';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    const result = await fetchAAData(body.accountId);
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've fetched ${result.fetched} transactions via Account Aggregator.`,
    });
  } catch (err) {
    console.error('[API /aa/transactions] error:', err);
    return NextResponse.json({ error: 'Failed to fetch AA transactions' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ transactions: [], message: 'Use POST with accountId to fetch AA transactions.' });
}
