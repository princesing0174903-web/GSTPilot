import { NextResponse } from 'next/server';
import { getCollectionsState, sendReminders, detectOverdue, markRecovered } from '@/lib/banking/collections';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getCollectionsState();
    return NextResponse.json(state);
  } catch (err) {
    console.error('[API /banking/collections] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load collections state', summary: null, records: [], workflow: [], hasLiveData: false },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'remind';

    if (action === 'detect') {
      const result = await detectOverdue();
      return NextResponse.json({
        success: true,
        ...result,
        message: `I've detected ${result.detected} new overdue invoices.`,
      });
    }
    if (action === 'recover' && body.id) {
      const result = await markRecovered(body.id, body.amount || 0);
      return NextResponse.json({
        success: true,
        ...result,
        message: "I've marked this collection as recovered.",
      });
    }
    // Default: send reminders.
    const result = await sendReminders({ stage: body.stage });
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've scheduled collections recovery — reminders sent to ${result.sent} clients via ${result.channel}.`,
    });
  } catch (err) {
    console.error('[API /banking/collections] POST error:', err);
    return NextResponse.json({ error: 'Failed to process collections action' }, { status: 500 });
  }
}
