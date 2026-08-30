# Task ZOHO-REBUILD — Zoho Books Integration Builder

## Task: Build a clean new Zoho Books integration from scratch at /home/z/my-project.

The old Zoho integration was completely removed. This rebuild delivers OAuth
connect/disconnect/refresh + Organizations selector + Customers/Invoices/Bills/
Payments tabs — all backed by REAL Zoho API responses (no mock data). Mirrors
the proven Google Workspace integration pattern (AES-256-GCM tokens at rest,
HMAC-signed OAuth state, tenant isolation, permanent/temporary failure
distinction).

## What was done

### 1. Crypto — `src/lib/integrations/zoho/crypto.ts` (server-only)
AES-256-GCM with 96-bit IV. Key derived from `ZOHO_CLIENT_SECRET` via
double-HMAC-SHA256 (label `'gstpilot-zoho-v1'`, usage `'aes-256-gcm-key'`) —
domain-separated from the Google Workspace key. Exports `encrypt`,
`decrypt`, `safeDecrypt`. Same ciphertext format as Google:
`<iv.b64>.<tag.b64>.<ct.b64>`.

### 2. Types — `src/lib/integrations/zoho/types.ts`
Type definitions for the Zoho integration surface:
- `ZohoDataCenter`, `ZohoEndpoints`, `ZohoOAuthConfig`
- `ZohoOAuthStatePayload`, `ZohoTokenResponse`, `ZohoExchangeResult`,
  `ZohoRefreshResult`, `ZohoValidTokenResult`, `ZohoConnectionStatus`
- `ZohoResolvedOrgUser` (header-resolution shape)
- API response shapes: `ZohoOrganization`, `ZohoContact`, `ZohoInvoice`,
  `ZohoBill`, `ZohoPayment`

### 3. OAuth helper — `src/lib/integrations/zoho/oauth.ts` (~570 lines)
Single entry point for all server-side Zoho OAuth + API concerns:
- `ZOHO_BOOKS_SCOPE = 'ZohoBooks.fullaccess.all'`
- `DC_ENDPOINTS` map: 6 data centers (`in`, `com`, `eu`, `au`, `jp`, `ca`),
  each with `authBaseUrl`, `tokenUrl`, `apiBaseUrl`.
- `resolveDataCenter()` — reads `ZOHO_DC` env var (default `in`, unknown →
  `in` with warning).
- `getZohoEndpoints()` — endpoints for the configured DC.
- `isZohoConfigured()` — truthy iff `ZOHO_CLIENT_ID` + `ZOHO_CLIENT_SECRET`
  + `ZOHO_REDIRECT_URI` all set.
- `getZohoOAuthConfig()` — returns `{clientId, clientSecret, redirectUri,
  endpoints}`. `redirectUri` from `ZOHO_REDIRECT_URI` env var (NOT dynamic
  resolution — Zoho requires pre-registration).
- `encodeState({orgId, userId, userEmail, returnPath, redirectUri})` —
  HMAC-SHA256-signed state, format
  `<nonce.b64url>.<payload.b64url>.<expiresAt>.<hmac.b64url>`. 16-byte nonce
  echoed in payload + 10-min TTL + `timingSafeEqual` comparison. Key from
  `ZOHO_OAUTH_STATE_SECRET ?? ZOHO_CLIENT_SECRET` (different label from the
  AES key for domain separation).
- `decodeState(state)` — verifies HMAC + TTL + nonce echo. Returns null on
  any failure.
- `buildAuthUrl(state, redirectUri)` — Zoho consent URL with
  `access_type=offline` + `prompt=consent` (forces refresh_token emission).
- `exchangeCodeForTokens(code, redirectUri)` — POSTs to Zoho token endpoint.
  Returns `{tokens, error}`.
- `storeTokens(orgId, userId, userEmail, tokens, zohoOrgId?, zohoOrgName?)` —
  encrypts access+refresh tokens, upserts via `@@unique([organizationId, userId])`.
  Preserves existing refresh token if Zoho didn't return a new one (rare re-
  consent case). Clears `revokedAt` on reconnect.
