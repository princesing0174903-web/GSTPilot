# Backup & Disaster Recovery — GSTPilot Infinity™

**Project:** `gstpilot1` (Firebase, region `asia-south1`)
**Last updated:** Phase 11 — DevOps & Compliance
**Owner:** Platform Engineering
**Approved by:** Founder

---

## 1. Backup Strategy

Three tiers of backups run automatically. All backups land in Cloud Storage buckets in `asia-south1` and are encrypted at rest with Google-managed keys (CMEK available on request).

### 1.1 Daily automated Firestore export

| Property | Value |
| --- | --- |
| Trigger | Cloud Scheduler → Pub/Sub → Cloud Function `firestoreScheduledExport` |
| Schedule | `0 1 * * *` (01:00 IST daily) |
| Mechanism | `firestore-admin` `exportDocuments` to `gs://gstpilot1-backups-daily/{date}/` |
| Format | Firestore native export (LevelDB shards + metadata) |
| Retention | 30 days (lifecycle rule deletes objects older than 30d) |

The Cloud Function is configured to use the **managed export** API (not the per-collection JSON walker in `scripts/backup.ts`). The managed export is atomic and consistent — it does NOT block writes.

### 1.2 Weekly full backup (JSON)

| Property | Value |
| --- | --- |
| Trigger | Cloud Scheduler → Cloud Function `weeklyJsonBackup` |
| Schedule | `0 4 * * 0` (04:00 IST every Sunday) |
| Mechanism | `scripts/backup.ts` walks 31 collections, paginated read (500/page), writes `backups/{ts}/{collection}.json`, compresses to `.tar.gz`, uploads to `gs://gstpilot1-backups-weekly/{date}.tar.gz` |
| Format | JSON per collection (human-readable, portable, restorable via `scripts/restore.ts`) |
| Retention | 12 weeks (84 days) |

### 1.3 Monthly cold archive

