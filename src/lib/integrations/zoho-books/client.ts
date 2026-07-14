// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books API Client
//
// Thin `fetch` wrapper for the Zoho Books REST API with:
//   • Automatic Bearer-token injection
//   • Exponential-backoff retry on 5xx + network errors (3 attempts)
//   • Never-throw semantics (returns { data, error, status })
//   • Organization-id query param injection (Zoho Books is multi-tenant —
//     every request needs `organization_id` for most endpoints)
//
// SERVER-ONLY. The access token is resolved upstream via
// `getValidAccessToken()` from oauth.ts (which handles auto-refresh).
// ═══════════════════════════════════════════════════════════════════════════════

import { getZohoEndpoints } from './oauth';
import type { ApiResult } from './types';

/** Maximum retry attempts for transient failures (5xx / network). */
const MAX_RETRIES = 3;
/** Base delay in ms for exponential backoff (500ms, 1000ms, 2000ms). */
const BASE_BACKOFF_MS = 500;

/** Sleep helper for backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Whether a response status is retryable (5xx or 429 rate-limited). */
function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/** Whether an error is retryable (network / abort). */
function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('socket hang up') ||
      msg.includes('aborted')
    );
  }
  return false;
}

export interface ZohoFetchOptions extends RequestInit {
  /**
   * Zoho Books numeric organization ID. Most Zoho Books endpoints require
   * `organization_id` as a query param — pass it here and it'll be injected
   * automatically.
   */
  organizationId?: string;
  /** Override the default retry count (default: 3). */
  maxRetries?: number;
}

/**
 * Low-level Zoho Books API fetch with retry + never-throw semantics.
 *
 * - Injects `Authorization: Bearer <accessToken>`
 * - Injects `organization_id` query param when `organizationId` is provided
 * - Retries up to `maxRetries` times on 5xx / 429 / network errors with
 *   exponential backoff (500ms → 1s → 2s)
 * - Parses JSON when the response is `application/json`, else returns text
 * - Returns `{ data, error, status }` — NEVER throws
 */
export async function zohoFetch<T>(
  path: string,
  accessToken: string,
  options: ZohoFetchOptions = {},
): Promise<ApiResult<T>> {
  const { organizationId, maxRetries = MAX_RETRIES, ...init } = options;
  const endpoints = getZohoEndpoints();

  // Build the full URL. `path` may start with "/" (relative to apiBaseUrl) or
  // be a fully-qualified URL (rare — used when Zoho returns a paginated
  // `next_page` link).
  const baseUrl = path.startsWith('http') ? '' : `${endpoints.apiBaseUrl}`;
  const url = new URL(path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`);

  // Inject organization_id into the query string (Zoho Books is multi-tenant).
  if (organizationId && !url.searchParams.has('organization_id')) {
    url.searchParams.set('organization_id', organizationId);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let lastError: string | null = null;
  let lastStatus = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 500ms, 1000ms, 2000ms, …
      const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    try {
      const resp = await fetch(url.toString(), { ...init, headers });

      // Retryable HTTP status → loop again.
      if (isRetryableStatus(resp.status)) {
        lastStatus = resp.status;
        const text = await resp.text().catch(() => '');
        lastError = `Zoho API error ${resp.status}: ${text.slice(0, 500)}`;
        if (attempt < maxRetries) continue;
        return { data: null, error: lastError, status: resp.status };
      }

      // Non-retryable error → return immediately.
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return {
          data: null,
          error: `Zoho API error ${resp.status}: ${text.slice(0, 500)}`,
          status: resp.status,
        };
      }

      // Success — parse the body.
      if (resp.status === 204) {
        return { data: null as T, error: null, status: resp.status };
      }
      const ct = resp.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const json = (await resp.json()) as T;
        return { data: json, error: null, status: resp.status };
      }
      const text = await resp.text();
      return { data: text as unknown as T, error: null, status: resp.status };
    } catch (err) {
      lastStatus = 0;
      lastError = err instanceof Error ? err.message : 'Network error calling Zoho API.';
      if (!isRetryableError(err) || attempt >= maxRetries) {
        return { data: null, error: lastError, status: 0 };
      }
      // else loop again
    }
  }

  return { data: null, error: lastError ?? 'Exhausted retries.', status: lastStatus };
}

/**
 * Convenience GET wrapper.
 *
 * @example
 *   const res = await zohoGet<ZohoBooksOrganizationsResponse>('/organizations', token);
 */
export async function zohoGet<T>(
  path: string,
  accessToken: string,
  options?: Omit<ZohoFetchOptions, 'method' | 'body'>,
): Promise<ApiResult<T>> {
  return zohoFetch<T>(path, accessToken, { ...(options ?? {}), method: 'GET' });
}

/**
 * Convenience POST wrapper.
 *
 * @example
 *   const res = await zohoPost<{ invoice: { invoice_id: string } }>('/invoices', token, {
 *     body: JSON.stringify(payload),
 *     organizationId: zohoOrgId,
 *   });
 */
export async function zohoPost<T>(
  path: string,
  accessToken: string,
  options?: Omit<ZohoFetchOptions, 'method'>,
): Promise<ApiResult<T>> {
  return zohoFetch<T>(path, accessToken, { ...(options ?? {}), method: 'POST' });
}

/**
 * Convenience PUT wrapper.
 */
export async function zohoPut<T>(
  path: string,
  accessToken: string,
  options?: Omit<ZohoFetchOptions, 'method'>,
): Promise<ApiResult<T>> {
  return zohoFetch<T>(path, accessToken, { ...(options ?? {}), method: 'PUT' });
}

/**
 * Convenience DELETE wrapper.
 */
export async function zohoDelete<T>(
  path: string,
  accessToken: string,
  options?: Omit<ZohoFetchOptions, 'method' | 'body'>,
): Promise<ApiResult<T>> {
  return zohoFetch<T>(path, accessToken, { ...(options ?? {}), method: 'DELETE' });
}
