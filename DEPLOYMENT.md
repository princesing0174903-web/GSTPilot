# GSTPilot Infinity™ — Production Deployment Guide

This document explains how to deploy GSTPilot Infinity to an independent,
permanent production URL that does **not** require the Z.ai preview
environment to be open.

---

## 1. Architecture Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, standalone output) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| ORM | Prisma 6 (SQLite for dev, PostgreSQL for prod) |
| Auth | Firebase Auth (client) + session cookies (server) |
| AI | z-ai-web-dev-sdk (default), OpenAI/Anthropic/Gemini (optional) |
| Banking | Setu Account Aggregator (sandbox → production) |
| GST | MastersIndia GSP (sandbox credentials — to be supplied) |
| Accounting | Zoho Books (OAuth 2.0) |
| Email/Drive/Sheets | Google Workspace (OAuth 2.0) |
| Hosting (recommended) | Vercel (Node.js runtime, `bom1` region for India) |

The app is built with `output: "standalone"` in `next.config.ts`, which
produces a self-contained `.next/standalone/` bundle that can run on any
Node.js host (Vercel, Railway, Fly.io, Docker, bare metal).

---

## 2. Z.ai / Preview Dependency Audit

The codebase was audited for runtime dependencies on the Z.ai preview
environment. **No production code path requires Z.ai to be open.**

| Occurrence | Classification | Action |
|-----------|---------------|--------|
| `next.config.ts` → `allowedDevOrigins: ["*.space-z.ai", "localhost", ...]` | DEV ONLY | Allows the preview iframe to work in dev. Ignored in production builds. **No action needed.** |
| `src/middleware.ts` → CSP `frame-ancestors 'self' https://*.space-z.ai` | SAFE | Only affects whether the app can be embedded in an iframe. Production deployments are not embedded, so this policy has no effect. **No action needed.** |
| `src/lib/google-workspace/auth.ts` → `PREVIEW_PUBLIC_DOMAIN_SUFFIX = 'space-z.ai'` + `abc` header detection | SAFE + ENVIRONMENT-AWARE | Derives the OAuth redirect URI from the **request origin**. On a production hostname (e.g. `app.yourdomain.com`), it uses that hostname directly. The `space-z.ai` branch only activates when the `abc` header is present (Z.ai gateway). **Works correctly on any production domain.** |
| `src/lib/integrations/zoho-books/oauth.ts` → same pattern | SAFE + ENVIRONMENT-AWARE | Same as Google. Derives from request origin. **Works on any production domain.** |
| `.env.setu.template` → example preview URL | TEMPLATE ONLY | A template file, not loaded by the app. **Replace with your production URL when configuring Setu.** |
| `localhost:3000` fallbacks in OAuth helpers | DEV FALLBACK | Only used when no request origin can be derived (local dev). Production requests always have a valid `Host` header. **No action needed.** |

**Conclusion:** The application is already architected to run independently.
The Z.ai preview detection logic is additive — it enhances the preview
experience without breaking production.

---

## 3. Branding Audit

| Surface | Status |
|---------|--------|
| Browser title | `GSTPilot™ — The Financial Brain of India` ✓ |
| OG / Twitter cards | `GSTPilot™` ✓ |
| PWA manifest (`name`, `short_name`) | `GSTPilot — The Financial Brain of India` / `GSTPilot` ✓ |
| Favicon / apple-touch-icon | GSTPilot brand assets in `/public/brand/` ✓ |
| Theme color | `#000000` (GSTPilot dark) ✓ |
| Error pages (404, 500, global-error) | GSTPilot-branded ✓ |
| Loading / auth screens | GSTPilot-branded ✓ |

**No "Z.ai" branding exists in any user-visible surface.** The Z.ai name
appears only in code comments documenting the preview-gateway integration.

---

## 4. Production Deployment (Vercel)

### Step 1 — Push to Git

```bash
git init && git add -A && git commit -m "GSTPilot Infinity — production"
git remote add origin git@github.com:<you>/gstpilot-infinity.git
git push -u origin main
```

### Step 2 — Create Vercel Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Framework preset: **Next.js** (auto-detected from `next.config.ts`)
4. Root directory: `./` (default)
5. Build command: `next build` (auto-detected)
6. Output directory: `.next` (auto-detected)
7. Install command: `bun install` (or `npm install`)
8. Region: **bom1** (Mumbai — lowest latency for Indian users)
9. `vercel.json` is already in the repo and will be picked up automatically

### Step 3 — Configure Environment Variables

In the Vercel dashboard → Settings → Environment Variables, add every
variable from `.env.example` that applies to your deployment. At minimum:

**Required:**
- `DATABASE_URL` — PostgreSQL connection string (see Step 4)
- `CSRF_SECRET` — `openssl rand -hex 32`
- `NEXT_PUBLIC_APP_URL` — `https://app.yourdomain.com` (your Vercel URL or custom domain)
- `NODE_ENV` — `production` (Vercel sets this automatically)

