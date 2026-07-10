// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Downgrade API
// POST /api/billing/downgrade
//   Body: { organizationId, subscriptionId, newPlanId, applyImmediately? }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';
import type { SubscriptionPlanId } from '@/lib/billing-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_PLANS: SubscriptionPlanId[] = ['free', 'starter', 'professional', 'business', 'enterprise'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, subscriptionId, newPlanId, applyImmediately } = body as {
      organizationId?: string;
      subscriptionId?: string;
      newPlanId?: SubscriptionPlanId;
      applyImmediately?: boolean;
    };

    if (!organizationId) return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    if (!subscriptionId) return NextResponse.json({ ok: false, error: 'subscriptionId is required.' }, { status: 400 });
    if (!newPlanId || !VALID_PLANS.includes(newPlanId)) return NextResponse.json({ ok: false, error: `newPlanId must be one of: ${VALID_PLANS.join(', ')}` }, { status: 400 });

    const { downgradePlan } = await import('@/lib/billing-provider/server/orchestrator');
    const result = await downgradePlan(organizationId, subscriptionId, newPlanId, applyImmediately ?? false);

    if (result.prorationInvoice) {
      const { ...invFields } = result.prorationInvoice;
      delete (invFields as { id?: string }).id;
      await addDoc(collection(db, 'billing_invoices'), { ...invFields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/downgrade] error:', code, friendlyBillingError(err));
    return NextResponse.json({ ok: false, error: friendlyBillingError(err), code }, { status: statusCode });
  }
}
