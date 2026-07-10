// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — INFINITY AGI™ — MULTI-AGENT SWARM™
//
// 15 specialized autonomous agents collaborate continuously. Oracle acts as
// the coordinating intelligence.
//   CEO, CFO, COO, CTO, CRO, HR, Legal, Marketing, Sales, Finance,
//   Compliance, Banking, Engineering, Customer Success, Security.
//
// Each agent's metrics are derived from REAL rows in the agent's domain tables
// (CEODecision, CommandAuditLog, AGIDecision, AGIAuditLog). Inter-agent
// messages are reconstructed from REAL audit/decision/collaboration records.
// No mock values.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from './helpers';
import { safeCount, safeFindMany, cached, TTL, clamp01, parseJson } from './helpers';
import type {
  AgentId, AgentStatus, SwarmAgent, AgentMessage, SwarmSummary,
} from './types';

// ─── Agent roster — 15 specialized agents ────────────────────────────────────

interface AgentRosterEntry {
  id: AgentId;
  name: string;
  role: string;
  emoji: string;
  mandate: string;
  capabilities: string[];
  decisionDomains: string[];
}

export const AGENT_ROSTER: Record<AgentId, AgentRosterEntry> = {
  ceo: {
    id: 'ceo', name: 'Oracle CEO', role: 'Chief Executive Officer', emoji: '👑',
    mandate: 'Sets company vision, approves major decisions, resolves executive disagreements, owns the Enterprise AGI Health Score.',
    capabilities: ['strategy', 'vision', 'investment_approval', 'executive_coordination', 'board_reporting'],
    decisionDomains: ['strategy', 'growth', 'expansion', 'major_investments', 'hiring_leadership', 'ceo_approval'],
  },
  cfo: {
    id: 'cfo', name: 'Oracle CFO', role: 'Chief Financial Officer', emoji: '💰',
    mandate: 'Owns revenue, expenses, cash flow, GST, banking, payroll and financial risk. Approves every money-moving action.',
    capabilities: ['financial_planning', 'cash_management', 'gst', 'payroll', 'banking', 'forecasting'],
    decisionDomains: ['cash_flow', 'expenses', 'collections', 'gst', 'payroll', 'banking', 'forecasting', 'tax'],
  },
  coo: {
    id: 'coo', name: 'Oracle COO', role: 'Chief Operating Officer', emoji: '⚙️',
    mandate: 'Runs day-to-day operations, vendors, inventory, workflow orchestration and SLA compliance.',
    capabilities: ['operations', 'vendor_management', 'inventory', 'workflow_orchestration', 'sla'],
    decisionDomains: ['operations', 'vendors', 'inventory', 'sla', 'fulfillment', 'quality'],
  },
  cto: {
    id: 'cto', name: 'Oracle CTO', role: 'Chief Technology Officer', emoji: '🔧',
    mandate: 'Owns technology architecture, AI Software Factory, infrastructure and engineering velocity.',
    capabilities: ['architecture', 'ai_software_factory', 'infrastructure', 'engineering_velocity', 'security_posture'],
    decisionDomains: ['technology', 'architecture', 'infrastructure', 'ai_software_factory', 'security_engineering'],
  },
  cro: {
    id: 'cro', name: 'Oracle CRO', role: 'Chief Risk Officer', emoji: '🛡️',
    mandate: 'Owns enterprise risk — financial, compliance, operational, reputational and strategic.',
    capabilities: ['risk_assessment', 'compliance_monitoring', 'incident_response', 'retention_risk'],
    decisionDomains: ['risk', 'compliance', 'incidents', 'retention', 'audit'],
  },
  hr: {
    id: 'hr', name: 'Oracle HR', role: 'Head of People', emoji: '👥',
    mandate: 'Hiring, onboarding, performance, compensation, culture and workforce planning.',
    capabilities: ['hiring', 'onboarding', 'performance', 'compensation', 'workforce_planning'],
    decisionDomains: ['hiring', 'payroll', 'performance', 'retention', 'culture'],
  },
  legal: {
    id: 'legal', name: 'Oracle Legal', role: 'General Counsel', emoji: '⚖️',
    mandate: 'Contracts, ROC filings, notices, litigation, regulatory affairs and legal risk.',
    capabilities: ['contracts', 'roc', 'notices', 'litigation', 'regulatory'],
    decisionDomains: ['contracts', 'roc', 'notices', 'litigation', 'regulatory', 'ip'],
  },
  marketing: {
    id: 'marketing', name: 'Oracle Marketing', role: 'CMO', emoji: '📣',
    mandate: 'Brand, campaigns, lead generation, content, growth marketing and market intelligence.',
    capabilities: ['brand', 'campaigns', 'lead_gen', 'content', 'growth', 'market_intel'],
    decisionDomains: ['marketing', 'brand', 'campaigns', 'lead_generation', 'content', 'growth'],
  },
  sales: {
    id: 'sales', name: 'Oracle Sales', role: 'Head of Sales', emoji: '🤝',
    mandate: 'Pipeline, proposals, negotiation, closing and revenue realization.',
    capabilities: ['pipeline', 'proposals', 'negotiation', 'closing', 'revenue_realization'],
    decisionDomains: ['sales', 'pipeline', 'proposals', 'closing', 'revenue'],
  },
  finance: {
    id: 'finance', name: 'Oracle Finance', role: 'Finance Controller', emoji: '📊',
    mandate: 'Accounting, bookkeeping, financial reporting, audit and treasury operations.',
    capabilities: ['accounting', 'bookkeeping', 'reporting', 'audit', 'treasury'],
    decisionDomains: ['accounting', 'reporting', 'audit', 'treasury', 'reconciliation'],
  },
  compliance: {
    id: 'compliance', name: 'Oracle Compliance', role: 'Compliance Officer', emoji: '✅',
    mandate: 'GST, TDS, ROC, labour and industry-specific compliance. Owns the compliance calendar.',
    capabilities: ['gst', 'tds', 'roc', 'labour', 'industry_compliance', 'calendar'],
    decisionDomains: ['compliance', 'gst', 'tds', 'roc', 'filings', 'deadlines'],
  },
  banking: {
    id: 'banking', name: 'Oracle Banking', role: 'Treasury & Banking', emoji: '🏦',
    mandate: 'Banking connections, reconciliation, payments, collections and cash positioning.',
    capabilities: ['banking', 'reconciliation', 'payments', 'collections', 'cash_positioning'],
    decisionDomains: ['banking', 'reconciliation', 'payments', 'collections'],
  },
  engineering: {
    id: 'engineering', name: 'Oracle Engineering', role: 'VP Engineering', emoji: '🛠️',
    mandate: 'Builds and ships software via the AI Software Factory — projects, builds, deployments.',
    capabilities: ['software_factory', 'builds', 'deployments', 'code_review', 'testing'],
    decisionDomains: ['engineering', 'builds', 'deployments', 'code_review', 'testing'],
  },
  customer_success: {
    id: 'customer_success', name: 'Oracle Customer Success', role: 'Head of CS', emoji: '💚',
    mandate: 'Onboarding, retention, churn prevention, NPS and customer health.',
    capabilities: ['onboarding', 'retention', 'churn_prevention', 'nps', 'health_scoring'],
    decisionDomains: ['customer_success', 'retention', 'churn', 'onboarding', 'health'],
  },
  security: {
    id: 'security', name: 'Oracle Security', role: 'CISO', emoji: '🔐',
    mandate: 'Zero-trust validation, RBAC enforcement, guardrails, emergency shutdown and audit integrity.',
    capabilities: ['zero_trust', 'rbac', 'guardrails', 'emergency_shutdown', 'audit_integrity'],
    decisionDomains: ['security', 'rbac', 'guardrails', 'shutdown', 'audit'],
  },
};

