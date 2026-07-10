# GSTPilot Cloud Functions

Production server-side operations for the GSTPilot Firebase project (`gstpilot1`).
These functions handle the secure work that should NOT live in the Next.js API
routes — webhook signature verification, scheduled jobs, privileged admin
operations, and any operation that needs to bypass Firestore security rules.

- **Runtime**: Node.js 20
- **SDK**: `firebase-functions` v2 (2nd-gen) + `firebase-admin` v12
- **Language**: TypeScript 5.5 (strict)
- **Region**: `asia-south1` (Mumbai — co-located with the Firestore + Storage
  multi-region bucket for low latency).
- **Timezone**: All scheduled jobs use `Asia/Kolkata`.

---

## Deploy

From the project root:

```bash
# 1. One-time: install deps in the functions directory
cd functions
npm install

# 2. Set required secrets (one-time + on rotation)
firebase functions:secrets:set BILLING_ENCRYPTION_KEY   # base64-encoded 32-byte AES key
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET  # from Razorpay dashboard
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET    # whsec_... from Stripe dashboard
firebase functions:secrets:set SMTP_HOST                # e.g. smtp.sendgrid.net
firebase functions:secrets:set SMTP_USER                # apikey
firebase functions:secrets:set SMTP_PASSWORD            # SendGrid API key

# Optional non-secret config
firebase functions:config:set smtp.port=587 smtp.from="GSTPilot <noreply@gstpilot.app>"

# 3. Deploy
npm run deploy
# (equivalent to: `firebase deploy --only functions` from the project root)
```

To deploy a single function:

```bash
firebase deploy --only functions:billingWebhook
```

The `predeploy` hooks in `firebase.json` run `npm run lint` + `npm run build`
automatically before each deploy — failed lint or TS errors will block the deploy.

---

## Local development

```bash
cd functions
npm run serve   # builds + starts firebase emulators (functions only)
```

For full local testing (Auth + Firestore + Functions), run from the project root:

```bash
firebase emulators:start
```

Set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON for local
admin SDK calls outside the emulator.

---

## Functions

| # | Export name | Trigger | Schedule / Auth |
|---|---|---|---|
| 1 | `onUserCreate` | `onCall` | Auth required (called right after sign-up) |
| 2 | `onUserDelete` | `onCall` | Auth required (admin tooling) |
| 3 | `billingWebhook` | `onRequest` | HTTPS — Razorpay/Stripe signature verified |
| 4 | `billingRenewals` | `onSchedule` | `0 2 * * *` Asia/Kolkata (daily 2 AM IST) |
| 5 | `billingGraceExpiry` | `onSchedule` | `0 3 * * *` Asia/Kolkata (daily 3 AM IST) |
| 6 | `cleanupOrphanStorage` | `onSchedule` | `0 4 * * 0` Asia/Kolkata (Sun 4 AM IST) |
| 7 | `orgRoleChange` | `onCall` | Owner role required |
| 8 | `aiContextGather` | `onCall` | Owner/admin/accountant required |
| 9 | `auditLogWrite` | `onCall` | Any active org member |
| 10 | `dataExport` | `onCall` | Owner/admin required |
| 11 | `usageMeter` | `onCall` | Any active org member |
| 12 | `emailSend` | `onCall` | Owner/admin/accountant required |

### Function-by-function

- **`onUserCreate`** — Provisions a default personal org + owner membership +
  user profile + welcome notification. Called by the client immediately after
  `createUserWithEmailAndPassword` so provisioning completes before navigation.
- **`onUserDelete`** — Cleans up the deleted user's profile and memberships.
  Solo orgs are hard-deleted; multi-person orgs have ownership transferred to
  the longest-tenured admin (prevents accidental data loss).
- **`billingWebhook`** — Receives Razorpay/Stripe webhook events, verifies the
  HMAC signature, writes the payment doc + audit log. Auto-detects provider
  via `X-GSTP-Provider` header or `?provider=` query param. Returns 200 on
  signature failure so the provider doesn't retry indefinitely (the bad
  signature is logged).
- **`billingRenewals`** — Daily 2 AM IST. Scans active subscriptions whose
  `currentPeriodEnd` falls within the next 24h, marks auto-renewing subs as
  `renewing`, flags non-auto-renew subs with `expiresAt`. Idempotent via
  `renewalProcessedFor` field.
