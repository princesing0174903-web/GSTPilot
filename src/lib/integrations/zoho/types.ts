// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Zoho Books Integration: Type Definitions (server-only)
// ═══════════════════════════════════════════════════════════════════════════════
// Centralized types for the Zoho Books OAuth + API surface. Kept separate from
// `oauth.ts` so client hooks can import just the type shapes (when needed) without
// pulling in server-only modules.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';

// ── Data Center ──────────────────────────────────────────────────────────────

/** Zoho data center identifiers (lowercase). */
export type ZohoDataCenter = 'in' | 'com' | 'eu' | 'au' | 'jp' | 'ca';

/** Per-DC endpoints. `authBaseUrl` is the accounts subdomain (no path). */
export interface ZohoEndpoints {
  /** e.g. `https://accounts.zoho.in` */
  authBaseUrl: string;
  /** e.g. `https://accounts.zoho.in/oauth/v2/token` */
  tokenUrl: string;
  /** e.g. `https://www.zohoapis.in/books/v3` */
  apiBaseUrl: string;
  /** The DC identifier (`in` | `com` | `eu` | `au` | `jp` | `ca`). */
  dataCenter: ZohoDataCenter;
}

// ── OAuth Config ─────────────────────────────────────────────────────────────

export interface ZohoOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  endpoints: ZohoEndpoints;
}

// ── OAuth State Payload ──────────────────────────────────────────────────────

export interface ZohoOAuthStatePayload {
  orgId: string;
  userId: string;
  userEmail: string | null;
  returnPath: string | null;
  redirectUri: string;
}

// ── Token Exchange ───────────────────────────────────────────────────────────

/** Raw Zoho token endpoint response (auth code exchange or refresh). */
export interface ZohoTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number; // seconds
  api_domain?: string; // e.g. https://www.zohoapis.in
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** Result of an authorization-code exchange. */
export interface ZohoExchangeResult {
  tokens: ZohoTokenResponse | null;
  error: string | null;
}

/** Result of a refresh-token exchange. */
export interface ZohoRefreshResult {
  accessToken: string | null;
  expiresIn: number | null;
  apiDomain: string | null;
  error: string | null;
  /** True if the refresh token has been revoked / expired (400/401/403).
   *  False for temporary failures (429/5xx/network) — caller should treat
   *  the connection as `stale` rather than `disconnected`. */
  permanent: boolean;
}

// ── Valid Access Token ───────────────────────────────────────────────────────

export interface ZohoValidTokenResult {
  accessToken: string | null;
  error: string | null;
  /** True if the failure is permanent (revoked, decryption failed, no refresh).
   *  False for temporary failures (rate limit, network). */
  permanent: boolean;
}

// ── Connection Status ────────────────────────────────────────────────────────

export interface ZohoConnectionStatus {
  connected: boolean;
  state: 'live' | 'stale' | 'disconnected';
  email: string | null;
  zohoUserId: string | null;
  zohoOrgId: string | null;
  zohoOrgName: string | null;
  dataCenter: string | null;
  apiDomain: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
  expiryDate: string | null;
  scope: string | null;
  /** Populated when state is `stale` or `disconnected`. */
  error: string | null;
  /** True if the failure was permanent (treat as disconnected). */
  permanent: boolean;
}

// ── Header-based org+user resolution ─────────────────────────────────────────

export interface ZohoResolvedOrgUser {
  orgId: string | null;
  userId: string | null;
  userEmail: string | null;
  actorName: string | null;
  role: string | null;
}

// ── Zoho Books API shapes (subset of fields returned by Zoho) ────────────────

export interface ZohoOrganization {
  organization_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  is_default_org?: boolean;
  plan_type?: string;
  tax_group_enabled?: boolean;
  plan_name?: string;
  currency_id?: string;
  currency_code?: string;
  currency_symbol?: string;
  country_name?: string;
  country_code?: string;
  org_created_date?: string;
  gst_no?: string;
  fiscale_year_start_month?: string;
  // Zoho sometimes returns a `time_zone` field too.
  time_zone?: string;
}

export interface ZohoContact {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  contact_type?: string; // customer | vendor
  status?: string; // active | inactive
  email?: string;
  phone?: string;
  website?: string;
  currency_code?: string;
  outstanding_receivable_amount?: number;
  outstanding_payable_amount?: number;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  status?: string; // sent | draft | overdue | paid | etc.
  customer_name?: string;
  customer_id?: string;
  date?: string;
  due_date?: string;
  total?: number;
  balance?: number;
  currency_code?: string;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoBill {
  bill_id: string;
  bill_number: string;
  status?: string; // open | overdue | paid | etc.
  vendor_name?: string;
  vendor_id?: string;
  date?: string;
  due_date?: string;
  total?: number;
  balance?: number;
  currency_code?: string;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoPayment {
  payment_id: string;
  payment_number?: string;
  payment_mode?: string; // cash | check | creditcard | etc.
  customer_name?: string;
  customer_id?: string;
  amount?: number;
  date?: string;
  reference_number?: string;
  currency_code?: string;
  invoice_numbers?: string;
  created_time?: string;
}
