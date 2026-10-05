import { NextRequest, NextResponse } from 'next/server';
import { listDevelopers, getDeveloperDashboard } from '@/lib/app-platform/developer';

/** GET /api/developers — list all developers. Optional ?dashboard=true&developerId=X for full dashboard. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dashboard = searchParams.get('dashboard') === 'true';
    const developerId = searchParams.get('developerId');

    if (dashboard && developerId) {
      const dash = await getDeveloperDashboard(developerId);
      return NextResponse.json(dash);
    }

    const developers = await listDevelopers();
    return NextResponse.json({ developers, total: developers.length });
  } catch (error) {
    console.error('[API /developers] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch developers' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