- `refreshAccessToken(refreshToken)` — POSTs to Zoho token endpoint. Returns
  `{accessToken, expiresIn, apiDomain, error, permanent}`. `permanent=true`
  iff status ∈ {400, 401, 403}; `permanent=false` for 429/5xx/network.
- `getValidAccessToken(orgId, userId)` — loads token, refreshes 60s before
  expiry, persists refreshed access + api_domain. Does NOT overwrite refresh
  token (Zoho never returns a new one on refresh).
- `getConnectionStatus(orgId, userId)` — returns full status: `connected`,
  `state ∈ {'live','stale','disconnected'}`, email, zohoUserId, zohoOrgId,
  zohoOrgName, dataCenter, apiDomain, timestamps, scope, error, permanent.
  `stale` iff refresh failed with a temporary error (NOT disconnected).
- `disconnectZoho(orgId, userId)` — local-only revoke (Zoho has no revoke
  endpoint); marks `revokedAt = now`. Always returns `{ok: true}`.
- `resolveOrgUserFromHeaders(req)` — reads `x-gstpilot-orgid` +
  `x-gstpilot-actor` JSON headers.
- `refreshOrganizationMapping(orgId, userId, accessToken)` — fetches
  `{apiBaseUrl}/organizations`, picks the default org (or the first one),
  persists `zohoOrgId` + `zohoOrgName` on the token row.
- `getApiBaseUrl(apiDomain)` — derives `{apiDomain}/books/v3` from the
  `api_domain` Zoho returned (handles DC moves); falls back to the configured
  DC endpoint.

### 4. Barrel — `src/lib/integrations/zoho/index.ts`
Re-exports everything from `./crypto`, `./types`, `./oauth`.

### 5. API routes (11 total)
All gated by `requireAuth(req)`; all read `(orgId, userId)` from
`x-gstpilot-orgid` + `x-gstpilot-actor` headers; all return structured error
codes (`AUTH_REVOKED` permanent, `AUTH_STALE` temporary, `NO_ORG_SELECTED`
when no Zoho org picked yet, `ZOHO_API_ERROR` for Zoho-side failures,
`ZOHO_NOT_CONFIGURED` 503 for missing env vars).

- `GET /api/integrations/zoho/connect` — returns `{ok, authUrl, redirectUri}`
  or 503 `ZOHO_NOT_CONFIGURED`.
- `GET /api/integrations/zoho/callback` — verifies state, exchanges code,
  stores tokens, fetches organizations + persists default org mapping,
  redirects to `/?zoho_connected=1&view=zoho-books` (or `?zoho_error=<code>`
  on failure).
- `GET /api/integrations/zoho/status` — returns full connection status.
- `POST /api/integrations/zoho/disconnect` — local revoke.
- `POST /api/integrations/zoho/refresh` — force refresh; returns fresh status
  on success, `AUTH_REVOKED` 401 if permanent failure, `AUTH_STALE` 503 if
  temporary.
- `GET /api/integrations/zoho/organizations` — proxies
  `GET {apiBaseUrl}/organizations`.
- `POST /api/integrations/zoho/organizations/select` — persists chosen Zoho
  org ID + name; returns fresh status.
- `GET /api/integrations/zoho/customers` — proxies
  `GET {apiBaseUrl}/contacts?contact_type=customer`. Returns
  `NO_ORG_SELECTED` 400 when no Zoho org picked.
- `GET /api/integrations/zoho/invoices` — proxies
  `GET {apiBaseUrl}/invoices` (sort by date desc).
- `GET /api/integrations/zoho/bills` — proxies `GET {apiBaseUrl}/bills`.
- `GET /api/integrations/zoho/payments` — proxies
  `GET {apiBaseUrl}/customerpayments`.

