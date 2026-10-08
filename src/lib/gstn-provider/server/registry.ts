// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real GSTN Integration™ — Provider Registry (SERVER-ONLY)
//
// The SINGLE switch-point between providers. Today returns MockGSTProvider;
// when GSTN_PROVIDER=official env var is set, returns FutureOfficialGSTProvider.
//
// All existing pages communicate ONLY through IGSTProvider (via the service
// layer). Switching to production later means changing exactly ONE env var —
// no service, hook, or UI code changes.
//
// This file is SERVER-ONLY — it imports the providers which use `node:crypto`.
// API routes are the only consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IGSTProvider } from '../provider';
import { MockGSTProvider } from './mock-provider';
import { FutureOfficialGSTProvider } from './official-provider';

export type GSTProviderName = 'mock' | 'official';

let cachedProvider: IGSTProvider | null = null;

/**
 * Resolve which provider to use based on the `GSTN_PROVIDER` env var.
 *   • 'official' (or 'live', 'production') → FutureOfficialGSTProvider
 *   • everything else (default, 'mock', undefined) → MockGSTProvider
 */
export function getProviderName(): GSTProviderName {
  const raw = (process.env.GSTN_PROVIDER ?? 'mock').toLowerCase().trim();
  if (raw === 'official' || raw === 'live' || raw === 'production') {
    return 'official';
  }
  return 'mock';
}

/**
 * Get the active GSTN provider. The provider is cached for the process lifetime
 * — switching providers requires a server restart (which is correct: provider
 * changes are an ops concern, not a runtime concern).
 *
 * Server-only: callers MUST be API routes or server services.
 */
export function getGSTProvider(): IGSTProvider {
  if (cachedProvider) return cachedProvider;
  const name = getProviderName();
  cachedProvider = name === 'official'
    ? new FutureOfficialGSTProvider()
    : new MockGSTProvider();
  return cachedProvider;
}

/**
 * For diagnostics — returns a description of the active provider.
 */
export function describeProvider(): { name: string; isLive: boolean; configured: boolean } {
  const provider = getGSTProvider();
  return {
    name: provider.name,
    isLive: provider.isLive,
    configured: true,
  };
}
