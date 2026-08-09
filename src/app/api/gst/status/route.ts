// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst/status?organizationId=...
// ═══════════════════════════════════════════════════════════════════════════════
// Returns the canonical connection state for an org's GST integration.
// ONE source of truth — the UI must never show contradictory states.
//
// Response: {
//   ok: true,
//   status: {
//     mode: 'live' | 'sandbox' | 'demo' | 'not_connected',
//     providerKey, providerName, providerDisplayName,
//     gstin, legalName, tradeName,
//     modeLabel,           // "LIVE" | "SANDBOX" | "DEMO" | "NOT CONNECTED"
//     lastTestOk, lastTestedAt, lastTestMessage,
//     lastSyncAt,
//     tokenExpiry, tokenExpired,
//     configId,
//   }
// }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { modeLabel } from '@/lib/gst-reconciliation/server/provider-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required.', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const member = await requireOrgMembership(uid, organizationId);
    if (member instanceof NextResponse) return member;

    // Read the most-recently-updated enabled config.
    const configs = await db.gSPProviderConfig.findMany({
      where: { organizationId, enabled: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (configs.length === 0) {
      return NextResponse.json({
        ok: true,
        status: {
          mode: 'demo',
          modeLabel: 'DEMO',
          providerKey: 'mock',
          providerName: 'Demo (offline sample data)',
          providerDisplayName: 'Demo',
          gstin: null,
          legalName: null,
          tradeName: null,
          lastTestOk: null,
          lastTestedAt: null,
          lastTestMessage: null,
          lastSyncAt: null,
          tokenExpiry: null,
          tokenExpired: false,
          configId: null,
        },
      });
    }

    const cfg = configs[0];
    const isMock = cfg.providerKey === 'mock';
    const tokenExpiry = cfg.tokenExpiry;
    const tokenExpired = tokenExpiry ? tokenExpiry.getTime() < Date.now() : false;

    // Mode resolution — mirrors provider-mode.ts but inline for the status route
    // so we can surface token-expired as a distinct state.
    let mode: 'live' | 'sandbox' | 'demo' | 'not_connected';
    if (isMock) {
      mode = 'demo';
    } else if (!cfg.lastConnectedAt || !cfg.lastTestOk) {
      mode = 'not_connected';
    } else if (tokenExpired) {
      // Configured + tested, but token expired — treat as not_connected for data
      // purposes (the UI shows a prominent "reconnect" banner).
      mode = 'not_connected';
    } else {
      mode = cfg.mode === 'production' ? 'live' : 'sandbox';
    }

    return NextResponse.json({
      ok: true,
      status: {
        mode,
        modeLabel: modeLabel(mode),
        providerKey: cfg.providerKey,
        providerName: cfg.displayName,
        providerDisplayName: cfg.displayName,
        gstin: cfg.gstin,
        legalName: cfg.legalName,
        tradeName: cfg.tradeName,
        lastTestOk: cfg.lastTestOk,
        lastTestedAt: cfg.lastConnectedAt?.toISOString() ?? null,
        lastTestMessage: cfg.lastTestMessage,
        lastSyncAt: cfg.lastSyncAt?.toISOString() ?? null,
        tokenExpiry: tokenExpiry?.toISOString() ?? null,
        tokenExpired,
        configId: cfg.id,
      },
    });
  } catch (error) {
    return friendlyApiError(error, 'Unable to load GST connection status.');
  }
}
