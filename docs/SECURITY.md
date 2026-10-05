# Security & Compliance — GSTPilot Infinity™

**Project:** `gstpilot1` (Firebase, region `asia-south1`)
**Last updated:** Phase 11 — DevOps & Compliance
**Owner:** Platform Engineering + Compliance Officer
**Classification:** Internal

---

## 1. Access Control

### 1.1 RBAC Model (Role-Based Access Control)

GSTPilot uses a five-role hierarchical RBAC model. Every API route enforces the minimum role required; Cloud Functions re-enforce on the server side via `requireOrgRole()` (see `functions/src/helpers/org-permission.ts`).

| Role | Description | Granted by |
| --- | --- | --- |
| `owner` | Single per org. Full control + billing + danger-zone ops (delete org, transfer ownership). | Creator of the org; transferred via `orgRoleChange` function |
| `admin` | Manage members, settings, integrations. Cannot delete org or change billing plan. | Owner-invited |
| `accountant` | Read + write financial data (invoices, returns, payments, banking). Cannot manage members. | Admin-invited |
| `viewer` | Read-only access to dashboard + reports. | Admin-invited |
| `member` | Standard user — read shared data + write own tasks/notifications. | Admin-invited |

### 1.2 Resource × Role Permission Matrix (14 resources)

| Resource | owner | admin | accountant | viewer | member |
| --- | --- | --- | --- | --- | --- |
| Organization settings | ✏️ | ✏️ | 👁 | 👁 | — |
| Members (invite / remove) | ✏️ | ✏️ | — | — | — |
| Clients | ✏️ | ✏️ | ✏️ | 👁 | 👁 |
| Invoices | ✏️ | ✏️ | ✏️ | 👁 | 👁 |
| Returns (GSTR) | ✏️ | ✏️ | ✏️ | 👁 | 👁 |
| Payments | ✏️ | ✏️ | ✏️ | 👁 | — |
| Banking transactions | ✏️ | ✏️ | ✏️ | 👁 | — |
| Documents | ✏️ | ✏️ | ✏️ | 👁 | 👁 |
| Audit logs | 👁 | 👁 | 👁 | 👁 | — |
| Billing & subscription | ✏️ | — | — | — | — |
| ERP connections | ✏️ | ✏️ | 👁 | 👁 | — |
| AI Oracle / CFO | ✏️ | ✏️ | ✏️ | 👁 | 👁 |
| Team tasks | ✏️ | ✏️ | ✏️ | 👁 | ✏️ (own) |
| Notifications | ✏️ (own) | ✏️ (own) | ✏️ (own) | ✏️ (own) | ✏️ (own) |

`✏️` = read + write, `👁` = read-only, `—` = no access.

Enforcement points:
- Firestore Security Rules (`firestore.rules`) — primary enforcement, cannot be bypassed by client SDK.
- Next.js API routes (586 of them) — re-check role via `usePermissions()` / `requireOrgRole()` server-side helpers.
- Cloud Functions — `requireOrgRole(db, uid, orgId, ...allowedRoles)` in every privileged trigger.

### 1.3 ABAC Policies (Attribute-Based Access)

On top of RBAC, attribute-based policies layer additional constraints:

| Policy | Rule |
| --- | --- |
| Org-scoped data | A user can only access docs under `/orgs/{orgId}/...` where they have a non-suspended membership. Enforced in Firestore rules. |
| Suspended-user deny | If `members/{uid}.status === 'suspended'`, all read/write access is revoked immediately. |
| Plan-gated features | The `e-invoicing`, `AI Oracle`, `banking intelligence` features are gated on `org.plan !== 'free'`. Enforced in API routes. |
| Single-owner invariant | Every org has exactly one owner. `orgRoleChange` promotes a new owner AND demotes the old to `admin` in a single transaction. |
| Time-based approval | High-risk executions (banking transfers, statutory filings) require a 2nd-person approval (`needsApproval()` in `src/lib/execution-cloud/security.ts`). |

---

## 2. Audit Logging

### 2.1 What's tracked

Every privileged action is recorded in `/orgs/{orgId}/auditLogs/` with this shape:

