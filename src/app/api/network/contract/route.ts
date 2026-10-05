// POST /api/network/contract
// Create a draft contract in the B2B Commerce Cloud™ between two network nodes.

import { NextResponse } from 'next/server';
import { createContract } from '@/lib/network/commerce';
import { invalidateNetworkCache } from '@/lib/network/orchestrator';
import type { ContractType } from '@/lib/network/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_CONTRACT_TYPES: ReadonlySet<string> = new Set([
  'supply',
  'service',
  'partnership',
  'nda',
  'msa',
  'sla',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title: string | undefined = body.title;
    const fromNodeId: string | undefined = body.fromNodeId;
    const toNodeId: string | undefined = body.toNodeId;

    if (!title || !fromNodeId || !toNodeId) {
      return NextResponse.json(
        { error: 'title, fromNodeId and toNodeId are required' },
        { status: 400 },
      );
    }

    const typeRaw: string = typeof body.type === 'string' ? body.type : 'service';
    const type: ContractType = VALID_CONTRACT_TYPES.has(typeRaw)
      ? (typeRaw as ContractType)
      : 'service';

    const contract = await createContract({
      fromNodeId,
      toNodeId,
      title,
      type,
      value: Number(body.value) || 0,
      currency: typeof body.currency === 'string' ? body.currency : 'INR',
      startDate:
        typeof body.startDate === 'string' ? body.startDate : new Date().toISOString(),
      endDate: body.endDate,
      terms: body.terms,
    });

    invalidateNetworkCache();

    return NextResponse.json(
      { success: true, contract },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
      },
    );
  } catch (error) {
    console.error('[Network contract] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create contract', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
