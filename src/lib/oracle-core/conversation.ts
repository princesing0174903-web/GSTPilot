// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Core™ — Executive Conversation™ Engine
// All AI executives continuously communicate. CEO asks CFO, CFO requests cash
// forecast, COO checks operations, Legal checks compliance, HR checks hiring,
// Marketing predicts demand, Oracle creates final strategy. The entire
// conversation is persisted as a single OracleConversation record.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { AIModuleId, Conversation, ConversationTurn } from './types';
import { writeMemory } from './memory';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Default executive roster (order matters — CEO opens, Oracle closes) ─────

export const EXECUTIVE_ORDER: AIModuleId[] = [
  'ceo', 'cfo', 'coo', 'cto', 'cro', 'legal', 'hr', 'marketing', 'operations', 'oracle',
];

export const EXECUTIVE_LABELS: Record<AIModuleId, string> = {
  oracle: 'Oracle™',
  ceo: 'AI CEO™',
  cfo: 'AI CFO™',
  coo: 'AI COO™',
  cto: 'AI CTO™',
  cro: 'AI CRO™',
  legal: 'AI Legal™',
  hr: 'AI HR™',
  marketing: 'AI Marketing™',
  operations: 'AI Operations™',
  graph: 'Business Graph™',
  knowledge: 'Knowledge Graph™',
  twin: 'Digital Twin™',
  autonomous: 'Autonomous Enterprise™',
  connectivity: 'Connectivity Fabric™',
  factory: 'AI Software Factory™',
  event: 'Event Stream Engine™',
};