All Zoho Books API calls pass `organization_id=<zohoOrgId>` query param
(Zoho's multi-tenant requirement). Access tokens NEVER leave the server.

### 6. Hook — `src/hooks/useZohoBooks.ts`
Client-side hook mirroring `useGoogleWorkspace`:
- `useOrg()` + `useAuth()` for context; `contextReady = Boolean(orgId && userId)`.
- `connect()` — guards with `contextReady`; returns
  `{authUrl, error, notConfigured, requiredEnvVars}`.
- `disconnect()` — POST + optimistic local status update + authoritative re-fetch.
- `refresh()` — POST + apply echoed status (or re-fetch).
- `refreshStatus()` — auto-fires on `contextReady` flip.
- `call<T>(path, init)` — generic authenticated fetch wrapper; stamps
  `x-gstpilot-orgid` + `x-gstpilot-actor` headers.
- Convenience wrappers: `listOrganizations()`, `selectOrganization(orgId, orgName)`,
  `listCustomers(max)`, `listInvoices(max)`, `listBills(max)`, `listPayments(max)`.

### 7. Page — `src/components/zoho-books/ZohoBooksPage.tsx` (replaced placeholder)
Full dark-themed (bg-black + text-white + white/[0.02] surfaces) integration
page mirroring `GoogleWorkspacePage`:
- `StatusPill` — live (emerald) / stale (amber) / disconnected (white) /
  unknown (spinner) variants.
- Header with Refresh + Refresh Token + Connect/Disconnect buttons (Connect
  disabled until `contextReady`, label flips to "Loading workspace…").
- Context-not-ready banner, connect/disconnect/refresh error banners with
  dismiss buttons.
- `DisconnectedCard` — centered hero with Connect CTA + scope summary
  (`ZohoBooks.fullaccess.all` + DC from env var).
- `ConnectedPanel` — status card (email, Zoho org, DC, last sync, connected
  since, token expires, scopes as chips). When no Zoho org selected →
  shows `OrganizationPicker`; otherwise → Customers/Invoices/Bills/Payments
  tabs.
- `OrganizationPicker` — radio-style list of Zoho organizations with name +
  country + GST + currency + default-org badge. "Use this organization"
  button persists selection + reloads the page (so header + tab visibility
  update).
- `CustomersTab` — list with name + status + email + currency + receivable
  amount (max-h-96 overflow-y-auto, thin scrollbar).
- `InvoicesTab` — list with `invoice_number` (mono) + customer + status +
  amount (with due balance if any).
- `BillsTab` — list with `bill_number` (mono) + vendor + status + amount.
- `PaymentsTab` — list with customer + amount + payment mode + date +
  reference number; shows a total-of-N-payments summary at the top.
- `TabLoading` / `TabError` / `TabRetry` — shared loading + error states.
- Detects `?zoho_connected=1` / `?zoho_error=` on mount → triggers
  `refreshStatus` + cleans URL.
- All icons from `lucide-react` (BookIcon custom SVG, Building2, Users,
  FileText, Receipt, Wallet, CheckCircle2, AlertTriangle, Clock, Unplug,
  RefreshCw, Loader2, LogOut, XCircle).

## Critical rules verified
- ✅ All credentials stay server-side (`.env` only) — `isZohoConfigured()`
  checks env vars; `getZohoOAuthConfig()` reads them; never returned to
  frontend.
- ✅ Never return tokens to frontend — every route that touches the access
  token only returns the proxied API response.
- ✅ HMAC-signed OAuth state with 10-min TTL + 16-byte nonce + nonce echo +
  `timingSafeEqual` (defense-in-depth against nonce substitution under same
  key).
- ✅ AES-256-GCM encryption for tokens at rest (separate domain-separated
  key from Google Workspace via different HMAC label).
- ✅ `permanent` flag distinguishes revoked tokens (400/401/403 → disconnected)
  from temporary failures (429/5xx/network → stale).
- ✅ Temporary failures return `connected: true` with stale state — NOT
  disconnected (so the UI shows "retry" not "reconnect").
- ✅ Tenant isolation — every DB query scoped by
  `(organizationId, userId)` via the `@@unique([organizationId, userId])`
  constraint.
- ✅ Connect button disabled until `contextReady === true` (when both
  `orgId` + `userId` are resolved from `useOrg()` + `useAuth()`).
- ✅ `ZOHO_REDIRECT_URI` env var used for redirect URI (NOT dynamic
  resolution — Zoho requires pre-registration in the API console).
- ✅ Data center from `ZOHO_DC` env var (default `in`).

## Smoke tests (all passed)
Tested every endpoint against the running dev server (port 3000) with
`x-gstpilot-orgid: test-org-001` + `x-gstpilot-actor: {"uid":"test-user-001",...}`
headers:

- `GET /api/integrations/zoho/connect` → 200 with valid Zoho OAuth URL:
  - `client_id=1000.KO5C1LU7AWX944NFH7GDGD6DMOI0MB`
  - `redirect_uri=http://localhost:3000/api/integrations/zoho/callback`
    (matches `ZOHO_REDIRECT_URI` env var)
  - `scope=ZohoBooks.fullaccess.all`
  - `access_type=offline` + `prompt=consent`
  - 4-part HMAC-signed state (verified by base64url-decoding the middle
    payload segment — `nonce` echo matches outer nonce, `redirectUri`
    matches env var, `returnPath='/?view=zoho-books'`).
- `GET /api/integrations/zoho/status` → 200
  `{ok:true, status:{connected:false, state:'disconnected', error:'not_connected', permanent:true}}`.
- `GET /api/integrations/zoho/status` without auth headers → 401 AUTH_REQUIRED.
- `POST /api/integrations/zoho/disconnect` → 200 `{ok:true}` (always ok).
- `GET /api/integrations/zoho/disconnect` → 405 (correct — only POST handler).
- `POST /api/integrations/zoho/refresh` → 401 AUTH_REVOKED (no token row).
- `GET /api/integrations/zoho/organizations` → 401 AUTH_REVOKED.
- `GET /api/integrations/zoho/customers` → 401 AUTH_REVOKED.
- `GET /api/integrations/zoho/invoices` → 401 AUTH_REVOKED.
- `GET /api/integrations/zoho/bills` → 401 AUTH_REVOKED.
- `GET /api/integrations/zoho/payments` → 401 AUTH_REVOKED.
- `POST /api/integrations/zoho/organizations/select` (no token row) →
  404 NOT_CONNECTED.
- `GET /api/integrations/zoho/callback` (no params) → 307 redirect to
  `/?zoho_error=missing_params&view=zoho-books`.
- `GET /?view=zoho-books` → 200, 47KB HTML, zero runtime errors in the
  dev log.

## Lint
Before: 14 errors, 5 warnings (all pre-existing in other files —
EnterpriseSettings, FinancingMarketplacePage, finos/ui/charts,
MissionControlPage, providers-lazy).
After: 14 errors, 5 warnings — **ZERO new lint errors from any Zoho file**.

## Files created (16 total)
- `src/lib/integrations/zoho/crypto.ts` (AES-256-GCM, ~95 lines)
- `src/lib/integrations/zoho/types.ts` (~190 lines)
- `src/lib/integrations/zoho/oauth.ts` (~580 lines)
- `src/lib/integrations/zoho/index.ts` (barrel)
- `src/app/api/integrations/zoho/connect/route.ts`
- `src/app/api/integrations/zoho/callback/route.ts`
- `src/app/api/integrations/zoho/status/route.ts`
- `src/app/api/integrations/zoho/disconnect/route.ts`
- `src/app/api/integrations/zoho/refresh/route.ts`
- `src/app/api/integrations/zoho/organizations/route.ts`
- `src/app/api/integrations/zoho/organizations/select/route.ts`
- `src/app/api/integrations/zoho/customers/route.ts`
- `src/app/api/integrations/zoho/invoices/route.ts`
- `src/app/api/integrations/zoho/bills/route.ts`
- `src/app/api/integrations/zoho/payments/route.ts`
- `src/hooks/useZohoBooks.ts`
- `src/components/zoho-books/ZohoBooksPage.tsx` (replaced placeholder, ~900
  lines)