| Property | Value |
| --- | --- |
| Trigger | Object Finalize on the weekly bucket → Cloud Function `archiveToCold` (fires on last Sunday of month — detected via the file name's month) |
| Mechanism | Copies the weekly `.tar.gz` to `gs://gstpilot1-backups-archive/` with `storageClass: ARCHIVE` |
| Format | Same `.tar.gz` as weekly |
| Retention | 7 years (2,557 days) — compliance with Indian DPDP Act 2023 + GST record retention |
| Retrieval | Archive class — up to 12h retrieval time. Use only for legal/regulatory requests. |

### 1.4 Storage backups

Cloud Storage for the application (`gstpilot1.firebasestorage.app`) is backed up via:

- **Bucket versioning** — enabled on the primary bucket. Keeps all object versions for 90 days (lifecycle rule transitions old versions to Nearline after 30d, then deletes after 90d).
- **Cross-region replication** — async replication to a secondary bucket `gstpilot1-backup-mirror` in `asia-south2` (Delhi). RPO 15 minutes for storage objects.

### 1.5 Configuration & secrets backup

- **Firestore rules + indexes:** version-controlled in `firestore.rules` / `firestore.indexes.json` / `storage.rules` in the Git repository. Git history is the backup.
- **Cloud Functions source:** version-controlled in `functions/` directory. Git history is the backup.
- **Cloud Function secrets:** backed up via `firebase functions:secrets:access` to a sealed GPG-encrypted file in the archive bucket on the 1st of each month (manual operation, two-person rule).

---

## 2. Recovery Objectives

| Metric | Target | Notes |
| --- | --- | --- |
| **RPO** (Recovery Point Objective) | 24 hours | Worst-case data loss = 1 daily export cycle. Storage RPO = 15 min via cross-region replication. |
| **RTO** (Recovery Time Objective) | 4 hours | From incident declaration to full service restoration. |
| **RTO — Cloud Functions only** | 30 minutes | Single `firebase deploy --only functions` from main branch. |
| **RTO — Rules + indexes only** | 15 minutes | Single `firebase deploy --only firestore:rules,firestore:indexes,storage`. |
| **Backup verification cadence** | Weekly | Test restore to staging project `gstpilot1-staging` (see §4). |

---

## 3. Recovery Procedures

### 3.1 Firestore restore — from daily managed export

> **Use when:** data corruption or accidental deletion < 24h old.
> **Estimated time:** 30–90 minutes depending on dataset size.

```bash
# 1. Identify the most recent successful export.
gsutil ls gs://gstpilot1-backups-daily/ | tail -5

# 2. (Optional) Restore to a staging project first to verify.
gcloud config set project gstpilot1-staging
gcloud firestore import gs://gstpilot1-backups-daily/2024-01-15T01-00-00-000Z/

# 3. If staging looks good, restore to production.
gcloud config set project gstpilot1
gcloud firestore import gs://gstpilot1-backups-daily/2024-01-15T01-00-00-000Z/

# 4. Verify in the Firebase Console → Firestore → Data.
# 5. Verify in the production UI — check the dashboard, clients list, invoices list.
```

**⚠ Managed exports OVERWRITE the entire database by default.** To restore individual collections only, use the JSON restore path in §3.2.

### 3.2 Firestore restore — from weekly JSON backup (granular)

> **Use when:** only specific collections need to be restored (e.g. just `invoices`), or you need to merge with existing data.
> **Estimated time:** 10–60 minutes depending on collection size.

```bash
# 1. Download the weekly .tar.gz archive.
gsutil cp gs://gstpilot1-backups-weekly/2024-01-14T04-00-00-000Z.tar.gz backups/

# 2. Extract it.
cd backups && tar -xzf 2024-01-14T04-00-00-000Z.tar.gz && cd ..

# 3. DRY-RUN first — see what would be written without touching Firestore.
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
  bun run scripts/restore.ts backups/2024-01-14T04-00-00-000Z

# 4. Restore specific collections only (recommended for partial recovery).
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
  bun run scripts/restore.ts backups/2024-01-14T04-00-00-000Z \
  --confirm --only invoices,clients

# 5. Full restore (IRREVERSIBLE — overwrites existing docs).
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
  bun run scripts/restore.ts backups/2024-01-14T04-00-00-000Z --confirm
```

### 3.3 Storage restore

> **Use when:** files (documents, invoices PDFs, exports) are corrupted or deleted.
> **Estimated time:** 15 minutes.

```bash
# Option A — restore a specific deleted object from bucket versioning.
gsutil cp \
  gs://gstpilot1.firebasestorage.app/orgs/{orgId}/documents/{file}#1234 \
  gs://gstpilot1.firebasestorage.app/orgs/{orgId}/documents/{file}

# Option B — restore the entire bucket from the cross-region mirror.
# Run from a host with both buckets accessible.
gsutil -m rsync -r \
  gs://gstpilot1-backup-mirror \
  gs://gstpilot1.firebasestorage.app
```

### 3.4 Cloud Functions redeploy

> **Use when:** a function is misbehaving or was accidentally deleted.
> **Estimated time:** 5–10 minutes.

```bash
# From a clean checkout of main branch:
git checkout main
git pull
cd functions
npm ci
npm run build
npx firebase deploy --only functions --project gstpilot1
```

### 3.5 Full system recovery (complete regional outage)

> **Use when:** entire Firebase project or `asia-south1` region is unavailable.
> **Estimated time:** 3–4 hours (target RTO).
> **Two-person rule:** requires Founder + Platform Engineer approval.

```bash
# 1. Provision a new Firebase project in a backup region (asia-south2 / Delhi).
firebase projects:create gstpilot1-recovery
firebase use gstpilot1-recovery

# 2. Restore Firestore from the most recent daily export.
gcloud firestore import gs://gstpilot1-backups-daily/{latest}/

# 3. Restore Storage from the cross-region mirror.
gsutil -m rsync -r gs://gstpilot1-backup-mirror gs://gstpilot1-recovery.firebasestorage.app

# 4. Deploy rules + indexes + functions.
firebase deploy --only firestore:rules,firestore:indexes,storage
cd functions && npm ci && npm run build && npx firebase deploy --only functions

# 5. Re-point DNS (gstpilot.in / app.gstpilot.in) to the new project's
#    hosting URL. This is the manual gate — needs Founder sign-off.

# 6. Deploy the Next.js app (see DEPLOYMENT.md for App Hosting / Vercel / Cloud Run).

# 7. Update environment variables in the new project:
#    firebase functions:secrets:set BILLING_ENCRYPTION_KEY
#    firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
#    firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
#    firebase functions:secrets:set SMTP_HOST
#    firebase functions:secrets:set SMTP_USER
#    firebase functions:secrets:set SMTP_PASSWORD

# 8. Verify:
#    - https://gstpilot-recovery.web.app loads
#    - /api/system/health returns 200
#    - Auth login works (test with a real account)
#    - Firestore console shows restored data
#    - Cloud Functions trigger correctly (test signup → onUserCreate)

# 9. Postmortem (see docs/SECURITY.md §Incident Response Plan).
```

---

## 4. Backup Verification

### 4.1 Weekly automated test restore

A scheduled Cloud Function runs every Saturday at 06:00 IST:

1. Picks the most recent daily export from `gs://gstpilot1-backups-daily/`.
2. Imports it into the staging project `gstpilot1-staging` (wiping prior staging data first).
3. Runs a smoke test:
   - Document count matches the production count (±2% tolerance for in-flight writes).
   - Top 10 collections each have ≥1 document.
   - A test auth user can be created.
   - The `dashboard` API route returns 200.
4. Publishes a verification report to a Pub/Sub topic consumed by the alerting pipeline (see `docs/SECURITY.md`).
5. If verification fails, alerts the on-call engineer via PagerDuty / email.

### 4.2 Manual quarterly DR drill

Every quarter (Jan / Apr / Jul / Oct), the team performs a full §3.5 drill in an isolated recovery project. The drill is timed and the RTO is recorded. Target: RTO ≤ 4 hours.

---

## 5. Retention Schedule (Summary)

| Tier | Frequency | Format | Storage Class | Retention |
| --- | --- | --- | --- | --- |
| Daily | 01:00 IST daily | Firestore native export | Standard | 30 days |
| Weekly | 04:00 IST Sunday | JSON `.tar.gz` | Standard | 12 weeks (84 days) |
| Monthly archive | Last Sunday of month | JSON `.tar.gz` | Archive | 7 years (2,557 days) |
| Storage versioning | Per-object write | Native | Standard → Nearline (30d) → delete (90d) | 90 days |
| Storage mirror | Continuous (async) | Native | Standard | Indefinite |
| Config (Git) | Per-commit | Text | GitHub | Indefinite |
| Cloud Function secrets | Monthly (manual) | GPG-sealed | Archive | 7 years |

---

## 6. Roles & Responsibilities

| Role | Backup responsibility | Restore responsibility |
| --- | --- | --- |
| Founder | Approves full-system recovery | Approves full-system recovery (two-person rule) |
| Platform Engineer | Owns the backup Cloud Functions, monitors daily success | Runs §3.1, §3.2, §3.3, §3.4 |
| On-call Engineer | Responds to backup-failure alerts within 1 hour | Executes §3.4 (functions only) without approval |
| Compliance Officer | Audits monthly that archives exist for the prior 7 years | Approves retrieval from Archive class |

---

## 7. Cloud Storage Bucket Layout

```
gs://gstpilot1-backups-daily/          # Daily Firestore native exports
  2024-01-14T01-00-00-000Z/
    ...
  2024-01-15T01-00-00-000Z/
    ...

gs://gstpilot1-backups-weekly/         # Weekly JSON .tar.gz (human-readable)
  2024-01-07T04-00-00-000Z.tar.gz
  2024-01-14T04-00-00-000Z.tar.gz

gs://gstpilot1-backups-archive/        # Monthly cold archive (7-year retention)
  2024-01.tar.gz
  2024-02.tar.gz

gs://gstpilot1-backup-mirror/          # Async cross-region mirror of primary storage bucket
  orgs/
    {orgId}/
      documents/
      invoices/
      ...

gs://gstpilot1-secrets-archive/        # GPG-sealed monthly secret exports
  2024-01-secrets.gpg
```

---

## 8. Alerting

| Condition | Severity | Channel |
| --- | --- | --- |
| Daily Firestore export fails | P1 | PagerDuty + email to platform-eng@ |
| Weekly JSON backup fails | P2 | Email to platform-eng@ |
| Weekly test-restore verification fails | P1 | PagerDuty |
| Cross-region storage mirror lag > 1h | P2 | Email |
| Bucket lifecycle rule misconfigured | P3 | Slack #platform-alerts |

Alerts are emitted via the existing alerts pipeline (`/api/alerts` + Cloud Function `alertRouter`). The on-call rotation is documented in `docs/SECURITY.md` §Incident Response Plan.

---

## 9. Change Log

| Date | Change | Author |
| --- | --- | --- |
| Phase 11 | Initial BCP/DR plan created | Platform Engineering |