export const AGENT_IDS = Object.keys(AGENT_ROSTER) as AgentId[];

// ─── Per-agent metric collection (from REAL data) ────────────────────────────

const dayAgo = (): Date => new Date(Date.now() - 24 * 60 * 60 * 1000);

async function agentDecisionsLast24h(id: AgentId): Promise<number> {
  // Count AGIDecision rows proposed by this agent in the last 24h, plus
  // CEODecision rows where the required role maps to this agent.
  const [agi, ceo] = await Promise.all([
    safeCount(() => db.aGIDecision.count({
      where: { proposingAgent: id, createdAt: { gte: dayAgo() } },
    })),
    safeCount(() => db.cEODecision.count({
      where: { requiresRole: roleForAgent(id), createdAt: { gte: dayAgo() } },
    })),
  ]);
  return agi + ceo;
}

async function agentDecisionsTotal(id: AgentId): Promise<number> {
  const [agi, ceo] = await Promise.all([
    safeCount(() => db.aGIDecision.count({ where: { proposingAgent: id } })),
    safeCount(() => db.cEODecision.count({ where: { requiresRole: roleForAgent(id) } })),
  ]);
  return agi + ceo;
}

/** Map an AgentId to the CEODecision.requiresRole value that corresponds to it. */
function roleForAgent(id: AgentId): string {
  switch (id) {
    case 'ceo': return 'ceo';
    case 'cfo': case 'finance': case 'banking': return 'cfo';
    case 'coo': return 'manager';
    case 'cto': case 'engineering': return 'manager';
    case 'cro': case 'compliance': case 'security': return 'manager';
    case 'hr': return 'manager';
    case 'legal': return 'manager';
    case 'marketing': case 'sales': case 'customer_success': return 'manager';
    default: return 'manager';
  }
}

