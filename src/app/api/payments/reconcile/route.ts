import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Bulk reconciliation endpoint.
 *
 * Reconciliation is now handled per-payment in the Payments view
 * (organizations/GSTpilot_SAAS/payments) via the `reconciled` flag on each
 * Payment document. This endpoint returns a graceful no-op response so legacy
 * callers do not crash — no fabricated match counts.
 */
export async function POST() {
  try {
    return NextResponse.json({
      success: true,
      matched: 0,
      total: 0,
      matchedAmount: 0,
      message:
        "Reconciliation is now managed per-payment in the Payments view. Open a payment and toggle its reconciled flag — Firestore is the only source of truth.",
    });
  } catch (err) {
    console.error('[API /payments/reconcile] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to reconcile payments' },
      { status: 500 },
    );
  }
}
