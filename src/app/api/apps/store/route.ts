import { NextRequest, NextResponse } from 'next/server';
import { listStoreApps } from '@/lib/app-platform/registry';
import { APP_CATEGORY_META, type AppCategory } from '@/lib/app-platform/types';
import { db } from '@/lib/db';

/** GET /api/apps/store — full store browse result (apps + categories + featured). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;
    const type = searchParams.get('type') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const sortBy = (searchParams.get('sort') as 'popular' | 'rating' | 'newest' | 'name') ?? 'popular';

    const [storeResult, allApps] = await Promise.all([
      listStoreApps({ category, type, search, sortBy, page: 1, pageSize: 48 }),
      db.app.findMany({ where: { status: 'published' }, select: { category: true } }),
    ]);

    // Build category metadata with counts
    const categoryCounts: Record<string, number> = {};
    for (const app of allApps) categoryCounts[app.category] = (categoryCounts[app.category] ?? 0) + 1;
    const categories = Object.entries(APP_CATEGORY_META).map(([cat, meta]) => ({
      category: cat as AppCategory,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      count: categoryCounts[cat] ?? 0,
    })).filter((c) => c.count > 0);

    // Featured apps
    const featuredResult = await listStoreApps({ featuredOnly: true, sortBy: 'rating', page: 1, pageSize: 6 });

    return NextResponse.json({
      apps: storeResult.apps,
      total: storeResult.total,
      categories,
      featured: featuredResult.apps,
    });
  } catch (error) {
    console.error('[API /apps/store] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch store' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
