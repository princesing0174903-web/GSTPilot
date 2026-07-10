// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — FutureOfficialGSTProvider (SERVER-ONLY)
//
// The placeholder for the real production GSTN API integration. Every method
// throws `NotImplementedError` so the system fails LOUDLY if you switch to this
// provider before implementing the real HTTP calls.
//
// WHEN YOU'RE READY TO GO LIVE:
//   1. Set env: GSTN_PROVIDER=official, GSTN_CLIENT_ID, GSTN_CLIENT_SECRET,
//      GSTN_AUTH_BASE_URL, GSTN_API_BASE_URL, GSTN_ENCRYPTION_KEY
//   2. Implement each method below to call the real GSTN endpoints. The
//      request/response shapes are documented inline.
//   3. The service layer, hooks, and UI DO NOT CHANGE — they only talk to
//      IGSTProvider. That's the whole point of the provider pattern.
//
// This file is SERVER-ONLY (it will hold real HTTP client code + secrets).
// ═══════════════════════════════════════════════════════════════════════════════

import type { IGSTProvider, GSTSession, FileReturnInput, FileReturnResult } from '../provider';
import type {
  ConnectResult,
  GSTLedger,
  GSTNotice,
  GSTProfile,
  GSTReturn,
  GSTReturnType,
  VerifyGSTINResult,
} from '../types';
import { NotImplementedError } from '../errors';

/**
 * Future provider that will call the official GSTN REST APIs.
 *
 * Every method throws NotImplementedError today. When you implement each
 * method, replace the throw with a real `fetch()` call to the GSTN endpoint.
 * The contract (input/output shapes) is identical to MockGSTProvider, so the
 * service layer doesn't change.
 *
 * Reference docs (GSTN API Sandbox):
 *   - Authentication: https://developer.gst.gov.in/apiportal/api/apiHelp?section=auth
 *   - GSTR-1: https://developer.gst.gov.in/apiportal/api/apiHelp?section=gstr1
 *   - GSTR-2B: https://developer.gst.gov.in/apiportal/api/apiHelp?section=gstr2b
 *   - GSTR-3B: https://developer.gst.gov.in/apiportal/api/apiHelp?section=gstr3b
 *   - Ledgers: https://developer.gst.gov.in/apiportal/api/apiHelp?section=ledgers
 *   - Notices: https://developer.gst.gov.in/apiportal/api/apiHelp?section=notices
 */
export class FutureOfficialGSTProvider implements IGSTProvider {
  readonly name = 'Official GSTN Provider (not yet implemented)';
  readonly isLive = true;

  /**
   * Configuration resolved from env. Throws if required env vars are missing.
   * This is intentionally called lazily (not at construction) so the provider
   * can be instantiated even without env config — only actual method calls
   * surface the missing config.
   */
  private getConfig(): {
    clientId: string;
    clientSecret: string;
    authBaseUrl: string;
    apiBaseUrl: string;
  } {
    const clientId = process.env.GSTN_CLIENT_ID;
    const clientSecret = process.env.GSTN_CLIENT_SECRET;
    const authBaseUrl = process.env.GSTN_AUTH_BASE_URL ?? 'https://api.gst.gov.in';
    const apiBaseUrl = process.env.GSTN_API_BASE_URL ?? 'https://api.gst.gov.in';

    if (!clientId || !clientSecret) {
      throw new NotImplementedError('Official GSTN authentication');
    }
    return { clientId, clientSecret, authBaseUrl, apiBaseUrl };
  }

  /**
   * POST /taxpayerapi/v1.0/authenticate → request OTP.
   * Request body: { action: 'OTPREQUEST', app_key, username, gstin }
   * Response: { status, txnId, ... }
   */
  async requestOTP(gstin: string, username: string): Promise<ConnectResult> {
    void this.getConfig();
    void gstin;
    void username;
    throw new NotImplementedError('GSTN requestOTP');
  }

  /**
   * POST /taxpayerapi/v1.0/authenticate → verify OTP + get JWT session.
   * Request body: { action: 'AUTHTOKEN', app_key, username, otp, txnId }
   * Response: { auth_token, expires_in, refresh_token, ... }
   */
  async verifyOTP(
    gstin: string,
    username: string,
    otp: string,
  ): Promise<{ session: GSTSession; profile: Partial<GSTProfile> }> {
    void this.getConfig();
    void gstin;
    void username;
    void otp;
    throw new NotImplementedError('GSTN verifyOTP');
  }

