// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL ENTERPRISE NETWORK™ — GLOBAL OPPORTUNITY ENGINE
// Oracle-discovered cross-org opportunities: new customers, suppliers,
// partnerships, markets, cross-sells, expansions, cost savings. Seeded
// idempotently for the host node + top customer/supplier nodes. Summary
// computes totals, funnel status counts, breakdown by type/source, avg
// probability, and top-10 by potential value — all from REAL rows.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getHostNode } from './organizations';
import type {
  OpportunityEngineSummary,
  OpportunityStatus,
  OpportunitySummary,
  OpportunityType,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pickName(n: { legalName: string; tradeName: string | null }): string {
  return n.tradeName || n.legalName;
}

// Resolve a list of node IDs into {id → name} in a single batched query.
async function resolveNodeNames(
  nodeIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(nodeIds.filter((x): x is string => !!x)));
  if (ids.length === 0) return new Map();
  const nodes = await db.networkNode.findMany({
    where: { id: { in: ids } },
    select: { id: true, legalName: true, tradeName: true },
  });
  const map = new Map<string, string>();
  for (const n of nodes) {
    map.set(n.id, pickName(n));
  }
  return map;
}

// ─── Opportunity Engine Summary ───────────────────────────────────────────────
export async function getOpportunityEngineSummary(): Promise<OpportunityEngineSummary> {
  const [
    totalOpportunities,
    discoveredOpportunities,
    qualifiedOpportunities,
    proposedOpportunities,
    acceptedOpportunities,
    totalValueAgg,
    byTypeAgg,
    bySourceAgg,
    avgProbabilityAgg,
    topRows,
  ] = await Promise.all([
    db.networkOpportunity.count(),
    db.networkOpportunity.count({ where: { status: 'discovered' } }),
    db.networkOpportunity.count({ where: { status: 'qualified' } }),
    db.networkOpportunity.count({ where: { status: 'proposed' } }),
    db.networkOpportunity.count({ where: { status: 'accepted' } }),
    db.networkOpportunity.aggregate({ _sum: { potentialValue: true } }),
    db.networkOpportunity.groupBy({
      by: ['type'],
      _count: { id: true },
    }),
    db.networkOpportunity.groupBy({
      by: ['source'],
      _count: { id: true },
    }),
    db.networkOpportunity.aggregate({ _avg: { probability: true } }),
    db.networkOpportunity.findMany({
      orderBy: { potentialValue: 'desc' },
      take: 10,
    }),
  ]);

  // ── byType transform ──
  const byType: Record<string, number> = {};
  for (const g of byTypeAgg) {
    byType[g.type] = g._count.id;
  }

  // ── bySource transform ──
  const bySource: Record<string, number> = {};
  for (const g of bySourceAgg) {
    bySource[g.source] = g._count.id;
  }

  // ── Top opportunities with forNode name resolved ──
  const topNodeIds = topRows.map((o) => o.forNodeId);
  const nameById = await resolveNodeNames(topNodeIds);
  const topOpportunities: OpportunitySummary[] = topRows.map((o) => ({
    id: o.id,
    forNodeId: o.forNodeId,
    forName: nameById.get(o.forNodeId) ?? 'Unknown',
    type: o.type as OpportunityType,
    title: o.title,
    description: o.description,
    potentialValue: Number(o.potentialValue),
    currency: o.currency,
    probability: o.probability,
    source: o.source,
    status: o.status as OpportunityStatus,
    createdAt: o.createdAt.toISOString(),
  }));

  return {
    totalOpportunities,
    discoveredOpportunities,
    qualifiedOpportunities,
    proposedOpportunities,
    acceptedOpportunities,
    totalPotentialValue: Number(totalValueAgg._sum.potentialValue ?? 0),
    byType,
    bySource,
    avgProbability: Number(avgProbabilityAgg._avg.probability ?? 0),
    topOpportunities,
  };
}

// ─── Idempotent seeding ───────────────────────────────────────────────────────
const SEED_LOCK = { value: false };

type OpportunitySeed = {
  forNodeType: 'organization' | 'customer' | 'supplier';
  forNodeRank: number; // 0-based rank within the nodeType (0 = first/host)
  type: OpportunityType;
  title: string;
  description: string;
  potentialValue: number;
  probability: number;
  source: string;
};

