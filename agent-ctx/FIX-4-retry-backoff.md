# Task ID: FIX-4 — Retry Backoff for MastersIndia Provider

**Agent**: Z.ai Code
**Status**: ✅ COMPLETE
**Files modified**: `src/lib/gst-reconciliation/server/mastersindia-provider.ts` (+147 lines, 396 → 543)
**Lint**: exit 0 (no errors, no warnings)

## Summary

Added retry-with-backoff to all 3 HTTP calls in the MastersIndia GSP provider:
1. OAuth2 token endpoint (POST `/oauth/token`) — in `authenticate()`
2. GSTR-2B fetch endpoint (GET `/gstr2b/getGSTR2B`) — in `fetchGSTR2B()`
3. GSTIN verification endpoint (GET `/gstin/search`) — in `verifyGSTIN()`

## Retry configuration

| Parameter | Value |
|---|---|
| maxAttempts | 3 (initial + 2 retries) |
| initialDelayMs | 500 |
| multiplier | 2 (exponential: 500ms, 1000ms, 2000ms) |
| maxDelayMs | 30_000 (cap, mainly for Retry-After) |
| Retry on | network errors, timeouts (GSP_TIMEOUT), 429 (GSPRateLimitError), 5xx (GSPGSTNOutageError + GSPError 5xx) |
| Fail-fast on | 401/403 (GSPAuthError), 400 (GSPConfigError), 404 (GSPNotFoundError), other 4xx |
| Retry-After | honoured on 429 — delta-seconds OR HTTP-date, capped at 30s |

## Approach

- **Used a small private inline helper** (`fetchJsonWithRetry`) rather than the shared `retryWithBackoff` directly. Reason: `retryWithBackoff` does not support per-error delay overrides, which are required to honour the `Retry-After` header. The spec explicitly allows this ("If the existing retry utility doesn't quite fit, you may add a small helper function within mastersindia-provider.ts").
- **Reused `isRetryableError`** from `@/lib/reliability/retry` as a defensive fallback in the GSP-specific classifier.
- **Preserved all typed errors**: `GSPAuthError` / `GSPRateLimitError` / `GSPGSTNOutageError` are re-thrown as-is after retries are exhausted (callers see the same error classes as before).
- **Preserved the 30s AbortController timeout**: each retry attempt gets its own 30s timeout (the timeout lives inside `fetchJson`, which `fetchJsonWithRetry` calls per attempt).

## Key implementation details

- `parseRetryAfter(header)` — RFC 7231 §7.1.3 compliant: handles delta-seconds (integer) and HTTP-date forms.
- `isRetryableGSPError(err)` — classifies GSPError subclasses + inspects `statusCode` for generic GSPError.
- `fetchJsonWithRetry<T>(url, opts)` — the retry loop. Non-retryable errors fail fast (preserving typed error class). After maxAttempts, the last typed error is re-thrown as-is.
- 429 handler in `fetchJson` now attaches `retryAfterMs` to the thrown `GSPRateLimitError` via intersection-type cast (`as GSPRateLimitError & { retryAfterMs?: number }`). The error class itself is unchanged.
- Emits `console.warn` per retry (method, attempt, delay, error message — no URLs to avoid leaking GSTINs).

## Constraints honoured

- ✅ Public API unchanged (`authenticate`, `fetchGSTR2B`, `verifyGSTIN`, `testConnection` signatures byte-identical)
- ✅ 30s AbortController timeout preserved
- ✅ No new dependencies
- ✅ Response shapes unchanged
- ✅ Typed errors preserved

## Deviations

- Used inline helper instead of `retryWithBackoff` directly (spec permits this for Retry-After support).
- Added `console.warn` per retry (spec didn't require it, but provides essential observability).
- Capped `Retry-After` at 30s to bound worst-case sync latency.

Full work record: see `/home/z/my-project/worklog.md` (appended).
