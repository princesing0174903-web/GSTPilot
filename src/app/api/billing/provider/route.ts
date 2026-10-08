// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Provider Diagnostics API
//
// GET /api/billing/provider
//   Returns: { ok: true, name, provider, isLive, mode, healthy, cryptoOk }
//
// Reports the active payment provider's health + whether it's a live or mock
// implementation. Used by the UI to show "Mock Razorpay (India)" etc.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { describeBillingProvider } from '@/lib/billing-provider/server/registry';
import { providerHealthCheck } from '@/lib/billing-provider/server/orchestrator';
import { verifyCrypto } from '@/lib/billing-provider/server/crypto';
import { friendlyBillingError } from '@/lib/billing-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const desc = describeBillingProvider();
    const health = await providerHealthCheck();
    const cryptoOk = verifyCrypto();

    return NextResponse.json({
      ok: true,
      name: desc.name,
      provider: desc.provider,
      isLive: desc.isLive,
      mode: desc.mode,
      healthy: health.healthy,
      cryptoOk,
    });
  } catch (err) {
    const { statusCode, code, message } = friendlyBillingError(err);
    console.error('[api/billing/provider] error:', code, message);
    return NextResponse.json({ ok: false, error: message, code }, { status: statusCode });
  }
}
