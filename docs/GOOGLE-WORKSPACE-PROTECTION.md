# Google Workspace Integration — Protected Infrastructure

> **Status: STABLE PRODUCTION. Do not refactor.**
>
> The Google Workspace integration (Gmail, Drive, Docs, Sheets, Calendar) is
> complete and verified. From this point onward it is treated as **production
> infrastructure**, not experimental code. Future work builds ON TOP of it —
> it does not repeatedly rebuild it.

This document is the contract that protects the integration from regressions.
Every contributor (human or AI agent) MUST read it before touching any file
listed in §1.

---

## 1. Protected Files (do not refactor unless explicitly instructed)

These files implement the working OAuth flow, token encryption, and Google
service wrappers. They are frozen. Editing them requires (a) a documented
reason, (b) preservation of existing behaviour, and (c) a passing
`bun run gw-check` (and `gw-check:live <url>` if OAuth/callback behaviour
could be affected).

### Core library — `src/lib/google-workspace/`

| File | Role | Why it's protected |
|---|---|---|
| `auth.ts` | OAuth config, `resolvePublicOrigin()`, `resolveRedirectUri()`, `buildAuthUrl()`, `encodeState()`/`decodeState()`, `exchangeCodeForTokens()`, `getValidAccessToken()`, `refreshAccessToken()`, `storeTokens()`/`loadTokens()`, `disconnectGoogle()`, `getConnectionStatus()`, `resolveOrgUserFromHeaders()` | The entire OAuth lifecycle. Contains the `abc`-header fix for the preview gateway hostname rewriting. A regression here breaks OAuth for every user. |
| `crypto.ts` | `encrypt()` / `decrypt()` / `safeDecrypt()` (AES-256-GCM, key derived from `GOOGLE_CLIENT_SECRET` via HKDF-SHA256). | If the key derivation or IV/tag layout changes, every stored token becomes undecryptable → all users locked out. |
| `route-auth.ts` | `resolveGoogleAuth(req)` — shared auth gate for all service routes. | Every service route depends on this. Changing the 401/403 contract breaks the frontend. |
| `services.ts` | `gmail`, `drive`, `docs`, `sheets`, `calendar` service wrappers (thin Google REST API clients). | The frontend hooks call these exact function names. Renaming or changing signatures breaks the UI. |
| `index.ts` | Barrel export. | Adding/renaming exports ripples to every import site. |

### API routes — `src/app/api/integrations/google/`

| Route file | Path | Role |
|---|---|---|
| `connect/route.ts` | `GET /api/integrations/google/connect` | Builds the Google consent URL + encodes the OAuth state. |
| `callback/route.ts` | `GET /api/integrations/google/callback` | Exchanges the code, stores tokens, redirects to `/?view=google-workspace&google_connected=1`. **Contains the 404 fix** — redirects to the ROOT route `/` (not `/google-workspace`, which is a client-side view, not a route). |
| `status/route.ts` | `GET /api/integrations/google/status` | Returns `{ connected, userEmail, scopes }`. |
| `disconnect/route.ts` | `POST /api/integrations/google/disconnect` | Revokes tokens + marks row revoked. |
| `gmail/route.ts` | `GET/POST /api/integrations/google/gmail` | Gmail list/send/draft. |
| `drive/route.ts` | `GET/POST /api/integrations/google/drive` | Drive list/upload/create-folder. |
| `docs/route.ts` | `POST /api/integrations/google/docs` | Create Google Doc. |
| `sheets/route.ts` | `POST /api/integrations/google/sheets` | Export data to a Sheet. |
| `calendar/events/route.ts` | `GET/POST /api/integrations/google/calendar/events` | List + create Calendar events. **The route file MUST live at `calendar/events/route.ts`** (not `calendar/route.ts`) — moving it back causes the Calendar 404 regression. |

### Frontend — protected behaviour contracts

