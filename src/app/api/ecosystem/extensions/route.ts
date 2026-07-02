// GET /api/ecosystem/extensions
// List all marketplace + private extensions. Real install counts, real ratings.

import { NextResponse } from 'next/server';
import { listExtensions } from '@/lib/ecosystem/extensions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const visibility = url.searchParams.get('visibility') as 'public' | 'private' | null;
    const orgId = url.searchParams.get('orgId') ?? undefined;
    const limit = Number(url.searchParams.get('limit')) || 100;

    const extensions = await listExtensions({
      visibility: visibility ?? undefined,
      organizationId: orgId,
      limit,
    });

    return NextResponse.json(
      { total: extensions.length, extensions },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem extensions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to list extensions', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
