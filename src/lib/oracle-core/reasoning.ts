// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle Intelligence Core™ — Enterprise Reasoning Engine™
//
// Every AI decision must contain:
//   • business reasoning    • financial reasoning    • risk reasoning
//   • compliance reasoning  • operational reasoning  • legal reasoning
//   • historical evidence   • supporting data        • confidence (0-100)
//   • 2-3 alternatives with pros/cons/ROI
//   • expected ROI           • rollback strategy     • final answer
//
// Pipeline:
//   1. gatherBusinessContext(req.firmId)     — Context Engine™
//   2. chooseModel({purpose:'reasoning'})    — Multi-Model AI Router™
//   3. renderPrompt('oracle_orchestrate')    — Enterprise Prompt Engine™
//   4. optional z-ai-web-dev-sdk LLM call (skip if req.callLLM===false or on failure)
//   5. parse 6 reasoning dimensions; fall back to deterministic structured reasoning
//   6. generate 2-3 alternatives with heuristic templates
//   7. compute confidence from data completeness + historical evidence + LLM success
//   8. persist to db.oracleReasoning + log model call + write memory record
//   9. return ReasoningResult
//
// Never throws — always returns a valid ReasoningResult (with deterministic
// fallback reasoning built from the gathered context).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AIModuleId,
  AIProvider,
  ModelTier,
  ReasoningRequest,
  ReasoningResult,
} from './types';
import { db } from '@/lib/db';
import { gatherBusinessContext, formatContextForPrompt } from './context';
import { chooseModel, logModelCall } from './router';
import { renderPrompt } from './prompts';
import { writeMemory } from './memory';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function inr(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

// ─── LLM call (optional) ────────────────────────────────────────────────────

interface LLMOutcome {
  answer: string;
  success: boolean;
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
  error?: string;
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<LLMOutcome> {
  const start = Date.now();
  try {
    // Dynamic import so this module can load even if the SDK isn't ready.
    const ZAIModule = await import('z-ai-web-dev-sdk');
    const ZAI = (ZAIModule as any).default ?? ZAIModule;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    });
    const answer: string = completion?.choices?.[0]?.message?.content ?? '';
    return {
      answer,
      success: answer.length > 0,
      promptTokens: Math.ceil(systemPrompt.length / 4) + Math.ceil(userPrompt.length / 4),
      outputTokens: Math.ceil(answer.length / 4),
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      answer: '',
      success: false,
      promptTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - start,
      error: err?.message ?? String(err),
    };
  }
}

// ─── Deterministic fallback reasoning (built from real context) ─────────────

interface ContextSlice {
  hasCash: boolean;
  hasRevenue: boolean;
  cashBalance: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  receivables: number;
  payables: number;
  gstCollected: number;
  gstPaid: number;
  healthScore: number;
  runwayDays: number;
  anomalies: number;
  pendingApprovals: number;
  goalsCount: number;
  strategiesCount: number;
  modulesWithData: number;
}

function assessContext(ctx: Awaited<ReturnType<typeof gatherBusinessContext>>): ContextSlice {
  let modulesWithData = 0;
  if (ctx.graph.nodeCount > 0) modulesWithData++;
  if (ctx.twin.healthScore > 0 || ctx.twin.cashRunwayDays > 0) modulesWithData++;
  if (ctx.finance.cashBalance > 0 || ctx.finance.monthlyRevenue > 0) modulesWithData++;
  if (ctx.connectedSystems.total > 0) modulesWithData++;
  if (ctx.recentInvoices.length > 0) modulesWithData++;
  if (ctx.pendingApprovals.length > 0) modulesWithData++;
  if (ctx.goals.length > 0) modulesWithData++;
  if (ctx.previousConversations.length > 0) modulesWithData++;
  if (ctx.knowledge.entityCount > 0) modulesWithData++;

  return {
    hasCash: ctx.finance.cashBalance > 0,
    hasRevenue: ctx.finance.monthlyRevenue > 0,
    cashBalance: ctx.finance.cashBalance,
    monthlyRevenue: ctx.finance.monthlyRevenue,
    monthlyExpenses: ctx.finance.monthlyExpenses,
    receivables: ctx.finance.receivables,
    payables: ctx.finance.payables,
    gstCollected: ctx.finance.gstCollected,
    gstPaid: ctx.finance.gstPaid,
    healthScore: ctx.twin.healthScore,
    runwayDays: ctx.twin.cashRunwayDays,
    anomalies: ctx.twin.anomalies,
    pendingApprovals: ctx.pendingApprovals.length,
    goalsCount: ctx.goals.length,
    strategiesCount: ctx.strategies.length,
    modulesWithData,
  };
}

