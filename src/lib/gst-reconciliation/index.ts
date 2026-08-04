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
  type ReconciliationSummary,
} from './match-engine';

// Server-only (do not import from client components)
export { getGSPProvider, listGSPProviders, isGSPProviderAvailable } from './server/registry';
export { MockGSPProvider } from './server/mock-provider';
