// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Business Snapshot Invalidation Event Bus
//
// A tiny global event bus so ANY mutation (create invoice, create client,
// Zoho sync, payment recorded, etc.) can instantly invalidate the Business
// Snapshot cache and force every dashboard, Oracle, AI CFO, and report to
// re-fetch.
//
// This is the "single source of truth" enforcement layer:
//   1. A user creates an invoice in the Invoice Workspace
//   2. The Invoice API saves to Prisma
//   3. The mutation calls `invalidateBusinessSnapshot()`
//   4. Every mounted `useBusinessSnapshot()` hook receives the event
//   5. Each hook re-fetches `/api/business/snapshot?forceRefresh=true`
//   6. Every dashboard updates INSTANTLY — no 60-second wait
//
// Usage (anywhere a mutation happens):
//   import { invalidateBusinessSnapshot } from '@/lib/business-snapshot-events';
//   invalidateBusinessSnapshot();  // fire-and-forget
//
// Usage (in the hook):
//   useEffect(() => {
//     const off = onBusinessSnapshotInvalidated(() => refresh(true));
//     return off;
//   }, [refresh]);
// ═══════════════════════════════════════════════════════════════════════════════

const EVENT_NAME = 'gstpilot:business-snapshot-invalidated';

/**
 * Fire a global invalidation event. Every mounted `useBusinessSnapshot()`
 * hook will re-fetch with `forceRefresh=true`.
 *
 * Safe to call from server components (no-op) or client components.
 * Safe to call multiple times in quick succession (hooks debounce).
 */
export function invalidateBusinessSnapshot(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/**
 * Subscribe to snapshot invalidation events. Returns an unsubscribe function.
 *
 * @param handler — Called whenever `invalidateBusinessSnapshot()` is fired.
 */
export function onBusinessSnapshotInvalidated(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener(EVENT_NAME, handler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
  };
}
