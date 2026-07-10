import { NextRequest, NextResponse } from 'next/server';
import { listStoreApps, resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** GET /api/apps — list all published apps (with filters). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;
    const type = searchParams.get('type') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const featuredOnly = searchParams.get('featured') === 'true';
    const sortBy = (searchParams.get('sort') as 'popular' | 'rating' | 'newest' | 'name') ?? 'popular';
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '48', 10);

    const result = await listStoreApps({ category, type, search, featuredOnly, sortBy, page, pageSize });
    return NextResponse.json({ apps: result.apps, total: result.total, page, pageSize });
  } catch (error) {
    console.error('[API /apps] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch apps' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
