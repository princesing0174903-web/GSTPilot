# Banking Integration — Setu AA Preparation Checklist

> **STATUS: PREPARATION MODE — NOT LIVE**
>
> The Setu Account Aggregator adapter is structurally complete but NOT
> connected. No real Setu API calls are made. This document defines exactly
> what must be true before the banking integration can go live.

## 1. Architecture Summary (What Exists Now)

### Already Complete
| Component | Location | Status |
|-----------|----------|--------|
| `IBankProvider` interface | `src/lib/banking-provider/provider.ts` | ✅ Clean 7-method contract |
| `SetuAAProvider` adapter | `src/lib/banking-provider/server/setu-aa-provider.ts` | ✅ Structure complete, PREPARATION MODE |
| Setu SDK (8 files) | `src/lib/setu/` | ✅ Full AA SDK (auth, client, consents, accounts, transactions, webhooks) |
| Webhook receiver | `src/app/api/webhooks/setu/route.ts` | ✅ Signature verification + 3 event handlers (stub) |
| AES-256-GCM encryption | `src/lib/banking-provider/server/crypto.ts` | ✅ `BANK_ENCRYPTION_KEY` env var |
| Provider registry (org-level) | `src/lib/banking-provider/server/registry.ts` | ✅ Per-connection provider selection |
| Orchestrator | `src/lib/banking-provider/server/orchestrator.ts` | ✅ Wires provider through session.provider |
| Mock provider | `src/lib/banking-provider/server/mock-provider.ts` | ✅ Fully functional, deterministic data |
| Consent management types | `src/lib/banking-provider/consent-types.ts` | ✅ BankConsent, ConsentHistoryEntry, etc. |
| Consent management UI | `src/components/banking/BankingConsentManager.tsx` | ✅ Active/history/revoke/event log |
| Consent API | `src/app/api/banking/consents/route.ts` | ✅ GET handler (returns empty in prep mode) |
| `ConnectBankResult.redirectUrl` | `src/lib/banking-provider/types.ts` | ✅ Added for AA consent redirect |
| Prisma `CollectionRecovery.organizationId` | `prisma/schema.prisma` | ✅ Added (nullable, indexed) |
| Prisma `UPITransaction` model | `prisma/schema.prisma` | ✅ Added (was missing entirely) |
| Auth guards on all 35 routes | `src/app/api/banking/*` + `src/app/api/aa/*` | ✅ requireAuth + requireOrgMembership |

### NOT Yet Done (Post-Credentials)
| Component | What's Needed |
|-----------|---------------|
| SetuAAProvider method bodies | Replace `assertPreparationMode()` with real Setu SDK calls (documented inline) |
| Webhook event handlers | Wire CONSENT_APPROVED → completeBankConnection, SESSION_COMPLETED → syncTransactions |
| Firestore webhook dedup | Replace in-memory `processedEventIds` Set with `setu_webhook_events` collection |
| Consent API server-side read | Implement Firestore Admin SDK read for bank_connections |
| Org-level provider config in DB | Store provider preference per-org (currently env-var default) |
| `isLive = true` flip | Only after sandbox verification passes |

---

## 2. Pre-Production Security & Compliance Checklist

Before flipping `isLive = true` on the SetuAAProvider, ALL of the following
must be true. Each item has a verification command or manual check.

### 2.1 Data Localization (RBI / DPDP Act)

- [ ] **India-hosted database** — All bank transaction data must reside in India.
  - Firestore: configure region to `asia-south1` (Mumbai) or `asia-south2` (Delhi).
  - Prisma/SQLite: the SQLite file must be on an India-hosted server.
  - **Verify:** `firebase projects:list` shows the project region; check Firestore location in GCP console.

- [ ] **No cross-border data transfer** — Bank data must never leave India.
  - No AWS us-east-1, no GCP us-central1, no EU regions.
  - Backup/snapshot targets must be in India.
  - **Verify:** Review all cloud resource regions in the infrastructure config.

- [ ] **DPDP Act compliance** — Data Principal consent for data processing.
  - Privacy policy must disclose bank data collection + processing purpose.
  - Data Principal can request access/correction/erasure (RTI flow).
  - **Verify:** Legal review of privacy policy + data processing agreement.

### 2.2 Encryption

- [ ] **AES-256-GCM at rest** — Bank connection tokens encrypted server-side.
  - `BANK_ENCRYPTION_KEY` env var set (64-char hex or 44-char base64 = 32 bytes).
  - Key NEVER logged, NEVER sent to client, NEVER in client-side code.
  - **Verify:** `echo $BANK_ENCRYPTION_KEY | wc -c` (should be 65 or 45); grep client bundles for the key string (should find nothing).

