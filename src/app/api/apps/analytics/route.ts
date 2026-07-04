import { NextResponse } from 'next/server';
import { getPlatformAnalytics } from '@/lib/app-platform/analytics';

/** GET /api/apps/analytics — platform-wide app marketplace analytics. */
export async function GET() {
  try {
    const analytics = await getPlatformAnalytics();
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('[API /apps/analytics] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analytics' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