function buildDeterministicReasoning(
  req: ReasoningRequest,
  ctx: Awaited<ReturnType<typeof gatherBusinessContext>>,
  slice: ContextSlice,
): {
  business: string;
  financial: string;
  risk: string;
  compliance: string;
  operational: string;
  legal: string;
  historical: string;
  finalAnswer: string;
  expectedRoi: string | null;
  rollback: string;
} {
  const business = `Based on the live business context, the question "${req.request.slice(0, 160)}" is evaluated against ${slice.modulesWithData} connected data sources. The firm currently has ${slice.goalsCount} active goal(s) and ${slice.strategiesCount} active strategy/strategies, with ${slice.pendingApprovals} pending executive approval(s). Business health score is ${slice.healthScore}/100 and the Digital Twin reports ${slice.anomalies} anomaly(ies). Recommendation should align with existing strategic objectives and avoid introducing conflicting priorities.`;

  const financial = slice.hasCash
    ? `Current cash position is ${inr(slice.cashBalance)} with ${slice.runwayDays} days of runway. Monthly revenue is ${inr(slice.monthlyRevenue)} against ${inr(slice.monthlyExpenses)} in expenses. Receivables of ${inr(slice.receivables)} and payables of ${inr(slice.payables)} imply net working capital of ${inr(slice.receivables - slice.payables)}. GST liability is approximately ${inr(slice.gstCollected)} with ${inr(slice.gstPaid)} in ITC available. Any recommendation must preserve liquidity — do not commit to outflows exceeding 25% of available cash without explicit approval.`
    : `Cash position data is unavailable from connected systems. Treat any financial commitment as high-risk until banking/ERP data is connected. Recommend conservative posture: defer non-essential outflows, accelerate receivables, and prioritize connecting bank + ERP data sources via the Connectivity Fabric™.`;

  const risk = slice.anomalies > 0
    ? `The Digital Twin has flagged ${slice.anomalies} anomaly(ies) requiring attention. With health score at ${slice.healthScore}/100 and ${slice.pendingApprovals} pending decision(s), the principal risks are: (1) anomaly escalation, (2) decision backlog creating execution drag, (3) runway compression if expenses exceed revenue. Risk-mitigation gates: require CFO sign-off for any commitment >25% of cash, freeze discretionary spend until anomalies clear, and review pending approvals within 24h.`
    : `No active anomalies detected. Health score is ${slice.healthScore}/100. Principal risks remain: (1) data-source gaps that limit visibility, (2) decision backlog (${slice.pendingApprovals} pending), (3) runway compression if monthly expenses exceed revenue. Recommend monthly risk review and weekly cash-position check.`;

  const compliance = `GST position: ${inr(slice.gstCollected)} collected vs ${inr(slice.gstPaid)} in ITC available. Ensure GSTR-1 and GSTR-3B are filed on time for the current period; review GSTR-2B reconciliation for any unmatched ITC. All decisions that affect GST liability must be logged for audit. If the action involves payments above ₹1L or sensitive customer/vendor data, flag for compliance review before execution.`;

  const operational = `Operational state: ${slice.goalsCount} active goals, ${slice.strategiesCount} active strategies, ${slice.pendingApprovals} pending approvals. Recommend sequencing the requested action AFTER clearing critical pending approvals (oldest first) to prevent execution backlog. If the request maps to an existing goal/strategy, attach it as a milestone; otherwise classify it as a new initiative requiring owner assignment and a 30-day review checkpoint.`;

  const legal = `From a legal standpoint, ensure the proposed action complies with the Indian Companies Act, GST Act, and any contractual obligations with vendors/customers. If the action involves new contracts, vendor onboarding, or regulatory filings, route through AI Legal™ for clause review. Flag high-stakes items (penalty > ₹1L, regulatory exposure, litigation risk) for human counsel review before execution. No irreversible legal action should be taken without explicit human approval.`;

  const historical = ctx.previousConversations.length > 0
    ? `Previous Oracle conversations on related topics: ${ctx.previousConversations.slice(0, 3).map((c) => `"${c.topic}"${c.consensus ? ` (consensus: ${c.consensus.slice(0, 100)})` : ''}`).join('; ')}. ${ctx.recentReports.length > 0 ? `Recent reports/documents also reference: ${ctx.recentReports.slice(0, 3).map((r) => r.title).join(', ')}.` : ''} Use this history to avoid re-litigating settled decisions and to maintain strategic continuity.`
    : `No prior Oracle conversations on this topic were found in unified memory. ${ctx.recentReports.length > 0 ? `Recent documents: ${ctx.recentReports.slice(0, 3).map((r) => r.title).join(', ')}.` : 'Recommend establishing a baseline by connecting more data sources.'}`;

  const finalAnswer = `Recommendation: ${req.requestType === 'decide' ? 'Proceed with the action subject to the risk gates above.' : req.requestType === 'simulate' ? 'Simulation result depends on the assumptions; see the financial and risk reasoning for projected outcomes.' : 'Analyzed using live business context. See the 6 reasoning dimensions above for the full picture.'} Confidence reflects data completeness (${slice.modulesWithData}/9 sources) and historical evidence availability. Execute only after the rollback strategy is acknowledged by the responsible owner.`;

  const expectedRoi = slice.hasRevenue
    ? `+${inr(slice.monthlyRevenue * 0.05)} to +${inr(slice.monthlyRevenue * 0.15)} over 90 days (5-15% revenue uplift assumption)`
    : null;

  const rollback = `Rollback strategy: (1) Time-box the action to 30 days with a checkpoint review. (2) Define a clear abort trigger — e.g., cash balance drops below ${inr(slice.cashBalance * 0.8)}, anomaly count doubles, or GST compliance is at risk. (3) Pre-stage the rollback procedure: halt new commitments, revert configuration changes, notify affected stakeholders via the Connectivity Fabric. (4) Document the rollback in Oracle Memory for future learning. (5) If rollback is not possible (irreversible action), require explicit board-level approval before execution.`;

  return {
    business,
    financial,
    risk,
    compliance,
    operational,
    legal,
    historical,
    finalAnswer,
    expectedRoi,
    rollback,
  };
}

