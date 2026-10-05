// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Connect API
//
// POST /api/banking/connect
//   Body: { organizationId, provider?, accountHolder, bankName, accountNumber,
//           ifsc, accountType }
//   Returns:
//     - Mock provider: { ok, result, complete } — instant connect + complete.
//     - Setu AA provider: { ok, result, complete: null } — result.redirectUrl is
//       the Setu consent webview URL. The client must open it; the connection
//       completes later (via webhook or /api/banking/complete).
//
// Auth: requireAuth + requireOrgMembership. The `createdBy` field is taken from
// the authed session (NOT the request body) to prevent uid forgery.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { connectBank, completeBankConnection } from '@/lib/banking-provider/server/orchestrator';
import { getProviderName } from '@/lib/banking-provider/server/registry';
import { BankingError, friendlyBankingError } from '@/lib/banking-provider/errors';
import type { BankProviderName } from '@/lib/banking-provider/types';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid, email } = auth;

    // 2. Parse body (only AFTER auth — never trust body.uid)
    const body = await req.json();
    const {
      organizationId,
      provider,
      accountHolder,
      bankName,
      accountNumber,
      ifsc,
      accountType,
    } = body as {
      organizationId?: string;
      provider?: BankProviderName;
      accountHolder?: string;
      bankName?: string;
      accountNumber?: string;
      ifsc?: string;
      accountType?: 'savings' | 'current' | 'credit' | 'loan' | 'unknown';
    };

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required' },
        { status: 400 },
      );
    }

    // 3. Verify org membership
    const org = await requireOrgMembership(uid, organizationId);
    if (org instanceof NextResponse) return org;

    // 4. Validate input
    if (!accountHolder || accountHolder.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: 'Account holder name must be at least 2 characters.' },
        { status: 400 },
      );
    }
    if (!accountNumber || accountNumber.replace(/\s+/g, '').length < 4) {
      return NextResponse.json(
        { ok: false, error: 'A valid account number (or mobile number for AA) is required.' },
        { status: 400 },
      );
    }
    if (!ifsc || ifsc.trim().length < 8) {
      // For AA providers, IFSC is not required upfront (the bank is discovered
      // post-consent). Only enforce for non-AA providers.
      const providerName: BankProviderName = provider ?? getProviderName();
      if (providerName !== 'setu' && providerName !== 'aa' && providerName !== 'finvu') {
        return NextResponse.json(
          { ok: false, error: 'A valid IFSC code is required.' },
          { status: 400 },
        );
      }
    }

    const providerName: BankProviderName = provider ?? getProviderName();

    // 5. Initiate the connection via the provider.
    //    createdBy comes from the AUTHED session — never from the body.
    const createdBy = {
      uid,
      name: accountHolder.trim(),
      email: email ?? '',
    };

    const result = await connectBank({
      organizationId,
      provider: providerName,
      accountHolder: accountHolder.trim(),
      bankName: bankName?.trim() ?? '',
      accountNumber: accountNumber.trim(),
      ifsc: ifsc?.trim().toUpperCase() ?? '',
      accountType: accountType ?? 'unknown',
      createdBy,
    });

    // 6. Complete the connection.
    //    - For Mock / direct providers (no redirectUrl): complete immediately.
    //    - For AA providers (redirectUrl present): do NOT auto-complete — the
    //      user must approve consent first. The client opens redirectUrl; the
    //      connection completes via webhook or /api/banking/complete.
    let complete: {
      encryptedConnection: string;
      consentExpiry: string;
      accountSnapshot: unknown;
    } | null = null;

    if (!result.redirectUrl) {
      // Instant-complete path (Mock, or a direct-bank provider).
      try {
        const completed = await completeBankConnection(organizationId, result.connectionRef);
        complete = {
          encryptedConnection: completed.encryptedConnection,
          consentExpiry: completed.consentExpiry,
          accountSnapshot: completed.accountSnapshot,
        };
      } catch (err) {
        console.warn(
          '[api/banking/connect] completeConnection deferred:',
          friendlyBankingError(err),
        );
      }
    } else {
      // AA deferred-completion path. The connection is NOT complete.
      // The frontend should open result.redirectUrl and then either:
      //   (a) wait for the /api/webhooks/setu webhook to fire, OR
      //   (b) poll POST /api/banking/complete?connectionRef=...

      // Persist the consent to the SetuConsent table so the webhook can map
      // consentId → organizationId when Setu fires CONSENT_STATUS_UPDATE.
      if (providerName === 'setu') {
        try {
          await db.setuConsent.create({
            data: {
              organizationId,
              consentId: result.connectionRef,
              vua: accountNumber.trim(),
              createdByUid: uid,
              status: 'INITIATED',
              approvalUrl: result.redirectUrl,
            },
          });
        } catch (err) {
          // Non-fatal — the consent is still valid in Setu; we just can't
          // correlate the webhook. Log and continue.
          console.warn(
            '[api/banking/connect] Failed to persist SetuConsent row:',
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      console.log(
        '[api/banking/connect] AA consent initiated — redirectUrl returned, completion deferred.',
        { connectionRef: result.connectionRef },
      );
    }

    return NextResponse.json({ ok: true, result, complete });
  } catch (err) {
    const statusCode = err instanceof BankingError ? err.statusCode : 500;
    const code = err instanceof BankingError ? err.code : 'UNKNOWN';
    console.error('[api/banking/connect] error:', code, friendlyBankingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBankingError(err), code },
      { status: statusCode },
    );
  }
}
