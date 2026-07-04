import { NextResponse } from 'next/server';
import { APP_CATEGORY_META, APP_TYPE_META, type AppCategory, type AppType } from '@/lib/app-platform/types';
import { db } from '@/lib/db';

/** GET /api/apps/categories — category + type metadata with live app counts. */
export async function GET() {
  try {
    const apps = await db.app.findMany({ where: { status: 'published' }, select: { category: true, type: true } });

    const categoryCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    for (const app of apps) {
      categoryCounts[app.category] = (categoryCounts[app.category] ?? 0) + 1;
      typeCounts[app.type] = (typeCounts[app.type] ?? 0) + 1;
    }

    const categories = Object.entries(APP_CATEGORY_META).map(([cat, meta]) => ({
      category: cat as AppCategory,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      count: categoryCounts[cat] ?? 0,
    }));

    const types = Object.entries(APP_TYPE_META).map(([type, meta]) => ({
      type: type as AppType,
      label: meta.label,
      icon: meta.icon,
      description: meta.description,
      count: typeCounts[type] ?? 0,
    }));

    return NextResponse.json({ categories, types, totalApps: apps.length });
  } catch (error) {
    console.error('[API /apps/categories] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch categories' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