// 10 canonical opportunities — anchored to host node + top customer & supplier.
const CANONICAL_OPPORTUNITIES: OpportunitySeed[] = [
  // ── For the host organization (the firm itself) ──
  {
    forNodeType: 'organization',
    forNodeRank: 0,
    type: 'new_customer',
    title: 'TCS Enterprise needs GST automation for 14 subsidiaries',
    description: 'Detected via partner network — multi-GSTIN reconciliation RFP',
    potentialValue: 2400000,
    probability: 45,
    source: 'network',
  },
  {
    forNodeType: 'organization',
    forNodeRank: 0,
    type: 'cost_saving',
    title: 'Switch to BlueWave Logistics — ₹18L/yr saving',
    description:
      'Network benchmark shows 14% lower freight cost vs current carrier',
    potentialValue: 1800000,
    probability: 72,
    source: 'benchmark',
  },
  {
    forNodeType: 'organization',
    forNodeRank: 0,
    type: 'partnership',
    title: 'Co-sell with Infosys on mid-market ERP rollouts',
    description:
      'Joint GTM motion — Infosys implementation + VEYRO tax/compliance layer; 60+ shared accounts identified',
    potentialValue: 4500000,
    probability: 55,
    source: 'network',
  },
  {
    forNodeType: 'organization',
    forNodeRank: 0,
    type: 'new_market',
    title: 'Enter UAE VAT compliance market via Sequoia portfolio intros',
    description:
      'Free-zone companies need VAT + corporate tax automation; 250+ warm intros available',
    potentialValue: 3200000,
    probability: 38,
    source: 'referral',
  },
  {
    forNodeType: 'organization',
    forNodeRank: 0,
    type: 'cross_sell',
    title: 'Upsell Payroll Pro to 84 existing GST-only clients',
    description:
      'Behavioral signal: 84 clients have ≥50 employees but no payroll module; payback < 4 months',
    potentialValue: 1680000,
    probability: 78,
    source: 'oracle',
  },
  {
    forNodeType: 'organization',
    forNodeRank: 0,
    type: 'expansion',
    title: 'Open Bengaluru GCC — 40-engineer hub for AI tax research',
    description:
      'Talent cost 32% lower than Mumbai; co-location with 3 AI partner firms accelerates roadmap',
    potentialValue: 9800000,
    probability: 42,
    source: 'oracle',
  },
  {
    forNodeType: 'organization',
    forNodeRank: 0,
    type: 'new_supplier',
    title: 'Onboard Silicon Semiconductors as preferred chip supplier',
    description:
      'Verified Bangalore supplier rated 4.7★ — replacement for China-dependent incumbent; lead time ↓ 41%',
    potentialValue: 920000,
    probability: 64,
    source: 'benchmark',
  },
  {
    forNodeType: 'organization',
    forNodeRank: 0,
    type: 'cost_saving',
    title: 'Centralize currency hedging via primary bank — ₹22L/yr saving',
    description:
      'Treasury benchmark shows 18 bps spread reduction by routing FX through the primary bank vs current multi-bank setup',
    potentialValue: 2200000,
    probability: 68,
    source: 'benchmark',
  },
  // ── For the top customer node ──
  {
    forNodeType: 'customer',
    forNodeRank: 0,
    type: 'cross_sell',
    title: 'AI CFO module — 360° cash-flow forecast for next quarter',
    description:
      'Detected: customer has ≥6 months of invoice + payment history; predictive cash-flow module fits cleanly',
    potentialValue: 480000,
    probability: 71,
    source: 'oracle',
  },
  // ── For the top supplier node ──
  {
    forNodeType: 'supplier',
    forNodeRank: 0,
    type: 'partnership',
    title: 'Strategic supply MoU — 24-month pricing lock + 8% volume discount',
    description:
      'Bilateral opportunity: 18-month forward commit unlocks preferred-customer tier + priority allocation',
    potentialValue: 1450000,
    probability: 60,
    source: 'network',
  },
];

export async function ensureOpportunitiesSeeded(): Promise<void> {
  if (SEED_LOCK.value) return;
  SEED_LOCK.value = true;
  try {
    const existingCount = await db.networkOpportunity.count();
    if (existingCount > 0) return; // idempotent

    // Group seeds by nodeType so we can resolve each target node once.
    const byNodeType = new Map<string, OpportunitySeed[]>();
    for (const s of CANONICAL_OPPORTUNITIES) {
      const arr = byNodeType.get(s.forNodeType) ?? [];
      arr.push(s);
      byNodeType.set(s.forNodeType, arr);
    }

    for (const [nodeType, seeds] of byNodeType.entries()) {
      // Resolve all candidate nodes of this type, ordered by createdAt asc
      // (organization=host first; customers/suppliers by creation order).
      const nodes = await db.networkNode.findMany({
        where: { nodeType },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      for (const seed of seeds) {
        const target = nodes[seed.forNodeRank];
        if (!target) continue; // skip if that rank doesn't exist
        await db.networkOpportunity.create({
          data: {
            forNodeId: target.id,
            type: seed.type,
            title: seed.title,
            description: seed.description,
            potentialValue: seed.potentialValue,
            currency: 'INR',
            probability: seed.probability,
            source: seed.source,
            status: 'discovered',
            metadata: JSON.stringify({
              source: 'canonical_seed',
              forNodeType: seed.forNodeType,
              forNodeRank: seed.forNodeRank,
            }),
          },
        });
      }
    }
  } finally {
    SEED_LOCK.value = false;
  }
}

// ─── Create Opportunity ───────────────────────────────────────────────────────
export async function createOpportunity(params: {
  forNodeId: string;
  type: OpportunityType;
  title: string;
  description: string;
  potentialValue: number;
  currency: string;
  probability: number;
  source: string;
  metadata?: Record<string, unknown>;
}): Promise<OpportunitySummary> {
  const opp = await db.networkOpportunity.create({
    data: {
      forNodeId: params.forNodeId,
      type: params.type,
      title: params.title,
      description: params.description,
      potentialValue: Number(params.potentialValue),
      currency: params.currency,
      probability: params.probability,
      source: params.source,
      status: 'discovered',
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });

  // Resolve the for-node name for the response
  const nameById = await resolveNodeNames([opp.forNodeId]);

  return {
    id: opp.id,
    forNodeId: opp.forNodeId,
    forName: nameById.get(opp.forNodeId) ?? 'Unknown',
    type: opp.type as OpportunityType,
    title: opp.title,
    description: opp.description,
    potentialValue: Number(opp.potentialValue),
    currency: opp.currency,
    probability: opp.probability,
    source: opp.source,
    status: opp.status as OpportunityStatus,
    createdAt: opp.createdAt.toISOString(),
  };
}

// ─── Convenience: returns the host node id (used by callers building a new
// opportunity for "this firm"). Mirrors the pattern from organizations.ts. ─────
export async function getHostNodeId(): Promise<string | null> {
  const host = await getHostNode();
  return host?.id ?? null;
}