- [ ] **HTTPS everywhere** — All API calls over TLS.
  - Production: Caddy/nginx terminates TLS with a valid certificate.
  - No `http://` URLs in production config.
  - HSTS header set.
  - **Verify:** `curl -I https://your-domain.com/api/banking/status` returns 200; no mixed-content warnings in browser console.

- [ ] **Setu OAuth2 client credentials** — `SETU_CLIENT_SECRET` stored securely.
  - In env vars (NEVER in code, NEVER in client bundles).
  - Rotated quarterly.
  - **Verify:** `echo $SETU_CLIENT_SECRET | wc -c` (should be > 20); grep git history for the secret (should find nothing).

### 2.3 Consent Management (AA Framework)

- [ ] **Consent is time-bound** — Every consent has an expiry (max 12 months per Setu).
  - `BankConnection.consentExpiry` is set on every connect.
  - UI shows countdown + warning when <7 days remaining.
  - **Verify:** Connect a sandbox account; check `consentExpiry` is set in Firestore.

- [ ] **Consent is revocable** — User can revoke at any time.
  - `/api/banking/disconnect` calls `SetuAAProvider.disconnect()` → `client.revokeConsent()`.
  - Revocation is irreversible (user must re-consent to reconnect).
  - **Verify:** Revoke a sandbox consent; confirm Setu shows status=REVOKED.

- [ ] **Consent is purpose-limited** — Consent request specifies FI types + date range.
  - `createConsentForAccounts()` sets `fiTypes: ['DEPOSIT_ACCOUNT']` + `dataRange`.
  - GSTPilot must NOT fetch data outside the consented range.
  - **Verify:** Review consent request payload in Setu dashboard.

- [ ] **Consent audit trail** — Every consent lifecycle event is logged.
  - `CONSENT_REQUESTED`, `CONSENT_APPROVED`, `CONSENT_REVOKED`, `CONSENT_EXPIRED` events.
  - Stored in Firestore `banking_audit_log` collection (or similar).
  - **Verify:** Query audit log after a connect/revoke cycle.

### 2.4 Audit Logs

- [ ] **Every banking operation is audited** — connect, sync, refresh, disconnect.
  - Actor (uid + email), org, action, timestamp, result, provider.
  - Immutable (append-only collection).
  - **Verify:** Perform each operation; check audit log has an entry.

- [ ] **Webhook events are audited** — Every Setu webhook is logged with raw payload.
  - eventId, type, consentId, timestamp, processedAt, result.
  - **Verify:** Send a test webhook (post-credentials); check audit log.

- [ ] **Audit log retention** — Retain for minimum 7 years (RBI / IT Act).
  - Configure Firestore TTL or archival to cold storage.
  - **Verify:** Check Firestore TTL policy on the audit collection.

### 2.5 Retention & Deletion

- [ ] **Data retention policy** — Bank transactions retained per business need + law.
  - Default: 7 years (RBI requirement for financial records).
  - Configurable per-org (some orgs may want shorter).
  - **Verify:** Document the retention policy; implement a cleanup job if needed.

- [ ] **Right to erasure** — Data Principal can request deletion.
  - Delete all bank_transactions, bank_connections for the org.
  - Revoke all active consents via Setu.
  - Log the erasure request + completion in the audit trail.
  - **Verify:** Document the erasure request flow; test on sandbox data.

- [ ] **Consent auto-expiry** — Expired consents stop syncing.
  - Scheduler checks `consentExpiry`; marks connection as 'expired' when elapsed.
  - No sync attempts on expired connections.
  - **Verify:** Set a short consent expiry in sandbox; confirm sync stops after expiry.

### 2.6 Webhook Verification

- [ ] **HMAC-SHA256 signature verification** — Every webhook is verified.
  - `SETU_WEBHOOK_SECRET` env var set.
  - `verifyWebhookSignature()` uses `timingSafeEqual` (prevents timing attacks).
  - Webhooks with bad signatures return 401 (NOT 200).
  - **Verify:** Send a webhook with a tampered signature; confirm 401 response.

- [ ] **Idempotency** — Duplicate webhooks don't double-process.
  - In-memory dedup (current) → Firestore `setu_webhook_events` collection (production).
  - **Verify:** Send the same webhook twice; confirm it's processed once.

- [ ] **Webhook URL is public** — Setu needs to reach it.
  - Production URL: `https://your-domain.com/api/webhooks/setu`
  - Configure in Setu dashboard.
  - **Verify:** `curl https://your-domain.com/api/webhooks/setu` returns 200 GET.

### 2.7 Rate Limits

