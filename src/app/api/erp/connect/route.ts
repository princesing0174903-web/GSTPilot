// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — Connect API
//
// POST /api/erp/connect
//   Body: { organizationId, provider, companyName, companyId?, companyGstin?,
//           credentials, createdBy }
//   Returns: { ok: true, result: ConnectERPResult, complete: CompleteERPConnectionResult }
//
// For the mock providers, connect + completeConnection happen in one shot (no
// real OAuth flow). For future real providers (Zoho/QuickBooks OAuth), the
// client would call /connect first, redirect to the OAuth consent screen, then
// call /complete separately with the auth code. The mock path is optimized to
// do both in a single request so the UI is instant.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { connectERP, completeERPConnection } from '@/lib/erp-provider/server/orchestrator';
import { ERPError, friendlyERPError } from '@/lib/erp-provider/errors';
import type { ERPProviderName } from '@/lib/erp-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_PROVIDERS: ERPProviderName[] = ['tally', 'zoho_books', 'busy', 'quickbooks'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, provider, companyName, companyId, companyGstin, credentials, createdBy } =
      body as {
        organizationId?: string;
        provider?: ERPProviderName;
        companyName?: string;
        companyId?: string;
        companyGstin?: string;
        credentials?: Record<string, string>;
        createdBy?: { uid: string; name: string; email: string };
      };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { ok: false, error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
        { status: 400 },
      );
    }
    if (!companyName || companyName.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: 'Company name must be at least 2 characters.' },
        { status: 400 },
      );
    }
    if (!credentials || Object.keys(credentials).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'ERP credentials are required.' },
        { status: 400 },
      );
    }

    // Step 1: initiate the connection via the provider.
    const result = await connectERP({
      organizationId,
      provider,
      companyName: companyName.trim(),
      companyId: companyId?.trim() ?? '',
      companyGstin: companyGstin?.trim() || undefined,
      credentials,
      createdBy: createdBy ?? { uid: '', name: '', email: '' },
    });

    // Step 2: complete the connection (for mock this is instant; for OAuth
    // providers the client would call /complete separately after consent).
    let complete: { encryptedConnection: string; tokenExpiry: string; companyInfo: unknown } | null = null;
    try {
      const completed = await completeERPConnection(organizationId, result.connectionRef);
      complete = {
        encryptedConnection: completed.encryptedConnection,
        tokenExpiry: completed.tokenExpiry,
        companyInfo: completed.companyInfo,
      };
    } catch (err) {
      // If completion fails (e.g. OAuth consent still pending), return just the
      // connect result so the client can poll /complete later.
      console.warn('[api/erp/connect] completeConnection deferred:', friendlyERPError(err));
    }

    return NextResponse.json({ ok: true, result, complete });
  } catch (err) {
    const statusCode = err instanceof ERPError ? err.statusCode : 500;
    const code = err instanceof ERPError ? err.code : 'UNKNOWN';
    console.error('[api/erp/connect] error:', code, friendlyERPError(err));
    return NextResponse.json(
      { ok: false, error: friendlyERPError(err), code },
      { status: statusCode },
    );
  }
}
