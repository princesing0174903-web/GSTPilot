// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Create Invoice API
// POST /api/billing/invoice
//   Body: CreateInvoiceInput
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';
import type { CreateInvoiceInput } from '@/lib/billing-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateInvoiceInput & {
      createdBy?: { uid: string; name: string; email: string };
    };

    if (!body.organizationId) return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    if (!body.subscriptionId) return NextResponse.json({ ok: false, error: 'subscriptionId is required.' }, { status: 400 });
    if (!body.type) return NextResponse.json({ ok: false, error: 'type is required.' }, { status: 400 });
    if (!body.createdBy) body.createdBy = { uid: '', name: '', email: '' };

    const { createInvoice } = await import('@/lib/billing-provider/server/orchestrator');
    const result = await createInvoice(body);

    const { ...invFields } = result.invoice;
    delete (invFields as { id?: string }).id;
    await addDoc(collection(db, 'billing_invoices'), {
      ...invFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/invoice] error:', code, friendlyBillingError(err));
    return NextResponse.json({ ok: false, error: friendlyBillingError(err), code }, { status: statusCode });
  }
}
