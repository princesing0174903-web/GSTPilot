// GET /api/ecosystem/developers
// Developer registry + SDK catalog. Real publish/installs metrics.

import { NextResponse } from 'next/server';
import { getDeveloperPlatformSummary } from '@/lib/ecosystem/developers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const summary = await getDeveloperPlatformSummary();
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Ecosystem': 'true' },
    });
  } catch (error) {
    console.error('[Ecosystem developers] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load developer registry', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
