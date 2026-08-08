// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GST Reconciliation Engine (public API)
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  IGSPProvider,
  GSPSession,
  GSTR2BRecord,
  GSTR2BFetchResult,
  GSPConnectionTest,
} from './types';

export {
  GSPError,
  GSPAuthError,
  GSPRateLimitError,
  GSPGSTNOutageError,
  GSPConfigError,
  GSPNotFoundError,
} from './errors';

export {
  reconcile,
  normalizeInvoiceNo,
  fuzzyInvoiceMatch,
  type BooksInvoice,
  type MatchStatus,
  type MatchResult,
  type MismatchField,
  type ScoreBreakdown,
  type ReconciliationSummary,
} from './match-engine';

export {
  suggestAction,
  suggestAllActions,
  type AISuggestion,
  type AISuggestionKey,
} from './ai-suggestions';

export {
  generateFixes,
  applyFixToBooks,
  type FixSuggestion,
  type FixType,
  type FixSeverity,
} from './auto-fix';

export {
  computeVendorScores,
  applyTrend,
  type VendorScore,
} from './vendor-score';

export {
  generateAISummary,
  type AIReconciliationSummary,
  type RiskLevel,
  type TopIssue,
} from './ai-summary';

// Server-only (do not import from client components)
export { getGSPProvider, getGSPProviderForOrg, listGSPProviders, getProviderMeta, isGSPProviderAvailable, type ProviderMeta, type OrgProviderResolution } from './server/registry';
export { MockGSPProvider } from './server/mock-provider';
export { MastersIndiaGSPProvider, type MastersIndiaConfig } from './server/mastersindia-provider';
export { GenericWebGSPProvider, type GenericWebConfig } from './server/generic-web-provider';
export { resolveProviderMode, modeLabel, modeBadgeClasses, type GSPMode, type ProviderModeInfo } from './server/provider-mode';
