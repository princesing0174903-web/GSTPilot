// GET /api/oracle/memory — Unified Memory™ search & stats
import { NextRequest, NextResponse } from 'next/server';
import { searchMemory, getMemoryStats } from '@/lib/oracle-core/memory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') ?? undefined;
    const category = searchParams.get('category') ?? undefined;
    const source = searchParams.get('source') ?? undefined;
    const entityType = searchParams.get('entityType') ?? undefined;
    const entityId = searchParams.get('entityId') ?? undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const minImportance = searchParams.get('minImportance') ? parseInt(searchParams.get('minImportance')!, 10) : undefined;
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      const stats = await getMemoryStats();
      return NextResponse.json(stats);
    }

    const result = await searchMemory({
      query,
      category: category as any,
      source: source as any,
      entityType,
      entityId,
      limit,
      minImportance,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
