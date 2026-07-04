import { NextResponse } from 'next/server';
import { syncUPI } from '@/lib/banking/upi';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await syncUPI();
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've synced UPI transactions — ${result.synced} processed, ${result.matched} matched to your bank.`,
    });
  } catch (err) {
    console.error('[API /upi/sync] error:', err);
    return NextResponse.json({ error: 'Failed to sync UPI' }, { status: 500 });
  }
}
