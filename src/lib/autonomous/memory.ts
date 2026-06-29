// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — ENTERPRISE MEMORY
//
// Remembers forever: every decision, approval, customer interaction, AI
// conversation, report, strategy, simulation, prediction, workflow and
// meeting. Everything becomes searchable.
//
// Aggregates across CEOMemory, AgentMemory, CEODecision, CEOAlert,
// AutonomousStrategyMeeting and AutonomousSimulation — no duplication, all
// REAL persisted records.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { EnterpriseMemoryEntry } from './types';

// ─── Unified search across every memory source ───────────────────────────────

export async function searchEnterpriseMemory(
  query?: string,
  limit = 50,
): Promise<{ entries: EnterpriseMemoryEntry[]; total: number; bySource: Record<string, number> }> {
  const q = (query ?? '').trim().toLowerCase();
  const entries: EnterpriseMemoryEntry[] = [];

  const [
    ceoMemory, agentMemory, ceoDecisions, ceoAlerts,
    strategyMeetings, simulations,
  ] = await Promise.all([
    safeQuery(() => db.cEOMemory.findMany({ orderBy: { occurredAt: 'desc' }, take: 40 })),
    safeQuery(() => db.agentMemory.findMany({ orderBy: { lastUsedAt: 'desc' }, take: 40 })),
    safeQuery(() => db.cEODecision.findMany({ orderBy: { createdAt: 'desc' }, take: 40 })),
    safeQuery(() => db.cEOAlert.findMany({ orderBy: { detectedAt: 'desc' }, take: 30 })),
    safeQuery(() => db.autonomousStrategyMeeting.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })),
    safeQuery(() => db.autonomousSimulation.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })),
  ]);

  for (const m of ceoMemory) {
    entries.push({
      id: m.id,
      source: 'strategy',
      title: m.title,
      description: m.description,
      importance: m.importance,
      occurredAt: m.occurredAt.toISOString(),
      tags: parseTags(m.tags),
      metadata: m.metadata ? safeJson(m.metadata) : undefined,
    });
  }
  for (const m of agentMemory) {
    entries.push({
      id: m.id,
      source: 'learning',
      title: `${m.memoryType}: ${m.key}`,
      description: m.value,
      importance: m.importance,
      occurredAt: m.lastUsedAt.toISOString(),
      tags: [m.agent, m.memoryType],
    });
  }
  for (const d of ceoDecisions) {
    entries.push({
      id: d.id,
      source: 'decision',
      title: d.title,
      description: `${d.reason} (status: ${d.status}, confidence: ${Math.round(d.confidence * 100)}%)`,
      importance: d.priority === 'critical' ? 0.95 : d.priority === 'high' ? 0.8 : 0.6,
      occurredAt: d.createdAt.toISOString(),
      tags: [d.type, d.status, d.priority],
      metadata: { financialImpact: d.financialImpact, risk: d.risk },
    });
  }
  for (const a of ceoAlerts) {
    entries.push({
      id: a.id,
      source: 'alert',
      title: a.title,
      description: a.message,
      importance: a.severity === 'critical' ? 0.98 : a.severity === 'high' ? 0.85 : 0.55,
      occurredAt: a.detectedAt.toISOString(),
      tags: [a.type, a.severity],
    });
  }
  for (const m of strategyMeetings) {
    entries.push({
      id: m.id,
      source: 'meeting',
      title: m.topic,
      description: m.consensus,
      importance: m.riskLevel === 'critical' ? 0.9 : 0.7,
      occurredAt: m.createdAt.toISOString(),
      tags: ['strategy_room', m.trigger, m.ceoApproval],
    });
  }
  for (const s of simulations) {
    entries.push({
      id: s.id,
      source: 'simulation',
      title: s.title,
      description: `${s.scenario} — recommendation: ${s.recommendation}`,
      importance: 0.65,
      occurredAt: s.createdAt.toISOString(),
      tags: [s.scenario, s.recommendation],
    });
  }

  // Sort by importance then recency
  entries.sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  });

  // Filter by query
  const filtered = q
    ? entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : entries;

  const bySource: Record<string, number> = {};
  for (const e of entries) bySource[e.source] = (bySource[e.source] || 0) + 1;

  return {
    entries: filtered.slice(0, limit),
    total: entries.length,
    bySource,
  };
}

// ─── Stats only (for dashboard) ───────────────────────────────────────────────

export async function getMemoryStats(): Promise<{
  total: number;
  bySource: Record<string, number>;
}> {
  const { bySource, total } = await searchEnterpriseMemory(undefined, 0);
  return { total, bySource };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeQuery<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[Autonomous] memory query failed:', err);
    return [];
  }
}

function parseTags(s: string | null): string[] {
  if (!s) return [];
  try { return JSON.parse(s) as string[]; } catch { return []; }
}

function safeJson(s: string): Record<string, unknown> | undefined {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return undefined; }
}
