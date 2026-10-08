// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Status API
//
// GET /api/billing/status
//   Returns the active payment provider description + health check result.
//   Also starts the background billing scheduler (idempotent).
//   No params required — this describes the SERVER's provider config.
//
// Uses dynamic imports for the heavy orchestrator + scheduler modules to keep
// the initial route compilation lightweight (critical on memory-constrained
// dev machines).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Dynamic imports — keeps the route shell light, heavy modules compile on demand.
    const [{ describePaymentProvider }, { providerHealthCheck }, { startBackgroundBilling }] =
      await Promise.all([
        import('@/lib/billing-provider/server/registry'),
        import('@/lib/billing-provider/server/orchestrator'),
        import('@/lib/billing-provider/server/scheduler'),
      ]);

    // Start the background scheduler (idempotent — safe to call on every hit).
    startBackgroundBilling();

    const provider = describePaymentProvider();
    const health = await providerHealthCheck();
    return NextResponse.json({ ok: true, provider, health });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/status] error:', code, friendlyBillingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBillingError(err), code },
      { status: statusCode },
    );
  }
}