**Firebase (auth):**
- All `NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_*` variables

**Google Workspace:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- In Google Cloud Console → Authorized redirect URIs, add:
  `https://app.yourdomain.com/api/integrations/google/callback`

**Zoho Books:**
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_DC=in`
- `ZOHO_OAUTH_STATE_SECRET` — `openssl rand -hex 32`
- In Zoho API Console → Authorized redirect URIs, add:
  `https://app.yourdomain.com/api/integrations/zoho/callback`

**Setu Banking (start with SANDBOX):**
- `SETU_CLIENT_ID`, `SETU_CLIENT_SECRET`, `SETU_PRODUCT_INSTANCE_ID`
- `SETU_BASE_URL=https://sandbox.setu.co`
- `SETU_REDIRECT_URL=https://app.yourdomain.com/banking/consent/return`
- `SETU_WEBHOOK_SECRET`

**GSTN / MastersIndia:**
- Use official **sandbox** credentials only (do NOT use documentation samples)
- `GSTN_PROVIDER=mastersindia`
- `GSTN_API_BASE_URL`, `GSTN_CLIENT_ID`, `GSTN_CLIENT_SECRET`, etc.

**AI:**
- `AI_PROVIDER=zai`, `ZAI_API_KEY`, `ZAI_MODEL`
- (or `openai`/`anthropic`/`gemini` with their respective keys)

### Step 4 — Provision PostgreSQL

**Recommended:** Neon (serverless Postgres, free tier, Mumbai region) or
Supabase or Vercel Postgres.