- **`billingGraceExpiry`** — Daily 3 AM IST. Suspends subscriptions past their
  grace period (default 7 days, configurable per-org via `graceDays`), downgrades
  org plan to `free`, notifies all members.
- **`cleanupOrphanStorage`** — Weekly Sunday 4 AM IST. Scans `orgs/` Storage
  prefix, deletes files whose Firestore document no longer exists (skips files
  younger than 7 days). Max 500 deletions per run. Audit-logs every deletion.
- **`orgRoleChange`** — Owner-only. Changes a member's role. Promoting someone
  to `owner` automatically demotes the caller to `admin` (single-owner invariant).
- **`aiContextGather`** — Gathers billing/banking/ERP/compliance context for
  the Oracle AI. Server-side gathering enforces role filtering and PII
  redaction (PAN, GSTIN masked) before the bundle leaves the function.
- **`auditLogWrite`** — Writes an audit-log entry under
  `/orgs/{orgId}/auditLogs`. Stamps `actorUid` + `actorEmail` from the auth
  context (unforgeable from the client).
- **`dataExport`** — GDPR-style data export. Returns org + all default
  collections as a single JSON payload. Owner/admin only. Audit-logs the export.
- **`usageMeter`** — Records a metered usage event (AI query, e-invoice, etc.).
  Server-side metering is the source of truth for billing. Atomic per-period
  counter increment via `FieldValue.increment`.
- **`emailSend`** — Sends a transactional email via SMTP STARTTLS on port 587
  (SendGrid/Mailgun/SES compatible). Owner/admin/accountant only. Audit-logs
  every send. For high volume, replace `sendViaSmtp` with a SendGrid API call.

---

## Required secrets

Set these via `firebase functions:secrets:set`:

| Secret | Purpose |
|---|---|
| `BILLING_ENCRYPTION_KEY` | 32-byte AES-256-GCM key (base64 or hex) for encrypting sensitive fields at rest. Used by `helpers/encryption.ts`. |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret from the Razorpay dashboard. Used by `billingWebhook`. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` signing secret from the Stripe dashboard. Used by `billingWebhook`. |
| `SMTP_HOST` | SMTP server hostname (e.g. `smtp.sendgrid.net`). Used by `emailSend`. |
| `SMTP_USER` | SMTP username (for SendGrid, this is the literal string `apikey`). |
| `SMTP_PASSWORD` | SMTP password (for SendGrid, this is the API key). |

Optional non-secret config (`firebase functions:config:set`):

| Key | Default | Purpose |
|---|---|---|
| `smtp.port` | `587` | SMTP port (use 465 for implicit TLS). |
| `smtp.from` | `SMTP_USER` | Default `From:` address. |

---

## Project layout

```
functions/
  package.json
  tsconfig.json
  .eslintrc.js
  .gitignore
  src/
    index.ts                    ← single entry — re-exports all triggers
    admin.ts                    ← firebase-admin singleton (applicationDefault())
    types.ts                    ← shared types (OrgRole, AuditLogEntry, etc.)
    triggers/
      auth-on-create.ts
      auth-on-delete.ts
      billing-webhook.ts
      billing-renewals.ts
      billing-grace-expiry.ts
      cleanup-orphan-storage.ts
      org-role-change.ts
      ai-context-gather.ts
      audit-log-write.ts
      data-export.ts
      usage-meter.ts
      email-send.ts
    helpers/
      verify-webhook.ts         ← verifyRazorpaySignature / verifyStripeSignature
      encryption.ts             ← AES-256-GCM encrypt/decrypt
      org-permission.ts         ← requireOrgRole (throws PermissionError)
```

---

## Notes

- The Next.js app (`src/`) is the source of truth for the client-side billing
  provider pattern (`src/lib/billing-provider/*`). These functions intentionally
  do NOT import from `src/` — they re-implement the minimum server-side surface
  so the functions deploy as a standalone unit.
- All onCall functions return a `{ ok, data?, error? }` envelope so the client
  can branch on `ok` without try/catch around every call.
- All onSchedule functions log a summary at the end (`processed=N skipped=M
  failed=K`) for `firebase functions:log` readability.
- The `asia-south1` region is set on every trigger for low-latency access from
  the Firestore multi-region (also `asia-south1`).
