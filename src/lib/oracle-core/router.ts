// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Core™ — Multi-Model AI Router
// Automatically selects the best model for each request based on
// speed / cost / reasoning / coding / vision / voice / long-context.
// Never hardcodes one provider. Falls back gracefully.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  AIProvider,
  ModelCallLog,
  ModelChoice,
  ModelPurpose,
  ModelTier,
  RouteRequest,
} from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Model Catalog ──────────────────────────────────────────────────────────
// Production pricing (USD per 1k tokens) and approximate latency.
// Source: public vendor pricing pages, Q4 2024.

interface ModelSpec {
  provider: AIProvider;
  model: string;
  tier: ModelTier;
  purposes: ModelPurpose[];
  inputCostPer1k: number;
  outputCostPer1k: number;
  latencyMs: number;
  contextWindow: number;       // max tokens
  supportsVision: boolean;
  supportsVoice: boolean;
}

const MODEL_CATALOG: ModelSpec[] = [
  // OpenAI
  {
    provider: 'openai', model: 'gpt-4o', tier: 'standard',
    purposes: ['reasoning', 'code', 'summary'],
    inputCostPer1k: 0.0025, outputCostPer1k: 0.01, latencyMs: 800,
    contextWindow: 128000, supportsVision: true, supportsVoice: false,
  },
  {
    provider: 'openai', model: 'gpt-4o-mini', tier: 'fast',
    purposes: ['reasoning', 'code', 'summary'],
    inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, latencyMs: 300,
    contextWindow: 128000, supportsVision: true, supportsVoice: false,
  },
  {
    provider: 'openai', model: 'o3-mini', tier: 'deep',
    purposes: ['reasoning'],
    inputCostPer1k: 0.0011, outputCostPer1k: 0.0044, latencyMs: 2500,
    contextWindow: 200000, supportsVision: false, supportsVoice: false,
  },
  // Anthropic
  {
    provider: 'anthropic', model: 'claude-3-5-sonnet', tier: 'standard',
    purposes: ['reasoning', 'code', 'summary'],
    inputCostPer1k: 0.003, outputCostPer1k: 0.015, latencyMs: 1000,
    contextWindow: 200000, supportsVision: true, supportsVoice: false,
  },
  {
    provider: 'anthropic', model: 'claude-3-5-haiku', tier: 'fast',
    purposes: ['reasoning', 'summary'],
    inputCostPer1k: 0.0008, outputCostPer1k: 0.004, latencyMs: 400,
    contextWindow: 200000, supportsVision: true, supportsVoice: false,
  },
  {
    provider: 'anthropic', model: 'claude-3-opus', tier: 'deep',
    purposes: ['reasoning'],
    inputCostPer1k: 0.015, outputCostPer1k: 0.075, latencyMs: 3000,
    contextWindow: 200000, supportsVision: true, supportsVoice: false,
  },
  // Gemini
  {
    provider: 'gemini', model: 'gemini-1.5-pro', tier: 'standard',
    purposes: ['reasoning', 'code', 'summary', 'vision'],
    inputCostPer1k: 0.00125, outputCostPer1k: 0.005, latencyMs: 900,
    contextWindow: 2000000, supportsVision: true, supportsVoice: false,
  },
  {
    provider: 'gemini', model: 'gemini-1.5-flash', tier: 'fast',
    purposes: ['reasoning', 'summary', 'vision'],
    inputCostPer1k: 0.000075, outputCostPer1k: 0.0003, latencyMs: 250,
    contextWindow: 1000000, supportsVision: true, supportsVoice: false,
  },
  // xAI
  {
    provider: 'xai', model: 'grok-beta', tier: 'standard',
    purposes: ['reasoning', 'summary'],
    inputCostPer1k: 0.005, outputCostPer1k: 0.015, latencyMs: 1200,
    contextWindow: 131072, supportsVision: false, supportsVoice: false,
  },
  // DeepSeek
  {
    provider: 'deepseek', model: 'deepseek-chat', tier: 'fast',
    purposes: ['reasoning', 'code', 'summary'],
    inputCostPer1k: 0.00014, outputCostPer1k: 0.00028, latencyMs: 500,
    contextWindow: 64000, supportsVision: false, supportsVoice: false,
  },
  {
    provider: 'deepseek', model: 'deepseek-reasoner', tier: 'deep',
    purposes: ['reasoning'],
    inputCostPer1k: 0.00055, outputCostPer1k: 0.0022, latencyMs: 3000,
    contextWindow: 64000, supportsVision: false, supportsVoice: false,
  },
  // Mistral
  {
    provider: 'mistral', model: 'mistral-large', tier: 'standard',
    purposes: ['reasoning', 'code', 'summary'],
    inputCostPer1k: 0.002, outputCostPer1k: 0.006, latencyMs: 700,
    contextWindow: 128000, supportsVision: false, supportsVoice: false,
  },
  {
    provider: 'mistral', model: 'mistral-small', tier: 'fast',
    purposes: ['reasoning', 'summary'],
    inputCostPer1k: 0.0002, outputCostPer1k: 0.0006, latencyMs: 250,
    contextWindow: 32000, supportsVision: false, supportsVoice: false,
  },
  // Perplexity
  {
    provider: 'perplexity', model: 'sonar-large', tier: 'standard',
    purposes: ['reasoning', 'summary'],
    inputCostPer1k: 0.001, outputCostPer1k: 0.001, latencyMs: 1500,
    contextWindow: 127072, supportsVision: false, supportsVoice: false,
  },
  // Llama (via Together / Groq / etc.)
  {
    provider: 'llama', model: 'llama-3.3-70b', tier: 'fast',
    purposes: ['reasoning', 'summary'],
    inputCostPer1k: 0.00088, outputCostPer1k: 0.00088, latencyMs: 350,
    contextWindow: 128000, supportsVision: false, supportsVoice: false,
  },
  // Azure OpenAI
  {
    provider: 'azure_openai', model: 'gpt-4o', tier: 'standard',
    purposes: ['reasoning', 'code', 'summary', 'vision'],
    inputCostPer1k: 0.0025, outputCostPer1k: 0.01, latencyMs: 850,
    contextWindow: 128000, supportsVision: true, supportsVoice: false,
  },
  // NVIDIA NIM
  {
    provider: 'nvidia_nim', model: 'nemotron-70b', tier: 'standard',
    purposes: ['reasoning', 'code'],
    inputCostPer1k: 0.001, outputCostPer1k: 0.001, latencyMs: 600,
    contextWindow: 128000, supportsVision: false, supportsVoice: false,
  },
];

