// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Background Analysis Scheduler (SERVER-ONLY)
//
// Triggers background AI analysis:
//   • Manual — `triggerAnalysis(orgId)` from an API route after a data change
//     (invoice created, payment received, GST sync, bank sync).
//   • Scheduled — `runScheduledAnalysis()` iterates orgs due for a refresh.
//
// The scheduler is intentionally lightweight: it calls the orchestrator's
// `runBackgroundAnalysis` which does the real work (gather → analyse →
// persist to ai_memory). Analysis is debounced per-org so rapid data changes
// don't trigger redundant runs.
//
// This file is SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { runBackgroundAnalysis } from './orchestrator';
import { isRetryableAIError } from '../errors';

// ─── Debounce state (per-org, in-process) ─────────────────────────────────────

interface PendingRun {
  orgId: string;
  timer: NodeJS.Timeout;
  promise: Promise<void>;
  resolve: () => void;
  reject: (err: unknown) => void;
}

const pending = new Map<string, PendingRun>();
const DEBOUNCE_MS = 5_000; // 5s debounce — coalesce rapid data changes

// ─── Manual trigger (debounced) ───────────────────────────────────────────────

/**
 * Trigger a background analysis run for an organization.
 * Debounced: if multiple triggers arrive within DEBOUNCE_MS, only one run
 * executes. Returns a promise that resolves when the (debounced) run completes.
 *
 * Call this after any data change that should refresh Oracle's memory:
 *   • Invoice created / paid / cancelled
 *   • GST sync completed
 *   • Bank sync completed
 *   • Report generated
 */
export function triggerAnalysis(organizationId: string): Promise<void> {
  if (!organizationId) return Promise.resolve();

  // If a run is already pending, chain onto it.
  const existing = pending.get(organizationId);
  if (existing) return existing.promise;

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(async () => {
      pending.delete(organizationId);
      try {
        await runBackgroundAnalysis(organizationId);
        resolve();
      } catch (err) {
        if (isRetryableAIError(err)) {
          // Retry once after a short delay for transient errors.
          setTimeout(async () => {
            try {
              await runBackgroundAnalysis(organizationId);
              resolve();
            } catch (err2) {
              reject(err2);
            }
          }, 10_000);
        } else {
          reject(err);
        }
      }
    }, DEBOUNCE_MS);

    pending.set(organizationId, { orgId: organizationId, timer, promise: Promise.resolve(), resolve, reject });
    // Patch: the promise stored above should be the one we just created.
    const entry = pending.get(organizationId)!;
    entry.promise = new Promise<void>((res, rej) => {
      entry.resolve = res;
      entry.reject = rej;
    });
  });
}

/**
 * Cancel any pending analysis run for an organization (e.g. on org switch).
 */
export function cancelPendingAnalysis(organizationId: string): void {
  const entry = pending.get(organizationId);
  if (entry) {
    clearTimeout(entry.timer);
    pending.delete(organizationId);
  }
}

// ─── Scheduled analysis ───────────────────────────────────────────────────────

/**
 * Run scheduled analysis for organizations that are due for a refresh.
 *
 * Today this is a no-op placeholder — the scheduler is wired to be invoked by
 * a cron job (or a manual admin endpoint). When orgs register their last
 * analysis timestamp, this function will iterate the ones overdue for a
 * refresh and call runBackgroundAnalysis for each.
 *
 * This keeps Oracle's memory fresh even without explicit user-triggered
 * analysis.
 */
export async function runScheduledAnalysis(): Promise<{ processed: number; errors: number }> {
  // Placeholder: in production this reads the list of active orgs from
  // Firestore `organizations` and calls runBackgroundAnalysis for each whose
  // last AI analysis is older than the refresh interval (e.g. 24h).
  // For now, return zero — actual org iteration is a Phase 11 (DevOps) concern.
  return { processed: 0, errors: 0 };
}

/**
 * Get the current scheduler status (for diagnostics).
 */
export function getSchedulerStatus(): {
  pendingOrgs: string[];
  debounceMs: number;
} {
  return {
    pendingOrgs: [...pending.keys()],
    debounceMs: DEBOUNCE_MS,
  };
}
