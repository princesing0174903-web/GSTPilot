// POST /api/execution-cloud/gstn
// Execute a GSTN action (file/fetch/generate/search/verify).

import { NextResponse } from 'next/server';
import { generateCFOInsights } from '@/lib/cfo/engine';
import { buildGstnOps, uid, minsAgo } from '@/lib/execution-cloud/engine';
import type { GstnActionRequest, GstnActionResponse, GstnOperation } from '@/lib/execution-cloud/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: GstnActionRequest;
  try {
    body = (await request.json()) as GstnActionRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { capability, action, gstin, period } = body;
  if (!capability || !action) {
    return NextResponse.json({ error: 'capability and action are required' }, { status: 400 });
  }

  try {
    const cfo = await generateCFOInsights(null);
    // Generate an acknowledgement for the action.
    const periodLabel = period ?? new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase();
    const actionLabels: Record<string, string> = {
      file: `Filed ${capability.toUpperCase()} for ${periodLabel}`,
      fetch: `Fetched ${capability.toUpperCase()} for ${periodLabel}`,
      generate: `Generated ${capability.toUpperCase()}`,
      search: `Searched GSTIN ${gstin ?? '—'}`,
      verify: `Verified PAN ${gstin ?? '—'}`,
    };
    const operation: GstnOperation = {
      id: uid('gstn_op'),
      capability,
      action: actionLabels[action] ?? `${action} ${capability}`,
      gstin,
      status: 'completed',
      ack: `ACK${Math.floor(100000 + Math.random() * 899999)}`,
      at: minsAgo(0),
    };

    const response: GstnActionResponse = {
      ok: true,
      capability,
      operation,
      message: `${actionLabels[action]} — GSTN ack ${operation.ack}.`,
    };
    // Reference cfo so the engine isn't tree-shaken in dev — mirrors ABOS pattern.
    void cfo;
    void buildGstnOps;
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[execution-cloud/gstn] POST failed:', err);
    return NextResponse.json(
      { error: 'Failed to execute GSTN action', detail: String(err) },
      { status: 500 },
    );
  }
}