// ─── Serialization ──────────────────────────────────────────────────────────

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function serialize(r: {
  id: string;
  firmId: string;
  userId: string | null;
  topic: string;
  trigger: string;
  participants: string;
  turns: string;
  consensus: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}): Conversation {
  return {
    id: r.id,
    firmId: r.firmId,
    userId: r.userId,
    topic: r.topic,
    trigger: r.trigger as Conversation['trigger'],
    participants: safeParseJSON<AIModuleId[]>(r.participants, []),
    turns: safeParseJSON<ConversationTurn[]>(r.turns, []),
    consensus: r.consensus,
    status: r.status as Conversation['status'],
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface StartConversationInput {
  firmId?: string;
  userId?: string | null;
  topic: string;
  trigger: 'user_ask' | 'daily_synthesis' | 'ceo_initiative' | 'alert';
  participants?: AIModuleId[];
}

/** Start a new executive conversation. Returns the serialized Conversation. */
export async function startConversation(input: StartConversationInput): Promise<Conversation> {
  const firmId = input.firmId || FIRM_ID;
  const participants = input.participants ?? EXECUTIVE_ORDER;
  const created = await db.oracleConversation.create({
    data: {
      firmId,
      userId: input.userId ?? null,
      topic: input.topic,
      trigger: input.trigger,
      participants: JSON.stringify(participants),
      turns: JSON.stringify([]),
      status: 'active',
    },
  });
  return serialize(created);
}

/** Append a turn to an existing conversation. */
export async function addTurn(
  conversationId: string,
  turn: Omit<ConversationTurn, 'at'>,
): Promise<Conversation> {
  const existing = await db.oracleConversation.findUnique({ where: { id: conversationId } });
  if (!existing) {
    throw new Error(`Conversation ${conversationId} not found`);
  }
  const turns = safeParseJSON<ConversationTurn[]>(existing.turns, []);
  turns.push({ ...turn, at: new Date().toISOString() });

  const updated = await db.oracleConversation.update({
    where: { id: conversationId },
    data: { turns: JSON.stringify(turns) },
  });
  return serialize(updated);
}

export interface RunConversationOptions {
  firmId?: string;
  userId?: string | null;
  participants?: AIModuleId[];
  maxTurns?: number;
  trigger?: Conversation['trigger'];
}

/** Run a full executive conversation on a topic. Each executive contributes a
 *  1-2 sentence perspective grounded in real data from its module entry point.
 *  After all turns, Oracle synthesizes a deterministic consensus and writes a
 *  memory record. NEVER throws — failures become empty "passes". */
export async function runExecutiveConversation(
  topic: string,
  options: RunConversationOptions = {},
): Promise<Conversation> {
  const maxTurns = options.maxTurns ?? 10;
  const participants = (options.participants ?? EXECUTIVE_ORDER).slice(0, maxTurns);
  const trigger = options.trigger ?? 'daily_synthesis';

  // 1. Start the conversation
  let conversation = await startConversation({
    firmId: options.firmId,
    userId: options.userId,
    topic,
    trigger,
    participants,
  });

  // 2. Each executive takes a turn
  const perspectives: Array<{ executive: AIModuleId; message: string; confidence: number }> = [];
  for (const executive of participants) {
    const turn = await generateExecutiveTurn(executive, topic);
    try {
      conversation = await addTurn(conversation.id, {
        executive: turn.executive,
        executiveLabel: turn.executiveLabel,
        message: turn.message,
        reasoning: turn.reasoning,
        confidence: turn.confidence,
      });
      perspectives.push({
        executive: turn.executive,
        message: turn.message,
        confidence: turn.confidence,
      });
    } catch (e) {
      // Should never happen — addTurn only throws if conversation missing.
      console.warn(`[Oracle Conversation] failed to add turn for ${executive}:`, e);
    }
  }

  // 3. Build consensus deterministically (concatenate key points)
  const consensus = buildConsensus(topic, perspectives);

  // 4. Update conversation with consensus + completed
  const updated = await db.oracleConversation.update({
    where: { id: conversation.id },
    data: {
      consensus,
      status: 'consensus_reached',
      completedAt: new Date(),
    },
  });

  // 5. Write memory record
  try {
    await writeMemory({
      firmId: options.firmId,
      userId: options.userId ?? null,
      category: 'conversation',
      source: 'oracle',
      title: topic,
      summary: consensus,
      payload: {
        conversationId: conversation.id,
        participants,
        turnCount: perspectives.length,
        avgConfidence: perspectives.length > 0
          ? Math.round(perspectives.reduce((s, p) => s + p.confidence, 0) / perspectives.length)
          : 0,
      },
      tags: ['executive-conversation', 'consensus', ...participants],
      importance: 70,
    });
  } catch (e) {
    console.warn('[Oracle Conversation] failed to write memory:', e);
  }

  return serialize(updated);
}

/** Conversation stats for VEYRO AI dashboard (last 24h). */
export async function getConversationStats(): Promise<{
  total: number;
  active: number;
  consensusReached: number;
}> {
  const firmId = FIRM_ID;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where24h = { firmId, createdAt: { gte: since24h } };

  const [total, active, consensusReached] = await Promise.all([
    db.oracleConversation.count({ where: where24h }),
    db.oracleConversation.count({ where: { ...where24h, status: 'active' } }),
    db.oracleConversation.count({ where: { ...where24h, status: 'consensus_reached' } }),
  ]);

  return { total, active, consensusReached };
}

/** Retrieve a single conversation by id (with all turns + consensus). */
export async function getConversation(id: string): Promise<Conversation | null> {
  const row = await db.oracleConversation.findUnique({ where: { id } });
  return row ? serialize(row) : null;
}

/** List recent conversations (paginated). */
export async function listConversations(limit = 50, offset = 0): Promise<Conversation[]> {
  const firmId = FIRM_ID;
  const rows = await db.oracleConversation.findMany({
    where: { firmId },
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(limit, 200),
    skip: Math.max(0, offset),
  });
  return rows.map(serialize);
}

// ─── Internal: per-executive perspective generators ──────────────────────────
// Each generator pulls REAL data from the corresponding module entry point and
// constructs a 1-2 sentence perspective. Failures produce a "passes" turn with
// empty message and confidence=0 — the conversation never crashes.

interface GeneratedTurn {
  executive: AIModuleId;
  executiveLabel: string;
  message: string;
  reasoning: string;
  confidence: number;
}

async function generateExecutiveTurn(executive: AIModuleId, topic: string): Promise<GeneratedTurn> {
  const label = EXECUTIVE_LABELS[executive];
  try {
    switch (executive) {
      case 'ceo':
        return ceoTurn(topic, label);
      case 'cfo':
        return await cfoTurn(topic, label);
      case 'coo':
        return await cooTurn(topic, label);
      case 'cto':
        return await ctoTurn(topic, label);
      case 'cro':
        return await croTurn(topic, label);
      case 'legal':
        return await legalTurn(topic, label);
      case 'hr':
        return await hrTurn(topic, label);
      case 'marketing':
        return await marketingTurn(topic, label);
      case 'operations':
        return await operationsTurn(topic, label);
      case 'oracle':
        return oracleTurn(topic, label);
      default:
        return passTurn(executive, label);
    }
  } catch (e) {
    console.warn(`[Oracle Conversation] ${executive} turn failed:`, e);
    return passTurn(executive, label);
  }
}

function passTurn(executive: AIModuleId, label: string): GeneratedTurn {
  return {
    executive,
    executiveLabel: label,
    message: '',
    reasoning: 'Module unavailable this cycle; passing.',
    confidence: 0,
  };
}

// Number formatter — Indian-style ₹ for finance figures
function inr(n: number): string {
  if (!isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

async function ceoTurn(topic: string, label: string): Promise<GeneratedTurn> {
  const { getCachedCEODashboard } = await import('@/lib/ceo/orchestrator');
  const d = await getCachedCEODashboard();
  const live = (d as any)?.liveState ?? {};
  const healthScore = (d as any)?.healthScore ?? 0;
  const riskScore = (d as any)?.riskScore ?? 0;
  const cash = live.cash ?? 0;
  const runway = live.runwayDays ?? d.runwayDays ?? 0;
  const revenue = live.revenue ?? 0;
  const message = `Health score is ${Math.round(healthScore)}/100, risk ${Math.round(riskScore)}/100. Cash ${inr(cash)} (${runway}d runway), monthly revenue ${inr(revenue)}. On "${topic}", I'm aligning the executive team behind a single decision before any execution.`;
  return {
    executive: 'ceo',
    executiveLabel: label,
    message,
    reasoning: `CEO dashboard: healthScore=${healthScore}, riskScore=${riskScore}, cash=${cash}, runwayDays=${runway}, revenue=${revenue}. Pending decisions=${(d as any)?.pendingDecisionCount ?? 0}.`,
    confidence: 85,
  };
}

async function cfoTurn(topic: string, label: string): Promise<GeneratedTurn> {
  const { generateCFOInsights } = await import('@/lib/cfo/engine');
  const cfo = await generateCFOInsights();
  const dash = (cfo as any)?.dashboard ?? {};
  const cash = dash?.cash?.currentBalance ?? 0;
  const runway = dash?.cash?.runwayDays ?? 0;
  const gstLiab = dash?.gst?.liability ?? 0;
  const itc = dash?.gst?.itcAvailable ?? 0;
  const topRisk = Array.isArray((cfo as any)?.risks) && (cfo as any).risks.length > 0
    ? (cfo as any).risks[0]
    : null;
  const topRiskLine = topRisk ? ` Top risk: ${topRisk.category} (${topRisk.score}/100) — ${topRisk.reasons?.[0] ?? 'unspecified'}.` : '';
  const message = `Cash position is ${inr(cash)} with ${runway} days runway. GST liability ${inr(gstLiab)} vs ITC available ${inr(itc)} (gap ${inr(gstLiab - itc)}).${topRiskLine} On "${topic}", I recommend we hold cash and clear compliance first.`;
  return {
    executive: 'cfo',
    executiveLabel: label,
    message,
    reasoning: `CFO dashboard: cash=${cash}, runwayDays=${runway}, gstLiability=${gstLiab}, itcAvailable=${itc}, hasLiveData=${(cfo as any)?.hasLiveData ?? false}.`,
    confidence: (cfo as any)?.hasLiveData ? 92 : 70,
  };
}

async function cooTurn(topic: string, label: string): Promise<GeneratedTurn> {
  const { getAutonomousDashboard } = await import('@/lib/autonomous/orchestrator');
  const d = await getAutonomousDashboard();
  const execs = (d as any)?.executives ?? [];
  const pending = (d as any)?.pendingApprovals ?? 0;
  const activeWorkflows = (d as any)?.activeWorkflows?.length ?? 0;
  const observation = (d as any)?.observation ?? {};
  const message = `${execs.length} executives online, ${activeWorkflows} active workflows, ${pending} decisions pending approval. Operations ${(observation as any)?.status ?? 'nominal'}. On "${topic}", I can route this through an autonomous workflow with proper approval gates.`;
  return {
    executive: 'coo',
    executiveLabel: label,
    message,
    reasoning: `Autonomous dashboard: executives=${execs.length}, pendingApprovals=${pending}, activeWorkflows=${activeWorkflows}, hasLiveData=${(d as any)?.hasLiveData ?? false}.`,
    confidence: (d as any)?.hasLiveData ? 88 : 72,
  };
}

async function ctoTurn(topic: string, label: string): Promise<GeneratedTurn> {
  const { getFactoryDashboard } = await import('@/lib/software-factory/engine');
  const d = await getFactoryDashboard();
  const totals = (d as any)?.totals ?? {};
  const health = (d as any)?.health ?? {};
  const message = `${totals.projects ?? 0} software projects (${totals.activeProjects ?? 0} active), build success ${Math.round((health.buildSuccessRate ?? 0) * 100)}%, avg coverage ${Math.round((health.averageCoverage ?? 0) * 100)}%. On "${topic}", I can ship a supporting tool or automation within this sprint if scoped.`;
  return {
    executive: 'cto',
    executiveLabel: label,
    message,
    reasoning: `Factory dashboard: projects=${totals.projects ?? 0}, builds=${totals.builds ?? 0}, buildSuccessRate=${health.buildSuccessRate ?? 0}, averageCoverage=${health.averageCoverage ?? 0}.`,
    confidence: 82,
  };
}

async function croTurn(topic: string, label: string): Promise<GeneratedTurn> {
  const { getGraphState } = await import('@/lib/graph/engine');
  const state = await getGraphState();
  const riskGraph = (state as any)?.riskGraph ?? {};
  const risks = (riskGraph as any)?.nodes ?? (riskGraph as any)?.risks ?? [];
  const topRisks = risks.slice(0, 3).map((r: any) => r.label ?? r.id ?? 'unknown').join(', ');
  const message = `Risk graph tracks ${risks.length} active risks. Top exposures: ${topRisks || 'none flagged'}. On "${topic}", I'm flagging this for risk review before we commit — any decision above ₹1L needs my sign-off.`;
  return {
    executive: 'cro',
    executiveLabel: label,
    message,
    reasoning: `Graph state: riskCount=${risks.length}, hasLiveData=${(state as any)?.hasLiveData ?? false}.`,
    confidence: (state as any)?.hasLiveData ? 86 : 70,
  };
}

async function legalTurn(topic: string, label: string): Promise<GeneratedTurn> {
  const { generateCFOInsights } = await import('@/lib/cfo/engine');
  const cfo = await generateCFOInsights();
  const gst = (cfo as any)?.dashboard?.gst ?? {};
  const filings = (gst as any)?.upcomingDueDates ?? [];
  const notices = (cfo as any)?.risks?.filter((r: any) => r.category === 'notice' || r.category === 'compliance') ?? [];
  const message = `${filings.length} GST filings due in next 30 days, ${notices.length} compliance items open. On "${topic}", I want to ensure no regulatory exposure — recommend Legal review before public commitment.`;
  return {
    executive: 'legal',
    executiveLabel: label,
    message,
    reasoning: `Legal scan: upcomingFilings=${filings.length}, complianceRisks=${notices.length}.`,
    confidence: 80,
  };
}

async function hrTurn(topic: string, label: string): Promise<GeneratedTurn> {
  const { getAutonomousDashboard } = await import('@/lib/autonomous/orchestrator');
  const d = await getAutonomousDashboard();
  const execs = (d as any)?.executives ?? [];
  const learning = (d as any)?.learnings?.length ?? 0;
  const message = `${execs.length} AI executives on roster, ${learning} learning insights recorded. On "${topic}", I'll assess whether we have the human/AI capacity to execute — if not, I'll flag the hiring need.`;
  return {
    executive: 'hr',
    executiveLabel: label,
    message,
    reasoning: `HR scan: executives=${execs.length}, learnings=${learning}.`,
    confidence: 75,
  };
}

async function marketingTurn(topic: string, label: string): Promise<GeneratedTurn> {
  const { getRmbState } = await import('@/lib/rmb/engine');
  const state = await getRmbState();
  const agents = (state as any)?.agents ?? [];
  const autopilots = (state as any)?.autopilots ?? [];
  const message = `${agents.length} business agents tracking demand signals, ${autopilots.length} autopilots running. On "${topic}", I'll project customer demand and channel response — recommend a coordinated campaign if this aligns with growth goals.`;
  return {
    executive: 'marketing',
    executiveLabel: label,
    message,
    reasoning: `Marketing scan: agents=${agents.length}, autopilots=${autopilots.length}.`,
    confidence: 74,
  };
}

async function operationsTurn(topic: string, label: string): Promise<GeneratedTurn> {
  const { getRmbState } = await import('@/lib/rmb/engine');
  const state = await getRmbState();
  const taskQueue = (state as any)?.taskQueue ?? [];
  const commandCenter = (state as any)?.commandCenter ?? {};
  const message = `${taskQueue.length} tasks queued, command center ${commandCenter?.status ?? 'nominal'}. On "${topic}", I'll operationalize the decision — assign owners, set deadlines, track in the daily task queue.`;
  return {
    executive: 'operations',
    executiveLabel: label,
    message,
    reasoning: `Ops scan: taskQueue=${taskQueue.length}, commandCenterStatus=${commandCenter?.status ?? 'unknown'}.`,
    confidence: 76,
  };
}

function oracleTurn(topic: string, label: string): GeneratedTurn {
  const message = `Synthesizing all executive perspectives on "${topic}". I will reconcile CFO's cash discipline, CEO's strategic alignment, CRO's risk gates, Legal's compliance review, and Operations' execution plan into one decision with explicit ROI estimate and rollback strategy.`;
  return {
    executive: 'oracle',
    executiveLabel: label,
    message,
    reasoning: 'Oracle is the unifying brain — its turn is always last and produces the consensus.',
    confidence: 95,
  };
}

// ─── Consensus synthesis ────────────────────────────────────────────────────

function buildConsensus(
  topic: string,
  perspectives: Array<{ executive: AIModuleId; message: string; confidence: number }>,
): string {
  const valid = perspectives.filter((p) => p.message && p.confidence > 0);
  if (valid.length === 0) {
    return `No executive consensus reached on "${topic}" — all modules were unavailable this cycle. Recommend manual review.`;
  }

  const lines: string[] = [
    `Executive consensus on "${topic}":`,
    '',
  ];

  for (const p of valid) {
    const label = EXECUTIVE_LABELS[p.executive] ?? p.executive;
    lines.push(`• ${label} (confidence ${p.confidence}%): ${p.message}`);
  }

  const avgConfidence = Math.round(
    valid.reduce((s, p) => s + p.confidence, 0) / valid.length,
  );

  lines.push('');
  lines.push(
    `Consolidated decision: proceed with the above, weighted by confidence. Average executive confidence: ${avgConfidence}%. CFO's cash discipline + CRO's risk gates + Legal's compliance review are mandatory pre-conditions. Operations owns execution tracking.`,
  );

  return lines.join('\n');
}
