import { NextRequest, NextResponse } from 'next/server';
import { getDeveloperDashboard } from '@/lib/app-platform/developer';

/** GET /api/app-platform/developer-dashboard?developerId=X — full developer dashboard data. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const developerId = searchParams.get('developerId');

    if (!developerId) {
      return NextResponse.json({ error: 'developerId query parameter is required' }, { status: 400 });
    }

    const dashboard = await getDeveloperDashboard(developerId);
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('[API /app-platform/developer-dashboard] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch developer dashboard' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
