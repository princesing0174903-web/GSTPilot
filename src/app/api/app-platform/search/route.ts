import { NextRequest, NextResponse } from 'next/server';
import { searchMarketplace } from '@/lib/app-platform/search';
import { resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** GET /api/app-platform/search?q=X — global marketplace search. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? '';

    let tenantId: string | undefined;
    try {
      tenantId = await resolveDefaultTenantId();
    } catch {
      // No tenant — search without tenant-scoped results
    }

    const result = await searchMarketplace(q, tenantId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /app-platform/search] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search marketplace' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
