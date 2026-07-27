// ═══════════════════════════════════════════════════════════════════════════════
// @/lib/async — shared async reliability utilities
// ═══════════════════════════════════════════════════════════════════════════════
//
// Production-grade primitives for eliminating every loading/async/request-state
// issue across the app. Used by hooks, page components, and mutation handlers.
//
// Exports:
//   • fetchWithTimeout, parseJsonSafely, FetchTimeoutError, FetchHttpError
//   • useMountedRef
//   • useAsyncAction
//   • useSafePolling
// ═══════════════════════════════════════════════════════════════════════════════

export {
  fetchWithTimeout,
  parseJsonSafely,
  FetchTimeoutError,
  FetchHttpError,
  type FetchWithTimeoutOptions,
} from './fetchWithTimeout';

export { useMountedRef } from './useMountedRef';

export { useAsyncAction, type UseAsyncActionState } from './useAsyncAction';

export { useSafePolling, type SafePollingOptions } from './useSafePolling';
