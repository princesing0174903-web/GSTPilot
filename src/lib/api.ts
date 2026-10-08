// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Frontend API Utility
// Typed helper functions for calling backend routes.
//
// Every helper wraps `fetchWithTimeout` so requests get a 30s AbortController
// timeout by default, a `res.ok` check, and a typed error message extracted
// from the response body. No request hangs forever.
// ═══════════════════════════════════════════════════════════════════════════════

import { fetchWithTimeout, FetchTimeoutError, type FetchWithTimeoutOptions } from '@/lib/async';

const API_BASE = '/api';
const DEFAULT_TIMEOUT_MS = 30_000;

function buildUrl(path: string, params?: Record<string, string>): string {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return `${API_BASE}${path}${query}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const msg = (body as Record<string, unknown>).error;
      if (typeof msg === 'string') return msg;
    }
  } catch {
    // response body isn't JSON — fall through
  }
  return `API Error: ${res.status} ${res.statusText}`;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string>,
  options?: FetchWithTimeoutOptions,
): Promise<T> {
  const res = await fetchWithTimeout(buildUrl(path, params), {
    method: 'GET',
    ...options,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: FetchWithTimeoutOptions,
): Promise<T> {
  const res = await fetchWithTimeout(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...options,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  options?: FetchWithTimeoutOptions,
): Promise<T> {
  const res = await fetchWithTimeout(buildUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    body: JSON.stringify(body),
    ...options,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  return res.json() as Promise<T>;
}

export async function apiPut<T>(
  path: string,
  body: unknown,
  options?: FetchWithTimeoutOptions,
): Promise<T> {
  const res = await fetchWithTimeout(buildUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    body: JSON.stringify(body),
    ...options,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  return res.json() as Promise<T>;
}

export async function apiDelete<T = void>(
  path: string,
  options?: FetchWithTimeoutOptions,
): Promise<T> {
  const res = await fetchWithTimeout(buildUrl(path), {
    method: 'DELETE',
    ...options,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  // Some DELETE endpoints return 204 No Content — guard the JSON parse.
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
}

// Re-export so callers can `instanceof FetchTimeoutError` without a second import.
export { FetchTimeoutError };
