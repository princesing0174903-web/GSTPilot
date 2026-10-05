// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE AI PLATFORM™ (ECOSYSTEM EDITION) — ORCHESTRATOR
// Single entry point. Bundles all 12 subsystems into one EcosystemDashboard.
// Cached 45s in-memory. Everything flows from REAL connected business data.
// Tagline: One Platform. Unlimited Enterprise Intelligence.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  ECOSYSTEM_SUBSYSTEMS,
  ECOSYSTEM_TAGLINE,
  TOTAL_ECOSYSTEM_SUBSYSTEMS,
  type EcosystemDashboard,
} from './types';
import { ensurePlatformOrganizationsSeeded } from '@/lib/platform/organizations';
import {
  ensureExtensionsSeeded,
  getMarketplaceSummary,
  listExtensions,
  listInstallsForOrg,
} from './extensions';
import { getWebhookSummary } from './webhooks';
import { getApiGatewaySummary } from './api-gateway';
import { getLowCodeSummary } from './lowcode';
import { getObservabilitySummary } from './observability';
import { getDeveloperPlatformSummary, ensureDevelopersSeeded } from './developers';
import { getEcosystemPerformanceSummary, getEcosystemSecuritySummary } from './security-performance';

// ─── In-memory cache (45s) ────────────────────────────────────────────────────
const CACHE_TTL_MS = 45000;
let cached: { dashboard: EcosystemDashboard; ts: number } | null = null;

export function invalidateEcosystemCache(): void {
  cached = null;
}

export async function getEcosystemDashboard(): Promise<EcosystemDashboard> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.dashboard;
  }

  // Ensure the platform orgs exist (anchors everything to the live Firm)
  await ensurePlatformOrganizationsSeeded();
  await ensureExtensionsSeeded();
  await ensureDevelopersSeeded();

  // Pick a host org (the first/anchor org) to scope "My Installs" + low-code seeding
  const hostOrg = await db.platformOrganization.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  const hostOrgId = hostOrg?.id ?? '';

  if (hostOrgId) {
    // Trigger low-code seeding for the host org (idempotent)
    const { ensureLowCodeSeeded } = await import('./lowcode');
    await ensureLowCodeSeeded(hostOrgId);
  }

  // Fan out all subsystem reads in parallel
  const [
    marketplace,
    extensions,
    myInstalls,
    webhooks,
    apiGateway,
    lowCode,
    observability,
    developers,
    security,
    performance,
  ] = await Promise.all([
    getMarketplaceSummary(),
    listExtensions({ visibility: 'public', limit: 100 }),
    hostOrgId ? listInstallsForOrg(hostOrgId) : Promise.resolve([]),
    getWebhookSummary(),
    getApiGatewaySummary(),
    getLowCodeSummary(hostOrgId || undefined),
    getObservabilitySummary(),
    getDeveloperPlatformSummary(),
    getEcosystemSecuritySummary(),
    getEcosystemPerformanceSummary(),
  ]);

  const publicExtensions = extensions.filter((e) => e.visibility === 'public').length;
  const privateExtensions = extensions.filter((e) => e.visibility === 'private').length;

  const dashboard: EcosystemDashboard = {
    tagline: ECOSYSTEM_TAGLINE,
    generatedAt: new Date().toISOString(),
    cacheTtlMs: CACHE_TTL_MS,
    hasLiveData: true,
    subsystemsImplemented: TOTAL_ECOSYSTEM_SUBSYSTEMS,
    subsystemsTotal: TOTAL_ECOSYSTEM_SUBSYSTEMS,
    subsystems: [...ECOSYSTEM_SUBSYSTEMS],
    dataSources: [
      'PlatformExtension',
      'PlatformExtensionInstall',
      'PlatformExtensionReview',
      'PlatformWebhookSubscription',
      'PlatformWebhookDelivery',
      'PlatformApiUsageLog',
      'PlatformLowCodeForm',
      'PlatformLowCodeWorkflow',
      'PlatformLowCodeSubmission',
      'PlatformDeveloper',
      'PlatformApiKey',
      'PlatformAuditEvent',
      'PlatformOrganization',
    ],

    // Headline KPIs
    totalExtensions: extensions.length,
    publicExtensions,
    privateExtensions,
    totalInstalls: marketplace.totalInstalls,
    activeWebhooks: webhooks.activeSubscriptions,
    totalApiKeys: apiGateway.totalKeys,
    apiCallsToday: observability.apiCallsToday,
    apiCalls30d: observability.apiCalls30d,
    totalDevelopers: developers.totalDevelopers,
    marketplaceRevenue: marketplace.revenue,
    lowCodeForms: lowCode.totalForms,
    lowCodeWorkflows: lowCode.totalWorkflows,

    // Subsystem summaries
    marketplace,
    extensions,
    myInstalls,
    webhooks,
    apiGateway,
    lowCode,
    observability,
    developers,
    security,
    performance,
  };

  cached = { dashboard, ts: Date.now() };
  return dashboard;
}
