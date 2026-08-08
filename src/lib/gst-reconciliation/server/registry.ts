// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GSP Provider Registry v2 (SERVER-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The SINGLE place where GSP providers are resolved. Supports TWO modes:
//
//   1. getGSPProvider(key?) — returns a stateless provider instance for a known
//      key. Used when the caller already knows which provider to use (e.g. the
//      reconciliation run route receives `gspProvider` in the body).
//
//   2. getGSPProviderForOrg(organizationId) — reads the org's GSPProviderConfig
//      from Prisma, decrypts the credentials, and returns the configured
//      provider instance + its mode (live/sandbox/demo/not_connected). Falls
//      back to MockGSPProvider (demo mode) when no config exists.
//
// Switching to a production provider means configuring it in Settings — no code
// changes required.
//
// This file is SERVER-ONLY (imports Prisma + the providers). API routes are
// the only consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IGSPProvider } from '../types';
import { MockGSPProvider } from './mock-provider';
import { MastersIndiaGSPProvider, type MastersIndiaConfig } from './mastersindia-provider';
import { GenericWebGSPProvider, type GenericWebConfig } from './generic-web-provider';
import { db } from '@/lib/db';
import { decryptString } from '@/lib/gstn-provider/server/crypto';

// ─── Provider metadata (for the Settings UI dropdown) ───────────────────────

export interface ProviderMeta {
  key: string;
  displayName: string;
  /** Whether this provider makes real network calls. */
  isLive: boolean;
  /** Short description shown in the Settings provider picker. */
  description: string;
  /** Fields the user must fill in to configure this provider. */
  fields: Array<{ key: string; label: string; type: 'text' | 'password'; required: boolean; placeholder?: string }>;
  /** Default sandbox + production base URLs (pre-filled in the UI). */
  defaults?: { sandboxUrl?: string; productionUrl?: string };
}

const PROVIDER_REGISTRY: Record<string, ProviderMeta> = {
  mock: {
    key: 'mock',
    displayName: 'Demo (offline sample data)',
    isLive: false,
    description: 'No real GSTN connection. Generates deterministic sample GSTR-2B data so you can explore the reconciliation engine. Never send real credentials.',
    fields: [],
  },
  mastersindia: {
    key: 'mastersindia',
    displayName: 'MastersIndia GSP',
    isLive: true,
    description: 'Officially licensed GST Suvidha Provider. Supports GSTIN search + GSTR-2B retrieval from the production GSTN portal.',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'MI client id' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: '••••••••' },
      { key: 'apikey', label: 'API Key', type: 'password', required: true, placeholder: '••••••••' },
    ],
    defaults: {
      sandboxUrl: 'https://sandboxapi.mastersindia.co',
      productionUrl: 'https://api.mastersindia.co',
    },
  },
  generic: {
    key: 'generic',
    displayName: 'Custom GSP (HTTP API)',
    isLive: true,
    description: 'Connect any standards-compliant GSP by base URL + bearer token. Use this for ClearTax, Clarity, GST Suvidha, or your own gateway.',
    fields: [
      { key: 'apikey', label: 'Bearer Token / API Key', type: 'password', required: true, placeholder: '••••••••' },
    ],
    defaults: {
      sandboxUrl: 'https://sandbox.gsp.example.com',
      productionUrl: 'https://api.gsp.example.com',
    },
  },
};

// ─── Stateless resolution (caller knows the key) ────────────────────────────

const STATELESS_INSTANCES: Record<string, IGSPProvider> = {
  mock: new MockGSPProvider(),
};

export function getGSPProvider(key?: string): IGSPProvider {
  const providerKey = key && PROVIDER_REGISTRY[key] ? key : 'mock';
  if (STATELESS_INSTANCES[providerKey]) return STATELESS_INSTANCES[providerKey];
  // Real providers need per-org config — stateless calls fall back to mock.
  if (providerKey !== 'mock') {
    console.warn(`[gsp-registry] Stateless request for '${providerKey}' — falling back to mock. Use getGSPProviderForOrg() for real providers.`);
  }
  return STATELESS_INSTANCES.mock;
}

export function listGSPProviders(): Array<ProviderMeta> {
  return Object.values(PROVIDER_REGISTRY);
}

export function isGSPProviderAvailable(key: string): boolean {
  return key in PROVIDER_REGISTRY;
}

export function getProviderMeta(key: string): ProviderMeta | undefined {
  return PROVIDER_REGISTRY[key];
}

// ─── Per-org resolution (reads Prisma config, decrypts secrets) ─────────────

