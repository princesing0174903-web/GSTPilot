// POST /api/network/rfq
// Create a Request for Quotation in the B2B Commerce Cloud™. Emits a matching
// NetworkTransaction so the broader business graph tracks the RFQ immediately.

import { NextResponse } from 'next/server';
import { createRfq } from '@/lib/network/commerce';
import { invalidateNetworkCache } from '@/lib/network/orchestrator';
import type { RfqCategory } from '@/lib/network/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'goods',
  'services',
  'raw_materials',
  'equipment',
  'logistics',
  'consulting',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title: string | undefined = body.title;
    const fromNodeId: string | undefined = body.fromNodeId;

    if (!title || !fromNodeId) {
      return NextResponse.json(
        { error: 'title and fromNodeId are required' },
        { status: 400 },
      );
    }

    const categoryRaw: string = typeof body.category === 'string' ? body.category : 'goods';
    const category: RfqCategory = VALID_CATEGORIES.has(categoryRaw)
      ? (categoryRaw as RfqCategory)
      : 'goods';

    const rfq = await createRfq({
      fromNodeId,
      toNodeId: body.toNodeId,
      title,
      description: typeof body.description === 'string' ? body.description : '',
      category,
      quantity: Number(body.quantity) || 1,
      unit: typeof body.unit === 'string' ? body.unit : 'unit',
      budgetMax: Number(body.budgetMax) || 0,
      currency: typeof body.currency === 'string' ? body.currency : 'INR',
      deliveryDate: body.deliveryDate,
      deliveryLocation: body.deliveryLocation,
    });

    invalidateNetworkCache();

    return NextResponse.json(
      { success: true, rfq },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
      },
    );
  } catch (error) {
    console.error('[Network rfq] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create RFQ', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
