# GSTPilot Infinity™ — Deployment Guide

> **TL;DR** — GSTPilot is a Next.js 16 app with 586 API routes. It requires a **Node.js runtime** (not static hosting). The cheapest production path is Vercel or Cloud Run. Firebase App Hosting requires the Firebase Blaze plan.

---

## Architecture Summary

| Layer | Technology | Why it requires a server |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + shadcn/ui | Client-rendered SPA |
| Backend | 586 Next.js API routes (Route Handlers) | Need Node runtime |
| Database | Firebase Firestore (multi-tenant) | Client SDK + Admin SDK |
| Auth | Firebase Auth | Client SDK |
| Storage | Firebase Cloud Storage | Client SDK |
| Background jobs | Cloud Functions (12 triggers) | Serverless Node 20 |
| ORM | Prisma (legacy Phase 1-4 SQLite) | Server-side only |

**Static export (`output: 'export'`) is NOT possible** because:
- 586 API routes require server-side execution
- 387 routes are explicitly `force-dynamic`
- Cloud Functions require a Node host

---

## Option 1: Vercel (Recommended — Easiest)

```bash
# 1. Push to GitHub
git remote add origin https://github.com/your-username/gstpilot.git
git push -u origin main

# 2. Import on Vercel
#    Visit https://vercel.com/new and select the repo.

# 3. Set environment variables in the Vercel dashboard
#    (Copy all from .env + add the secrets listed in apphosting.yaml)

# 4. Deploy — Vercel auto-detects Next.js and runs `next build`
```

**Build command**: `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`
**Output mode**: `standalone` (already set in `next.config.ts`)

---

## Option 2: Firebase App Hosting (Requires Blaze Plan)

```bash
# 1. Upgrade to Firebase Blaze plan
#    https://console.firebase.google.com/project/gstpilot1/usage/details

# 2. Install Firebase CLI
npm i -g firebase-tools
firebase login

# 3. Create App Hosting backend (one-time)
firebase apphosting:backends:create --project gstpilot1 --location asia-south1

# 4. Set secrets
firebase apphosting:secrets:set BILLING_ENCRYPTION_KEY
firebase apphosting:secrets:set BANKING_ENCRYPTION_KEY
firebase apphosting:secrets:set ERP_ENCRYPTION_KEY
firebase apphosting:secrets:set GSTN_ENCRYPTION_KEY
firebase apphosting:secrets:set COMMUNICATION_ENCRYPTION_KEY
firebase apphosting:secrets:set AI_PIPELINE_ENCRYPTION_KEY
firebase apphosting:secrets:set INTEGRATIONS_ENCRYPTION_KEY
firebase apphosting:secrets:set FIREBASE_PROJECT_ID
firebase apphosting:secrets:set FIREBASE_CLIENT_EMAIL
firebase apphosting:secrets:set FIREBASE_PRIVATE_KEY
firebase apphosting:secrets:set NEXTAUTH_SECRET
firebase apphosting:secrets:set NEXTAUTH_URL

# 5. Deploy
firebase apphosting:backends:deploy gstpilot-backend --project gstpilot1
```

**Config**: `apphosting.yaml` (already created at project root)

---

## Option 3: Cloud Run (Self-managed, GCP)

```bash
# 1. Build and push
gcloud run deploy gstpilot \
  --source . \
  --region asia-south1 \
  --memory 4Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --allow-unauthenticated \
  --set-env-vars NODE_OPTIONS=--max-old-space-size=2048 \
  --set-env-vars NEXT_PUBLIC_FIREBASE_PROJECT_ID=gstpilot1 \
  --set-env-vars NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAcq3nU7qOhi7zn0_2gYqamnmk-BZNTP24 \
  --set-env-vars NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gstpilot1.firebaseapp.com \
  --set-env-vars NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=gstpilot1.firebasestorage.app \
  --set-env-vars NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=44040248808 \
  --set-env-vars NEXT_PUBLIC_FIREBASE_APP_ID=1:44040248808:web:466c38a29dd3f7a8dd185d \
  --set-env-vars NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-RN53TNYCK5

# 2. Set secrets via Secret Manager
gcloud secrets create BILLING_ENCRYPTION_KEY --data-file=- <<< "$(openssl rand -hex 32)"
# ... repeat for each secret
```

---

## Option 4: Self-hosted (any Node 20+ server)

```bash
# On the server:
git clone https://github.com/your-username/gstpilot.git
cd gstpilot
bun install
bun run build
bun run start  # starts the standalone server on port 3000

# Use PM2 or systemd for process management:
pm2 start "bun run start" --name gstpilot
pm2 save && pm2 startup
```

---

## Deploying Cloud Functions (separate, all options)

```bash
cd functions
npm install

# Set secrets (one-time)
firebase functions:secrets:set BILLING_ENCRYPTION_KEY
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASSWORD

# Deploy
npm run deploy
# or from project root:
firebase deploy --only functions
```

---

## Deploying Firestore Rules + Indexes

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

---

## Post-Deployment Verification

1. **Health check**: `curl https://your-domain/api/billing/plans` → should return 200 with plan list.
2. **Auth flow**: Visit `/`, click Sign In, sign up with email — should create user in Firebase Auth.
3. **Firestore**: After signup, check Firestore for `users/{uid}` + `organizations/{orgId}` + `organization_members/{orgId}_{uid}` documents.
4. **Cloud Functions**: `firebase functions:log` — should show no errors on the auth-on-create trigger.
5. **Storage**: Try uploading a document — should appear in Cloud Storage under `organizations/{orgId}/documents/`.

---

## Environment Variables Checklist

### Public (safe for client)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### Server-only secrets
- `BILLING_ENCRYPTION_KEY`
- `BANKING_ENCRYPTION_KEY`
- `ERP_ENCRYPTION_KEY`
- `GSTN_ENCRYPTION_KEY`
- `COMMUNICATION_ENCRYPTION_KEY`
- `AI_PIPELINE_ENCRYPTION_KEY`
- `INTEGRATIONS_ENCRYPTION_KEY`
- `BILLING_PROVIDER` (default: `auto`)
- `ERP_PROVIDER` (default: `auto`)
- `FIREBASE_PROJECT_ID` (for admin SDK)
- `FIREBASE_CLIENT_EMAIL` (for admin SDK)
- `FIREBASE_PRIVATE_KEY` (for admin SDK)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

---

## What NOT to do

- ❌ Do NOT use `output: 'export'` — it breaks 586 API routes.
- ❌ Do NOT use Firebase Hosting (static) — it cannot serve API routes.
- ❌ Do NOT attempt to deploy Cloud Functions without first setting all 6 secrets.
- ❌ Do NOT commit `.env` or service account JSON to git.
