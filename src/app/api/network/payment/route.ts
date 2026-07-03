// POST /api/network/payment
// Create a payment in the Global Payments Network™. Emits a matching
// NetworkTransaction so the broader business graph tracks the flow immediately.

import { NextResponse } from 'next/server';
import { createPayment } from '@/lib/network/payments';
import { invalidateNetworkCache } from '@/lib/network/orchestrator';
import type { PaymentMethod } from '@/lib/network/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_METHODS: ReadonlySet<string> = new Set([
  'domestic_transfer',
  'international_wire',
  'upi',
  'card',
  'rtgs',
  'neft',
  'imps',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fromNodeId: string | undefined = body.fromNodeId;
    const toNodeId: string | undefined = body.toNodeId;
    const amount = Number(body.amount);

    if (!fromNodeId || !toNodeId) {
      return NextResponse.json(
        { error: 'fromNodeId and toNodeId are required' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'amount must be a positive number' },
        { status: 400 },
      );
    }

    const methodRaw: string = typeof body.method === 'string' ? body.method : 'domestic_transfer';
    const method: PaymentMethod = VALID_METHODS.has(methodRaw)
      ? (methodRaw as PaymentMethod)
      : 'domestic_transfer';

    const payment = await createPayment({
      fromNodeId,
      toNodeId,
      poId: body.poId,
      amount,
      currency: typeof body.currency === 'string' ? body.currency : 'INR',
      method,
      reference: body.reference,
    });

    invalidateNetworkCache();

    return NextResponse.json(
      { success: true, payment },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
      },
    );
  } catch (error) {
    console.error('[Network payment] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
