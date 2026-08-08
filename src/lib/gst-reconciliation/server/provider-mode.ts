// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GSP Provider Mode Resolution (SERVER-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The SINGLE source of truth for whether GSTPilot is operating with REAL GSTN
// data, SANDBOX (test endpoint) data, DEMO (offline sample) data, or NOT
// CONNECTED at all.
//
// CRITICAL CONTRACT — never violated anywhere in the codebase:
//   • 'live'        — a REAL production GSP is configured AND the last test
//                      connection SUCCEEDED. Data comes from the production GSTN.
//   • 'sandbox'     — a GSP is configured in SANDBOX/TEST mode AND the last test
//                      connection SUCCEEDED. Data comes from the GSP's sandbox
//                      environment (real HTTP, test data).
//   • 'demo'        — NO real GSP is configured. The MockGSPProvider is used to
//                      generate deterministic OFFLINE sample data. This is NEVER
//                      presented as "connected" or "live".
//   • 'not_connected'— no provider config exists at all.
//
// This file is SERVER-ONLY (imports Prisma). API routes are the only consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

export type GSPMode = 'live' | 'sandbox' | 'demo' | 'not_connected';

export interface ProviderModeInfo {
  mode: GSPMode;
  /** The provider key that will be used ('mock' for demo, otherwise the configured key). */
  providerKey: string;
  /** Human-readable provider name. */
  providerName: string;
  /** Whether the last test connection succeeded (null if never tested). */
  lastTestOk: boolean | null;
  /** ISO timestamp of the last successful test. */
  lastTestedAt: string | null;
  /** ISO timestamp of the last successful GSTR-2B sync. */
  lastSyncAt: string | null;
  /** The configured GSTIN for this org (if any). */
  gstin: string | null;
  /** Whether a real network call is made to fetch data. */
  isLive: boolean;
}

/**
 * Resolve the active GSP mode for an organization by reading its
 * GSPProviderConfig from Prisma.
 *
 * Returns 'not_connected' if no config exists, 'demo' if the only config is
 * the mock provider, 'sandbox'/'live' if a real provider is configured and
 * tested.
 */
export async function resolveProviderMode(
  organizationId: string,
): Promise<ProviderModeInfo> {
  if (!organizationId) {
    return {
      mode: 'not_connected',
      providerKey: 'mock',
      providerName: 'Not connected',
      lastTestOk: null,
      lastTestedAt: null,
      lastSyncAt: null,
      gstin: null,
      isLive: false,
    };
  }

  const configs = await db.gSPProviderConfig.findMany({
    where: { organizationId, enabled: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (configs.length === 0) {
    return {
      mode: 'demo',
      providerKey: 'mock',
      providerName: 'Demo (offline sample data)',
      lastTestOk: null,
      lastTestedAt: null,
      lastSyncAt: null,
      gstin: null,
      isLive: false,
    };
  }

  const cfg = configs[0];

  // The mock provider is always DEMO, never live — even if "enabled".
  if (cfg.providerKey === 'mock') {
    return {
      mode: 'demo',
      providerKey: 'mock',
      providerName: 'Demo (offline sample data)',
      lastTestOk: cfg.lastConnectedAt ? true : null,
      lastTestedAt: cfg.lastConnectedAt?.toISOString() ?? null,
      lastSyncAt: cfg.lastConnectedAt?.toISOString() ?? null,
      gstin: cfg.gstin ?? null,
      isLive: false,
    };
  }

  // A real provider is configured. Mode depends on the `mode` field
  // (sandbox vs production) AND whether the last test succeeded.
  const isProduction = (cfg.mode ?? 'sandbox') === 'production';
  const testedOk = cfg.lastConnectedAt != null;

  if (!testedOk) {
    // Configured but never successfully tested → treat as not_connected for
    // data-fetch purposes (we won't risk calling an untested provider).
    return {
      mode: 'not_connected',
      providerKey: cfg.providerKey,
      providerName: `${cfg.displayName} (configured, not tested)`,
      lastTestOk: false,
      lastTestedAt: null,
      lastSyncAt: null,
      gstin: cfg.gstin ?? null,
      isLive: false,
    };
  }

  return {
    mode: isProduction ? 'live' : 'sandbox',
    providerKey: cfg.providerKey,
    providerName: cfg.displayName,
    lastTestOk: true,
    lastTestedAt: cfg.lastConnectedAt?.toISOString() ?? null,
    lastSyncAt: cfg.lastSyncAt?.toISOString() ?? null,
    gstin: cfg.gstin ?? null,
    isLive: true,
  };
}

/**
 * Human-readable label for a mode (used in API responses + UI badges).
 */
export function modeLabel(mode: GSPMode): string {
  switch (mode) {
    case 'live':
      return 'LIVE';
    case 'sandbox':
      return 'SANDBOX';
    case 'demo':
      return 'DEMO';
    case 'not_connected':
      return 'NOT CONNECTED';
  }
}

/**
 * Tailwind badge classes for a mode (used by the UI).
 */
export function modeBadgeClasses(mode: GSPMode): string {
  switch (mode) {
    case 'live':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'sandbox':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'demo':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    case 'not_connected':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
  }
}
