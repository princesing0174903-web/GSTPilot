// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL ENTERPRISE NETWORK™ — TRUST NETWORK ENGINE
// Composite trust scores, distribution, verification rate, at-risk nodes,
// and the auditable NetworkTrustEvent log. Every metric is computed from
// REAL NetworkNode + NetworkTrustEvent rows.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapNode } from './organizations';
import type {
  TrustNetworkSummary,
  TrustEventSummary,
  TrustEventType,
  RiskLevel,
  NetworkNode,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeRiskLevel(trust: number): RiskLevel {
  if (trust >= 85) return 'low';
  if (trust >= 65) return 'medium';
  if (trust >= 40) return 'high';
  return 'critical';
}

function pickName(n: { legalName: string; tradeName: string | null }): string {
  return n.tradeName || n.legalName;
}

// ─── Trust Network Summary ────────────────────────────────────────────────────
export async function getTrustNetworkSummary(): Promise<TrustNetworkSummary> {
  const [
    totalNodes,
    verifiedNodes,
    avgAgg,
    highCount,
    mediumCount,
    lowCount,
    totalTrustEvents,
    recentEvents,
    topTrustedRaw,
    atRiskRaw,
  ] = await Promise.all([
    db.networkNode.count(),
    db.networkNode.count({ where: { verified: true } }),
    db.networkNode.aggregate({
      _avg: {
        trustScore: true,
        complianceScore: true,
        paymentReliabilityScore: true,
        supplierRating: true,
        customerRating: true,
        aiConfidenceScore: true,
      },
    }),
    db.networkNode.count({ where: { trustScore: { gte: 80 } } }),
    db.networkNode.count({ where: { trustScore: { gte: 60, lt: 80 } } }),
    db.networkNode.count({ where: { trustScore: { lt: 60 } } }),
    db.networkTrustEvent.count(),
    db.networkTrustEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.networkNode.findMany({ orderBy: { trustScore: 'desc' }, take: 10 }),
    db.networkNode.findMany({
      where: {
        OR: [
          { riskLevel: { in: ['high', 'critical'] } },
          { trustScore: { lt: 60 } },
        ],
      },
      take: 10,
    }),
  ]);

  // ── Resolve node names for the recent trust events (single batched query) ──
  const eventNodeIds = Array.from(new Set(recentEvents.map((e) => e.nodeId)));
  const eventNodes = eventNodeIds.length > 0
    ? await db.networkNode.findMany({
        where: { id: { in: eventNodeIds } },
        select: { id: true, legalName: true, tradeName: true },
      })
    : [];
  const nameById = new Map<string, string>();
  for (const n of eventNodes) {
    nameById.set(n.id, pickName(n));
  }

  const recentTrustEvents: TrustEventSummary[] = recentEvents.map((e) => ({
    id: e.id,
    nodeId: e.nodeId,
    nodeName: nameById.get(e.nodeId) ?? 'Unknown',
    eventType: e.eventType as TrustEventType,
    delta: e.delta,
    newScore: e.newScore,
    description: e.description,
    createdAt: e.createdAt.toISOString(),
  }));

  const verificationRate = totalNodes > 0 ? (verifiedNodes / totalNodes) * 100 : 0;

  const topTrustedNodes: NetworkNode[] = topTrustedRaw.map(mapNode);
  const atRiskNodes: NetworkNode[] = atRiskRaw.map(mapNode);

  return {
    avgTrustScore: Number(avgAgg._avg.trustScore ?? 0),
    avgComplianceScore: Number(avgAgg._avg.complianceScore ?? 0),
    avgPaymentReliabilityScore: Number(avgAgg._avg.paymentReliabilityScore ?? 0),
    avgSupplierRating: Number(avgAgg._avg.supplierRating ?? 0),
    avgCustomerRating: Number(avgAgg._avg.customerRating ?? 0),
    avgAiConfidenceScore: Number(avgAgg._avg.aiConfidenceScore ?? 0),
    trustDistribution: { high: highCount, medium: mediumCount, low: lowCount },
    verifiedNodes,
    verificationRate,
    totalTrustEvents,
    recentTrustEvents,
    topTrustedNodes,
    atRiskNodes,
  };
}

// ─── Record a trust event (atomic event log + node score update) ──────────────
export async function recordTrustEvent(
  nodeId: string,
  eventType: TrustEventType,
  delta: number,
  description: string,
) {
  const node = await db.networkNode.findUnique({ where: { id: nodeId } });
  if (!node) {
    throw new Error(`NetworkNode ${nodeId} not found`);
  }

  // Clamp trustScore to 0-100 and recompute riskLevel
  const newScore = Math.min(100, Math.max(0, node.trustScore + delta));
  const newRiskLevel = computeRiskLevel(newScore);

  // Create the audit event AND update the node in parallel
  const [event] = await Promise.all([
    db.networkTrustEvent.create({
      data: {
        nodeId,
        eventType,
        delta,
        newScore,
        description,
      },
    }),
    db.networkNode.update({
      where: { id: nodeId },
      data: {
        trustScore: newScore,
        riskLevel: newRiskLevel,
      },
    }),
  ]);

  return event;
}
