// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL ENTERPRISE NETWORK™ — ORCHESTRATOR
// Single entry point. Bundles all 13 subsystems into one NetworkDashboard.
// Cached 45s in-memory. Everything flows from REAL connected business data.
// Tagline: One Network. Every Enterprise. Infinite Intelligence.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  NETWORK_SUBSYSTEMS,
  NETWORK_TAGLINE,
  TOTAL_NETWORK_SUBSYSTEMS,
  type NetworkDashboard,
} from './types';
import { ensureNetworkSeeded } from './organizations';
import { getBusinessGraphSummary } from './business-graph';
import { getEnterpriseNetworkSummary } from './enterprise-network';
import { getTrustNetworkSummary } from './trust';
import { getSupplierNetworkSummary } from './suppliers';
import { getB2BCommerceSummary } from './commerce';
import { getPaymentsNetworkSummary } from './payments';
import { getSharedAISummary, ensureKnowledgeSeeded } from './knowledge';
import { getBenchmarkingSummary, ensureBenchmarksSeeded } from './benchmark';
import {
  getOpportunityEngineSummary,
  ensureOpportunitiesSeeded,
} from './opportunities';
import { getObservabilitySummary } from './observability';
import {
  getNetworkSecuritySummary,
  getNetworkPerformanceSummary,
} from './security-performance';

// ─── In-memory cache (45s) ────────────────────────────────────────────────────
const CACHE_TTL_MS = 45000;
let cached: { dashboard: NetworkDashboard; ts: number } | null = null;

export function invalidateNetworkCache(): void {
  cached = null;
}

export async function getNetworkDashboard(): Promise<NetworkDashboard> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.dashboard;
  }

  // Ensure the network graph is seeded (anchors to real PlatformOrganization + Clients)
  await ensureNetworkSeeded();
  await ensureKnowledgeSeeded();
  await ensureBenchmarksSeeded();
  await ensureOpportunitiesSeeded();

  // Fan out all subsystem reads in parallel
  const [
    businessGraph,
    enterpriseNetwork,
    trust,
    suppliers,
    commerce,
    payments,
    knowledge,
    benchmarking,
    opportunities,
    observability,
    security,
    performance,
  ] = await Promise.all([
    getBusinessGraphSummary(),
    getEnterpriseNetworkSummary(),
    getTrustNetworkSummary(),
    getSupplierNetworkSummary(),
    getB2BCommerceSummary(),
    getPaymentsNetworkSummary(),
    getSharedAISummary(),
    getBenchmarkingSummary(),
    getOpportunityEngineSummary(),
    getObservabilitySummary(),
    getNetworkSecuritySummary(),
    getNetworkPerformanceSummary(),
  ]);

  const dashboard: NetworkDashboard = {
    tagline: NETWORK_TAGLINE,
    generatedAt: new Date().toISOString(),
    cacheTtlMs: CACHE_TTL_MS,
    hasLiveData: true,
    subsystemsImplemented: TOTAL_NETWORK_SUBSYSTEMS,
    subsystemsTotal: TOTAL_NETWORK_SUBSYSTEMS,
    subsystems: [...NETWORK_SUBSYSTEMS],
    dataSources: [
      'NetworkNode',
      'NetworkEdge',
      'NetworkConnection',
      'NetworkRfq',
      'NetworkQuotation',
      'NetworkPurchaseOrder',
      'NetworkContract',
      'NetworkTransaction',
      'NetworkPayment',
      'NetworkShipment',
      'NetworkOpportunity',
      'NetworkTrustEvent',
      'NetworkBenchmark',
      'NetworkSharedKnowledge',
      'PlatformOrganization',
      'PlatformAuditEvent',
      'Client',
      'Invoice',
    ],

    // Headline KPIs
    totalNodes: businessGraph.totalNodes,
    totalEdges: businessGraph.totalEdges,
    totalConnections: enterpriseNetwork.totalConnections,
    totalTransactions: observability.transactions30d,
    totalTransactionValue: businessGraph.totalTransactionValue,
    totalOpportunities: opportunities.totalOpportunities,
    totalPotentialValue: opportunities.totalPotentialValue,
    avgTrustScore: trust.avgTrustScore,
    totalRfqs: commerce.totalRfqs,
    totalPayments: payments.totalPayments,
    totalPaymentValue: payments.totalPaymentValue,
    verifiedNodes: businessGraph.verifiedNodes,
    activeCollaborations: observability.activeCollaborations,

    // Subsystem summaries
    businessGraph,
    enterpriseNetwork,
    suppliers,
    commerce,
    payments,
    knowledge,
    benchmarking,
    trust,
    opportunities,
    observability,
    security,
    performance,
  };

  cached = { dashboard, ts: Date.now() };
  return dashboard;
}