  /**
   * POST /taxpayerapi/v1.0/authenticate → refresh session.
   * Request body: { action: 'REFRESHTOKEN', app_key, refresh_token, username }
   */
  async refreshSession(session: GSTSession): Promise<{ session: GSTSession }> {
    void this.getConfig();
    void session;
    throw new NotImplementedError('GSTN refreshSession');
  }

  /**
   * POST /taxpayerapi/v1.0/authenticate → revoke session.
   */
  async disconnect(session: GSTSession): Promise<void> {
    void this.getConfig();
    void session;
    throw new NotImplementedError('GSTN disconnect');
  }

  /**
   * GET /commonapi/v1.0/search → public GSTIN lookup.
   * Query: ?Action=TP&Gstin={gstin}
   * No session required — uses client credentials.
   */
  async verifyGSTIN(gstin: string): Promise<VerifyGSTINResult> {
    void this.getConfig();
    void gstin;
    throw new NotImplementedError('GSTN verifyGSTIN');
  }

  /**
   * GET /taxpayerapi/v1.0/profile → taxpayer profile.
   * Headers: { Authorization: 'Bearer {auth_token}', gstin, ... }
   */
  async getProfile(session: GSTSession): Promise<GSTProfile> {
    void this.getConfig();
    void session;
    throw new NotImplementedError('GSTN getProfile');
  }

  /**
   * GET /taxpayerapi/v1.0/returns/gstr1 → GSTR-1 filings.
   * GET /taxpayerapi/v1.0/returns/gstr3b → GSTR-3B filings.
   * GET /taxpayerapi/v1.0/returns/gstr2b → GSTR-2B (auto-drafted).
   * Query: ?ret_period={period}&gstin={gstin}&action=FILEDETAILS
   */
  async syncReturns(
    session: GSTSession,
    options?: { period?: string; returnTypes?: GSTReturnType[] },
  ): Promise<{ returns: GSTReturn[] }> {
    void this.getConfig();
    void session;
    void options;
    throw new NotImplementedError('GSTN syncReturns');
  }

  /**
   * GET /taxpayerapi/v1.0/notices → notices / orders / communications.
   */
  async syncNotices(session: GSTSession): Promise<{ notices: GSTNotice[] }> {
    void this.getConfig();
    void session;
    throw new NotImplementedError('GSTN syncNotices');
  }

  /**
   * GET /taxpayerapi/v1.0/ledgers/cash → Electronic Cash Ledger.
   * GET /taxpayerapi/v1.0/ledgers/credit → Electronic Credit Ledger.
   * GET /taxpayerapi/v1.0/ledgers/liability → Liability Ledger.
   */
  async syncLedgers(session: GSTSession): Promise<{
    cash: GSTLedger;
    credit: GSTLedger;
    liability: GSTLedger;
  }> {
    void this.getConfig();
    void session;
    throw new NotImplementedError('GSTN syncLedgers');
  }

  async healthCheck(): Promise<boolean> {
    // Once implemented, ping the GSTN health endpoint.
    // For now, return false so the scheduler doesn't try to use this provider.
    return false;
  }

  /**
   * POST /taxpayerapi/v1.0/returns/gstr1 → file GSTR-1.
   * POST /taxpayerapi/v1.0/returns/gstr3b → file GSTR-3B.
   *
   * CRITICAL: This method MUST return a real ARN from GSTN. It must NEVER
   * generate a fake/simulated ARN. The return is only marked "filed" when
   * GSTN returns a real acknowledgment number.
   *
   * Implementation steps when going live:
   * 1. Encrypt the payload with the app key (AES-256)
   * 2. POST to the GSTN filing endpoint with the auth token
   * 3. Parse the response for the ARN (acknowledgment number)
   * 4. Return { arn, acknowledgedAt, status }
   * 5. If GSTN returns an error, throw — the caller must NOT mark as filed
   */
  async fileReturn(
    session: GSTSession,
    input: FileReturnInput,
  ): Promise<FileReturnResult> {
    void this.getConfig();
    void session;
    void input;
    throw new NotImplementedError('GSTN fileReturn');
  }
}
