// GET /api/network/partners
// Lists all strategic-partner nodes plus investor nodes, merged into one array.

import { NextResponse } from 'next/server';
import { listNodes } from '@/lib/network/organizations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) || 50 : 50;

    const [partners, investors] = await Promise.all([
      listNodes({ nodeType: 'partner', limit, search }),
      listNodes({ nodeType: 'investor', limit: 50 }),
    ]);

    // Merge both arrays (investors appended after partners). Dedup by id just in case.
    const seen = new Set<string>();
    const merged = [...partners, ...investors].filter((node) => {
      if (seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    });

    return NextResponse.json(
      { partners: merged, total: merged.length },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' } },
    );
  } catch (error) {
    console.error('[Network partners] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load partners', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
