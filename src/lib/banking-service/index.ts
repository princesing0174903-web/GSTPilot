// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Service — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════
//
// Single import surface for the entire Banking module. UI pages, API routes,
// Oracle actions, and Oracle workflows import from here — never from
// individual files. This keeps the public contract stable when internals
// move.
//
//   import {
//     getBankingService,
//     type BankingService,
//     type BankingAccount,
//     CATEGORY_META,
//     matchQuestion,
//   } from '@/lib/banking-service';
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types (the contract) ─────────────────────────────────────────────────────
export * from './types';

// ─── Provider interface + factory ─────────────────────────────────────────────
export { type BankingService, getBankingService } from './provider';

// ─── Mock provider (concrete implementation; usually not imported directly) ───
export { MockBankingProvider } from './mock-provider';

// ─── Categorization rules engine (pure helpers + UI metadata) ─────────────────
export {
  matchRule,
  evaluateRules,
  extractCounterparty,
  CATEGORY_META,
  CATEGORY_ORDER,
  type CategoryMeta,
} from './rules';

// ─── Reconciliation matching helpers (pure) ───────────────────────────────────
export {
  findCandidates,
  classifyMatch,
  amountScore,
  dateScore,
  nameScore,
  combineScore,
  type ReconcileLedger,
  type LedgerInvoice,
  type LedgerPayment,
  type LedgerExpense,
} from './reconcile';

// ─── Forecast helpers (pure) ──────────────────────────────────────────────────
export {
  computeForecast,
  buildNarrative,
  type ComputeForecastInput,
  type ComputedForecast,
} from './forecast';

// ─── Oracle Banking Intelligence — question matching (pure) ───────────────────
export {
  matchQuestion,
  type BankingQuestionKind,
  type MatchedQuestion,
} from './intelligence';

// ─── Setu provider (real banking integration) ─────────────────────────────────
// Live BankingService implementation backed by the Setu AA gateway. Auto-used
// by getBankingService() when Setu creds are present; falls back to Mock
// otherwise. See src/lib/setu/ for the SDK.
export { SetuBankingProvider } from './providers/setu-provider';
