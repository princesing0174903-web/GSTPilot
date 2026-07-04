import { NextResponse } from 'next/server';
import { markCollected } from '@/lib/invoices/receivables';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { id: string; amount: number };
    if (!body.id || body.amount == null) {
      return NextResponse.json({ error: 'id and amount are required' }, { status: 400 });
    }
    const rec = await markCollected(body.id, body.amount);
    return NextResponse.json({
      success: true,
      receivable: rec,
      message: `I've recovered ${body.amount} from ${rec.customerName} — ${rec.status}.`,
    });
  } catch (err) {
    console.error('[API /receivables/recover] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to recover receivable' },
      { status: 500 },
    );
  }
}
