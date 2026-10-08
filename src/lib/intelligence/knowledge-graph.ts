// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Cross-Company Knowledge Graph™
// Phase 7 — Subsystem 5
// ═══════════════════════════════════════════════════════════════════════════════
//
// One anonymous Business Knowledge Graph linking:
//   • Industries              • Growth patterns
//   • Products                • Risk patterns
//   • Regions                 • Compliance patterns
//   • Business models         • Customer behavior
//   • Vendor behavior
//
// No private company data is ever exposed — only aggregated links.
// Edges are derived from co-occurrence / correlation in anonymized contributions.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import {
  INDUSTRY_KEYS,
  INDUSTRY_LABELS,
  type IndustryKey,
  type KnowledgeEdgeRelation,
  type KnowledgeGraphEdge,
  type KnowledgeGraphNode,
  type KnowledgeGraphReport,
  type KnowledgeNodeKind,
} from './types'
import { isSampleSafe, currentDate } from './privacy'

// ─── Node Builders ────────────────────────────────────────────────────────────

async function upsertNode(
  kind: KnowledgeNodeKind,
  label: string,
  industry?: IndustryKey,
  region?: string,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const existing = await db.knowledgeNode.findUnique({
    where: { kind_label: { kind, label } },
    select: { id: true, weight: true },
  })
  if (existing) {
    await db.knowledgeNode.update({
      where: { id: existing.id },
      data: {
        weight: existing.weight + 1,
        industry: industry || null,
        region: region || null,
        metadata: JSON.stringify(metadata),
        updatedAt: new Date(),
      },
    })
    return existing.id
  }
  const created = await db.knowledgeNode.create({
    data: {
      kind, label,
      industry: industry || null,
      region: region || null,
      weight: 1,
      metadata: JSON.stringify(metadata),
    },
  })
  return created.id
}

async function upsertEdge(
  sourceId: string,
  targetId: string,
  relation: KnowledgeEdgeRelation,
  strength: number,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const existing = await db.knowledgeEdge.findUnique({
    where: { sourceId_targetId_relation: { sourceId, targetId, relation } },
    select: { id: true, evidence: true, strength: true },
  })
  if (existing) {
    // Incremental recompute: weighted average of existing + new
    const newEvidence = existing.evidence + 1
    const newStrength = (existing.strength * existing.evidence + strength) / newEvidence
    await db.knowledgeEdge.update({
      where: { id: existing.id },
      data: {
        evidence: newEvidence,
        strength: round3(newStrength),
        metadata: JSON.stringify(metadata),
        updatedAt: new Date(),
      },
    })
  } else {
    await db.knowledgeEdge.create({
      data: {
        sourceId, targetId, relation,
        strength: round3(strength),
        evidence: 1,
        metadata: JSON.stringify(metadata),
      },
    })
  }
}

// ─── Graph Build (from anonymized contributions) ─────────────────────────────

/**
 * Rebuild the anonymous cross-company knowledge graph from contributions.
 * This is a privacy-safe aggregation:
 *   • Industry nodes: derived from contribution.industry (categorical)
 *   • Region nodes: derived from contribution.region (categorical)
 *   • Business model nodes: derived from contribution.businessModelTags
 *   • Growth/risk/compliance pattern nodes: derived from contribution tags
 *   • Edges: co-occurrence in contributions + correlation of trends
 *
 * No org identity is exposed — only anonymized categorical links.
 */
