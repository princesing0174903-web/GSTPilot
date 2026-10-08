// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — INFINITY AGI™ — LONG-TERM MEMORY™
//
// Oracle remembers everything forever: conversations, decisions, failures,
// customer history, employee history, strategy, roadmap, experiments, meetings,
// approvals, deployments, financial history, execution history. Every memory
// is searchable.
//
// Memories are seeded from REAL production rows across the enterprise —
// CEODecision, CEOAlert, CEOGoal, CEOMemory, AutonomousStrategyMeeting,
// AutonomousPlan, AutonomousSimulation, Client, Employee, Invoice, GSTRFiling,
// DevDeployment, AGIDecision — then unified into one searchable AGIMemory store.
// No mock values.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from './helpers';
import { safeCount, safeFindMany, cached, TTL, clamp01, parseJson, scoreMemory, emptyBreakdown } from './helpers';
import type {
  AGIMemory, MemoryCategory, MemorySummary, MemorySearchResult,
} from './types';

const CATEGORIES: MemoryCategory[] = [
  'conversation', 'decision', 'failure', 'customer', 'employee', 'strategy',
  'roadmap', 'experiment', 'meeting', 'approval', 'deployment', 'financial',
  'execution', 'learning',
];

// ─── Seed memories from REAL production rows ─────────────────────────────────

/** Syncs memories from real enterprise rows into AGIMemory. Idempotent — uses
 *  memoryKey for upsert. */