// ─── LLM output parsing ─────────────────────────────────────────────────────

interface ParsedReasoning {
  business: string;
  financial: string;
  risk: string;
  compliance: string;
  operational: string;
  legal: string;
  finalAnswer: string;
}

/**
 * Parse the 6 reasoning dimensions out of the LLM answer.
 * Tries (a) JSON, (b) markdown section headers, (c) plain keyword prefixes.
 * On any failure, returns null and the caller falls back to deterministic.
 */
function parseReasoningFromAnswer(answer: string): ParsedReasoning | null {
  if (!answer || answer.trim().length === 0) return null;

  // (a) Try JSON first
  const jsonStart = answer.indexOf('{');
  const jsonEnd = answer.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const obj = JSON.parse(answer.slice(jsonStart, jsonEnd + 1));
      const fields = ['businessReasoning', 'financialReasoning', 'riskReasoning', 'complianceReasoning', 'operationalReasoning', 'legalReasoning', 'finalAnswer'];
      if (fields.every((f) => typeof (obj as any)[f] === 'string' && (obj as any)[f].length > 0)) {
        return {
          business: obj.businessReasoning,
          financial: obj.financialReasoning,
          risk: obj.riskReasoning,
          compliance: obj.complianceReasoning,
          operational: obj.operationalReasoning,
          legal: obj.legalReasoning,
          finalAnswer: obj.finalAnswer,
        };
      }
    } catch {
      /* fall through */
    }
  }

  // (b) Try markdown headers
  const headerRe = /(?:^|\n)#{1,4}\s*([A-Za-z][A-Za-z &/\-]{2,40})\s*\n([\s\S]*?)(?=\n#{1,4}\s|$)/g;
  const sections: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(answer)) !== null) {
    const label = m[1].toLowerCase().trim();
    const body = m[2].trim();
    if (label.includes('business')) sections.business = body;
    else if (label.includes('financial')) sections.financial = body;
    else if (label.includes('risk') && !label.includes('compliance')) sections.risk = body;
    else if (label.includes('compliance')) sections.compliance = body;
    else if (label.includes('operation')) sections.operational = body;
    else if (label.includes('legal')) sections.legal = body;
    else if (label.includes('final') || label.includes('recommendation') || label.includes('answer')) sections.finalAnswer = body;
  }

  if (sections.business && sections.financial && sections.risk) {
    return {
      business: sections.business,
      financial: sections.financial,
      risk: sections.risk,
      compliance: sections.compliance || '',
      operational: sections.operational || '',
      legal: sections.legal || '',
      finalAnswer: sections.finalAnswer || answer.slice(0, 500),
    };
  }

  // (c) Try keyword-prefixed lines
  const lines = answer.split('\n');
  const grab = (kw: string): string => {
    const ln = lines.find((l) => l.toLowerCase().includes(kw));
    return ln ? ln.replace(/^[\s>*\-\d.]+/, '').trim() : '';
  };
  const business = grab('business reasoning');
  const financial = grab('financial reasoning');
  const risk = grab('risk reasoning');
  const compliance = grab('compliance reasoning');
  const operational = grab('operational reasoning');
  const legal = grab('legal reasoning');
  if (business && financial && risk) {
    return {
      business,
      financial,
      risk,
      compliance: compliance || '',
      operational: operational || '',
      legal: legal || '',
      finalAnswer: answer.slice(0, 800),
    };
  }

  return null;
}

