// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL ENTERPRISE NETWORK™ — GLOBAL BUSINESS GRAPH ENGINE
// Computes the world business graph topology, density, distribution and
// transaction value from REAL NetworkNode / NetworkEdge rows. Every metric
// here is derived from rows in the database (no mock values).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BusinessGraphSummary, NetworkEdgeSummary, RelationshipType } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pickName(n: { legalName: string; tradeName: string | null }): string {
  return n.tradeName || n.legalName;
}

// ─── Global Business Graph Summary ────────────────────────────────────────────
export async function getBusinessGraphSummary(): Promise<BusinessGraphSummary> {
  const [
    totalNodes,
    totalEdges,
    verifiedNodes,
    nodesByTypeAgg,
    edgesByTypeAgg,
    avgTrustAgg,
    totalTxnValueAgg,
    industryAgg,
    stateAgg,
  ] = await Promise.all([
    db.networkNode.count(),
    db.networkEdge.count(),
    db.networkNode.count({ where: { verified: true } }),
    db.networkNode.groupBy({ by: ['nodeType'], _count: { id: true } }),
    db.networkEdge.groupBy({ by: ['relationshipType'], _count: { id: true } }),
    db.networkNode.aggregate({ _avg: { trustScore: true } }),
    db.networkNode.aggregate({ _sum: { totalTransactionValue: true } }),
    db.networkNode.groupBy({
      by: ['industry'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
    db.networkNode.groupBy({
      by: ['state'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
  ]);

  // ── Nodes by type ──
  const nodesByType: Record<string, number> = {};
  for (const g of nodesByTypeAgg) {
    nodesByType[g.nodeType] = g._count.id;
  }

  // ── Edges by relationship type ──
  const edgesByType: Record<string, number> = {};
  for (const g of edgesByTypeAgg) {
    edgesByType[g.relationshipType] = g._count.id;
  }

  // ── Top industries (drop null industry bucket) ──
  const topIndustries = industryAgg
    .filter((g) => g.industry !== null && g.industry !== '')
    .map((g) => ({ industry: g.industry as string, count: g._count.id }));

  // ── Top regions (drop null state bucket) ──
  const topRegions = stateAgg
    .filter((g) => g.state !== null && g.state !== '')
    .map((g) => ({ region: g.state as string, count: g._count.id }));

  // ── Network density = totalEdges / (totalNodes * (totalNodes - 1) / 2) ──
  const densityDenominator = (totalNodes * (totalNodes - 1)) / 2;
  const networkDensity = densityDenominator > 0 ? totalEdges / densityDenominator : 0;

  return {
    totalNodes,
    totalEdges,
    nodesByType,
    edgesByType,
    verifiedNodes,
    avgTrustScore: Number(avgTrustAgg._avg.trustScore ?? 0),
    topIndustries,
    topRegions,
    networkDensity,
    totalTransactionValue: Number(totalTxnValueAgg._sum.totalTransactionValue ?? 0),
  };
}

// ─── Recent edges (with resolved node names) ──────────────────────────────────
export async function listEdges(limit: number = 50): Promise<NetworkEdgeSummary[]> {
  const edges = await db.networkEdge.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  if (edges.length === 0) return [];

  // Resolve from/to node names via a single batched query
  const nodeIdSet = new Set<string>();
  for (const e of edges) {
    nodeIdSet.add(e.fromNodeId);
    nodeIdSet.add(e.toNodeId);
  }
  const nodeIds = Array.from(nodeIdSet);
  const nodes = await db.networkNode.findMany({
    where: { id: { in: nodeIds } },
    select: { id: true, legalName: true, tradeName: true },
  });
  const nameById = new Map<string, string>();
  for (const n of nodes) {
    nameById.set(n.id, pickName(n));
  }

  return edges.map((e) => ({
    id: e.id,
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    fromName: nameById.get(e.fromNodeId) ?? 'Unknown',
    toName: nameById.get(e.toNodeId) ?? 'Unknown',
    relationshipType: e.relationshipType as RelationshipType,
    status: e.status,
    strength: e.strength,
    totalTransactionValue: Number(e.totalTransactionValue),
    transactionCount: e.transactionCount,
    startedAt: e.startedAt.toISOString(),
  }));
}
