// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Plans API
//
// GET /api/billing/plans
//   Returns the 5 canonical subscription plans (Free, Starter, Professional,
//   Business, Enterprise). No auth required — plans are global.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getAllPlans } from '@/lib/billing-provider/server/plans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const plans = getAllPlans();
    return NextResponse.json({ ok: true, plans });
  } catch (err) {
    console.error('[api/billing/plans] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load subscription plans.' },
      { status: 500 },
    );
  }
}
