// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/status
//
// Returns the Zoho Books connection status for the current (org, user) pair.
// Never exposes token strings — only metadata (userEmail, organization name,
// data center, scopes, connected timestamp).
//
// Response shape:
//   {
//     ok: true,
//     status: {
//       connected: boolean,
//       userEmail: string | null,
//       zohoUserId: string | null,
//       connectedAt: string | null,        // ISO timestamp
//       scopes: string[],                  // raw Zoho scope strings
//       organizationName: string | null,   // Zoho Books org display name
//       zohoOrgId: string | null,          // Zoho Books numeric org ID
//       dataCenter: string | null,         // "in" / "com" / …
//       scopeAreas: string[]               // friendly: Books, Invoices, Customers, …
//     }
//   }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getConnectionStatus,
  resolveOrgUserFromHeaders,
} from '@/lib/integrations/zoho-books';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { orgId, userId } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }
    const status = await getConnectionStatus(orgId, userId);
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error('[/api/integrations/zoho/status] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Status check failed.' },
      { status: 500 },
    );
  }
}
