// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — Barrel Export (CLIENT-SAFE)
//
// The single import surface for AI functionality. This file is CLIENT-SAFE —
// it only re-exports types, errors, the provider interface, the pure engines,
// and the client-side Firestore service. The server-only modules (provider
// implementations, registry, orchestrator, scheduler) are NOT re-exported
// here; they must be imported directly from `./server/*` by API routes only.
//
// Importing from this file (client components + hooks):
//   import { useAIInsights, Insight, Recommendation, BusinessContext } from '@/lib/ai-provider';
//
// API routes import the server modules directly:
//   import { getAIProvider } from '@/lib/ai-provider/server/registry';
//   import { analyzeBusiness, answerBusinessQuestion } from '@/lib/ai-provider/server/orchestrator';
// ═══════════════════════════════════════════════════════════════════════════════

// Types — pure, safe for client + server
export * from './types';

// Errors — pure classes, safe for client + server
export * from './errors';

// Provider interface — pure, safe for client + server
export type { IAIProvider } from './provider';

// Pure engines — safe for client + server (used by the mock provider + future
// providers as the retrieval/analysis layer)
export {
  buildBusinessContext,
  currentPeriod,
  formatINR,
  formatPercent,
  periodLabel,
  periodMinus,
  periodPlus,
  daysUntil,
  deterministicId,
  type BusinessDataSnapshot,
  type InvoiceSnapshot,
  type GstTransactionSnapshot,
  type BankConnectionSnapshot,
  type BankTransactionSnapshot,
  type ClientSnapshot,
  type ReturnSnapshot,
} from './knowledge';

export {
  generateInsightsFromContext,
  detectDuplicateInvoices,
  INSIGHT_THRESHOLDS,
  type InsightType,
} from './insights';

export { generateRecommendationsFromContext } from './recommendations';
export {
  computeBusinessScoreFromContext,
  computeRiskScoreFromContext,
  generateAlertsFromContext,
} from './scoring';
export { answerQuestionWithContext, detectIntent, INTENT_KEYWORDS, type Intent } from './chat';
export {
  predictRevenueFromContext,
  predictCashFlowFromContext,
  generateBriefFromContext,
} from './predictions';

// Client-safe Firestore service (reads + writes + real-time subs for ai_memory)
export {
  AI_COLLECTIONS,
  toMemory,
  subscribeToMemories,
  subscribeToMemoriesByType,
  getMemories,
  saveMemory,
  updateMemory,
  deleteMemory,
  upsertMemory,
  clearMemoriesByType,
  hashSummary,
} from './service';
