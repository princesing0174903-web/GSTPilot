// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Generic Web GSP Provider (SERVER-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
//
// A generic GSP provider that connects to ANY standards-compliant GSP gateway
// via a base URL + bearer token. The expected response shape is the GSTPilot
// canonical GSTR2B JSON (documented in /docs/gsp-contract.md), which mirrors
// the fields returned by MastersIndia/ClearTax after normalization.
//
// This lets orgs plug in ClearTax, Clarity, GST Suvidha, or their own internal
// gateway without writing a dedicated provider class.
//
// This file is SERVER-ONLY.
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

export interface GenericWebConfig {
  /** Bearer token / API key used for authentication. */
  apikey: string;
  /** Base URL of the GSP gateway. */
  apiEndpoint: string;
  /** 'sandbox' | 'production' */
  mode: 'sandbox' | 'production';
}

const DEFAULT_TIMEOUT_MS = 30_000;

async function fetchJson<T>(url: string, opts: {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  timeoutMs?: number;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: opts.method,
      headers: { Accept: 'application/json', ...opts.headers },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      throw new GSPAuthError('generic', 'Authentication failed — check your API key.');
    }
    if (res.status === 429) {
      throw new GSPRateLimitError('generic', 'Rate limit exceeded. Please retry shortly.');
    }
    if (res.status >= 502) {
      throw new GSPGSTNOutageError('generic', 'The GSP gateway is temporarily unavailable.');
    }
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    if (!res.ok) {
      const msg = (parsed && typeof parsed === 'object' && 'message' in parsed && typeof (parsed as { message: unknown }).message === 'string')
        ? (parsed as { message: string }).message
        : `GSP request failed (HTTP ${res.status}).`;
      throw new GSPError(msg, 'GSP_REQUEST_FAILED', 'generic', res.status);
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof GSPError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GSPError('The request timed out. Please try again.', 'GSP_TIMEOUT', 'generic', 504);
    }
    throw new GSPError('Unable to reach the GSP gateway. Check your network.', 'GSP_NETWORK_ERROR', 'generic', 502);
  } finally {
    clearTimeout(timeout);
  }
}

function num(v: unknown): number {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
  return 0;
}

interface Generic2bResponse {
  gstin?: string;
  period?: string;
  generatedAt?: string;
  records?: Array<Record<string, unknown>>;
  error?: string | { message?: string };
}

export class GenericWebGSPProvider implements IGSPProvider {
  readonly key = 'generic';
  readonly displayName = 'Custom GSP (HTTP API)';

  constructor(private config: GenericWebConfig | undefined | null) {}

  private assertConfig(): asserts this is { config: GenericWebConfig } {
    if (!this.config || !this.config.apikey || !this.config.apiEndpoint) {
      throw new GSPConfigError('generic', 'Custom GSP is not configured. Provide an API key and endpoint URL.');
    }
  }

  async testConnection(): Promise<GSPConnectionTest> {
    try { this.assertConfig(); } catch (err) {
      return { ok: false, provider: this.key, message: err instanceof Error ? err.message : 'Configuration error.' };
    }
    const start = Date.now();
    try {
      const base = this.config!.apiEndpoint.replace(/\/$/, '');
      // Ping the gateway's health endpoint (if it has one); otherwise a 404
      // still proves the host is reachable + auth is valid (401 vs 404).
      await fetchJson<{ status?: string }>(`${base}/health`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.config!.apikey}` },
        timeoutMs: 10_000,
      });
      return { ok: true, provider: this.key, message: `Connected to custom GSP (${this.config!.mode}) successfully.`, latencyMs: Date.now() - start };
    } catch (err) {
      // A 404 is OK — the host responded, auth just may not have a /health.
      if (err instanceof GSPError && err.code === 'GSP_REQUEST_FAILED' && err.statusCode === 404) {
        return { ok: true, provider: this.key, message: `Gateway reachable (${this.config!.mode}).`, latencyMs: Date.now() - start };
      }
      return { ok: false, provider: this.key, message: err instanceof GSPError ? err.message : 'Connection test failed.', latencyMs: Date.now() - start };
    }
  }

  async authenticate(): Promise<GSPSession> {
    this.assertConfig();
    // Generic GSP uses the API key directly as the bearer token — no OAuth.
    return {
      accessToken: this.config!.apikey,
      clientId: 'generic',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { provider: this.key, mode: this.config!.mode },
    };
  }

  async fetchGSTR2B(session: GSPSession, gstin: string, period: string): Promise<GSTR2BFetchResult> {
    this.assertConfig();
    if (!gstin || gstin.length !== 15) {
      throw new GSPError('A valid 15-character GSTIN is required.', 'INVALID_GSTIN', this.key, 400);
    }
    const base = this.config!.apiEndpoint.replace(/\/$/, '');
    const url = `${base}/gstr2b?gstin=${encodeURIComponent(gstin)}&period=${encodeURIComponent(period)}`;
    const res = await fetchJson<Generic2bResponse>(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (res.error) {
      const msg = typeof res.error === 'string' ? res.error : res.error.message ?? 'GSTR-2B fetch failed.';
      if (/not available|no data|not found/i.test(msg)) {
        throw new GSPNotFoundError('generic', `GSTR-2B for period ${period} is not yet available.`);
      }
      throw new GSPError(msg, 'GSP_GSTR2B_FAILED', this.key, 502);
    }

    const rawRecords = res.records ?? [];
    const records: GSTR2BRecord[] = rawRecords.map((r) => ({
      supplierGSTIN: String(r.supplierGSTIN ?? r.supplier_gstin ?? ''),
      supplierName: r.supplierName ? String(r.supplierName) : (r.supplier_name ? String(r.supplier_name) : undefined),
      invoiceNo: String(r.invoiceNo ?? r.invoice_no ?? ''),
      invoiceDate: r.invoiceDate ? String(r.invoiceDate) : (r.invoice_date ? String(r.invoice_date) : undefined),
      taxableValue: num(r.taxableValue ?? r.taxable_value),
      igst: num(r.igst),
      cgst: num(r.cgst),
      sgst: num(r.sgst),
      cess: num(r.cess),
      itcAvailable: num(r.itcAvailable ?? r.itc_available ?? (num(r.igst) + num(r.cgst) + num(r.sgst) + num(r.cess))),
      itcEligible: r.itcEligible !== false && r.itc_eligible !== false,
      docType: r.docType ? String(r.docType) : 'invoice',
      uploadStatus: r.uploadStatus ? String(r.uploadStatus) : 'Uploaded',
    }));

    return {
      gstin,
      period,
      records,
      totalRecords: records.length,
      generatedAt: res.generatedAt ?? new Date().toISOString(),
      isLive: true,
      metadata: { provider: this.key, mode: this.config!.mode, source: 'generic-web' },
    };
  }
}