// ─── Route Selection Algorithm ──────────────────────────────────────────────

/**
 * Choose the best model for a request based on purpose, tier, and constraints.
 * Algorithm:
 *   1. Filter catalog by purpose, tier, vision, voice, long-context.
 *   2. If preferredProvider given, prefer it (if it qualifies).
 *   3. Score each candidate: cost-effectiveness + latency + capability.
 *   4. Return the top candidate + rationale.
 */
export function chooseModel(req: RouteRequest): ModelChoice {
  const candidates = MODEL_CATALOG.filter((m) => {
    if (!m.purposes.includes(req.purpose)) return false;
    if (req.tier && m.tier !== req.tier) return false;
    if (req.requiresVision && !m.supportsVision) return false;
    if (req.requiresVoice && !m.supportsVoice) return false;
    if (req.longContext && m.contextWindow < 100000) return false;
    return true;
  });

  if (candidates.length === 0) {
    // Fallback — zai (always available in this sandbox).
    return {
      provider: 'zai',
      model: 'glm-4.6',
      tier: req.tier ?? 'standard',
      purpose: req.purpose,
      rationale: 'No qualified provider matched constraints; falling back to default ZAI gateway (always available).',
      costPer1kUsd: 0.001,
      estimatedLatencyMs: 600,
    };
  }

  // Preferred provider check
  if (req.preferredProvider) {
    const preferred = candidates.find((m) => m.provider === req.preferredProvider);
    if (preferred) {
      return toChoice(preferred, `Preferred provider ${req.preferredProvider} matched and qualified.`);
    }
  }

  // Score: lower is better. Balance cost (60%) + latency (40%).
  const scored = candidates
    .map((m) => {
      const cost = m.inputCostPer1k + m.outputCostPer1k;
      const score = cost * 60 + (m.latencyMs / 1000) * 40;
      return { spec: m, score };
    })
    .sort((a, b) => a.score - b.score);

  const best = scored[0];
  const runnerUp = scored[1];
  const rationale = runnerUp
    ? `Selected ${best.spec.provider}/${best.spec.model} — best cost-effectiveness (${best.spec.inputCostPer1k + best.spec.outputCostPer1k} USD/1k) and latency (${best.spec.latencyMs}ms). Runner-up: ${runnerUp.spec.provider}/${runnerUp.spec.model}.`
    : `Selected ${best.spec.provider}/${best.spec.model} — best cost-effectiveness (${best.spec.inputCostPer1k + best.spec.outputCostPer1k} USD/1k) and latency (${best.spec.latencyMs}ms).`;

  return toChoice(best.spec, rationale);
}

