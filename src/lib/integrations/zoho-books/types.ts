// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Integration · Type Definitions
//
// Zero `any`. Every Zoho API response shape touched by this integration is
// modeled here so the compiler enforces correctness end-to-end.
// ═══════════════════════════════════════════════════════════════════════════════

/** Zoho data centers. `in` = India (accounts.zoho.in / www.zohoapis.in). */
export type ZohoDataCenter = 'in' | 'com' | 'eu' | 'au' | 'jp' | 'ca';

/** Resolved Zoho endpoint URLs for a given data center. */
export interface ZohoEndpoints {
  /** OAuth consent screen URL base. */
  authBaseUrl: string;
  /** OAuth token exchange + refresh + revoke URL. */
  tokenUrl: string;
  /** Zoho Books REST API base (no trailing slash). */
  apiBaseUrl: string;
  /** The data center code. */
  dc: ZohoDataCenter;
}

/** OAuth configuration resolved from environment variables. */
export interface ZohoOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  endpoints: ZohoEndpoints;
}

/**
 * The scope set requested during OAuth. Zoho Books exposes a single
 * `ZohoBooks.fullaccess.all` scope that covers Invoices, Customers, Vendors,
 * Bills, Expenses, Banking, and Reports — the seven functional areas the UI
 * advertises.
 */
export const ZOHO_BOOKS_SCOPE = 'ZohoBooks.fullaccess.all';

/**
 * Friendly display names for the functional areas covered by the Zoho Books
 * scope. Surfaced in the connection-status UI as the "Scopes" list.
 */
export const ZOHO_BOOKS_SCOPE_AREAS: readonly string[] = [
  'Books',
  'Invoices',
  'Customers',
  'Bills',
  'Expenses',
  'Banking',
  'Reports',
] as const;

/** Decoded OAuth state payload (base64url-encoded, round-tripped via callback). */
export interface ZohoOAuthState {
  orgId: string;
  userId: string;
  userEmail: string;
  returnPath?: string;
  redirectUri?: string;
}

/** Raw token-exchange response from Zoho's /oauth/v2/token endpoint. */
export interface ZohoTokenExchangeResponse {
  access_token?: string;
  refresh_token?: string;
  api_domain?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** Normalized token set persisted (encrypted) to Prisma. */
export interface ZohoTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: Date | null;
  scope: string;
  tokenType: string;
  apiDomain: string | null;
}

/** Token-refresh response from Zoho. */
export interface ZohoRefreshResult {
  accessToken: string | null;
  expiresIn: number | null;
  apiDomain: string | null;
  error: string | null;
  /** True when the refresh token is genuinely revoked/invalid (HTTP 400 +
   *  invalid_grant, HTTP 401/403). False for temporary errors (network timeout,
   *  429, 5xx) — in those cases the token is still valid and the user should
   *  NOT be told to reconnect. */
  permanent: boolean;
}

/** Database row shape (minus the encrypted token strings) for read paths. */
export interface StoredZohoToken {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  zohoUserId: string | null;
  zohoOrgId: string | null;
  zohoOrgName: string | null;
  apiDomain: string | null;
  dataCenter: string;
  connectedAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
}

/** Public connection status returned by the /status API route. */
export interface ZohoConnectionStatus {
  connected: boolean;
  userEmail: string | null;
  zohoUserId: string | null;
  connectedAt: string | null;
  /** ISO timestamp of the last token update (refresh / reconnect). */
  lastConnectedAt: string | null;
  scopes: string[];
  /** Zoho Books organization display name (multi-tenant mapping). */
  organizationName: string | null;
  /** Zoho Books numeric organization ID. */
  zohoOrgId: string | null;
  /** Zoho data center (in / com / eu / …). */
  dataCenter: string | null;
  /** Functional scope areas covered (Books, Invoices, Customers, …). */
  scopeAreas: readonly string[];
  /**
   * TRUE when a token row exists in the DB but the server CANNOT actually use
   * it — either because ZOHO_CLIENT_SECRET is missing (tokens can't be
   * decrypted) or because the encrypted payload is corrupt/was encrypted with
   * a different secret. When `requiresReconnect` is true, `connected` is
   * forced to `false` so the UI NEVER shows a fake "Connected" state.
   */
  requiresReconnect: boolean;
  /**
   * TRUE when the Zoho OAuth client credentials (ZOHO_CLIENT_ID /
   * ZOHO_CLIENT_SECRET) are not configured on the server. The UI uses this to
   * show a "Configuration required" notice instead of a misleading error.
   */
  notConfigured: boolean;
  /** Human-readable reason for the current state (null when fully connected). */
  reason: string | null;
}

/** Result of an exchange-code-for-tokens call. */
export interface ZohoTokenExchangeResult {
  tokens: ZohoTokens;
  /** User info extracted from the token response (Zoho doesn't return an
   * id_token, so this is filled best-effort from the /users/me endpoint). */
  userInfo: ZohoUserInfo;
  error: string | null;
}

/** Best-effort user profile (fetched post-token for audit logging). */
export interface ZohoUserInfo {
  userId?: string;
  email?: string;
  fullName?: string;
}

/** Generic API result envelope used by every service wrapper. Never throws. */
export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

/** Zoho Books organization record (returned by GET /books/v3/organizations). */
export interface ZohoBooksOrganization {
  organization_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  is_default_org?: boolean;
  plan_type?: string;
  tax_group_enabled?: boolean;
  plan_name?: string;
  is_org_active?: boolean;
  country_code?: string;
  country_name?: string;
  currency_code?: string;
  currency_id?: string;
  currency_symbol?: string;
  fiscal_year_label?: string;
  time_zone?: string;
  created_date?: string;
}

/** Response shape for GET /books/v3/organizations. */
export interface ZohoBooksOrganizationsResponse {
  code: number;
  message: string;
  organizations: ZohoBooksOrganization[];
}

/** Header-resolved org/user context (mirrors the Google Workspace pattern). */
export interface ResolvedOrgUser {
  orgId: string | null;
  userId: string | null;
  userEmail: string | null;
}
