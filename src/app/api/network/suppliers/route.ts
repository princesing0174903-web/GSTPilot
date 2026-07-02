// GET /api/network/suppliers
// Lists suppliers (or discovers by category) + the supplier network summary.

import { NextResponse } from 'next/server';
import {
  listSuppliers,
  discoverSuppliers,
  getSupplierNetworkSummary,
} from '@/lib/network/suppliers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? undefined;
    const limitParam = url.searchParams.get('limit');
    const category = url.searchParams.get('category') ?? undefined;
    const limit = limitParam ? Number(limitParam) || 20 : 20;

    const [suppliers, summary] = await Promise.all([
      category
        ? discoverSuppliers(category, limit)
        : listSuppliers({
            search,
            limit: limitParam ? Number(limitParam) || 50 : 50,
          }),
      getSupplierNetworkSummary(),
    ]);

    return NextResponse.json(
      { suppliers, summary },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' } },
    );
  } catch (error) {
    console.error('[Network suppliers] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load suppliers', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