function toChoice(spec: ModelSpec, rationale: string): ModelChoice {
  return {
    provider: spec.provider,
    model: spec.model,
    tier: spec.tier,
    purpose: spec.purposes[0],
    rationale,
    costPer1kUsd: spec.inputCostPer1k + spec.outputCostPer1k,
    estimatedLatencyMs: spec.latencyMs,
  };
}

// ─── Call Logging ───────────────────────────────────────────────────────────

export interface LogCallInput {
  firmId?: string;
  userId?: string | null;
  provider: AIProvider;
  model: string;
  tier: ModelTier;
  purpose: ModelPurpose;
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string | null;
  reasoningId?: string | null;
}

/** Log every model invocation for audit + cost tracking. */
export async function logModelCall(input: LogCallInput): Promise<void> {
  const spec = MODEL_CATALOG.find(
    (m) => m.provider === input.provider && m.model === input.model,
  );
  const costUsd = spec
    ? (spec.inputCostPer1k * input.promptTokens + spec.outputCostPer1k * input.outputTokens) / 1000
    : 0;

  try {
    await db.oracleModelCall.create({
      data: {
        firmId: input.firmId || FIRM_ID,
        userId: input.userId ?? null,
        provider: input.provider,
        model: input.model,
        tier: input.tier,
        purpose: input.purpose,
        promptTokens: input.promptTokens,
        outputTokens: input.outputTokens,
        latencyMs: input.latencyMs,
        success: input.success,
        errorMessage: input.errorMessage ?? null,
        costUsd,
        reasoningId: input.reasoningId ?? null,
      },
    });
  } catch (e) {
    console.warn('[Oracle Router] failed to log model call:', e);
  }
}

// ─── Router Stats ───────────────────────────────────────────────────────────

export async function getRouterStats(): Promise<{
  totalCalls: number;
  byProvider: Record<string, number>;
  byTier: Record<string, number>;
  successRate: number;
  avgLatencyMs: number;
  totalCostUsd: number;
  fallbacksTriggered: number;
}> {
  const firmId = FIRM_ID;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, byProviderRows, byTierRows, successCount, latencyAgg, costAgg, fallbackCount] = await Promise.all([
    db.oracleModelCall.count({ where: { firmId, createdAt: { gte: since } } }),
    db.oracleModelCall.groupBy({
      by: ['provider'],
      where: { firmId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.oracleModelCall.groupBy({
      by: ['tier'],
      where: { firmId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.oracleModelCall.count({ where: { firmId, createdAt: { gte: since }, success: true } }),
    db.oracleModelCall.aggregate({
      where: { firmId, createdAt: { gte: since } },
      _avg: { latencyMs: true },
    }),
    db.oracleModelCall.aggregate({
      where: { firmId, createdAt: { gte: since } },
      _sum: { costUsd: true },
    }),
    db.oracleModelCall.count({ where: { firmId, createdAt: { gte: since }, provider: 'zai' } }),
  ]);

  const byProvider: Record<string, number> = {};
  for (const r of byProviderRows) byProvider[r.provider] = r._count._all;
  const byTier: Record<string, number> = {};
  for (const r of byTierRows) byTier[r.tier] = r._count._all;

  return {
    totalCalls: total,
    byProvider,
    byTier,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 100,
    avgLatencyMs: Math.round(latencyAgg._avg.latencyMs ?? 0),
    totalCostUsd: Math.round((costAgg._sum.costUsd ?? 0) * 10000) / 10000,
    fallbacksTriggered: fallbackCount,
  };
}

/** List recent model calls for audit log. */
export async function getRecentModelCalls(limit = 50): Promise<ModelCallLog[]> {
  const firmId = FIRM_ID;
  const rows = await db.oracleModelCall.findMany({
    where: { firmId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });
  return rows.map((r) => ({
    id: r.id,
    firmId: r.firmId,
    userId: r.userId,
    provider: r.provider as AIProvider,
    model: r.model,
    tier: r.tier as ModelTier,
    purpose: r.purpose as ModelPurpose,
    promptTokens: r.promptTokens,
    outputTokens: r.outputTokens,
    latencyMs: r.latencyMs,
    success: r.success,
    errorMessage: r.errorMessage,
    costUsd: r.costUsd,
    reasoningId: r.reasoningId,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Get the full catalog for the /api/oracle/models endpoint. */
export function getModelCatalog() {
  return MODEL_CATALOG.map((m) => ({
    provider: m.provider,
    model: m.model,
    tier: m.tier,
    purposes: m.purposes,
    inputCostPer1k: m.inputCostPer1k,
    outputCostPer1k: m.outputCostPer1k,
    latencyMs: m.latencyMs,
    contextWindow: m.contextWindow,
    supportsVision: m.supportsVision,
    supportsVoice: m.supportsVoice,
  }));
}