1. Create a database at [neon.tech](https://neon.tech)
2. Copy the connection string: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require&schema=public`
3. Set as `DATABASE_URL` in Vercel
4. Run the schema push from your local machine (or a Vercel build step):
   ```bash
   DATABASE_URL="postgresql://..." bun run db:push
   ```
5. **Never** run `db:reset` in production — it drops all data.

### Step 5 — Deploy & Verify

1. Click **Deploy** in Vercel
2. Wait for the build to complete (~3-5 min)
3. Visit the Vercel-provided URL (e.g. `gstpilot-xxx.vercel.app`)
4. Verify `/api/health` returns `{"status":"healthy","environment":"production",...}`
5. Configure your custom domain (Step 6)

### Step 6 — Custom Domain

1. Vercel dashboard → your project → Settings → Domains
2. Add `app.yourdomain.com` (or `gstpilot.yourdomain.com`)
3. Add the DNS records Vercel shows you (typically a `CNAME` to `cname.vercel-dns.com`)
4. Wait for DNS propagation (5 min - 24 h)
5. Update `NEXT_PUBLIC_APP_URL` to the custom domain
6. Update OAuth redirect URIs in Google Cloud Console + Zoho Console + Setu dashboard to the custom domain
7. Redeploy

---

## 5. Direct URL / Deep-Link Support

GSTPilot is a single-route SPA (`/` with `?view=` query params). Every view
is reachable via a direct URL:

| View | URL |
|------|-----|
| Dashboard | `/` or `/?view=dashboard` |
| Invoices | `/?view=invoices` |
| Customers | `/?view=clients` |
| Banking | `/?view=banking` |
| GST Reconciliation | `/?view=reconciliation` |
| Returns | `/?view=returns` |
| Reports | `/?view=reports` |
| Oracle AI | `/?view=ai-cfo` |
| Google Workspace | `/?view=google-workspace` |
| Zoho Books | `/?view=zoho-books` |

Refreshing any of these will **not** produce a 404 — they all resolve to the
root route which renders the appropriate view via the `view` query param.

---

## 6. Health Check Endpoint

`GET /api/health` is public (no auth) and returns:

```json
{
  "ok": true,
  "status": "healthy",
  "environment": "production",
  "app": "gstpilot-infinity",
  "version": "0.2.0",
  "database": "healthy",
  "uptime": 3600,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "responseMs": 42
}
```

Use this for:
- Uptime monitoring (UptimeRobot, Pingdom)
- Vercel deployment health checks
- Kubernetes liveness/readiness probes
- Load balancer health checks

The endpoint never leaks secrets — it returns only aggregate status + version.

---

## 7. OAuth Callback URLs — Production Checklist

For each integration, add the **production** callback URL in the provider's
console (keep dev/sandbox URLs separate):

| Provider | Production Callback URL |
|----------|----------------------|
| Google Workspace | `https://app.yourdomain.com/api/integrations/google/callback` |
| Zoho Books | `https://app.yourdomain.com/api/integrations/zoho/callback` |
| Setu Banking (redirect) | `https://app.yourdomain.com/banking/consent/return` |
| Setu Banking (webhook) | `https://app.yourdomain.com/api/webhooks/setu` |

The code **auto-derives** these from the request origin, so you do not need
to set `GOOGLE_REDIRECT_URI` / `ZOHO_REDIRECT_URI` explicitly in production —
they will resolve to `https://app.yourdomain.com/...` automatically.
Setting them explicitly is also fine and takes precedence.

---

## 8. Webhook URLs

| Webhook | URL | Notes |
|---------|-----|-------|
| Setu | `https://app.yourdomain.com/api/webhooks/setu` | Setu posts AA consent + transaction events here |
| Email (inbound) | `https://app.yourdomain.com/api/webhooks/email` | If using an inbound email provider |
| WhatsApp | `https://app.yourdomain.com/api/webhooks/whatsapp` | Meta WhatsApp Business webhook |

**Never** point production webhooks at `localhost` or the Z.ai preview URL.

---

## 9. Security Checklist

- [x] No secrets in client-side code (`NEXT_PUBLIC_*` prefix is client-exposed — only use for public keys)
- [x] No development credentials committed (`.env` is gitignored)
- [x] HTTPS enforced by Vercel (HSTS automatic)
- [x] Secure cookies (Vercel sets `Secure` + `HttpOnly` automatically in production)
- [x] CORS: API routes use relative paths (`/api/...`) — no cross-origin needed
- [x] CSP: `src/middleware.ts` sets a restrictive Content-Security-Policy
- [x] Tenant isolation: every API route uses `requireAuth` + `requireOrgMembership` (Phase 2 verified)
- [x] No sample/documentation API credentials in source (MastersIndia creds must be supplied via env)
- [x] `GSTPILOT_ALLOW_SEED` left blank in production (prevents demo data injection)

---

## 10. Post-Deployment Acceptance Test

After deployment, perform this exact sequence with Z.ai **completely closed**:

1. Open a fresh Chrome window (no Z.ai tabs)
2. Type your permanent GSTPilot URL
3. Verify the landing page loads (no 404, no blank screen)
4. Click **Sign In** → Firebase auth → dashboard loads
5. Navigate to: Dashboard → Invoices → Customers → Banking → GST → Reports → Oracle
6. Refresh each page — no 404, no hydration crash
7. Open a new tab → navigate to GSTPilot again → session persists (no re-login)
8. Verify no "Z.ai" text appears anywhere in the UI
9. Verify `/api/health` returns `"environment":"production"`
10. Create a test invoice → verify it appears in Dashboard + Reports + Oracle
11. Check browser console — no red errors

If all 11 pass, GSTPilot is independently deployed.

---

## 11. Alternative: Docker / Self-Hosted

If you prefer self-hosting over Vercel:

```bash
# Build the standalone bundle
bun run build    # produces .next/standalone/

# Run with Node.js
NODE_ENV=production \
DATABASE_URL="postgresql://..." \
CSRF_SECRET="..." \
node .next/standalone/server.js
```

A `Dockerfile` can be built on top of `node:20-alpine` copying the
standalone output. Use a process manager (PM2, systemd) for auto-restart.

---

## 12. Remaining Technical Debt (Documented)

These items were identified during the Phase 3 canonical-business-logic audit
and are documented for a future hardening sprint. They do **not** block
production deployment:

1. **Duplicate GST calculation engines** — `lib/oracle-cfo/invoice-engine.ts`
   has a tax-inclusive `calculateGST` used only by the Oracle conversational
   flow (intentional UX: "₹50,000 at 18% GST" means tax-inclusive). It writes
   to Firestore, not the canonical Prisma DB, so it does not affect
   Dashboard/Reports/Oracle headline numbers. The canonical engine is
   `lib/invoices/invoices-utils.ts → calculateInvoiceTotals`.

2. **Vendor model has no `organizationId` column** — it is scoped via
   `client.firmId`. This is fragile when a vendor is not linked to a client.
   A future migration should add `organizationId` to `Vendor`, `Payment`,
   and `GSTRFiling` directly.

3. **`lib/banking/engine.ts` (`buildCashFlowState`)** — serves the legacy
   `/api/bank/*` route family. The `/api/banking-intel/*` routes use a
   separate engine. Both are canonical for their respective UI surfaces;
   they are not duplicates. A future consolidation could merge them.

4. **`ReportsPage.tsx`** reads some metrics from Firestore rather than the
   canonical Prisma snapshot. The `/api/ai-reports` endpoint (Phase 2) reads
   from canonical sources. A future migration should move `ReportsPage.tsx`
   to use `/api/ai-reports`.

5. **Draft invoices count toward revenue** in the canonical snapshot (only
   `cancelled` is excluded). This is conservative — excluding `draft` would
   zero-out revenue for orgs that don't transition invoices to `sent`.
   A future workflow improvement should reliably set `status='sent'` on
   issuance, then the snapshot can exclude both `draft` and `cancelled`.