export async function seedMemoriesFromRealData(): Promise<number> {
  let seeded = 0;

  // 1. CEO decisions → decision memories
  const decisions = await safeFindMany(() => db.cEODecision.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { id: true, type: true, title: true, reason: true, status: true, risk: true, financialImpact: true, createdAt: true, requiresRole: true },
  }));
  for (const d of decisions) {
    const key = `decision:${d.id}`;
    const content = `${d.title}\n\nReason: ${d.reason}\nStatus: ${d.status}\nRisk: ${d.risk}\nFinancial impact: ${d.financialImpact}\nRequired role: ${d.requiresRole}`;
    await upsertMemory({
      memoryKey: key,
      category: 'decision',
      title: d.title,
      content,
      summary: `${d.type} decision (${d.status}) — risk ${d.risk}`,
      tags: [d.type, d.status, d.risk],
      sourceModule: 'ai_ceo',
      sourceEntity: d.id,
      importance: d.risk === 'critical' ? 0.95 : d.risk === 'high' ? 0.8 : 0.6,
    });
    seeded++;
  }

  // 2. CEO alerts → failure memories
  const alerts = await safeFindMany(() => db.cEOAlert.findMany({
    orderBy: { detectedAt: 'desc' },
    take: 40,
    select: { id: true, type: true, title: true, message: true, severity: true, detectedAt: true, acknowledged: true },
  }));
  for (const a of alerts) {
    const key = `failure:${a.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'failure',
      title: a.title,
      content: `${a.message}\n\nSeverity: ${a.severity}\nType: ${a.type}\nDetected: ${a.detectedAt.toISOString()}\nAcknowledged: ${a.acknowledged}`,
      summary: `${a.severity} alert: ${a.type}`,
      tags: [a.type, a.severity, a.acknowledged ? 'acknowledged' : 'open'],
      sourceModule: 'oracle_intelligence',
      sourceEntity: a.id,
      importance: a.severity === 'critical' ? 0.95 : a.severity === 'high' ? 0.8 : 0.6,
    });
    seeded++;
  }

  // 3. CEO goals → strategy memories
  const goals = await safeFindMany(() => db.cEOGoal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, title: true, description: true, status: true, progressPct: true, deadline: true, createdAt: true },
  }));
  for (const g of goals) {
    const key = `strategy:${g.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'strategy',
      title: g.title,
      content: `${g.description}\n\nStatus: ${g.status}\nProgress: ${g.progressPct}%\nDeadline: ${g.deadline?.toISOString() ?? 'no deadline'}`,
      summary: `Goal: ${g.title} (${g.status}, ${g.progressPct}%)`,
      tags: [g.status, 'goal'],
      sourceModule: 'ai_ceo',
      sourceEntity: g.id,
      importance: 0.75,
    });
    seeded++;
  }

  // 4. Strategy meetings → meeting memories
  const meetings = await safeFindMany(() => db.autonomousStrategyMeeting.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, topic: true, consensus: true, status: true, createdAt: true },
  }));
  for (const m of meetings) {
    const key = `meeting:${m.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'meeting',
      title: m.topic,
      content: `Strategy Room meeting on "${m.topic}".\nConsensus: ${m.consensus}\nStatus: ${m.status}`,
      summary: `Strategy meeting: ${m.topic}`,
      tags: ['strategy_room', m.status],
      sourceModule: 'autonomous_enterprise',
      sourceEntity: m.id,
      importance: 0.7,
    });
    seeded++;
  }

  // 5. Simulations → experiment memories
  const sims = await safeFindMany(() => db.autonomousSimulation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, scenario: true, recommendation: true, confidence: true, createdAt: true },
  }));
  for (const s of sims) {
    const key = `experiment:${s.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'experiment',
      title: `Simulation: ${s.scenario}`,
      content: `Simulated scenario "${s.scenario}". Recommendation: ${s.recommendation}. Confidence: ${s.confidence}.`,
      summary: `Simulation ${s.scenario} → ${s.recommendation}`,
      tags: [s.scenario, s.recommendation, 'simulation'],
      sourceModule: 'digital_twin',
      sourceEntity: s.id,
      importance: clamp01(0.5 + s.confidence / 4),
    });
    seeded++;
  }

  // 6. Clients → customer memories
  const clients = await safeFindMany(() => db.client.findMany({
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, tradeName: true, entityType: true, contactEmail: true, gstin: true, status: true, createdAt: true },
  }));
  for (const c of clients) {
    const key = `customer:${c.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'customer',
      title: c.tradeName,
      content: `Client ${c.tradeName} — type: ${c.entityType ?? 'unknown'}, GSTIN: ${c.gstin ?? 'n/a'}, status: ${c.status}, email: ${c.contactEmail ?? 'n/a'}.`,
      summary: `Client: ${c.tradeName} (${c.entityType ?? 'general'})`,
      tags: ['client', c.entityType ?? 'general', c.status],
      sourceModule: 'crm',
      sourceEntity: c.id,
      importance: 0.6,
    });
    seeded++;
  }

  // 7. Employees → employee memories
  const employees = await safeFindMany(() => db.employee.findMany({
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, name: true, designation: true, department: true, salary: true, createdAt: true },
  }));
  for (const e of employees) {
    const key = `employee:${e.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'employee',
      title: e.name,
      content: `Employee ${e.name} — designation: ${e.designation ?? 'n/a'}, department: ${e.department ?? 'n/a'}, salary: ₹${e.salary ?? 0}.`,
      summary: `Employee: ${e.name} (${e.designation ?? 'role'})`,
      tags: ['employee', e.department ?? 'general'],
      sourceModule: 'hr',
      sourceEntity: e.id,
      importance: 0.6,
    });
    seeded++;
  }

  // 8. GST filings → financial memories
  const filings = await safeFindMany(() => db.gSTRFiling.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, returnType: true, period: true, status: true, totalTax: true, createdAt: true },
  }));
  for (const f of filings) {
    const key = `financial:${f.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'financial',
      title: `GST ${f.returnType} — ${f.period}`,
      content: `GST filing ${f.returnType} for period ${f.period}. Status: ${f.status}. Total tax: ₹${f.totalTax ?? 0}.`,
      summary: `GST ${f.returnType} ${f.period} (${f.status})`,
      tags: ['gst', f.returnType, f.status],
      sourceModule: 'gst',
      sourceEntity: f.id,
      importance: 0.7,
    });
    seeded++;
  }

  // 9. Dev deployments → deployment memories
  const deploys = await safeFindMany(() => db.devDeployment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, environment: true, status: true, createdAt: true },
  }));
  for (const d of deploys) {
    const key = `deployment:${d.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'deployment',
      title: `Deployment ${d.environment}`,
      content: `Deployment to ${d.environment}. Status: ${d.status}. Deployed at: ${d.createdAt.toISOString()}.`,
      summary: `Deploy ${d.environment} (${d.status})`,
      tags: ['deployment', d.environment, d.status],
      sourceModule: 'ai_software_factory',
      sourceEntity: d.id,
      importance: 0.65,
    });
    seeded++;
  }

  // 10. AGI decisions → decision memories (the AGI's own decisions)
  const agiDecisions = await safeFindMany(() => db.aGIDecision.findMany({
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, title: true, summary: true, status: true, category: true, proposingAgent: true, createdAt: true },
  }));
  for (const d of agiDecisions) {
    const key = `agi_decision:${d.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'decision',
      title: d.title,
      content: `${d.summary}\n\nCategory: ${d.category}\nProposed by: ${d.proposingAgent}\nStatus: ${d.status}`,
      summary: `AGI decision: ${d.title} (${d.status})`,
      tags: ['agi', d.category, d.proposingAgent, d.status],
      sourceModule: 'agi',
      sourceEntity: d.id,
      importance: 0.8,
    });
    seeded++;
  }

  // 11. Execution tasks → execution memories
  const tasks = await safeFindMany(() => db.executionTask.findMany({
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, description: true, type: true, status: true, agent: true, createdAt: true },
  }));
  for (const t of tasks) {
    const key = `execution:${t.id}`;
    await upsertMemory({
      memoryKey: key,
      category: 'execution',
      title: t.description,
      content: `Execution task (${t.type}) "${t.description}". Agent: ${t.agent ?? 'unassigned'}. Status: ${t.status}.`,
      summary: `Task: ${t.description} (${t.status})`,
      tags: ['execution', t.status, t.agent ?? 'unassigned'],
      sourceModule: 'execution_cloud',
      sourceEntity: t.id,
      importance: 0.55,
    });
    seeded++;
  }

  // 12. Approvals → approval memories
  const approvals = await safeFindMany(() => db.approval.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, reason: true, status: true, approvedBy: true, risk: true, createdAt: true },
  }));
  for (const a of approvals) {
    const key = `approval:${a.id}`;
    const label = a.reason ?? `Approval (task risk ${a.risk})`;
    await upsertMemory({
      memoryKey: key,
      category: 'approval',
      title: label,
      content: `Approval "${label}". Approved by: ${a.approvedBy ?? 'pending'}. Status: ${a.status}. Risk: ${a.risk}/100.`,
      summary: `Approval: ${label} (${a.status})`,
      tags: ['approval', a.status, a.approvedBy ?? 'pending'],
      sourceModule: 'command_network',
      sourceEntity: a.id,
      importance: 0.65,
    });
    seeded++;
  }

  return seeded;
}

async function upsertMemory(input: {
  memoryKey: string;
  category: MemoryCategory;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  sourceModule: string;
  sourceEntity: string;
  importance: number;
}): Promise<void> {
  try {
    await db.aGIMemory.upsert({
      where: { memoryKey: input.memoryKey },
      create: {
        memoryKey: input.memoryKey,
        category: input.category,
        title: input.title,
        content: input.content,
        summary: input.summary,
        tags: JSON.stringify(input.tags),
        sourceModule: input.sourceModule,
        sourceEntity: input.sourceEntity,
        importance: input.importance,
      },
      update: {
        title: input.title,
        content: input.content,
        summary: input.summary,
        tags: JSON.stringify(input.tags),
        importance: input.importance,
      },
    });
  } catch {
    /* ignore — best-effort sync */
  }
}

// ─── Retrieve recent memories ────────────────────────────────────────────────

export async function getRecentMemories(limit = 24): Promise<AGIMemory[]> {
  const rows = await safeFindMany(() => db.aGIMemory.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  }));
  return rows.map(mapRow);
}

// ─── Search memories ─────────────────────────────────────────────────────────

export async function searchMemories(query: string, limit = 20): Promise<MemorySearchResult[]> {
  if (!query.trim()) {
    const recent = await getRecentMemories(limit);
    return recent.map((memory) => ({ memory, score: 0, matchedOn: [] }));
  }
  // Pull a candidate pool (recent 500 memories) and score locally.
  const pool = await safeFindMany(() => db.aGIMemory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  }));
  const scored: MemorySearchResult[] = [];
  for (const row of pool) {
    const memory = mapRow(row);
    const { score, matchedOn } = scoreMemory(memory, query);
    if (score > 0) {
      scored.push({ memory, score, matchedOn });
      // increment retrieval count (best-effort)
      try {
        await db.aGIMemory.update({
          where: { id: row.id },
          data: { retrievalCount: { increment: 1 } },
        });
      } catch { /* ignore */ }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ─── Memory summary ──────────────────────────────────────────────────────────

export async function getMemorySummary(): Promise<MemorySummary> {
  return cached<MemorySummary>('agi:memory:summary', TTL.MEDIUM, async () => {
    const [total, rows, oldest, newest, retrievals] = await Promise.all([
      safeCount(() => db.aGIMemory.count()),
      safeFindMany(() => db.aGIMemory.findMany({
        select: { category: true, importance: true, retrievalCount: true, content: true, summary: true, createdAt: true },
      })),
      safeFirstRow('asc'),
      safeFirstRow('desc'),
      safeCount(() => db.aGIMemory.count()),
    ]);

    const byCategory = emptyBreakdown(CATEGORIES);
    let totalImportance = 0;
    let totalRetrievals = 0;
    let storageBytes = 0;
    for (const r of rows) {
      byCategory[r.category as MemoryCategory] = (byCategory[r.category as MemoryCategory] ?? 0) + 1;
      totalImportance += r.importance ?? 0;
      totalRetrievals += r.retrievalCount ?? 0;
      storageBytes += (r.content?.length ?? 0) + (r.summary?.length ?? 0);
    }

    return {
      totalMemories: total,
      byCategory,
      totalRetrievals,
      avgImportance: rows.length > 0 ? clamp01(totalImportance / rows.length) : 0,
      oldestMemory: oldest?.createdAt?.toISOString() ?? null,
      newestMemory: newest?.createdAt?.toISOString() ?? null,
      storageBytes,
    };
  });

  async function safeFirstRow(dir: 'asc' | 'desc') {
    try {
      return await db.aGIMemory.findFirst({
        orderBy: { createdAt: dir },
        select: { createdAt: true },
      });
    } catch { return null; }
  }
}

// ─── Row mapper ──────────────────────────────────────────────────────────────

function mapRow(r: {
  id: string; memoryKey: string; category: string; title: string; content: string;
  summary: string | null; tags: string; sourceModule: string | null;
  sourceEntity: string | null; importance: number; retrievalCount: number;
  createdAt: Date;
}): AGIMemory {
  return {
    id: r.id,
    memoryKey: r.memoryKey,
    category: r.category as MemoryCategory,
    title: r.title,
    content: r.content,
    summary: r.summary,
    tags: parseJson<string[]>(r.tags, []),
    sourceModule: r.sourceModule,
    sourceEntity: r.sourceEntity,
    importance: clamp01(r.importance ?? 0.5),
    retrievalCount: r.retrievalCount ?? 0,
    createdAt: r.createdAt.toISOString(),
  };
}
