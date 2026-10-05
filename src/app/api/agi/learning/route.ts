// GET /api/agi/learning
// Returns recent self-improvement learning episodes + the learning summary.
import { NextResponse } from 'next/server';
import { getRecentLearnings, getLearningSummary } from '@/lib/agi/learning';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [recent, summary] = await Promise.all([getRecentLearnings(50), getLearningSummary()]);
    return NextResponse.json({ ok: true, recent, summary });
  } catch (err) {
    console.error('[agi/learning] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load AGI learning' }, { status: 500 });
  }
}