// ─── Alternatives generator (heuristic) ─────────────────────────────────────

function generateAlternatives(
  req: ReasoningRequest,
  slice: ContextSlice,
): ReasoningResult['alternatives'] {
  const alts: ReasoningResult['alternatives'] = [];

  // Alt 1: Do nothing / maintain status quo
  alts.push({
    label: 'Maintain status quo — do nothing',
    pros: [
      'No new risk introduced',
      'No additional capital commitment',
      'Team focus stays on current priorities',
    ],
    cons: [
      'Opportunity cost — competitor may act first',
      `${slice.pendingApprovals} pending approval(s) remain unaddressed`,
      slice.anomalies > 0 ? `${slice.anomalies} active anomaly(ies) may escalate` : 'No active anomalies, but no progress either',
    ],
    estimatedRoi: '0% short-term; risk of -5% to -10% if competitors act',
  });

  // Alt 2: Aggressive approach
  alts.push({
    label: 'Aggressive approach — accelerate the recommendation',
    pros: [
      'Captures upside sooner',
      slice.hasRevenue ? `Potential +${inr(slice.monthlyRevenue * 0.15)} revenue within 60 days` : 'Establishes market position early',
      'Forces decision backlog clearance',
    ],
    cons: [
      `Requires up to 40% of available cash (${inr(slice.cashBalance * 0.4)})`,
      'Higher execution risk — limited rollback window',
      slice.runwayDays > 0 && slice.runwayDays < 60 ? `Runway (${slice.runwayDays}d) is tight — aggressive spend is risky` : 'May strain team capacity',
    ],
    estimatedRoi: slice.hasRevenue
      ? `+${inr(slice.monthlyRevenue * 0.2)} to +${inr(slice.monthlyRevenue * 0.3)} over 90 days (20-30% uplift)`
      : 'High variance — could be +30% or -15%',
  });

  // Alt 3: Conservative approach (phased)
  alts.push({
    label: 'Conservative approach — phase it over 90 days',
    pros: [
      'Limits cash exposure to <15% per phase',
      'Allows learning between phases',
      'Easy rollback at each phase gate',
      'Aligns with quarterly review cadence',
    ],
    cons: [
      'Slower to realize full benefit',
      'Requires 3 review checkpoints (overhead)',
      'Competitor may outpace if market moves fast',
    ],
    estimatedRoi: slice.hasRevenue
      ? `+${inr(slice.monthlyRevenue * 0.08)} to +${inr(slice.monthlyRevenue * 0.12)} over 90 days (8-12% uplift, lower risk)`
      : 'Modest but stable: +5% to +10% over 90 days',
  });

  return alts;
}

// ─── Confidence computation ─────────────────────────────────────────────────