export interface OrgProviderResolution {
  provider: IGSPProvider;
  providerKey: string;
  /** 'live' | 'sandbox' | 'demo' | 'not_connected' */
  mode: 'live' | 'sandbox' | 'demo' | 'not_connected';
  configId: string | null;
  gstin: string | null;
}

/**
 * Resolve the active GSP provider for an organization.
 *
 * Reads the org's most-recently-updated enabled GSPProviderConfig, decrypts
 * the stored credentials, and returns a fully-configured provider instance.
 *
 * If no config exists OR the configured provider is 'mock', returns the
 * MockGSPProvider in 'demo' mode.
 *
 * If a real provider is configured but its `lastConnectedAt` is null (never
 * tested), returns the provider but in 'not_connected' mode — callers should
 * refuse to fetch data in that state.
 */
export async function getGSPProviderForOrg(
  organizationId: string,
): Promise<OrgProviderResolution> {
  // No org → demo
  if (!organizationId) {
    return {
      provider: STATELESS_INSTANCES.mock,
      providerKey: 'mock',
      mode: 'demo',
      configId: null,
      gstin: null,
    };
  }

  const configs = await db.gSPProviderConfig.findMany({
    where: { organizationId, enabled: true },
    orderBy: { updatedAt: 'desc' },
  });

  // No config → demo
  if (configs.length === 0) {
    return {
      provider: STATELESS_INSTANCES.mock,
      providerKey: 'mock',
      mode: 'demo',
      configId: null,
      gstin: null,
    };
  }

  const cfg = configs[0];

  // Mock provider is always demo
  if (cfg.providerKey === 'mock') {
    return {
      provider: STATELESS_INSTANCES.mock,
      providerKey: 'mock',
      mode: 'demo',
      configId: cfg.id,
      gstin: cfg.gstin ?? null,
    };
  }

  // Never tested (or last test failed) → not_connected (refuse to use an
  // untested or broken real provider). CRITICAL: must check lastTestOk, not
  // lastConnectedAt — they diverge after a failed re-test.
  if (cfg.lastTestOk !== true) {
    return {
      provider: STATELESS_INSTANCES.mock,
      providerKey: cfg.providerKey,
      mode: 'not_connected',
      configId: cfg.id,
      gstin: cfg.gstin ?? null,
    };
  }

  // Token expired → also not_connected (UI shows a reconnect banner).
  if (cfg.tokenExpiry && cfg.tokenExpiry.getTime() < Date.now()) {
    return {
      provider: STATELESS_INSTANCES.mock,
      providerKey: cfg.providerKey,
      mode: 'not_connected',
      configId: cfg.id,
      gstin: cfg.gstin ?? null,
    };
  }

  // Decrypt secrets
  let decryptedSecret = '';
  try {
    decryptedSecret = cfg.clientSecret ? decryptString(cfg.clientSecret) : '';
  } catch {
    // Corrupt ciphertext — treat as not connected
    return {
      provider: STATELESS_INSTANCES.mock,
      providerKey: cfg.providerKey,
      mode: 'not_connected',
      configId: cfg.id,
      gstin: cfg.gstin ?? null,
    };
  }

  const mode: 'live' | 'sandbox' = (cfg.mode ?? 'sandbox') === 'production' ? 'live' : 'sandbox';

  if (cfg.providerKey === 'mastersindia') {
    const miConfig: MastersIndiaConfig = {
      clientId: cfg.clientId ?? '',
      clientSecret: decryptedSecret,
      apikey: cfg.apikey ? decryptString(cfg.apikey) : '',
      apiEndpoint: cfg.apiEndpoint ?? '',
      mode: cfg.mode ?? 'sandbox',
    };
    return {
      provider: new MastersIndiaGSPProvider(miConfig),
      providerKey: 'mastersindia',
      mode,
      configId: cfg.id,
      gstin: cfg.gstin ?? null,
    };
  }

  if (cfg.providerKey === 'generic') {
    const genConfig: GenericWebConfig = {
      apikey: decryptedSecret || (cfg.apikey ? decryptString(cfg.apikey) : ''),
      apiEndpoint: cfg.apiEndpoint ?? '',
      mode: cfg.mode ?? 'sandbox',
    };
    return {
      provider: new GenericWebGSPProvider(genConfig),
      providerKey: 'generic',
      mode,
      configId: cfg.id,
      gstin: cfg.gstin ?? null,
    };
  }

  // Unknown provider key → fall back to demo
  return {
    provider: STATELESS_INSTANCES.mock,
    providerKey: 'mock',
    mode: 'demo',
    configId: cfg.id,
    gstin: cfg.gstin ?? null,
  };
}