export async function buildKnowledgeGraphFromContributions(): Promise<{
  nodesCreated: number
  edgesCreated: number
  industriesCovered: number
}> {
  const contributions = await db.intelligenceContribution.findMany({
    select: {
      industry: true, region: true, businessModelTags: true,
      growthPatternTag: true, riskPatternTag: true, compliancePattern: true,
      revenueTrendPct: true, complianceScore: true, vendorRiskScore: true,
      healthScore: true, cashFlowHealth: true,
    },
    take: 1000, // Performance™ — cap per build cycle
  })

  if (!isSampleSafe(contributions.length)) {
    return { nodesCreated: 0, edgesCreated: 0, industriesCovered: 0 }
  }

  // 1. Industry nodes
  const industryNodeIds = new Map<IndustryKey, string>()
  for (const ind of INDUSTRY_KEYS) {
    const count = contributions.filter((c) => c.industry === ind).length
    if (count === 0) continue
    const id = await upsertNode('industry', INDUSTRY_LABELS[ind], ind, undefined, { count })
    industryNodeIds.set(ind, id)
  }

  // 2. Region nodes
  const regionCounts: Record<string, number> = {}
  for (const c of contributions) {
    if (!c.region) continue
    regionCounts[c.region] = (regionCounts[c.region] || 0) + 1
  }
  const regionNodeIds = new Map<string, string>()
  for (const [region, count] of Object.entries(regionCounts)) {
    if (count < 2) continue // privacy: only regions with ≥2 orgs
    const id = await upsertNode('region', region, undefined, region, { count })
    regionNodeIds.set(region, id)
  }

  // 3. Pattern nodes
  const patternTagMap = {
    growth: new Map<string, number>(),
    risk: new Map<string, number>(),
    compliance: new Map<string, number>(),
  }
  for (const c of contributions) {
    if (c.growthPatternTag) patternTagMap.growth.set(c.growthPatternTag, (patternTagMap.growth.get(c.growthPatternTag) || 0) + 1)
    if (c.riskPatternTag) patternTagMap.risk.set(c.riskPatternTag, (patternTagMap.risk.get(c.riskPatternTag) || 0) + 1)
    if (c.compliancePattern) patternTagMap.compliance.set(c.compliancePattern, (patternTagMap.compliance.get(c.compliancePattern) || 0) + 1)
  }
  const patternNodeIds = {
    growth: new Map<string, string>(),
    risk: new Map<string, string>(),
    compliance: new Map<string, string>(),
  }
  for (const [tag, count] of patternTagMap.growth) {
    if (count < 2) continue
    patternNodeIds.growth.set(tag, await upsertNode('growthPattern', tag, undefined, undefined, { count }))
  }
  for (const [tag, count] of patternTagMap.risk) {
    if (count < 2) continue
    patternNodeIds.risk.set(tag, await upsertNode('riskPattern', tag, undefined, undefined, { count }))
  }
  for (const [tag, count] of patternTagMap.compliance) {
    if (count < 2) continue
    patternNodeIds.compliance.set(tag, await upsertNode('compliancePattern', tag, undefined, undefined, { count }))
  }

  // 4. Business model nodes
  const modelTagCounts: Record<string, number> = {}
  for (const c of contributions) {
    try {
      const tags = JSON.parse(c.businessModelTags || '[]') as string[]
      for (const t of tags) modelTagCounts[t] = (modelTagCounts[t] || 0) + 1
    } catch { /* ignore */ }
  }
  const modelNodeIds = new Map<string, string>()
  for (const [tag, count] of Object.entries(modelTagCounts)) {
    if (count < 2) continue
    modelNodeIds.set(tag, await upsertNode('businessModel', tag, undefined, undefined, { count }))
  }

  // 5. Edges: industry ↔ region (co-occurrence)
  for (const [ind, indId] of industryNodeIds) {
    for (const [region, regionId] of regionNodeIds) {
      const coCount = contributions.filter((c) => c.industry === ind && c.region === region).length
      if (coCount < 2) continue
      const strength = Math.min(1, coCount / 20)
      await upsertEdge(indId, regionId, 'grows_with', strength, { coOccurrence: coCount })
    }
  }

  // 6. Edges: industry ↔ growth pattern (correlation)
  for (const [ind, indId] of industryNodeIds) {
    for (const [tag, tagId] of patternNodeIds.growth) {
      const coCount = contributions.filter((c) => c.industry === ind && c.growthPatternTag === tag).length
      if (coCount < 2) continue
      const strength = Math.min(1, coCount / 10)
      await upsertEdge(indId, tagId, 'growth_correlates', strength, { coOccurrence: coCount })
    }
  }

  // 7. Edges: industry ↔ risk pattern (correlation)
  for (const [ind, indId] of industryNodeIds) {
    for (const [tag, tagId] of patternNodeIds.risk) {
      const coCount = contributions.filter((c) => c.industry === ind && c.riskPatternTag === tag).length
      if (coCount < 2) continue
      const strength = Math.min(1, coCount / 10)
      await upsertEdge(indId, tagId, 'risk_correlates', strength, { coOccurrence: coCount })
    }
  }

  // 8. Edges: industry ↔ compliance pattern (correlation)
  for (const [ind, indId] of industryNodeIds) {
    for (const [tag, tagId] of patternNodeIds.compliance) {
      const coCount = contributions.filter((c) => c.industry === ind && c.compliancePattern === tag).length
      if (coCount < 2) continue
      const strength = Math.min(1, coCount / 10)
      await upsertEdge(indId, tagId, 'compliance_correlates', strength, { coOccurrence: coCount })
    }
  }

  // 9. Edges: industry ↔ business model (co-occurrence)
  for (const [ind, indId] of industryNodeIds) {
    for (const [tag, tagId] of modelNodeIds) {
      const coCount = contributions.filter((c) => {
        if (c.industry !== ind) return false
        try {
          const tags = JSON.parse(c.businessModelTags || '[]') as string[]
          return tags.includes(tag)
        } catch { return false }
      }).length
      if (coCount < 2) continue
      const strength = Math.min(1, coCount / 10)
      await upsertEdge(indId, tagId, 'customer_overlaps', strength, { coOccurrence: coCount })
    }
  }

  // 10. Edges: industry ↔ industry (growth correlation)
  const indPairs: Array<[IndustryKey, IndustryKey]> = []
  for (let i = 0; i < INDUSTRY_KEYS.length; i++) {
    for (let j = i + 1; j < INDUSTRY_KEYS.length; j++) {
      indPairs.push([INDUSTRY_KEYS[i], INDUSTRY_KEYS[j]])
    }
  }
  for (const [indA, indB] of indPairs) {
    const aValues = contributions.filter((c) => c.industry === indA).map((c) => c.revenueTrendPct)
    const bValues = contributions.filter((c) => c.industry === indB).map((c) => c.revenueTrendPct)
    if (!isSampleSafe(aValues.length) || !isSampleSafe(bValues.length)) continue
    const corr = pearsonCorrelation(aValues, bValues)
    if (Math.abs(corr) < 0.3) continue // only meaningful correlations
    const aId = industryNodeIds.get(indA)
    const bId = industryNodeIds.get(indB)
    if (!aId || !bId) continue
    const strength = Math.abs(corr)
    const relation: KnowledgeEdgeRelation = corr > 0 ? 'grows_with' : 'competes_with'
    await upsertEdge(aId, bId, relation, strength, { correlation: round3(corr) })
  }

  return {
    nodesCreated: industryNodeIds.size + regionNodeIds.size
      + patternNodeIds.growth.size + patternNodeIds.risk.size + patternNodeIds.compliance.size
      + modelNodeIds.size,
    edgesCreated: 0, // Edges upserted; count not tracked for performance
    industriesCovered: industryNodeIds.size,
  }
}

