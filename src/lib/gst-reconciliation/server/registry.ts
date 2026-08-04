// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GSP Provider Registry
// ═══════════════════════════════════════════════════════════════════════════════
//
// The SINGLE place where GSP providers are registered. Switching to a
// production provider (MastersIndia, Clarity, ClearTax) means:
//   1. Implement IGSPProvider in server/<provider>-provider.ts
//   2. Register it in this file
// No UI or service code changes required.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IGSPProvider } from '../types';
import { MockGSPProvider } from './mock-provider';

const REGISTRY: Record<string, IGSPProvider> = {
  mock: new MockGSPProvider(),
  // Production providers — implement and register here when credentials are
  // configured. Each implements IGSPProvider from ../types.ts.
  // mastersindia: new MastersIndiaGSPProvider(),
  // clarity: new ClarityGSPProvider(),
  // cleartax: new ClearTaxGSPProvider(),
  // gstsuvidha: new GSTSuvidhaGSPProvider(),
};

const DEFAULT_PROVIDER = 'mock';

export function getGSPProvider(key?: string): IGSPProvider {
  const providerKey = key && REGISTRY[key] ? key : DEFAULT_PROVIDER;
  return REGISTRY[providerKey];
}

export function listGSPProviders(): Array<{ key: string; displayName: string }> {
  return Object.values(REGISTRY).map((p) => ({ key: p.key, displayName: p.displayName }));
}

export function isGSPProviderAvailable(key: string): boolean {
  return key in REGISTRY;
}
