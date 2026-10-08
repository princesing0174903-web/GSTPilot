// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Provider Info API (TASK 12)
//
// GET /api/banking/provider
//   → getProviderInfo()
//
// Returns metadata about the active bank provider (MockBankProvider now,
// SetuProvider/RazorpayXProvider later) — name, isLive, capabilities, etc.
// Used by the UI's provider badge + "Connect to live bank" CTA.
//
// Note: provider info is global (not org-scoped), so we skip the org check
// but still require an authenticated session.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { getProviderInfo } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const info = await getProviderInfo();
    return NextResponse.json(info);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load bank provider info.');
  }
}
