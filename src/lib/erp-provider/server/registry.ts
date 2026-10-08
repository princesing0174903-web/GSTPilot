// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — Provider Registry (SERVER-ONLY)
//
// The SINGLE place that decides which ERP provider implementation is active.
//
// Env var: ERP_PROVIDER (default: 'auto')
//   • 'auto' / 'mock'  — Mock providers (one per connection.provider field)
//   • 'tally-future'   — FutureTallyProvider (real Tally, throws NotImplementedError)
//   • 'zoho_books-future' — FutureZohoBooksProvider (real Zoho, throws)
//   • 'busy-future'    — FutureBusyProvider (real Busy, throws)
//   • 'quickbooks-future' — FutureQuickBooksProvider (real QBO, throws)
//
// The registry returns the provider implementation for a SPECIFIC ERP
// (tally / zoho_books / busy / quickbooks) so each connection can use its own
// backend. In 'mock' mode (default), each ERP gets its own Mock provider. In
// 'future' mode, each ERP gets its real provider once implemented.
//
// Switching to production = change ONE env var — no service/hook/UI changes.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ERPProviderName } from '../types';
import type { IERPProvider } from '../provider';
import { MockTallyProvider } from './mock-tally-provider';
import { MockZohoBooksProvider } from './mock-zoho-books-provider';
import { MockBusyProvider } from './mock-busy-provider';
import { MockQuickBooksProvider } from './mock-quickbooks-provider';
import {
  FutureTallyProvider,
  FutureZohoBooksProvider,
  FutureBusyProvider,
  FutureQuickBooksProvider,
} from './future-providers';

// ─── Cached provider instances (one per ERP name) ────────────────────────────

const cache = new Map<ERPProviderName, IERPProvider>();

/**
 * Resolve the active provider for a given ERP name.
 *
 * In the default 'mock' mode, this returns the appropriate Mock provider.
 * In 'future' mode (ERP_PROVIDER=<erp>-future), this returns the real provider
 * (which throws NotImplementedError until implemented).
 */
export function getERPProvider(provider: ERPProviderName): IERPProvider {
  const cached = cache.get(provider);
  if (cached) return cached;

  const mode = (process.env.ERP_PROVIDER ?? 'auto').toLowerCase();
  let instance: IERPProvider;

  // Per-ERP future override takes precedence.
  const futureKey = `${provider}-future`;
  if (mode === futureKey) {
    instance = createFutureProvider(provider);
  } else if (mode === 'auto' || mode === 'mock') {
    instance = createMockProvider(provider);
  } else {
    // Unknown mode — fall back to mock with a warning.
    console.warn(
      `[erp-provider/registry] Unknown ERP_PROVIDER='${mode}'. Falling back to mock providers.`,
    );
    instance = createMockProvider(provider);
  }

  cache.set(provider, instance);
  return instance;
}

function createMockProvider(provider: ERPProviderName): IERPProvider {
  switch (provider) {
    case 'tally':
      return new MockTallyProvider();
    case 'zoho_books':
      return new MockZohoBooksProvider();
    case 'busy':
      return new MockBusyProvider();
    case 'quickbooks':
      return new MockQuickBooksProvider();
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = provider;
      void _exhaustive;
      throw new Error(`Unknown ERP provider: ${provider}`);
    }
  }
}

function createFutureProvider(provider: ERPProviderName): IERPProvider {
  switch (provider) {
    case 'tally':
      return new FutureTallyProvider();
    case 'zoho_books':
      return new FutureZohoBooksProvider();
    case 'busy':
      return new FutureBusyProvider();
    case 'quickbooks':
      return new FutureQuickBooksProvider();
    default: {
      const _exhaustive: never = provider;
      void _exhaustive;
      throw new Error(`Unknown ERP provider: ${provider}`);
    }
  }
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

/**
 * Describe the active provider for an ERP — used by the /api/erp/status route.
 */
export function describeERPProvider(provider: ERPProviderName): {
  name: string;
  provider: ERPProviderName;
  isLive: boolean;
  mode: string;
} {
  const p = getERPProvider(provider);
  return {
    name: p.name,
    provider: p.provider,
    isLive: p.isLive,
    mode: (process.env.ERP_PROVIDER ?? 'auto').toLowerCase(),
  };
}