| File | Why it's protected |
|---|---|
| `src/contexts/AppContext.tsx` | `currentView` lazy-initializes from `?view=` URL param. **This is the 404 fix's other half** — without it, the app loads the dashboard instead of the Google Workspace view after OAuth. |
| `src/hooks/useGoogleWorkspace.ts` | Frontend hook calling the routes above. Endpoint URLs + header names are part of the contract. |
| `src/components/google-workspace/GoogleWorkspacePage.tsx` | Reads `?google_connected=1` / `?google_error=` from the URL and shows the success/error banner. The banner + URL-cleaning logic is load-bearing. |

### Environment

| File | Why it's protected |
|---|---|
| `.env` | Tracked. Contains `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. May be periodically wiped by the sandbox auto-sync — `.env.local` covers this. |
| `.env.local` | **Gitignored** (by `.env*` pattern). Permanent home for Google OAuth vars. Survives `.env` wipes. NEVER delete, NEVER commit. |
| `prisma/schema.prisma` → `GoogleWorkspaceToken` model | The `@@unique([organizationId, userId])` constraint + field names are load-bearing. Renaming fields breaks `auth.ts` queries. |

---

## 2. Permanent Rules

1. **Never modify working OAuth logic unless absolutely necessary.** If a
   future task touches authentication, routing, middleware, Google services,
   environment loading, callback handling, or redirects: preserve existing
   behaviour, keep backward compatibility, do not rewrite working code.

2. **Run the regression check on every dev-server restart.** The fast guard
   (`bun run gw-check`) verifies env vars + token encryption in <1s. The full
   guard (`bun run gw-check:live <preview-url>`) adds 12 HTTP probes. Both
   exit non-zero on failure. **Do not continue development with a failing
   check** — fix the regression first.

3. **Protect the files in §1.** Do not refactor them unless explicitly
   instructed. If a future task requires editing them, explain why first and
   preserve existing behaviour. Run `bun run gw-check` (and `gw-check:live`
   if OAuth/callback behaviour could be affected) before considering the task
   done.

4. **Preserve environment configuration.** Future changes must never overwrite
   or remove `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or
   `GOOGLE_REDIRECT_URI`. If an env var is missing at runtime, the
   `getGoogleOAuthConfig()` guard throws a clear error — report it, do not
   silently change configuration.

5. **Preserve working routes.** Future development must never accidentally
   change working endpoints or callback URLs. The Calendar route MUST stay at
   `calendar/events/route.ts`. The callback MUST redirect to the ROOT route
   `/` (not `/google-workspace`). After any routing change, run
   `bun run gw-check:live <url>` and confirm all service routes return 401
   (not 404).

6. **Before every commit affecting Google Workspace**, run the regression
   checklist in §3. Only continue if all pass.

7. **Never reintroduce the bugs in §4.** They have been solved at significant
   cost; do not bring them back.

8. **Development rule.** Whenever you modify any Google-related code, ask
   yourself: *"Could this change break the existing Google Workspace
   integration?"* If the answer is "possibly", run
   `bun run gw-check:live <url>` and verify compatibility before completing
   the task.

---

## 3. Pre-Commit Regression Checklist

Before committing ANY change that touches Google Workspace code (or anything
that could affect it — routing, middleware, env, auth), run:

```bash
# Fast guard (env + crypto, <1s, no server needed):
bun run gw-check

# Full guard (env + crypto + 12 HTTP probes against a live preview):
bun run gw-check:live https://preview-chat-<chat-id>.space-z.ai
```

**Manual checklist (verify each):**

- [ ] OAuth connect — `GET /api/integrations/google/connect` returns `authUrl`
      + `redirectUri` on `space-z.ai` (not `fcapp.run`, not `localhost`).
- [ ] OAuth callback — `GET /api/integrations/google/callback?code=...&state=...`
      returns HTTP 307 to `/?view=google-workspace&...` (not `/google-workspace`).
- [ ] Tokens still decrypt — `encrypt()` → `decrypt()` round-trips.
- [ ] Gmail — `GET /api/integrations/google/gmail` returns 401 when not
      connected (not 404).