function computeConfidence(
  slice: ContextSlice,
  historicalAvailable: boolean,
  llmSuccess: boolean,
): number {
  // Base: data completeness (0-50 pts, 9 modules max)
  const dataCompleteness = Math.min(50, Math.round((slice.modulesWithData / 9) * 50));

  // Historical evidence (0-25 pts)
  const historical = historicalAvailable ? 25 : 5;

  // LLM success (0-25 pts)
  const llm = llmSuccess ? 25 : 10;

  // Penalty for anomalies (max -10)
  const anomalyPenalty = Math.min(10, slice.anomalies * 2);

  const total = Math.max(0, Math.min(100, dataCompleteness + historical + llm - anomalyPenalty));
  return total;
}

// ─── Main entry: reason() ───────────────────────────────────────────────────

export async function reason(req: ReasoningRequest): Promise<ReasoningResult> {
  const firmId = req.firmId || FIRM_ID;

  // Step 1 — gather context (never throws)
  const ctx = await gatherBusinessContext(firmId).catch(() => null);
  const safeCtx = ctx ?? (await gatherBusinessContext(firmId));
  const slice = assessContext(safeCtx);

  // Step 2 — choose model
  const tier: ModelTier = req.preferredTier || 'standard';
  const modelChoice = chooseModel({
    purpose: 'reasoning',
    tier,
    inputTokensEstimate: safeCtx.estimatedTokens + Math.ceil(req.request.length / 4),
  });

  // Step 3 — render prompt
  const rendered = renderPrompt('oracle_orchestrate', {
    context: formatContextForPrompt(safeCtx),
    question: req.request,
  });
  const systemPrompt = rendered?.system ?? 'You are Oracle™ — the unified AI brain of GSTPilot Infinity™.';
  const userPrompt = rendered?.user ?? `CONTEXT:\n${formatContextForPrompt(safeCtx)}\n\nQUESTION:\n${req.request}`;

  // Step 4 — optional LLM call
  const shouldCallLLM = req.callLLM !== false;
  let llmOutcome: LLMOutcome | null = null;
  if (shouldCallLLM) {
    llmOutcome = await callLLM(systemPrompt, userPrompt);
  }

  // Step 5 — build the 6 reasoning dimensions
  const fallback = buildDeterministicReasoning(req, safeCtx, slice);
  let business = fallback.business;
  let financial = fallback.financial;
  let risk = fallback.risk;
  let compliance = fallback.compliance;
  let operational = fallback.operational;
  let legal = fallback.legal;
  let historical = fallback.historical;
  let finalAnswer = fallback.finalAnswer;

  if (llmOutcome?.success) {
    const parsed = parseReasoningFromAnswer(llmOutcome.answer);
    if (parsed) {
      // Use parsed LLM output, but never accept empty strings — fall back to deterministic.
      business = parsed.business || fallback.business;
      financial = parsed.financial || fallback.financial;
      risk = parsed.risk || fallback.risk;
      compliance = parsed.compliance || fallback.compliance;
      operational = parsed.operational || fallback.operational;
      legal = parsed.legal || fallback.legal;
      finalAnswer = parsed.finalAnswer || fallback.finalAnswer;
      // If LLM didn't surface historical evidence, keep our deterministic version.
      if (!historical || historical.length < 20) historical = fallback.historical;
    } else {
      // Parsing failed — put the full answer in business reasoning (per spec) but keep the rest deterministic.
      business = `${llmOutcome.answer.slice(0, 1200)}\n\n[Structured parse failed — showing raw LLM output. Deterministic reasoning used for other dimensions.]`;
    }
  }

  // Step 6 — alternatives
  const alternatives = generateAlternatives(req, slice);

  // Step 7 — confidence
  const confidence = computeConfidence(slice, safeCtx.previousConversations.length > 0, llmOutcome?.success ?? false);

  // Step 8 — supporting data (real context snapshot)
  const supportingData: Record<string, unknown> = {
    firmId,
    contextGatheredAt: safeCtx.gatheredAt,
    estimatedContextTokens: safeCtx.estimatedTokens,
    finance: safeCtx.finance,
    twin: safeCtx.twin,
    graph: {
      nodeCount: safeCtx.graph.nodeCount,
      edgeCount: safeCtx.graph.edgeCount,
      topRisks: safeCtx.graph.topRisks,
    },
    connectedSystems: safeCtx.connectedSystems,
    pendingApprovals: safeCtx.pendingApprovals.length,
    activeGoals: safeCtx.goals.length,
    activeStrategies: safeCtx.strategies.length,
    recentInvoicesCount: safeCtx.recentInvoices.length,
    modulesWithData: slice.modulesWithData,
    modelChoice: {
      provider: modelChoice.provider,
      model: modelChoice.model,
      tier: modelChoice.tier,
      rationale: modelChoice.rationale,
      costPer1kUsd: modelChoice.costPer1kUsd,
      estimatedLatencyMs: modelChoice.estimatedLatencyMs,
    },
    llmCalled: shouldCallLLM,
    llmSuccess: llmOutcome?.success ?? false,
    llmLatencyMs: llmOutcome?.latencyMs ?? 0,
  };

  const executivesConsulted: AIModuleId[] = req.executives && req.executives.length > 0
    ? req.executives
    : ['oracle', 'ceo', 'cfo', 'cro'];

  // Step 9 — persist to db.oracleReasoning
  let reasoningId = '';
  let createdAt = new Date().toISOString();
  try {
    const created = await (db as any).oracleReasoning.create({
      data: {
        firmId,
        userId: req.userId ?? null,
        request: req.request,
        requestType: req.requestType,
        businessReasoning: business,
        financialReasoning: financial,
        riskReasoning: risk,
        complianceReasoning: compliance,
        operationalReasoning: operational,
        legalReasoning: legal,
        historicalEvidence: historical,
        supportingData: JSON.stringify(supportingData),
        confidence,
        alternatives: JSON.stringify(alternatives),
        expectedRoi: fallback.expectedRoi,
        rollbackStrategy: fallback.rollback,
        finalAnswer,
        modelUsed: modelChoice.provider,
        modelTier: modelChoice.tier,
        executivesConsulted: JSON.stringify(executivesConsulted),
        approved: false,
        rejected: false,
        outcome: 'pending',
        outcomeNote: null,
      },
    });
    reasoningId = created.id;
    createdAt = created.createdAt instanceof Date ? created.createdAt.toISOString() : String(created.createdAt);
  } catch (err) {
    console.warn('[Reasoning Engine] failed to persist OracleReasoning:', err);
  }

  // Step 10 — log the model call (for audit + cost tracking)
  try {
    await logModelCall({
      firmId,
      userId: req.userId ?? null,
      provider: modelChoice.provider as AIProvider,
      model: modelChoice.model,
      tier: modelChoice.tier,
      purpose: 'reasoning',
      promptTokens: llmOutcome?.promptTokens ?? safeCtx.estimatedTokens,
      outputTokens: llmOutcome?.outputTokens ?? Math.ceil(finalAnswer.length / 4),
      latencyMs: llmOutcome?.latencyMs ?? 0,
      success: shouldCallLLM ? (llmOutcome?.success ?? false) : true,
      errorMessage: llmOutcome?.error ?? (shouldCallLLM ? null : 'LLM call skipped (callLLM=false)'),
      reasoningId: reasoningId || null,
    });
  } catch (err) {
    console.warn('[Reasoning Engine] failed to log model call:', err);
  }

  // Step 11 — write memory record
  try {
    await writeMemory({
      firmId,
      userId: req.userId ?? null,
      category: 'reasoning',
      entityType: 'reasoning',
      entityId: reasoningId || null,
      title: `Oracle reasoning: ${req.request.slice(0, 80)}`,
      summary: finalAnswer.slice(0, 500),
      payload: {
        requestType: req.requestType,
        confidence,
        modelUsed: modelChoice.provider,
        modelTier: modelChoice.tier,
        llmCalled: shouldCallLLM,
        llmSuccess: llmOutcome?.success ?? false,
        executivesConsulted,
        expectedRoi: fallback.expectedRoi,
      },
      tags: ['oracle', 'reasoning', req.requestType],
      importance: confidence >= 70 ? 80 : 60,
      source: 'oracle',
    });
  } catch (err) {
    console.warn('[Reasoning Engine] failed to write memory:', err);
  }

  // Step 12 — assemble & return
  const result: ReasoningResult = {
    id: reasoningId,
    firmId,
    userId: req.userId ?? null,
    request: req.request,
    requestType: req.requestType,
    businessReasoning: business,
    financialReasoning: financial,
    riskReasoning: risk,
    complianceReasoning: compliance,
    operationalReasoning: operational,
    legalReasoning: legal,
    historicalEvidence: historical,
    supportingData,
    confidence,
    alternatives,
    expectedRoi: fallback.expectedRoi,
    rollbackStrategy: fallback.rollback,
    finalAnswer,
    modelUsed: modelChoice.provider,
    modelTier: modelChoice.tier,
    executivesConsulted,
    approved: false,
    rejected: false,
    outcome: 'pending',
    outcomeNote: null,
    createdAt,
  };

  return result;
}

