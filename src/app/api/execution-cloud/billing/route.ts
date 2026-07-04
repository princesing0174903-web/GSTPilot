// POST /api/execution-cloud/billing
// Upgrade / downgrade / cancel / retry payment.

import { NextResponse } from 'next/server';
import { generateCFOInsights } from '@/lib/cfo/engine';
import { buildCurrentSubscription, applyBillingAction } from '@/lib/execution-cloud/engine';
import type { BillingActionRequest, BillingActionResponse } from '@/lib/execution-cloud/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: BillingActionRequest;
  try {
    body = (await request.json()) as BillingActionRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, planId } = body;
  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  try {
    const cfo = await generateCFOInsights(null);
    const current = buildCurrentSubscription(cfo);
    const updated = applyBillingAction(current, { action, planId });

    const messages: Record<string, string> = {
      upgrade: `Upgraded to ${updated.planName} plan — ₹${updated.monthlyAmountINR.toLocaleString('en-IN')}/mo.`,
      downgrade: `Downgraded to ${updated.planName} plan — ₹${updated.monthlyAmountINR.toLocaleString('en-IN')}/mo.`,
      cancel: 'Subscription cancelled. You will retain access until the end of the current period.',
      retry_payment: 'Payment retried successfully. Subscription is now active.',
    };

    const response: BillingActionResponse = {
      ok: true,
      subscription: updated,
      message: messages[action] ?? 'Billing action applied.',
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[execution-cloud/billing] POST failed:', err);
    return NextResponse.json(
      { error: 'Failed to apply billing action', detail: String(err) },
      { status: 500 },
    );
  }
}
