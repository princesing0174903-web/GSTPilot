import { NextResponse } from 'next/server';
import { importTransactions } from '@/lib/banking/statements';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.accountId || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'accountId and rows[] are required' }, { status: 400 });
    }
    const result = await importTransactions(body.accountId, body.rows);
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've imported ${result.imported} transactions from your statement.`,
    });
  } catch (err) {
    console.error('[API /banking/transactions/import] error:', err);
    return NextResponse.json({ error: 'Failed to import transactions' }, { status: 500 });
  }
}