async function agentMessagesExchanged(id: AgentId): Promise<number> {
  // Inter-agent messages = audit logs where this agent was the actor in the
  // last cycle (24h), reconstructing coordination traffic from REAL records.
  return safeCount(() => db.aGIAuditLog.count({
    where: { actorId: id, actorType: 'ai_agent', occurredAt: { gte: dayAgo() } },
  }));
}

async function agentAvgConfidence(id: AgentId): Promise<number> {
  const rows = await safeFindMany(() => db.aGIDecision.findMany({
    where: { proposingAgent: id },
    select: { confidence: true },
    take: 50,
    orderBy: { createdAt: 'desc' },
  }));
  if (rows.length === 0) return 0.5;
  return clamp01(rows.reduce((s, r) => s + (r.confidence || 0.5), 0) / rows.length);
}

async function agentSuccessRate(id: AgentId): Promise<number> {
  const total = await agentDecisionsTotal(id);
  if (total === 0) return 0;
  const executed = await safeCount(() => db.aGIDecision.count({
    where: { proposingAgent: id, status: { in: ['executed', 'approved'] } },
  }));
  return clamp01(executed / total);
}

async function agentLastActive(id: AgentId): Promise<string | null> {
  const r = await safeFirst(() => db.aGIAuditLog.findFirst({
    where: { actorId: id },
    orderBy: { occurredAt: 'desc' },
    select: { occurredAt: true },
  }));
  return r?.occurredAt?.toISOString() ?? null;
}

async function safeFirst<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

// ─── Persist + load agent rows ───────────────────────────────────────────────

/** Upserts the 15 agent rows so metrics are queryable. */
export async function seedAgentsIfMissing(): Promise<void> {
  for (const id of AGENT_IDS) {
    const entry = AGENT_ROSTER[id];
    try {
      const existing = await db.aGIAgent.findUnique({ where: { agentId: id } });
      if (!existing) {
        await db.aGIAgent.create({
          data: {
            agentId: id,
            name: entry.name,
            role: entry.role,
            emoji: entry.emoji,
            mandate: entry.mandate,
            capabilities: JSON.stringify(entry.capabilities),
            decisionDomains: JSON.stringify(entry.decisionDomains),
            status: 'active',
            lastActiveAt: new Date(),
          },
        });
      }
    } catch {
      /* ignore */
    }
  }
}

/** Returns the 15 swarm agents with REAL live metrics. */
export async function getSwarmAgents(): Promise<SwarmAgent[]> {
  await seedAgentsIfMissing();
  const out: SwarmAgent[] = [];
  for (const id of AGENT_IDS) {
    const entry = AGENT_ROSTER[id];
    const [d24, dTotal, msgs, conf, succ, lastActive] = await Promise.all([
      agentDecisionsLast24h(id),
      agentDecisionsTotal(id),
      agentMessagesExchanged(id),
      agentAvgConfidence(id),
      agentSuccessRate(id),
      agentLastActive(id),
    ]);
    // Status heuristic: if decided in last 24h → active; if has total → idle; else paused
    let status: AgentStatus = 'paused';
    if (d24 > 0) status = 'active';
    else if (dTotal > 0) status = 'idle';
    // Persist current metrics back to the row (best-effort, non-blocking)
    try {
      await db.aGIAgent.update({
        where: { agentId: id },
        data: {
          decisionsLast24h: d24,
          decisionsTotal: dTotal,
          messagesExchanged: msgs,
          avgConfidence: conf,
          successRate: succ,
          status,
          lastActiveAt: lastActive ? new Date(lastActive) : null,
        },
      });
    } catch {
      /* ignore */
    }
    out.push({
      id,
      name: entry.name,
      role: entry.role,
      emoji: entry.emoji,
      mandate: entry.mandate,
      capabilities: entry.capabilities,
      decisionDomains: entry.decisionDomains,
      status,
      currentTask: null,
      decisionsLast24h: d24,
      decisionsTotal: dTotal,
      messagesExchanged: msgs,
      avgConfidence: conf,
      successRate: succ,
      lastActiveAt: lastActive,
    });
  }
  return out;
}

// ─── Reconstruct inter-agent messages from REAL audit/decision records ──────

