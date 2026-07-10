// POST /api/bank/collections/remind
// Schedule WhatsApp + Email + SMS reminders for all overdue invoices.

import { NextResponse } from 'next/server';
import { remindCollections } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const res = await remindCollections();
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    console.error('[bank/collections/remind] POST failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to schedule reminders', detail: String(err) },
      { status: 500 },
    );
  }
}
