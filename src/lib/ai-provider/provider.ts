// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Provider Interface
//
// IAIProvider is the SINGLE contract every AI backend must implement.
// Today we ship:
//   • MockAIProvider — deterministic real-data analysis (default, NO LLM)
//   • FutureOpenAIProvider  — OpenAI GPT (placeholder, throws NotImplementedError)
//   • FutureGeminiProvider  — Google Gemini (placeholder)
//   • FutureClaudeProvider  — Anthropic Claude (placeholder)
//
// All existing pages communicate ONLY through this interface (via the
// orchestrator + service layer). Switching to a production provider later
// means changing exactly ONE env var in registry.ts — no UI, hook, or service
// code changes.
//
// IMPORTANT: This interface is PURE (no Firebase, no Node `crypto` imports) so
// it is safe to import from both client and server code. The implementations
// live in `server/` and are only ever imported by API routes / orchestrator.
//
// CRITICAL: Every method receives a `BusinessContext` that has ALREADY been
// built from real Firestore data by the Business Knowledge Engine. Providers
// never read Firestore directly — they only analyse the context they're given.
// This guarantees multi-tenant isolation at the architecture level.
// ═══════════════════════════════════════════════════════════════════════════════

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
} from './types';

/**
 * The contract every AI backend implements.
 *
 * Every method receives a `BusinessContext` (the real, org-scoped business
 * snapshot) and returns plain analysis data — never Firestore documents. The
 * SERVICE layer is responsible for persisting results to `ai_memory`.
 *
 * Implementations MUST throw the typed errors from `./errors.ts` so callers
 * can branch on `instanceof` for proper UX.
 */
export interface IAIProvider {
  /** Human-readable provider name (e.g. 'Mock AI Oracle', 'OpenAI GPT-4'). */
  readonly name: string;
  /** The provider identifier. */
  readonly provider: AIProviderName;
  /** Whether this provider makes real calls to an external LLM API. */
  readonly isLive: boolean;

  // ─── Insight Engine ──────────────────────────────────────────────────────

  /**
   * Generate business insights from the real BusinessContext.
   * Each insight references the real metric it was derived from.
   * Returns [] when there is nothing notable to surface.
   */
  generateInsights(context: BusinessContext): Promise<Insight[]>;

  // ─── Recommendation Engine ───────────────────────────────────────────────

  /**
   * Generate actionable recommendations from the context + insights.
   * Each recommendation carries a rationale referencing the real metric.
   */
  generateRecommendations(
    context: BusinessContext,
    insights: Insight[],
  ): Promise<Recommendation[]>;

  // ─── Alert Engine ────────────────────────────────────────────────────────

  /**
   * Generate time-sensitive alerts from the context + insights.
   * Only the most urgent items become alerts.
   */
  generateAlerts(context: BusinessContext, insights: Insight[]): Promise<Alert[]>;

  // ─── Scoring ─────────────────────────────────────────────────────────────

  /** Compute the composite Business Score (0-100). */
  computeBusinessScore(context: BusinessContext): Promise<BusinessScore>;

  /** Compute the Risk Score (0-100, higher = riskier). */
  computeRiskScore(context: BusinessContext, insights: Insight[]): Promise<RiskScore>;

  // ─── Oracle Chat Engine ──────────────────────────────────────────────────

  /**
   * Answer a natural-language business question using the REAL BusinessContext.
   * The answer MUST reference real data — never fabricated values.
   */
  answerBusinessQuestion(
    question: string,
    context: BusinessContext,
  ): Promise<ChatResponse>;

  // ─── Predictions ─────────────────────────────────────────────────────────

  /** Predict revenue for the next N months using the real context. */
  predictRevenue(context: BusinessContext, months: number): Promise<Prediction>;

  /** Predict cash flow for the next N months using the real context. */
  predictCashFlow(context: BusinessContext, months: number): Promise<Prediction>;

  // ─── Brief ───────────────────────────────────────────────────────────────

  /**
   * Generate a concise executive brief (1-3 sentences) summarising the
   * business state, top insights, and most urgent recommendation.
   */
  generateBrief(
    context: BusinessContext,
    insights: Insight[],
    recommendations: Recommendation[],
  ): Promise<string>;

  // ─── Module Analysis ─────────────────────────────────────────────────────

  /**
   * Deep-dive analysis of a single business module.
   * Returns metrics + module-specific insights + recommendations.
   */
  analyzeModule(
    module: AnalysisModule,
    context: BusinessContext,
  ): Promise<AnalysisResult>;

  // ─── Health ──────────────────────────────────────────────────────────────

  /** Health check — used by the scheduler to verify the provider is reachable. */
  healthCheck(): Promise<boolean>;
}

/**
 * Re-export the analysis types so consumers can import everything from the
 * provider module without reaching into `./types`.
 */
export type {
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
} from './types';