- [ ] **API route rate limits** — Prevent abuse of banking endpoints.
  - `/api/banking/connect`: max 5/min per org (mirrors GST filing routes).
  - `/api/banking/sync`: max 10/min per org.
  - `/api/banking/disconnect`: max 5/min per org.
  - **Verify:** Send 10 rapid requests to `/api/banking/connect`; confirm rate limit triggers.

- [ ] **Setu API rate limits** — Don't exceed Setu's limits.
  - SetuClient has a built-in rate limiter (5 concurrent, 100ms spacing).
  - Monitor 429 responses; back off if needed.
  - **Verify:** Check SetuClient logs for 429s during load testing.

- [ ] **Webhook endpoint rate limit** — Prevent webhook flooding.
  - Max 100 webhooks/min per IP (configurable in Caddy/nginx).
  - **Verify:** Send 200 rapid webhooks; confirm rate limit triggers.

### 2.8 Tenant Isolation

- [ ] **Every DB query is org-scoped** — No cross-tenant data access.
  - All Prisma queries filter on `organizationId`.
  - All Firestore queries filter on `organizationId`.
  - **Verify:** Audit every `db.*.findMany()` and Firestore `.where()` call.

- [ ] **`CollectionRecovery.organizationId` is enforced** — Added in this prep task.
  - New rows MUST set it (enforce at the application layer).
  - Existing rows backfilled or marked for cleanup.
  - **Verify:** Try to create a CollectionRecovery without orgId; confirm it's rejected.

- [ ] **`UPITransaction.organizationId` is enforced** — Added in this prep task.
  - All `upi.ts` functions accept + filter on `organizationId`.
  - **Verify:** Query UPITransactions for org A; confirm no org B data leaks.

- [ ] **Auth guard on every route** — All 35 banking+AA routes require auth.
  - `requireAuth` + `requireOrgMembership` (15 routes) or `requireAuth` only (2 status routes).
  - **Verify:** `curl -X GET /api/banking/state` without auth header; confirm 401.

- [ ] **Account ownership check** — accountId-scoped routes verify the account belongs to the org.
  - `/api/banking/accounts/[id]/sync`: check `account.organizationId === request.orgId`.
  - **Verify:** Try to sync another org's account; confirm 403.

---

## 3. Setu Credentials & Configuration Required

When Setu sandbox access is granted, set these environment variables:

```env
# ─── Setu AA Gateway (sandbox) ───────────────────────────────────────────────
SETU_CLIENT_ID=<from Setu Bridge product instance>
SETU_CLIENT_SECRET=<from Setu Bridge product instance>
SETU_PRODUCT_INSTANCE_ID=<from Setu Bridge product instance>
SETU_BASE_URL=https://fiu-sandbox.setu.co
SETU_AUTH_URL=https://uat.setu.co/api/v2/auth/token
SETU_WEBHOOK_SECRET=<generate a strong random secret; register in Setu dashboard>

# ─── Banking encryption key (AES-256-GCM, 32 bytes) ─────────────────────────
# Generate with: openssl rand -hex 32
BANK_ENCRYPTION_KEY=<64-char hex string>

# ─── Provider selection (optional — defaults to 'mock') ─────────────────────
# Set to 'setu' ONLY after sandbox verification passes.
BANK_PROVIDER=mock
```

### Production (after sandbox verification):
```env
SETU_BASE_URL=https://fiu.setu.co
SETU_AUTH_URL=https://docs.setu.co/api/v2/auth/token
# (other vars same as sandbox)
```

---

## 4. Sandbox Verification Steps

Once credentials are set, verify end-to-end BEFORE flipping `isLive`:

1. **Config check:** `isSetuConfigured()` returns `true`.
2. **Health check:** `SetuClient.healthCheck()` returns `{ ok: true, authOk: true, fipCount: >0 }`.
3. **FIP list:** `SetuClient.listFips('ACTIVE')` returns 50+ FIPs (Indian banks).
4. **Consent creation:** `createConsentForAccounts()` returns a consent with a `url` field.
5. **Consent approval:** Open the consent URL in a browser; approve on the Setu sandbox AA app.
6. **Webhook receipt:** `/api/webhooks/setu` receives a `CONSENT_STATUS_UPDATE` event.
7. **Data session:** `SetuClient.createSession()` + `getSession()` returns COMPLETED.
8. **Account fetch:** `collectDeliveredAccounts()` returns at least 1 account with balances.
9. **Transaction fetch:** `fetchTransactionsFromSession()` returns transactions.
10. **Revoke:** `SetuClient.revokeConsent()` returns `{ status: 'REVOKED' }`.

Only after ALL 10 steps pass, flip `isLive = true` in `setu-aa-provider.ts`
and set `BANK_PROVIDER=setu` in production env.

---

## 5. What Z.ai Will Implement After Sandbox Access

