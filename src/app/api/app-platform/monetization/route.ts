import { NextResponse } from 'next/server';
import { getMonetizationSummary } from '@/lib/app-platform/monetization';

/** GET /api/app-platform/monetization — platform monetization summary. */
export async function GET() {
  try {
    const summary = await getMonetizationSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[API /app-platform/monetization] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch monetization summary' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