- [ ] Drive — `GET /api/integrations/google/drive` returns 401 (not 404).
- [ ] Docs — `POST /api/integrations/google/docs` returns 401 (not 404).
- [ ] Sheets — `POST /api/integrations/google/sheets` returns 401 (not 404).
- [ ] Calendar — `GET /api/integrations/google/calendar/events` returns 401
      (not 404). Route file is at `calendar/events/route.ts`.
- [ ] Connect — the full OAuth flow lands on the Google Workspace view with
      the "Google Workspace connected successfully." banner (no 404).
- [ ] Disconnect — `POST /api/integrations/google/disconnect` returns
      `{ ok: true }` (idempotent).
- [ ] Refresh — `GET /api/integrations/google/status` returns the current
      connection state.

Only continue if all pass.

---

## 4. Registry of Solved Bugs (NEVER reintroduce)

These issues have been diagnosed and fixed at significant cost. The
regression check (`scripts/google-workspace-regression-check.ts`) guards
against most of them. Do not bring them back.

### 4.1 — `fcapp.run` callback URLs (hostname regression)

**Symptom:** OAuth redirected to
`ws-ac-e-fb-ebdd-qzovjyebwd.cn-hongkong-vpc.fcapp.run` →
`ERR_CONNECTION_TIMED_OUT`.

**Root cause:** The preview gateway overwrites `Host` / `x-forwarded-host`
with a stale internal `fcapp.run` hostname, but it ALSO sets a custom `abc`
header containing the real public preview hostname prefix.

**Fix:** `resolvePublicOrigin()` in `src/lib/google-workspace/auth.ts` checks
the `abc` header FIRST, constructing `https://${abc}.space-z.ai`. The stale
`Host`/`x-forwarded-host` are correctly ignored.

**Guarded by:** regression check "Connect: redirect_uri on space-z.ai (NOT
fcapp.run/localhost)".

### 4.2 — Incorrect preview hostname detection (Origin-header fallback)

**Symptom:** `resolvePublicOrigin()` used the browser `Origin` header, but
the OAuth callback is a top-level navigation from Google (no `Origin`
header), so it fell through to stale `Host`.

**Fix:** The connect step encodes the resolved `redirectUri` into the OAuth
`state`. The callback decodes `state.redirectUri` and uses it for BOTH the
token exchange and the final browser redirect — no reliance on callback
request headers.

**Guarded by:** regression check "Callback: HTTP 307 redirect" +
"Callback: redirects to root".

### 4.3 — Broken callback redirects (404 after successful OAuth)

**Symptom:** OAuth succeeded, tokens saved, but the browser landed on a 404.
Refreshing showed "Connected".

**Root cause:** The callback redirected to
`${publicOrigin}/google-workspace?google_connected=1`, but
`/google-workspace` is a CLIENT-SIDE VIEW identifier (AppContext
`currentView` state), NOT a Next.js route. There is no
`src/app/google-workspace/page.tsx` file → Next.js 404.

**Fix:** The callback now redirects to the ROOT route `/` (always exists)
with `?view=google-workspace&google_connected=1`. `AppContext`
lazy-initializes `currentView` from `?view=`, so the Google Workspace view
renders immediately and `GoogleWorkspacePage` shows the success banner.

**Guarded by:** regression check "Callback: redirects to root '/'" +
"Root route /?google_connected=1&view=google-workspace → 200".

### 4.4 — Missing environment variables (`.env` wiped by sandbox auto-sync)

**Symptom:** `GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars are not set.`
The sandbox auto-sync periodically rewrites `.env` to just `DATABASE_URL`.

**Fix:** `.env.local` (gitignored, permanent) contains the Google OAuth vars.
Next.js loads `.env.local` independently of `.env`, so the vars survive
`.env` wipes.

**Guarded by:** regression check "GOOGLE_CLIENT_ID is set" +
"GOOGLE_CLIENT_SECRET is set".

### 4.5 — Calendar route mismatch (404 on events endpoint)

**Symptom:** `GET /api/integrations/google/calendar/events?max=10` returned
404. The frontend called `/calendar/events` but the route file was at
`calendar/route.ts` (serves `/calendar`, not `/calendar/events`).

**Fix:** Route file moved to `src/app/api/integrations/google/calendar/events/route.ts`.
The file location MUST stay here — moving it back causes the 404.

