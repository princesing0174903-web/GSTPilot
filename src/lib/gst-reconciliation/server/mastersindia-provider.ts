// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — MastersIndia GSP Provider (SERVER-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
//
// A REAL production GSP provider implementation that calls the MastersIndia
// (mastersindia.co) GST Suvidha Provider API over HTTPS.
//
// MastersIndia is one of the officially licensed GSPs in India. Their API
// proxies authenticated requests to the GSTN portal for:
//   • GSTIN search (public taxpayer lookup)
//   • GSTR-2B retrieval (auto-drafted input tax credit)
//   • GSTR-1 / GSTR-3B filing-status retrieval
//
// This provider implements the IGSPProvider contract so the reconciliation
// engine and all GST routes work unchanged.
//
// CONFIGURATION (stored encrypted in GSPProviderConfig):
//   • clientId        — MastersIndia client id
//   • clientSecret    — MastersIndia client secret (encrypted at rest)
//   • apikey          — MastersIndia API key
//   • apiEndpoint     — base URL (sandbox vs production)
//
// ENVIRONMENT:
//   MastersIndia provides a sandbox at https://api.mastersindia.co and a
//   production endpoint. The `mode` field on GSPProviderConfig selects which.
//
// SECURITY:
//   • This file is SERVER-ONLY — it holds real HTTP client logic + secrets.
//   • Secrets are read from the passed config object (decrypted by the caller).
//   • Nothing is logged that could leak a secret (tokens are masked).
//   • All network calls have a hard timeout (30s default).
//
// Reference: https://docs.mastersindia.co/
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  IGSPProvider,
  GSPSession,
  GSTR2BFetchResult,
  GSTR2BRecord,
  GSPConnectionTest,
} from '../types';
import {
  GSPAuthError,
  GSPConfigError,
  GSPError,
  GSPGSTNOutageError,
  GSPNotFoundError,
  GSPRateLimitError,
} from '../errors';

// ─── Provider config shape (decrypted by the caller) ─────────────────────────

export interface MastersIndiaConfig {
  clientId: string;
  clientSecret: string;
  apikey: string;
  /** Sandbox or production base URL. */
  apiEndpoint: string;
  /** 'sandbox' | 'production' — only affects the display name. */
  mode: 'sandbox' | 'production';
}

const DEFAULT_TIMEOUT_MS = 30_000;

// ─── HTTP helper with timeout + typed errors ─────────────────────────────────