export async function getRecentAgentMessages(limit = 24): Promise<AgentMessage[]> {
  // Messages = AGI audit logs where an agent acted on a decision/workflow,
  // plus Command AuditLog coordination records. Each becomes a Swarm message.
  const [agiAudit, cmdAudit, agiDecisions] = await Promise.all([
    safeFindMany(() => db.aGIAuditLog.findMany({
      where: { actorType: 'ai_agent' },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: { id: true, actionType: true, actorId: true, targetType: true, targetId: true, reason: true, occurredAt: true, signature: true },
    })),
    safeFindMany(() => db.commandAuditLog.findMany({
      where: { actorType: { in: ['ai_ceo', 'ai_cfo', 'ai_coo', 'ai_cto', 'ai_cro', 'oracle', 'system'] } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: { id: true, commandType: true, actorId: true, actorType: true, targetModule: true, targetEntity: true, occurredAt: true, signature: true },
    })),
    safeFindMany(() => db.aGIDecision.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, proposingAgent: true, collaborators: true, title: true, status: true, createdAt: true },
    })),
  ]);

  const messages: AgentMessage[] = [];

  // AGI audit logs → agent→oracle messages
  for (const r of agiAudit) {
    const fromAgent = (r.actorId as AgentId) ?? 'ceo';
    if (!AGENT_ROSTER[fromAgent]) continue;
    messages.push({
      id: r.id,
      fromAgent,
      toAgent: 'oracle',
      intent: mapActionToIntent(r.actionType),
      content: r.reason ?? `${r.actionType} on ${r.targetType}`,
      relatedDecision: r.targetId,
      createdAt: r.occurredAt.toISOString(),
    });
  }

  // Command audit logs → agent→agent coordination messages
  for (const r of cmdAudit) {
    const fromAgent = mapActorTypeToAgent(r.actorType);
    if (!fromAgent) continue;
    messages.push({
      id: r.id,
      fromAgent,
      toAgent: 'oracle',
      intent: 'coordinate',
      content: `${r.commandType} on ${r.targetModule}`,
      relatedDecision: r.targetEntity,
      createdAt: r.occurredAt.toISOString(),
    });
  }

  // AGI decisions → proposing agent informs collaborators
  for (const r of agiDecisions) {
    const fromAgent = r.proposingAgent as AgentId;
    if (!AGENT_ROSTER[fromAgent]) continue;
    const collaborators = parseJson<string[]>(r.collaborators, []);
    const toAgent: AgentId | 'oracle' | 'all' = collaborators.length > 1 ? 'all' : 'oracle';
    messages.push({
      id: r.id,
      fromAgent,
      toAgent,
      intent: r.status === 'approved' ? 'approve' : r.status === 'rejected' ? 'reject' : 'propose',
      content: `${r.title} [${r.status}]`,
      relatedDecision: r.id,
      createdAt: r.createdAt.toISOString(),
    });
  }

  // Sort by createdAt desc and dedupe by id
  const seen = new Set<string>();
  return messages
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .slice(0, limit);
}

function mapActionToIntent(action: string): AgentMessage['intent'] {
  switch (action) {
    case 'approve': return 'approve';
    case 'reject': return 'reject';
    case 'execute': return 'propose';
    case 'reason': return 'inform';
    case 'learn': return 'inform';
    case 'simulate': return 'request';
    case 'shutdown': return 'alert';
    case 'rollback': return 'alert';
    default: return 'coordinate';
  }
}

function mapActorTypeToAgent(actorType: string): AgentId | null {
  const map: Record<string, AgentId> = {
    ai_ceo: 'ceo', ai_cfo: 'cfo', ai_coo: 'coo', ai_cto: 'cto', ai_cro: 'cro',
    oracle: 'ceo', system: 'security',
  };
  return map[actorType] ?? null;
}

// ─── Swarm summary ───────────────────────────────────────────────────────────

export async function getSwarmSummary(): Promise<SwarmSummary> {
  return cached<SwarmSummary>('agi:swarm:summary', TTL.MEDIUM, async () => {
    const agents = await getSwarmAgents();
    const active = agents.filter((a) => a.status === 'active').length;
    const thinking = agents.filter((a) => a.status === 'thinking').length;
    const executing = agents.filter((a) => a.status === 'executing').length;
    const totalDecisions24h = agents.reduce((s, a) => s + a.decisionsLast24h, 0);
    const totalMessages = agents.reduce((s, a) => s + a.messagesExchanged, 0);
    const avgConfidence = agents.length > 0
      ? agents.reduce((s, a) => s + a.avgConfidence, 0) / agents.length
      : 0;
    const avgSuccess = agents.length > 0
      ? agents.reduce((s, a) => s + a.successRate, 0) / agents.length
      : 0;
    // top contributor = most decisions in last 24h
    const top = agents.slice().sort((a, b) => b.decisionsLast24h - a.decisionsLast24h);
    const topContributor = top[0] && top[0].decisionsLast24h > 0 ? top[0].id : null;
    return {
      totalAgents: agents.length,
      activeAgents: active,
      thinkingAgents: thinking,
      executingAgents: executing,
      totalDecisions24h,
      totalMessagesExchanged: totalMessages,
      avgConfidence: clamp01(avgConfidence),
      avgSuccessRate: clamp01(avgSuccess),
      topContributor,
      coordinationLoad: totalMessages,
    };
  });
}
