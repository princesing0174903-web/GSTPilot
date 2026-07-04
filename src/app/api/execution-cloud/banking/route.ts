// POST /api/execution-cloud/banking
// Execute a banking action (sync/collect/fetch/reconcile).

import { NextResponse } from 'next/server';
import { generateCFOInsights } from '@/lib/cfo/engine';
import { uid, minsAgo } from '@/lib/execution-cloud/engine';
import type { BankingActionRequest, BankingActionResponse, ReconciliationEntry } from '@/lib/execution-cloud/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: BankingActionRequest;
  try {
    body = (await request.json()) as BankingActionRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { capability, action, accountId } = body;
  if (!capability || !action) {
    return NextResponse.json({ error: 'capability and action are required' }, { status: 400 });
  }

  try {
    await generateCFOInsights(null);
    const actionLabels: Record<string, string> = {
      sync: `Synced bank statement for ${accountId ?? 'all accounts'}`,
      collect: `UPI collect request sent`,
      fetch: `Fetched data via Account Aggregator`,
      reconcile: `Reconciled bank transactions`,
    };

    let result: ReconciliationEntry | undefined;
    if (action === 'reconcile') {
      result = {
        id: uid('recon'),
        bankRef: `UTR${Math.floor(1e11 + Math.random() * 8e11)}`,
        bankAmount: Math.floor(15000 + Math.random() * 285000),
        matchedInvoice: `INV-2025-${String(Math.floor(4100 + Math.random() * 400)).padStart(4, '0')}`,
        matchedTo: 'Reliance Retail Ltd',
        status: 'matched',
        confidencePct: Math.floor(88 + Math.random() * 11),
        at: minsAgo(0),
      };
    }

    const response: BankingActionResponse = {
      ok: true,
      capability,
      message: actionLabels[action] ?? `${action} ${capability}`,
      result,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[execution-cloud/banking] POST failed:', err);
    return NextResponse.json(
      { error: 'Failed to execute banking action', detail: String(err) },
      { status: 500 },
    );
  }
}