```
{
  actorUid: string        // unforgeable — stamped from auth context server-side
  actorEmail: string      // unforgeable
  action: string          // 'invoice.create' | 'payment.refund' | 'org.role.change' | ...
  target: string          // collection/doc path affected
  metadata: object        // additional context (amount, role, etc.)
  timestamp: Timestamp    // server-stamped
  ip: string              // client IP (where available)
  userAgent: string       // client UA
}
```

Tracked actions include (non-exhaustive):
- Auth: login, signup, password reset, account deletion
- Org: create, member invite, role change, suspend, delete
- Financial: invoice create/edit/cancel/send, payment record, payment refund, return file
- Compliance: GSTR prepare, GSTR submit, notice acknowledge
- Banking: connect, disconnect, transaction reconcile
- ERP: connect, sync, disconnect
- Data: export (GDPR / DPDP), delete (right-to-erasure)
- Admin: billing plan change, feature flag toggle

### 2.2 Retention

| Log type | Retention | Rationale |
| --- | --- | --- |
| Financial actions (invoices, payments, returns, banking) | **7 years** | Indian Companies Act 2013 §128 (accounting records) + GST Act §36 (GST records) |
| Non-financial actions (login, settings change) | **3 years** | SOC 2 reasonableness + GDPR Art. 5(1)(e) data minimization |
| Security events (failed login, role escalation, key rotation) | **7 years** | ISO 27001 A.12.4 logging + SOC 2 CC7.2 |

Retention is enforced by a Cloud Function (`auditLogRetention`) running daily at 05:00 IST that deletes logs older than the retention period for their category.

### 2.3 Immutability

- Audit log writes are append-only — Firestore rules forbid `update` and `delete` on `/orgs/{orgId}/auditLogs/{logId}` for all users (including owners).
- Logs are also exported daily to `gs://gstpilot1-backups-archive/audit-logs/{date}/` (Archive class, 7-year retention) for tamper-evidence — even a malicious owner with database write access cannot destroy the cloud copy.
- Every audit-log entry includes a SHA-256 hash of the prior entry's id+timestamp, forming a hash chain. Tampering with any entry breaks the chain.

---

## 3. Encryption

### 3.1 At rest

| Store | Mechanism | Key management |
| --- | --- | --- |
| Firestore | Google-managed AES-256 | Google default (CMEK available on Enterprise tier) |
| Cloud Storage | Google-managed AES-256 | Google default (CMEK optional) |
| Prisma SQLite (development) | Filesystem (no extra encryption) | N/A — dev only |
| Backups (`.tar.gz`) | AES-256 (Cloud Storage default) | Google-managed |

### 3.2 In transit

- All client↔server traffic uses **TLS 1.3** (Firebase Hosting, App Hosting, Cloud Functions, Cloud Storage all enforce TLS 1.2+ and prefer 1.3).
- Internal service-to-service traffic (Cloud Functions → Firestore / Storage) uses Google's internal RPC encryption (ALTS).
- HSTS preload header enforced via the security middleware (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).

### 3.3 Application-layer encryption

PII and sensitive fields are encrypted client-side or function-side using **AES-256-GCM** before being written to Firestore. The encrypted blob format is `<12-byte IV> || <ciphertext> || <16-byte auth tag>`, base64-encoded.

| Field | Encrypted by | Key env var |
| --- | --- | --- |
| ERP access/refresh tokens | Cloud Function / API route | `ERP_ENCRYPTION_KEY` |
| ERP company credentials | API route | `ERP_ENCRYPTION_KEY` |
| Payment provider customer IDs | Cloud Function `billingWebhook` / API route | `BILLING_ENCRYPTION_KEY` |
| Payment session metadata | API route | `BILLING_ENCRYPTION_KEY` |
| Banking account tokens | API route | `BILLING_ENCRYPTION_KEY` (shared) |
| SMTP credentials | Cloud Function `emailSend` (read at runtime via `defineSecret`) | Firebase Secret `SMTP_PASSWORD` |

Implementation: `functions/src/helpers/encryption.ts` (server) mirrors `src/lib/billing-provider/encryption.ts` (client). Both use Node `crypto.createCipheriv('aes-256-gcm', ...)`.

---

## 4. Secrets Management

### 4.1 Where secrets live