// ─── Query: Get Knowledge Graph Report ───────────────────────────────────────

export async function getKnowledgeGraphReport(limit = 50): Promise<KnowledgeGraphReport> {
  const [nodes, edges, nodeCount, edgeCount] = await Promise.all([
    db.knowledgeNode.findMany({
      orderBy: { weight: 'desc' },
      take: limit,
    }),
    db.knowledgeEdge.findMany({
      include: { source: true, target: true },
      orderBy: { strength: 'desc' },
      take: limit,
    }),
    db.knowledgeNode.count(),
    db.knowledgeEdge.count(),
  ])

  const topNodes: KnowledgeGraphNode[] = nodes.map((n) => ({
    id: n.id,
    kind: n.kind as KnowledgeNodeKind,
    label: n.label,
    industry: n.industry ?? undefined,
    region: n.region ?? undefined,
    weight: n.weight,
    metadata: safeParse(n.metadata),
  }))

  const topEdges: KnowledgeGraphEdge[] = edges.map((e) => ({
    id: e.id,
    source: {
      id: e.source.id, kind: e.source.kind as KnowledgeNodeKind, label: e.source.label,
      industry: e.source.industry ?? undefined, region: e.source.region ?? undefined,
      weight: e.source.weight, metadata: safeParse(e.source.metadata),
    },
    target: {
      id: e.target.id, kind: e.target.kind as KnowledgeNodeKind, label: e.target.label,
      industry: e.target.industry ?? undefined, region: e.target.region ?? undefined,
      weight: e.target.weight, metadata: safeParse(e.target.metadata),
    },
    relation: e.relation as KnowledgeEdgeRelation,
    strength: e.strength,
    evidence: e.evidence,
  }))

  // Industry clusters
  const industryClusters = await Promise.all(
    INDUSTRY_KEYS.map(async (ind) => {
      const indNodes = await db.knowledgeNode.findMany({
        where: { industry: ind },
        select: { id: true },
      })
      if (indNodes.length === 0) return { industry: ind, nodeCount: 0, edgeCount: 0 }
      const indNodeIds = indNodes.map((n) => n.id)
      const indEdges = await db.knowledgeEdge.count({
        where: { OR: [{ sourceId: { in: indNodeIds } }, { targetId: { in: indNodeIds } }] },
      })
      return { industry: ind, nodeCount: indNodes.length, edgeCount: indEdges }
    }),
  )
  const activeClusters = industryClusters.filter((c) => c.nodeCount > 0)
  const topCluster = activeClusters
    .sort((a, b) => b.nodeCount - a.nodeCount)[0]

  return {
    asOfDate: currentDate(),
    nodeCount,
    edgeCount,
    topNodes,
    topEdges,
    industryClusters: activeClusters,
    oracleSummary: buildGraphNarrative(nodeCount, edgeCount, topCluster?.industry),
  }
}