**Guarded by:** regression check "Service route EXISTS: GET
/api/integrations/google/calendar/events".

### 4.6 — Invalid attendee handling

Calendar event creation validates the `attendees` array. Do not pass
non-email strings; the Google Calendar API rejects them. The
`calendar.createEvent()` wrapper in `services.ts` is the single source of
truth for the request body shape.

### 4.7 — Broken event loading

`calendar.listEvents()` in `services.ts` is the single source of truth for
the upcoming-events response shape. The frontend
(`GoogleWorkspacePage.tsx` CalendarTab) destructures `events[].summary`,
`start.dateTime`, etc. Do not change the response field names without
updating the frontend.

---

## 5. Architectural Invariants (must always hold)

1. **The OAuth `redirect_uri` sent to Google in the authorize step MUST
   exactly match the `redirect_uri` sent in the token-exchange step.** Google
   rejects mismatches with `redirect_uri_mismatch`. Both are derived from
   `resolveRedirectUri(req)` / `decoded.redirectUri` — do not diverge them.

2. **The callback redirect target is ALWAYS the ROOT route `/`** with
   `?view=<view>&google_connected=1` (or `google_error=...`). It is NEVER a
   path like `/google-workspace` (which is a client-side view, not a route).

3. **`resolvePublicOrigin()` checks the `abc` header FIRST**, before `Origin`,
   `x-forwarded-host`, or `Host`. The `abc` header is the only reliable
   signal for the real public preview hostname.

4. **Token encryption uses AES-256-GCM** with the key derived from
   `GOOGLE_CLIENT_SECRET` via HKDF-SHA256 (salt:
   `gstpilot::google-workspace::v1`). Changing the salt, key derivation, or
   IV/tag layout makes every stored token undecryptable.

5. **The `GoogleWorkspaceToken` Prisma model has `@@unique([organizationId,
   userId])`** — one active connection per org+user pair. `storeTokens()`
   upserts on this key.

6. **All five service routes (Gmail, Drive, Docs, Sheets, Calendar) are
   protected by `resolveGoogleAuth(req)`**, which returns 401 when the user
   is not connected. They NEVER return 404 (a 404 means the route file is
   missing or misnamed — a regression).

7. **The Calendar route file lives at
   `src/app/api/integrations/google/calendar/events/route.ts`** (not
   `calendar/route.ts`). The frontend calls `/calendar/events`.

---

## 6. How to Safely Extend the Integration

If you need to ADD functionality (a new Google service, a new scope, a new
field on the token row), follow this order:

1. **Read this document fully.**
2. **Run `bun run gw-check` and `bun run gw-check:live <url>`** — confirm
   green baseline before you start.
3. **Add the new code in a NEW file** where possible (e.g. a new service
   module, a new route). Do not modify the existing protected files unless
   strictly necessary.
4. **If you MUST modify a protected file**, document the reason in the PR /
   worklog, preserve all existing behaviour, and run the full regression
   check afterward.
5. **If you add a new Google service route**, register it in the regression
   check script (`scripts/google-workspace-regression-check.ts`) so future
   changes are guarded.
6. **Run `bun run gw-check:live <url>` again** after your change. Fix any
   failure before considering the task done.

---

## 7. Verification Cadence

| When | What | Command |
|---|---|---|
| Every dev-server restart | env + crypto fast guard | `bun run gw-check` |
| Before any commit touching Google Workspace | full HTTP guard | `bun run gw-check:live <preview-url>` |
| After any routing / middleware / env change | full HTTP guard | `bun run gw-check:live <preview-url>` |
| Manual end-to-end (real Google account) | click Connect Google → consent → verify "Connected" + no 404 | (browser) |

---

## 8. Quick Reference

```bash
# Fast guard (no server needed, <1s):
bun run gw-check

# Full guard (against a live preview URL):
bun run gw-check:live https://preview-chat-<chat-id>.space-z.ai

# Regression check script source:
scripts/google-workspace-regression-check.ts
```

**If any check fails: STOP. Fix the regression before continuing development.**
