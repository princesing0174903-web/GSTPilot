// GET /api/network/customers
// Lists all customer nodes in the world business graph.

import { NextResponse } from 'next/server';
import { listNodes } from '@/lib/network/organizations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) || 100 : 100;

    const customers = await listNodes({ nodeType: 'customer', limit, search });

    return NextResponse.json(
      { customers, total: customers.length },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' } },
    );
  } catch (error) {
    console.error('[Network customers] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load customers', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