function buildGraphNarrative(nodeCount: number, edgeCount: number, topIndustry?: IndustryKey): string {
  if (nodeCount === 0) {
    return 'The Cross-Company Knowledge Graph is currently empty. As more organizations contribute anonymized intelligence, Oracle will surface industry correlations, growth patterns, and risk patterns here.'
  }
  let s = `The Knowledge Graph links ${nodeCount} anonymized business entities through ${edgeCount} correlation edges — no private company data exposed.`
  if (topIndustry) {
    s += ` The most-connected cluster is ${INDUSTRY_LABELS[topIndustry]}, indicating strong pattern diversity in this sector.`
  }
  return s
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const aSlice = a.slice(0, n)
  const bSlice = b.slice(0, n)
  const aMean = aSlice.reduce((x, y) => x + y, 0) / n
  const bMean = bSlice.reduce((x, y) => x + y, 0) / n
  let num = 0, denomA = 0, denomB = 0
  for (let i = 0; i < n; i++) {
    const ad = aSlice[i] - aMean
    const bd = bSlice[i] - bMean
    num += ad * bd
    denomA += ad * ad
    denomB += bd * bd
  }
  const denom = Math.sqrt(denomA * denomB)
  return denom === 0 ? 0 : num / denom
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function safeParse(s: string | null | undefined): Record<string, unknown> {
  try { return s ? JSON.parse(s) : {} } catch { return {} }
}