// ─── Read helpers ───────────────────────────────────────────────────────────

function serializeReasoning(r: any): ReasoningResult {
  return {
    id: r.id,
    firmId: r.firmId,
    userId: r.userId,
    request: r.request,
    requestType: r.requestType as ReasoningRequest['requestType'],
    businessReasoning: r.businessReasoning,
    financialReasoning: r.financialReasoning,
    riskReasoning: r.riskReasoning,
    complianceReasoning: r.complianceReasoning,
    operationalReasoning: r.operationalReasoning,
    legalReasoning: r.legalReasoning,
    historicalEvidence: r.historicalEvidence,
    supportingData: safeParseJSON<Record<string, unknown>>(r.supportingData, {}),
    confidence: r.confidence,
    alternatives: safeParseJSON<ReasoningResult['alternatives']>(r.alternatives, []),
    expectedRoi: r.expectedRoi,
    rollbackStrategy: r.rollbackStrategy,
    finalAnswer: r.finalAnswer,
    modelUsed: r.modelUsed as AIProvider,
    modelTier: r.modelTier as ModelTier,
    executivesConsulted: safeParseJSON<AIModuleId[]>(r.executivesConsulted, []),
    approved: r.approved,
    rejected: r.rejected,
    outcome: r.outcome as ReasoningResult['outcome'],
    outcomeNote: r.outcomeNote,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

/** Fetch a single reasoning record by id. */
export async function getReasoning(id: string): Promise<ReasoningResult | null> {
  try {
    const row = await (db as any).oracleReasoning.findUnique({ where: { id } });
    if (!row) return null;
    return serializeReasoning(row);
  } catch (err) {
    console.warn('[Reasoning Engine] getReasoning failed:', err);
    return null;
  }
}

/** List the most recent N reasoning records. */
export async function listReasoning(limit = 20): Promise<ReasoningResult[]> {
  try {
    const rows = await (db as any).oracleReasoning.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return rows.map(serializeReasoning);
  } catch (err) {
    console.warn('[Reasoning Engine] listReasoning failed:', err);
    return [];
  }
}

/** Update a reasoning record's outcome — used by the Self-Improvement Engine. */
export async function updateReasoningOutcome(
  id: string,
  outcome: 'success' | 'failure' | 'partial',
  note: string,
): Promise<void> {
  try {
    await (db as any).oracleReasoning.update({
      where: { id },
      data: { outcome, outcomeNote: note },
    });
  } catch (err) {
    console.warn('[Reasoning Engine] updateReasoningOutcome failed:', err);
  }
}

// ─── Dashboard stats (last 24h) ─────────────────────────────────────────────

export interface ReasoningStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  byType: Record<string, number>;
  avgConfidence: number;
}

export async function getReasoningStats(): Promise<ReasoningStats> {
  const firmId = FIRM_ID;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where = { firmId, createdAt: { gte: since } };

  try {
    const [total, approved, rejected, pending, byTypeRows, confAgg] = await Promise.all([
      (db as any).oracleReasoning.count({ where }),
      (db as any).oracleReasoning.count({ where: { ...where, approved: true } }),
      (db as any).oracleReasoning.count({ where: { ...where, rejected: true } }),
      (db as any).oracleReasoning.count({
        where: { ...where, approved: false, rejected: false },
      }),
      (db as any).oracleReasoning.groupBy({
        by: ['requestType'],
        where,
        _count: { _all: true },
      }),
      (db as any).oracleReasoning.aggregate({
        where,
        _avg: { confidence: true },
      }),
    ]);

    const byType: Record<string, number> = {};
    for (const r of byTypeRows ?? []) byType[r.requestType] = r._count._all;

    return {
      total: total ?? 0,
      approved: approved ?? 0,
      rejected: rejected ?? 0,
      pending: pending ?? 0,
      byType,
      avgConfidence: Math.round(confAgg?._avg?.confidence ?? 0),
    };
  } catch (err) {
    console.warn('[Reasoning Engine] getReasoningStats failed:', err);
    return {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      byType: {},
      avgConfidence: 0,
    };
  }
}
