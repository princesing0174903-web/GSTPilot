// GET /api/oracle/models — Multi-Model AI Router™ catalog & stats
import { NextResponse } from 'next/server';
import { getModelCatalog, getRouterStats, getRecentModelCalls } from '@/lib/oracle-core/router';

export async function GET() {
  try {
    const [catalog, stats, recent] = await Promise.all([
      Promise.resolve(getModelCatalog()),
      getRouterStats(),
      getRecentModelCalls(20),
    ]);
    return NextResponse.json({
      catalog,
      stats,
      recentCalls: recent,
      totalModels: catalog.length,
      providers: Array.from(new Set(catalog.map((m) => m.provider))),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
