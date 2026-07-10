// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Provider Registry (SERVER-ONLY)
//
// The SINGLE switch-point between providers. Today returns MockGenProvider;
// when AI_PROVIDER=official env var is set, returns FutureOfficialGenProvider.
//
// All existing pages communicate ONLY through IGenProvider (via the service
// layer). Switching to production later means changing exactly ONE env var —
// no service, hook, or UI code changes.
//
// This file is SERVER-ONLY — it imports the providers which use `node:crypto`.
// API routes + the background processor are the only consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IGenProvider } from '../provider';
import { MockGenProvider } from './mock-provider';
import { FutureOfficialGenProvider } from './official-provider';

export type AIProviderName = 'mock' | 'official';

let cachedProvider: IGenProvider | null = null;

/**
 * Resolve which provider to use based on the `AI_PROVIDER` env var.
 *   • 'official' (or 'live', 'production', 'openai', 'anthropic') → FutureOfficialGenProvider
 *   • everything else (default, 'mock', undefined) → MockGenProvider
 */
export function getProviderName(): AIProviderName {
  const raw = (process.env.AI_PROVIDER ?? 'mock').toLowerCase().trim();
  if (['official', 'live', 'production', 'openai', 'anthropic', 'google'].includes(raw)) {
    return 'official';
  }
  return 'mock';
}

/**
 * Get the active AI provider. Cached for the process lifetime — switching
 * providers requires a server restart.
 *
 * Server-only: callers MUST be API routes or the background processor.
 */
export function getGenProvider(): IGenProvider {
  if (cachedProvider) return cachedProvider;
  const name = getProviderName();
  cachedProvider = name === 'official'
    ? new FutureOfficialGenProvider()
    : new MockGenProvider();
  return cachedProvider;
}

/**
 * For diagnostics — returns a description of the active provider.
 */
export function describeProvider(): { name: string; isLive: boolean; providerName: string } {
  const provider = getGenProvider();
  return {
    name: provider.name,
    isLive: provider.isLive,
    providerName: provider.providerName,
  };
}