1. **Wire SetuAAProvider method bodies** — Replace each `assertPreparationMode()` with the documented Setu SDK call (inline comments show exact sequence).
2. **Wire webhook handlers** — CONSENT_APPROVED → completeBankConnection; SESSION_COMPLETED → syncBalances + syncTransactions; CONSENT_REVOKED → disconnectBank.
3. **Implement Firestore webhook dedup** — `setu_webhook_events` collection (replaces in-memory Set).
4. **Implement consent API server-side read** — Firestore Admin SDK read of bank_connections + decrypt session metadata for consentId/vua/linkedAccounts.
5. **Add rate limits** — 5/min for connect/disconnect, 10/min for sync (mirror GST filing routes).
6. **Add audit logging** — Banking action types to `src/lib/gst-reconciliation/server/audit.ts` (or a parallel banking audit module).
7. **Thread orgId through banking lib functions** — `aggregator.ts`, `engine.ts`, `oracle.ts`, `intelligence.ts`, `collections.ts`, `accounts.ts`, `statements.ts`, `upi.ts` (8 functions identified in Task 5-a audit).
8. **Add account ownership checks** — `/api/banking/accounts/[id]/sync`, `/api/banking/transactions/sync`, `/api/banking/transactions/import` verify accountId belongs to orgId.
9. **Run the 10-step sandbox verification** (see §4 above).
10. **Flip `isLive = true`** + set `BANK_PROVIDER=setu` in production.

---

## 6. What Requires Manual Action (Human / Legal / Ops)

1. **Setu FIU registration** — Submit the FIU onboarding form on bridge.setu.co. Requires: company registration, PAN, business proof, consent policy, data processing agreement. Timeline: 4-8 weeks.
2. **ReBIT compliance review** — Ensure GSTPilot's data handling meets ReBIT's AA technical specifications. Setu handles most of this via their gateway, but the FIU side (GSTPilot) must comply.
3. **DPDP Act registration** — Register as a Data Fiduciary with the Data Protection Board if processing significant volumes of personal data.
4. **Privacy policy update** — Add bank data collection + AA consent flow to the privacy policy.
5. **Terms of service update** — Add banking integration terms (consent, revocation, data retention).
6. **Infrastructure region** — Ensure the production database is in an India region (Firestore `asia-south1` or `asia-south2`).
7. **SSL certificate** — Production domain must have a valid TLS certificate (Let's Encrypt or commercial).
8. **Webhook URL registration** — Register `https://your-domain.com/api/webhooks/setu` in the Setu dashboard + set the webhook secret.
9. **Encryption key generation** — Generate `BANK_ENCRYPTION_KEY` with `openssl rand -hex 32`; store in a secrets manager (NOT in git).
10. **Key rotation policy** — Document how to rotate `BANK_ENCRYPTION_KEY` (re-encrypt all connections) and `SETU_CLIENT_SECRET` (update env + restart).

---

## 7. Estimated Implementation Scope (Post-Credentials)

| Task | Effort | Files |
|------|--------|-------|
| Wire SetuAAProvider 7 methods | 1-2 days | `setu-aa-provider.ts` |
| Wire webhook 3 handlers | 0.5 day | `api/webhooks/setu/route.ts` |
| Firestore webhook dedup | 0.5 day | new `setu_webhook_events` collection + route |
| Consent API server-side read | 0.5 day | `api/banking/consents/route.ts` + Admin SDK |
| Rate limits on banking routes | 0.5 day | 6 route files |
| Audit logging | 0.5 day | `audit.ts` + route calls |
| Thread orgId through 8 lib functions | 1 day | `aggregator.ts`, `engine.ts`, etc. |
| Account ownership checks | 0.5 day | 3 route files |
| Sandbox verification (10 steps) | 0.5 day | manual testing |
| **Total** | **5-6 days** | |

This assumes the Setu SDK (already complete) works as documented. If the SDK
needs fixes after sandbox testing, add 1-2 days.

---

## 8. DO NOT List (Hard Rules)

- ❌ **Do NOT claim Banking is LIVE** until `isLive = true` in `setu-aa-provider.ts`.
- ❌ **Do NOT claim Setu is connected** until sandbox verification passes.
- ❌ **Do NOT use fake bank transactions in the production path** — Mock data is for dev only.
- ❌ **Do NOT set `BANK_PROVIDER=setu` in production** until §4 verification passes.
- ❌ **Do NOT skip the HMAC signature check** on webhooks (even in sandbox).
- ❌ **Do NOT log `SETU_CLIENT_SECRET` or `BANK_ENCRYPTION_KEY`** anywhere.
- ❌ **Do NOT store bank connection tokens unencrypted** — always use AES-256-GCM.
- ❌ **Do NOT make Setu API calls from client code** — all Setu calls are server-side.
