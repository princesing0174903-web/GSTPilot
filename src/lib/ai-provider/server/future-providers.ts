// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Future AI Providers (SERVER-ONLY placeholders)
//
// Three production AI provider placeholders. Each throws NotImplementedError
// for every method until the production integration is built. They exist so
// the registry can switch to them via a single env var (`AI_PROVIDER`) the
// moment the real integrations are ready — no UI, hook, or service code
// changes will be needed.
//
// When implementing a real provider:
//   1. Add the API client init (env-var credentials) in this file.
//   2. Replace each method body with a real API call.
//   3. Keep the method signatures IDENTICAL to IAIProvider — the BusinessContext
//      is always passed in pre-built from real Firestore data, so the LLM call
//      just needs to phrase the analysis (the data analysis itself can reuse
//      the pure engines as structured prompts).
//
// This file is SERVER-ONLY — it must never be bundled into client code.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IAIProvider } from '../provider';
import type {
  AIProviderName,
  Alert,
  AnalysisModule,
  AnalysisResult,
  BusinessContext,
  BusinessScore,
  ChatResponse,
  Insight,
  Prediction,
  Recommendation,
  RiskScore,
} from '../types';
import { NotImplementedError } from '../errors';

/**
 * Base class for all future providers — throws NotImplementedError for every
 * method. Real providers extend this and override the methods they support.
 */
abstract class FutureAIProvider implements IAIProvider {
  abstract readonly name: string;
  abstract readonly provider: AIProviderName;
  readonly isLive = true;

  async generateInsights(_context: BusinessContext): Promise<Insight[]> {
    throw new NotImplementedError('AI insight generation');
  }
  async generateRecommendations(
    _context: BusinessContext,
    _insights: Insight[],
  ): Promise<Recommendation[]> {
    throw new NotImplementedError('AI recommendation generation');
  }
  async generateAlerts(_context: BusinessContext, _insights: Insight[]): Promise<Alert[]> {
    throw new NotImplementedError('AI alert generation');
  }
  async computeBusinessScore(_context: BusinessContext): Promise<BusinessScore> {
    throw new NotImplementedError('AI business scoring');
  }
  async computeRiskScore(_context: BusinessContext, _insights: Insight[]): Promise<RiskScore> {
    throw new NotImplementedError('AI risk scoring');
  }
  async answerBusinessQuestion(
    _question: string,
    _context: BusinessContext,
  ): Promise<ChatResponse> {
    throw new NotImplementedError('AI question answering');
  }
  async predictRevenue(_context: BusinessContext, _months: number): Promise<Prediction> {
    throw new NotImplementedError('AI revenue prediction');
  }
  async predictCashFlow(_context: BusinessContext, _months: number): Promise<Prediction> {
    throw new NotImplementedError('AI cash flow prediction');
  }
  async generateBrief(
    _context: BusinessContext,
    _insights: Insight[],
    _recommendations: Recommendation[],
  ): Promise<string> {
    throw new NotImplementedError('AI brief generation');
  }
  async analyzeModule(_module: AnalysisModule, _context: BusinessContext): Promise<AnalysisResult> {
    throw new NotImplementedError('AI module analysis');
  }
  async healthCheck(): Promise<boolean> {
    // Placeholder providers are not yet operational.
    return false;
  }
}

/**
 * FutureOpenAIProvider — OpenAI GPT integration (placeholder).
 *
 * When implementing:
 *   • Read OPENAI_API_KEY from env.
 *   • Call the Chat Completions API with the BusinessContext serialised as
 *     a structured system prompt.
 *   • Reuse the pure engines (insights/recommendations/chat) as the
 *     retrieval/analysis layer; let GPT phrase the final answer.
 */
export class FutureOpenAIProvider extends FutureAIProvider {
  readonly name = 'OpenAI GPT';
  readonly provider: AIProviderName = 'openai';
}

/**
 * FutureGeminiProvider — Google Gemini integration (placeholder).
 *
 * When implementing:
 *   • Read GEMINI_API_KEY from env.
 *   • Call the Gemini Generate Content API.
 *   • Same retrieval/analysis layer reuse as OpenAI.
 */
export class FutureGeminiProvider extends FutureAIProvider {
  readonly name = 'Google Gemini';
  readonly provider: AIProviderName = 'gemini';
}

/**
 * FutureClaudeProvider — Anthropic Claude integration (placeholder).
 *
 * When implementing:
 *   • Read ANTHROPIC_API_KEY from env.
 *   • Call the Claude Messages API.
 *   • Same retrieval/analysis layer reuse as OpenAI.
 */
export class FutureClaudeProvider extends FutureAIProvider {
  readonly name = 'Anthropic Claude';
  readonly provider: AIProviderName = 'claude';
}

/**
 * Factory: return the placeholder provider for a given name.
 * Used by the registry.
 */
export function createFutureProvider(name: AIProviderName): IAIProvider {
  switch (name) {
    case 'openai': return new FutureOpenAIProvider();
    case 'gemini': return new FutureGeminiProvider();
    case 'claude': return new FutureClaudeProvider();
    default:
      throw new Error(`Unknown future AI provider: ${name}`);
  }
}