interface FetchJsonOptions {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });

    // Handle non-2xx responses with typed errors.
    if (res.status === 401 || res.status === 403) {
      throw new GSPAuthError('mastersindia', 'Authentication failed — check your client id, secret, and API key.');
    }
    if (res.status === 429) {
      throw new GSPRateLimitError('mastersindia', 'MastersIndia rate limit exceeded. Please retry in a few minutes.');
    }
    if (res.status >= 502 && res.status < 600) {
      throw new GSPGSTNOutageError('mastersindia', 'The GST portal or MastersIndia is temporarily unavailable.');
    }

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      // Extract a human-friendly message from common MastersIndia error shapes.
      const msg =
        (parsed && typeof parsed === 'object' && 'message' in parsed && typeof (parsed as { message: unknown }).message === 'string')
          ? (parsed as { message: string }).message
          : `MastersIndia request failed (HTTP ${res.status}).`;
      throw new GSPError(msg, 'GSP_REQUEST_FAILED', 'mastersindia', res.status);
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof GSPError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GSPError(
        'The request to MastersIndia timed out. Please try again.',
        'GSP_TIMEOUT',
        'mastersindia',
        504,
      );
    }
    throw new GSPError(
      'Unable to reach MastersIndia. Please check your network and try again.',
      'GSP_NETWORK_ERROR',
      'mastersindia',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ─── MastersIndia API response shapes ────────────────────────────────────────

interface MIAuthResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface MIGstinResponse {
  status?: string;
  ctin?: {
    gstin?: string;
    lgnm?: string;
    tradeNam?: string;
    stateCode?: string;
    sts?: string;
    dty?: string;
    regdt?: string;
  };
  data?: Record<string, unknown>;
  error?: string | { message?: string };
}

interface MIGstr2bResponse {
  status?: string;
  data?: {
    gstin?: string;
    fp?: string; // filing period YYYYMM
    b2b?: Array<{
      inum?: string;
      idt?: string;
      txval?: number | string;
      igst?: number | string;
      cgst?: number | string;
      sgst?: number | string;
      cess?: number | string;
      itc?: {
        txval?: number | string;
        igst?: number | string;
        cgst?: number | string;
        sgst?: number | string;
        cess?: number | string;
        elg?: string;
      };
      pos?: string;
      rchrg?: string;
      inv_typ?: string;
      cfs?: string;
      ctim?: string;
      cnct?: string;
    }>;
    // MastersIndia sometimes nests records differently — normalize defensively.
  };
  error?: string | { message?: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : Math.round(n * 100) / 100;
  }
  return 0;
}

function assertConfig(cfg: MastersIndiaConfig | undefined | null): asserts cfg is MastersIndiaConfig {
  if (!cfg || !cfg.clientId || !cfg.clientSecret || !cfg.apikey || !cfg.apiEndpoint) {
    throw new GSPConfigError('mastersindia', 'MastersIndia is not fully configured. Provide client id, secret, API key, and endpoint.');
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class MastersIndiaGSPProvider implements IGSPProvider {
  readonly key = 'mastersindia';
  readonly displayName = 'MastersIndia GSP';

  constructor(private config: MastersIndiaConfig | undefined | null) {}

  async testConnection(): Promise<GSPConnectionTest> {
    try {
      assertConfig(this.config);
    } catch (err) {
      return {
        ok: false,
        provider: this.key,
        message: err instanceof Error ? err.message : 'Configuration error.',
      };
    }
    const start = Date.now();
    try {
      // Attempt to authenticate — if this succeeds, the credentials are valid.
      const session = await this.authenticate(this.config!);
      return {
        ok: true,
        provider: this.key,
        message: `Connected to MastersIndia (${this.config!.mode}) successfully.`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        ok: false,
        provider: this.key,
        message: err instanceof GSPError ? err.message : 'Connection test failed.',
        latencyMs: Date.now() - start,
      };
    }
  }

  async authenticate(
    _config: { clientId?: string; clientSecret?: string; apikey?: string; authEndpoint?: string },
  ): Promise<GSPSession> {
    assertConfig(this.config);
    const { clientId, clientSecret, apikey, apiEndpoint, mode } = this.config;

    // MastersIndia auth endpoint — POST OAuth2 client-credentials grant.
    const authUrl = `${apiEndpoint.replace(/\/$/, '')}/oauth/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetchJson<MIAuthResponse>(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.access_token) {
      throw new GSPAuthError('mastersindia', res.error_description || res.error || 'Authentication failed.');
    }

    const expiresInSec = res.expires_in ?? 3600;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    return {
      accessToken: res.access_token,
      clientId,
      expiresAt,
      metadata: {
        provider: this.key,
        mode,
        tokenType: res.token_type ?? 'Bearer',
        apikeyMasked: apikey.slice(0, 4) + '••••' + apikey.slice(-4),
      },
    };
  }

  async fetchGSTR2B(session: GSPSession, gstin: string, period: string): Promise<GSTR2BFetchResult> {
    assertConfig(this.config);
    if (!gstin || gstin.length !== 15) {
      throw new GSPError('A valid 15-character GSTIN is required.', 'INVALID_GSTIN', this.key, 400);
    }
    // period is YYYY-MM; MastersIndia expects YYYYMM.
    const miPeriod = period.replace('-', '');
    const base = this.config!.apiEndpoint.replace(/\/$/, '');
    const url = `${base}/gstr2b/getGSTR2B?gstin=${encodeURIComponent(gstin)}&ret_period=${encodeURIComponent(miPeriod)}`;

    const res = await fetchJson<MIGstr2bResponse>(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        apikey: this.config!.apikey,
      },
    });

    if (res.error) {
      const msg = typeof res.error === 'string' ? res.error : res.error.message ?? 'GSTR-2B fetch failed.';
      if (/not available|no data|not found/i.test(msg)) {
        throw new GSPNotFoundError('mastersindia', `GSTR-2B for period ${period} is not yet available on GSTN.`);
      }
      throw new GSPError(msg, 'GSP_GSTR2B_FAILED', this.key, 502);
    }

    // Normalize provider-specific response into our canonical GSTR2BRecord[].
    const rawB2b = res.data?.b2b ?? [];
    const records: GSTR2BRecord[] = rawB2b.map((b) => ({
      supplierGSTIN: b.ctim || gstin,
      supplierName: undefined,
      invoiceNo: b.inum || '',
      invoiceDate: b.idt || undefined,
      taxableValue: num(b.txval),
      igst: num(b.igst),
      cgst: num(b.cgst),
      sgst: num(b.sgst),
      cess: num(b.cess),
      itcAvailable: num(b.itc?.igst) + num(b.itc?.cgst) + num(b.itc?.sgst) + num(b.itc?.cess),
      itcEligible: (b.itc?.elg ?? 'Y').toUpperCase().startsWith('Y'),
      docType: 'invoice',
      uploadStatus: b.cfs || 'Uploaded',
    }));

    return {
      gstin,
      period,
      records,
      totalRecords: records.length,
      generatedAt: new Date().toISOString(),
      isLive: true,
      metadata: {
        provider: this.key,
        mode: this.config!.mode,
        source: 'mastersindia',
      },
    };
  }

  /**
   * Public GSTIN verification through MastersIndia (no session needed — uses
   * client credentials to fetch an access token, then calls the search API).
   * Used by the Settings "Verify GSTIN" button.
   */
  async verifyGSTIN(gstin: string): Promise<{
    gstin: string;
    legalName: string;
    tradeName: string;
    stateCode: string;
    status: string;
  }> {
    assertConfig(this.config);
    if (!gstin || gstin.length !== 15) {
      throw new GSPError('A valid 15-character GSTIN is required.', 'INVALID_GSTIN', this.key, 400);
    }
    const session = await this.authenticate(this.config!);
    const base = this.config!.apiEndpoint.replace(/\/$/, '');
    const url = `${base}/gstin/search?gstin=${encodeURIComponent(gstin)}`;
    const res = await fetchJson<MIGstinResponse>(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        apikey: this.config!.apikey,
      },
    });

    if (res.error) {
      const msg = typeof res.error === 'string' ? res.error : res.error.message ?? 'GSTIN lookup failed.';
      throw new GSPError(msg, 'GSP_GSTIN_FAILED', this.key, 502);
    }

    const c = res.ctin ?? {};
    return {
      gstin: c.gstin ?? gstin.toUpperCase(),
      legalName: c.lgnm ?? '',
      tradeName: c.tradeNam ?? '',
      stateCode: c.stateCode ?? gstin.slice(0, 2),
      status: c.sts ?? 'Unknown',
    };
  }
}
