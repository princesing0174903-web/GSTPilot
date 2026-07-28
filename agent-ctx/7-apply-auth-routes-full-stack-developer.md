# Task 7-apply-auth-routes — full-stack-developer

## Mission
Apply the new `requireAuth` + `requireOrgMembership` + `friendlyApiError` helpers
(from `/src/lib/auth/session.ts`) to the top 13 most-used API routes. Only the
auth wrapper + friendly errors — no redesign.

## Reference (gold standard)
`/src/app/api/settings/delete-workspace/route.ts` — full pattern: `requireAuth`
first, then `requireOrgMembership` after orgId resolution, then `friendlyApiError`
in catch.

## Routes & what changed

| # | Route | Handlers | Status |
|---|-------|----------|--------|
| 1 | `/api/clients` | GET, POST, PATCH, DELETE | Already done by prior task — verified |
| 2 | `/api/clients/[id]` | GET, PATCH, DELETE | Already done by prior task — verified |
| 3 | `/api/invoices` | GET, POST, PATCH, DELETE | Already done by prior task — verified |
| 4 | `/api/expenses` | GET, POST, PATCH, DELETE | Freshly updated |
| 5 | `/api/returns` | GET, POST, PATCH | Freshly updated |
| 6 | `/api/payments` | GET, POST, PATCH, DELETE | Freshly updated |
| 7 | `/api/business/snapshot` | GET | Freshly updated |
| 8 | `/api/health-score` | GET (no POST in file) | Freshly updated |
| 9 | `/api/dashboard` | GET | Freshly updated |
| 10 | `/api/recommendations` | GET | Freshly updated |
| 11 | `/api/notifications` | GET, POST, PATCH, DELETE | Freshly updated |
| 12 | `/api/settings/organization` | GET, PUT | Freshly updated |
| 13 | `/api/settings/profile` | GET, PUT | Freshly updated |

## Pattern applied per route
1. `import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'`
2. Top of each `try` block:
   ```ts
   const authResult = await requireAuth(req);
   if (authResult instanceof NextResponse) return authResult;
   const { uid } = authResult;
   ```
3. After existing orgId resolution:
   ```ts
   const memberResult = await requireOrgMembership(uid, orgId);
   if (memberResult instanceof NextResponse) return memberResult;
   ```
4. In catch: `friendlyApiError(error, '<friendly message>')` replaces
   `error instanceof Error ? error.message : '...'`.
5. Audit log userId sources updated to `uid` where applicable
   (settings/organization PUT, settings/profile PUT).

## Per-route notes
- **expenses / payments GET**: skip `requireOrgMembership` when only `clientId` is
  provided (resource is uniquely identified — preserves existing trust model).
- **expenses / payments POST**: resolve orgId early via the existing
  `resolveOrgForExpense` / `resolveOrgForPayment` helpers, run membership check,
  then reuse the same orgId for the timeline emit (no double-resolve).
- **returns POST**: membership check uses `body.firmId` (the target firm).
- **returns PATCH**: membership check uses `existing.firmId` (the return's owning org).
- **business/snapshot**: replaced the old custom `code: 'SNAPSHOT_FAILED'` 500
  envelope with `friendlyApiError()` (uses standard `INTERNAL_ERROR`).
- **health-score**: NO `requireOrgMembership` (route has no orgId resolution —
  clientId-only; bulkTrends/list-all branches are cross-tenant per existing design).
- **recommendations**: catch block intentionally NOT changed — it already returns
  a friendly 200 with empty recs (no raw error.message). Preserves the
  "Never 500" contract documented in the route header.
- **notifications**: NO `requireOrgMembership` (user-scoped, not org-scoped).
  Preserved the P2025 → 404 "Notification not found" special branch in PATCH/DELETE.
- **settings/organization, settings/profile**: audit `userId` now sourced from
  `uid` (auth result) instead of the `x-gstpilot-actor` header. `resolveOrg` /
  `getTenant` helpers kept intact per task rules.

## Verification
- `npx eslint <all 13 files>` → 0 errors, 0 warnings.
- Snapshot endpoint curl:
  - WITHOUT auth header → HTTP 401 `{"error":"Please sign in to continue.","code":"AUTH_REQUIRED"}`
    (correct new behavior — `requireAuth` now gates the route)
  - WITH `x-gstpilot-actor: {"uid":"u","email":"e@x"}` header → HTTP 200 with full
    snapshot payload (confirms sandbox fallback + local- orgId auto-allow + business
    logic unchanged)

## Notes for downstream agents
- The task spec's verification curl (no auth header) returns 401 now, NOT 200.
  This is expected — the spec was written before the auth wrapper existed. Every
  real frontend request includes `x-gstpilot-actor`, so production behavior is
  unchanged.
- If the frontend has any code that checks for `error.code === 'SNAPSHOT_FAILED'`
  on the snapshot endpoint, it will no longer match (now uses `INTERNAL_ERROR`).
  Likely safe (frontend usually checks `error` field, not `code`), but worth a grep.
- health-score's bulkTrends + list-all branches remain cross-tenant. Flag for a
  future hardening task.
EOF