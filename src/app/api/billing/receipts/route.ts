// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Receipts API
//
// GET /api/billing/receipts?organizationId=xxx
//   Returns: { ok: true, receipts: Receipt[] }
//
// One-shot read of all receipts (type='receipt') for an org. The client hook
// uses real-time subscriptions instead, but this route is useful for
// server-side renders + diagnostics.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy, limit as limitFn } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BILLING_COLLECTIONS, toReceipt } from '@/lib/billing-provider/service';
import { friendlyBillingError } from '@/lib/billing-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organizationId');
    const max = Number(req.nextUrl.searchParams.get('limit') ?? 100);
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId query param is required.' },
        { status: 400 },
      );
    }

    const q = query(
      collection(db, BILLING_COLLECTIONS.RECEIPTS),
      where('organizationId', '==', organizationId),
      orderBy('issuedAt', 'desc'),
      limitFn(max),
    );
    const snap = await getDocs(q);
    const receipts = snap.docs.map((d) => toReceipt(d.id, d.data() as Record<string, unknown>));
    return NextResponse.json({ ok: true, receipts });
  } catch (err) {
    const { statusCode, code, message } = friendlyBillingError(err);
    console.error('[api/billing/receipts] error:', code, message);
    return NextResponse.json({ ok: false, error: message, code }, { status: statusCode });
  }
}
