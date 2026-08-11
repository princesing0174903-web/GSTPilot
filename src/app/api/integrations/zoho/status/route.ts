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
    // Status check is a SAFE READ — never throw 400 when auth context is
    // missing. Instead return a deterministic `connected: false` status so
    // the client UI shows "Not connected" (rather than a misleading
    // "credentials missing" error). The hook still retries once the
    // org/user context becomes available.
    if (!orgId || !userId) {
      return NextResponse.json({
        ok: true,
        status: {
          connected: false,
          userEmail: null,
          zohoUserId: null,
          connectedAt: null,
          lastConnectedAt: null,
          scopes: [],
          organizationName: null,
          zohoOrgId: null,
          dataCenter: null,
          scopeAreas: [],
          requiresReconnect: false,
          notConfigured: false,
          reason: null,
          requiresAuth: true,
        },
      });
    }
    const status = await getConnectionStatus(orgId, userId);
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error('[/api/integrations/zoho/status] error:', err);
    // Even on a server error, return `connected: false` rather than 500 —
    // a transient DB error should never make the UI report
    // "credentials not configured".
    return NextResponse.json({
      ok: true,
      status: {
        connected: false,
        userEmail: null,
        zohoUserId: null,
        connectedAt: null,
        lastConnectedAt: null,
        scopes: [],
        organizationName: null,
        zohoOrgId: null,
        dataCenter: null,
        scopeAreas: [],
        requiresReconnect: false,
        notConfigured: false,
        reason: null,
        requiresAuth: true,
      },
    });
  }
}