| Secret type | Storage | Access |
| --- | --- | --- |
| Public config (Firebase API key, project ID) | Hard-coded in `src/lib/firebase.ts` (safe — Firebase web API keys are public identifiers, not security boundaries) | Bundled into client JS |
| App config that varies by env (`PAYMENT_PROVIDER`, `ERP_PROVIDER`) | `.env` (local) / GitHub Actions secrets (CI) / Firebase App Hosting env (prod) | `process.env` at build/runtime |
| App secrets (`ERP_ENCRYPTION_KEY`, `BILLING_ENCRYPTION_KEY`) | `.env` (local) / GitHub Actions secrets (CI) / Firebase App Hosting secrets (prod) | `process.env` at build/runtime |
| Cloud Function secrets (`RAZORPAY_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, `SMTP_*`) | Firebase Secrets Manager (`firebase functions:secrets:set`) | `defineSecret()` + `.value()` at runtime only |
| Service account JSON (for scripts/backup, scripts/restore) | Local filesystem only — NEVER committed | `GOOGLE_APPLICATION_CREDENTIALS` env var |

### 4.2 Rotation policy

| Secret | Rotation cadence | Owner |
| --- | --- | --- |
| `ERP_ENCRYPTION_KEY` | **90 days** | Platform Engineering |
| `BILLING_ENCRYPTION_KEY` | **90 days** | Platform Engineering |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | **90 days** | Platform Engineering (Razorpay dashboard) |
| `RAZORPAY_WEBHOOK_SECRET` | **30 days** | Platform Engineering |
| `STRIPE_SECRET_KEY` | **90 days** | Platform Engineering (Stripe dashboard) |
| `STRIPE_WEBHOOK_SECRET` | **30 days** | Platform Engineering |
| `SMTP_PASSWORD` | **90 days** | Platform Engineering |
| Firebase service account JSON | **180 days** | Platform Engineering |
| Firebase CLI token (`FIREBASE_TOKEN`) | **90 days** | Platform Engineering (`firebase login:ci`) |
| GitHub Actions `FIREBASE_TOKEN` secret | **90 days** | Platform Engineering |

Rotation procedure for AES keys: a Cloud Function (`keyRotation`) re-encrypts all sensitive fields with the new key, atomically swapping the env var via Firebase Secret. The old key is retained for 30 days in a "deprecated" keyring to allow reads of still-encrypted data; after 30 days it is destroyed.

### 4.3 Secret scan in CI

The `.github/workflows/ci.yml` `security-scan` job runs `grep -rE` for hard-coded secret literals in `src/**/*.ts(x)` — assignments matching `(api_key|secret|password|token)\s*[:=]\s*['\"][a-zA-Z0-9]{20,}`. If any are found, CI fails. Real secrets MUST be loaded from `process.env` or `defineSecret()`.

---

## 5. Compliance Mapping

### 5.1 SOC 2 Type II

| Trust Service Criterion | How GSTPilot satisfies it |
| --- | --- |
| **Security (CC1–CC7)** | RBAC + ABAC (§1), network controls (TLS 1.3 + firewall), audit logging (§2), encryption (§3), secrets management (§4), incident response (§7). |
| **Availability (A1)** | Health check endpoints (`/api/system/health`, `/api/system-health`), daily backups + cross-region replication (see `docs/BACKUP_RECOVERY.md`), RTO 4h / RPO 24h, Cloud Functions auto-scale, multi-zone Firestore. |
| **Processing Integrity (PI1)** | Audit trails (§2.1) with hash-chain tamper-evidence, batched transactional writes, idempotent Cloud Functions (e.g. `renewalProcessedFor` flag in `billingRenewals`). |
| **Confidentiality (C1)** | TLS 1.3 in transit, AES-256-GCM at rest + application-layer, role-gated access, PII redaction in `aiContextGather` (PAN/GSTIN masked before reaching the LLM). |
| **Privacy (P1–P8)** | Data retention policy (§2.2), data subject rights (GDPR §5.3), consent capture at signup, DPA available on request, data residency `asia-south1` (India). |

### 5.2 ISO 27001 — Annex A controls

| Control | Implementation |
| --- | --- |
| **A.5 Information security policies** | This document + `DEPLOYMENT.md` + `docs/BACKUP_RECOVERY.md`. Reviewed annually. |
| **A.6 Organization of information security** | Defined roles (Founder, Platform Engineer, Compliance Officer, On-call). Two-person rule for full-system recovery (§3.5 of `BACKUP_RECOVERY.md`). |
| **A.8 Asset management** | All data assets inventoried in `firestore.indexes.json` (31 collections). Cloud Storage buckets inventoried in `BACKUP_RECOVERY.md` §7. |
| **A.9 Access control** | RBAC + ABAC (§1). Least-privilege service accounts per script. Access reviews quarterly. |
| **A.10 Cryptography** | TLS 1.3, AES-256-GCM, key rotation policy (§4.2), hash-chain audit logs (§2.3). |
| **A.12 Operations security** | CI/CD pipeline (`/.github/workflows/ci.yml` + `deploy.yml`), change-management via PR review, capacity monitoring via `/api/system-health`, malware protection via dependency scanning (`bun audit` recommended quarterly). |
| **A.13 Communications security** | TLS 1.3 only, HSTS preload, network segregation via Firebase project isolation. |
| **A.14 System acquisition, development & maintenance** | TS strict mode, ESLint zero-error policy, dependency pinning, security review on every PR. |
| **A.15 Supplier relationships** | Razorpay, Stripe, Gmail, WhatsApp, ERP providers — DPA in place, audit on request. |
| **A.16 Incident management** | See §7 Incident Response Plan. |
| **A.17 Business continuity** | See `docs/BACKUP_RECOVERY.md`. |
| **A.18 Compliance** | Indian DPDP Act 2023 (§5.4), GDPR (§5.3), GST Act, Companies Act 2013. |

### 5.3 GDPR (EU General Data Protection Regulation)

| Article | Implementation |
| --- | --- |
| **Art. 5 — Principles** | Data minimization (only collect what's needed for GST filing), purpose limitation (data used only for stated purpose), storage limitation (retention schedule in §2.2), integrity & confidentiality (§3). |
| **Art. 6 — Lawful basis** | Consent (signup flow) + contractual necessity (providing the GST filing service) + legal obligation (GST Act record retention). |
| **Art. 7 — Consent** | Captured at signup via checkbox (not pre-ticked). Withdrawable via account deletion. |
| **Art. 12 — Transparency** | Privacy policy on landing page + in-product `Settings → Privacy`. |
| **Art. 13/14 — Information** | Privacy policy covers identity of controller, purposes, recipients, retention, rights, cross-border transfers. |
| **Art. 15 — Right of access** | Implemented via `dataExport` Cloud Function — returns JSON of all user/org data within 30 days. |
| **Art. 16 — Right to rectification** | Users can edit their profile + client/invoice data via the UI. |
| **Art. 17 — Right to erasure** | Implemented via `onUserDelete` Cloud Function — deletes user profile + solo orgs, transfers multi-person orgs. Financial records retained per legal obligation (GST Act §36). |
| **Art. 18 — Right to restriction** | Available on request — user can suspend their account (`members.status = 'suspended'`). |
| **Art. 20 — Right to data portability** | `dataExport` returns JSON — portable to any system. |
| **Art. 21 — Right to object** | Marketing opt-out via `users.marketingOptIn = false`. |
| **Art. 25 — Privacy by design** | ABAC, encryption-by-default, PII redaction before LLM, least-privilege service accounts. |
| **Art. 28 — Processor (DPA)** | DPA available with Firebase, Razorpay, Stripe, Gmail, WhatsApp. |
| **Art. 32 — Security of processing** | TLS 1.3, AES-256-GCM, RBAC, audit logs, secrets rotation. |
| **Art. 33 — Breach notification** | Within 24 hours of detection via the alerts pipeline (see §7). Firebase Console + email + PagerDuty. |
| **Art. 35 — DPIA** | Completed for: AI Oracle (LLM processing of business data), Banking connector (Account Aggregator framework), ERP connector. |
| **Data residency** | All primary data in `asia-south1` (Mumbai). Cross-region mirror in `asia-south2` (Delhi) for DR only. No data leaves India for primary processing. EU user data (if any) also stored in `asia-south1` per data-residency election — disclosed in privacy policy. |

### 5.4 Indian DPDP Act 2023 (Digital Personal Data Protection)

| Section | Implementation |
| --- | --- |
| **§4 — Lawful processing** | Consent obtained at signup + explicit consent for sensitive processing (banking, ERP, AI). |
| **§5 — Notice** | Privacy notice presented at signup + accessible in `Settings → Privacy`. |
| **§6 — Consent Manager** | Account Aggregator framework (RBI) used for banking data — consent via `/api/aa/consent`. |
| **§7 — Purpose limitation** | Data used only for GST filing, accounting, billing — stated in privacy policy. |
| **§8 — Data Fiduciary obligations** | GSTPilot is the Data Fiduciary. Security safeguards (§3), breach notification (§8(6)), data retention (§2.2), grievance officer (see below). |
| **§10 — Significant Data Fiduciary** | GSTPilot may be classified as SDF given scale. Additional obligations: DPIA (Art. 35 GDPR equivalent), independent audit (annual), Data Protection Officer appointed. |
| **§11 — Data Principal rights** | Access (dataExport), correction (UI), erasure (onUserDelete — subject to legal retention), grievance redressal. |
| **§12 — Consent withdrawal** | Account deletion = withdrawal of all consent. |
| **§8(6) — Breach notification** | To the Data Protection Board of India + affected users, within 72 hours of becoming aware. Internal target: 24 hours. |
| **Grievance Officer** | privacy@gstpilot.in — name + contact published in privacy policy. Response time: 48 hours acknowledgement, 30 days resolution. |

---

## 6. Security Headers

The application serves the following headers on all HTTP responses (set via the security middleware / `next.config.ts` headers config):

| Header | Value | Purpose |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| `X-Content-Type-Options` | `nosniff` | Block MIME-type sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Block clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Disable unused browser APIs + FLoC |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.firebasedatabase.app wss://*.firebaseio.com; frame-src https://*.firebaseapp.com; font-src 'self' data:;` | Mitigate XSS / injection |
| `Cross-Origin-Opener-Policy` | `same-origin` | Process isolation |
| `Cross-Origin-Resource-Policy` | `same-origin` | Block cross-origin resource loads |

> Note: `'unsafe-inline'` + `'unsafe-eval'` on `script-src` are required because Next.js 16 inline-emits module scripts + uses eval in dev. Production hardening (nonce-based CSP) is a Phase 12+ task.

---

## 7. Incident Response Plan

### 7.1 Severity levels

| Severity | Definition | Response time |
| --- | --- | --- |
| **P0 — Critical** | Production down, data loss, security breach | 15 min ack, 1h mitigation, 4h resolution |
| **P1 — High** | Major feature broken, partial data loss risk, security incident | 1h ack, 4h mitigation, 24h resolution |
| **P2 — Medium** | Feature degraded, no data risk | 4h ack, 1d mitigation, 1w resolution |
| **P3 — Low** | Cosmetic, minor bug | 1d ack, 1w resolution |

### 7.2 Response phases

**1. Detect**
- Automated: alerts pipeline (`/api/alerts`) + Cloud Monitoring + Cloud Function error reporting. Triggers: error-rate spike, latency spike, auth failure burst, billing anomaly, security event (role escalation, key rotation).
- Manual: user reports via support@, internal observation.

**2. Contain** (within 15 min for P0)
- Revoke all active sessions: `firebase auth:revoke-all-tokens` (if auth compromise).
- Disable compromised Cloud Functions: `firebase functions:delete <fn>` or rollback to prior SHA (see `.github/workflows/deploy.yml` §rollback).
- Block offending IPs at the WAF / Cloud Load Balancer.
- If data exfiltration suspected: freeze Firestore writes by tightening rules to admin-only.

**3. Eradicate**
- Rotate ALL secrets in §4.2 (encryption keys, provider keys, webhooks, SMTP, Firebase token, service account).
- Revoke + reissue all API keys (developer platform: `/api/app-platform/*`).
- Patch the underlying vulnerability (code change → PR → CI → deploy).

**4. Recover**
- Restore from backup per `docs/BACKUP_RECOVERY.md` (RTO 4h target).
- Verify via `/api/system/health` + smoke-test the production UI.
- Gradually re-enable write access if it was frozen.

**5. Postmortem** (within 5 business days)
- Review audit logs (`/api/audit-logs`) to reconstruct the timeline.
- Write a blameless postmortem: timeline, root cause, impact, what went well, what didn't, action items.
- Action items tracked in the project management tool with owners + due dates.
- Filed in `docs/postmortems/{YYYY-MM-DD-incident-title}.md` (git-tracked for retention).

### 7.3 On-call rotation

- 1 primary + 1 secondary on-call engineer, weekly rotation (Mon 10:00 IST → next Mon 10:00 IST).
- PagerDuty schedule + Slack #oncall channel.
- Escalation: Founder → Compliance Officer → external IR firm (retainer with [vendor]).

### 7.4 Breach notification (regulatory)

| Regulator | Deadline | Channel |
| --- | --- | --- |
| Data Protection Board of India (DPDP) | 72 hours | Online portal + email |
| Affected data principals | Without undue delay | Email + in-product banner |
| GDPR supervisory authority (if EU users) | 72 hours | Lead authority email |
| Razorpay / Stripe (if payment data) | 24 hours | Provider's breach portal |
|CERT-In (if critical infrastructure) | 6 hours | cert-in.org.in incident form |

---

## 8. Rate Limiting

| Surface | Limit | Burst | Implementation |
| --- | --- | --- | --- |
| Default API routes | **100 req/min/IP** | 120 | In-memory token bucket per IP (per-instance; aggregate ~N×instances in prod) |
| Auth endpoints (login/signup) | 5 req/min/IP | 8 | Stricter — brute-force protection |
| AI Oracle / CFO | 20 req/min/user | 30 | Per-uid — LLM cost control |
| Data export (GDPR) | 1 req/hour/user | 1 | Heavy operation |
| Webhooks (Razorpay/Stripe) | Unlimited (provider-controlled) | — | Signature-verified |
| Cloud Functions (onCall) | 60 req/min/user | 90 | Firebase App Check + rate-limit decorator |

Clients exceeding the limit receive `429 Too Many Requests` with `Retry-After` header. Repeat offenders are auto-blocked for 1 hour.

---

## 9. Penetration Testing Checklist

Conducted annually by an independent firm + ad-hoc after major releases.

### 9.1 Scope

- Web app: `https://gstpilot1.web.app` + custom domain
- API: all 586 routes under `/api/*`
- Cloud Functions: 12 triggers under `functions/src/triggers/`
- Firestore rules + Storage rules
- Authentication flows (email/password, Google OAuth, password reset)
- Third-party integrations (Razorpay, Stripe, Gmail, WhatsApp, ERP)

### 9.2 Test types

| Type | Tool / method | Pass criteria |
| --- | --- | --- |
| **OWASP Top 10** | OWASP ZAP + manual | No Critical or High findings |
| **Auth bypass** | Manual + Burp Suite | No way to access another org's data |
| **IDOR** | Manual | `/api/invoices/{id}` rejects ids from other orgs |
| **SSRF** | Manual | No server-side request to internal IPs |
| **SQL injection** | sqlmap | Not applicable (Prisma parameterized) — verify with sqlmap |
| **NoSQL injection** | Manual | Firestore queries use typed SDK (no string concat) — verify |
| **XSS** | OWASP ZAP + manual | No reflected/stored XSS in 586 routes |
| **CSRF** | Manual | SameSite=Lax cookies + token-based auth |
| **Rate-limit test** | Custom script | 100+ req/min triggers 429 |
| **Secret scan** | `git secrets` + `trufflehog` | No secrets in git history |
| **Dependency scan** | `bun audit` + `npm audit` in CI | No high/critical vulns |
| **Cloud misconfig** | `firebase audit` + ScoutSuite | No public Firestore/Storage |
| **Crypto audit** | Manual | AES-256-GCM, no ECB, IVs random, keys rotated |
| **Business logic** | Manual | Cannot file GST return for another org, cannot refund own payment |

### 9.3 Findings triage

| Severity | SLA to fix |
| --- | --- |
| Critical | 24 hours |
| High | 7 days |
| Medium | 30 days |
| Low | Next quarter |

All findings + remediation tracked in the security issue tracker. Critical/High findings reported to the Compliance Officer weekly.

---

## 10. Change Log

| Date | Change | Author |
| --- | --- | --- |
| Phase 11 | Initial security + compliance doc created | Platform Engineering + Compliance Officer |
