// GET /api/platform/apis — API platform inventory + keys + webhooks
import { NextResponse } from 'next/server';
import { getApiPlatformSummary } from '@/lib/platform/api-platform';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const summary = await getApiPlatformSummary();
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Platform': 'true' } });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute API platform summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
