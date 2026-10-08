// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Banking Consents API
//
// GET /api/banking/consents?organizationId=...
//   Returns the consent management state for the org:
//     - activeConsents: connections with status='connected' or 'consent_pending'
//     - consentHistory: connections with status='disconnected' or 'expired'
//     - events: lifecycle event log (placeholder — populated post-credentials)
//     - setuConfigured: whether SETU_* env vars are present
//     - providerLive: whether the active provider is live
//
// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️  PREPARATION MODE  ⚠️
// ═══════════════════════════════════════════════════════════════════════════════
//
// This route reads from the EXISTING bank_connections Firestore collection
// (which the Mock provider writes to). It maps BankConnection → BankConsent
// using the fields already available (status, consentExpiry, accountNumberMasked).
//
// The consentId / vua / linkedAccounts fields are null for Mock connections
// (Mock has no real AA consent). When Setu is live, these will be populated
// from the decrypted session metadata (session.metadata.consentId, etc.).
//
// This route does NOT make any Setu API calls. It only reads Firestore.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { describeProvider } from '@/lib/banking-provider/server/registry';
import { isSetuConfigured } from '@/lib/setu/utils';
import type { BankConnectionStatus } from '@/lib/banking-provider/types';
import type {
  BankConsent,
  ConsentManagementState,
  ConsentStatus,
} from '@/lib/banking-provider/consent-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Map a BankConnectionStatus to a ConsentStatus.
 * Mock connections are always 'active' (no real consent flow).
 */
function mapStatus(status: BankConnectionStatus): ConsentStatus {
  switch (status) {
    case 'connected':
    case 'consent_pending':
      return status === 'consent_pending' ? 'pending' : 'active';
    case 'expired':
      return 'expired';
    case 'disconnected':
      return 'revoked';
    case 'error':
      return 'revoked'; // treat error as revoked for UI purposes
    default:
      return 'revoked';
  }
}

function daysUntil(isoDate: string | null): number {
  if (!isoDate) return -1;
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Fetch bank connections from Firestore for the org and map them to BankConsent.
 *
 * PREPARATION MODE: This currently returns an empty list because the
 * Firestore service layer is client-side (the banking-provider/service.ts
 * uses client SDKs + onSnapshot). The server-side route can't easily read
 * Firestore without the Admin SDK. When Setu goes live, we'll either:
 *   (a) Add a server-side Firestore reader using the Admin SDK, OR
 *   (b) Have the client pass its existing bank_connections list to this route
 *       for enrichment (adding consentId/vua from the decrypted session).
 *
 * For now, the client should construct the ConsentManagementState from its
 * existing useBanking() data + call this route only for the providerLive /
 * setuConfigured flags.
 */
async function fetchConsents(
  _organizationId: string,
): Promise<{ activeConsents: BankConsent[]; consentHistory: BankConsent[] }> {
  // TODO(post-credentials): implement server-side Firestore read via Admin SDK.
  // For now, return empty — the client will build the list from useBanking() data.
  void _organizationId;
  return { activeConsents: [], consentHistory: [] };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const organizationId = req.nextUrl.searchParams.get('organizationId') ?? 'local';
    const orgResult = await requireOrgMembership(uid, organizationId);
    if (orgResult instanceof NextResponse) return orgResult;

    // Fetch consents (empty in preparation mode — see fetchConsents doc).
    const { activeConsents, consentHistory } = await fetchConsents(organizationId);

    // Provider diagnostics.
    const providerDesc = describeProvider();
    const setuConfigured = isSetuConfigured();

    const state: ConsentManagementState = {
      activeConsents,
      consentHistory,
      events: [], // TODO(post-credentials): populate from audit log.
      setuConfigured,
      providerLive: providerDesc.isLive,
    };

    return NextResponse.json({ ok: true, state });
  } catch (err) {
    return friendlyApiError(err, 'We could not load your consents right now.');
  }
}
