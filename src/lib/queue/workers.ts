/**
 * Workers — one per TaskType. Each worker is a thin async adapter that:
 *   1. Dynamically imports the relevant existing module (lazy — no cold-start
 *      bloat).
 *   2. Looks up the function to call from `payload.action`.
 *   3. Calls it with `payload.args` (array, spread) or `payload` itself.
 *
 * Each worker is wrapped with `safeExecute` from the reliability layer so
 * circuit-breaker + retry + fallback protection applies automatically.
 *
 * Workers MUST NOT throw — they should reject only on actual failure, so the
 * queue can record attempts / dead-letter correctly.
 */

import {
  safeExecute,
  type SafeExecuteOptions,
} from "@/lib/reliability";
import type { QueuedTask, TaskType } from "./task-queue";
import { getTaskQueue } from "./task-queue";

/** Shape of a worker function. */
export type WorkerFn = (task: QueuedTask) => Promise<void>;

/** Shape of `payload` expected by workers (permissive). */
interface WorkerPayload {
  /** Function name to invoke on the dynamically-imported module. */
  action?: string;
  /** Positional args (spread). */
  args?: unknown[];
  /** If `args` is absent, the whole payload (minus action/args) is passed. */
  [key: string]: unknown;
}

/**
 * Resolve the args to pass to the target function. If `payload.args` is an
 * array, spread it; otherwise pass the payload (sans `action`) as a single
 * argument. The `organizationId` from the task is auto-prepended to the args
 * if the target function is one of those that take `orgId` as the first arg
 * (we keep an explicit opt-in list to avoid surprising callers).
 */
function resolveArgs(payload: WorkerPayload, task: QueuedTask): unknown[] {
  if (Array.isArray(payload.args)) return payload.args;
  const { action: _action, args: _args, ...rest } = payload;
  return [rest];
}

/** Wrap a worker body with `safeExecute`. */
function wrap(
  breakerName: string,
  body: (payload: WorkerPayload, task: QueuedTask) => Promise<unknown>,
  opts?: SafeExecuteOptions,
): WorkerFn {
  return async (task) => {
    const payload = task.payload as unknown as WorkerPayload;
    await safeExecute(breakerName, () => body(payload, task), {
      breaker: breakerName,
      maxAttempts: 1, // retries are managed by the queue
      shouldRetry: () => false, // ditto
      ...opts,
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual workers
// ─────────────────────────────────────────────────────────────────────────────

/** invoice worker — delegates to invoice-engine/service.ts. */
export const invoiceWorker = wrap("invoice", async (payload, task) => {
  const mod = await import("@/lib/invoice-engine/service");
  const action = payload.action ?? "createInvoice";
  const fn = (mod as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[action];
  if (typeof fn !== "function") {
    throw new Error(`invoice worker: unknown action "${action}"`);
  }
  // createInvoice takes a single input object; other fns vary. We pass
  // `payload` minus `action`/`args` for createInvoice, or spread args if
  // provided. The dispatcher below handles both shapes uniformly.
  const args = resolveArgs(payload, task);
  await fn(...args);
});

/** gst worker — delegates to gst-engine/service.ts. */
export const gstWorker = wrap("gstn", async (payload, task) => {
  const mod = await import("@/lib/gst-engine/service");
  const action = payload.action ?? "createTransaction";
  const fn = (mod as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[action];
  if (typeof fn !== "function") {
    throw new Error(`gst worker: unknown action "${action}"`);
  }
  // createTransaction signature: (orgId, data). If the caller didn't supply
  // args explicitly, prepend the task's orgId.
  let args = resolveArgs(payload, task);
  if (!Array.isArray(payload.args) && args.length === 1) {
    args = [task.orgId, args[0]];
  }
  await fn(...args);
});

/** erp worker — delegates to erp-provider/server/orchestrator.ts. */
export const erpWorker = wrap("erp", async (payload, task) => {
  const mod = await import("@/lib/erp-provider/server/orchestrator");
  const action = payload.action ?? "fullERPSync";
  const fn = (mod as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[action];
  if (typeof fn !== "function") {
    throw new Error(`erp worker: unknown action "${action}"`);
  }
  await fn(...resolveArgs(payload, task));
});

/** bank worker — delegates to banking-provider/server/orchestrator.ts. */
export const bankWorker = wrap("banking", async (payload, task) => {
  const mod = await import("@/lib/banking-provider/server/orchestrator");
  const action = payload.action ?? "fullBankSync";
  const fn = (mod as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[action];
  if (typeof fn !== "function") {
    throw new Error(`bank worker: unknown action "${action}"`);
  }
  await fn(...resolveArgs(payload, task));
});

/** notification worker — delegates to notifications.ts. */
export const notificationWorker = wrap("notification", async (payload, _task) => {
  const mod = await import("@/lib/notifications");
  const action = payload.action ?? "createNotification";
  const fn = (mod as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[action];
  if (typeof fn !== "function") {
    throw new Error(`notification worker: unknown action "${action}"`);
  }
  await fn(...resolveArgs(payload, _task));
});

/** ai worker — delegates to ai-provider/server/orchestrator.ts. */
export const aiWorker = wrap("ai-provider", async (payload, task) => {
  const mod = await import("@/lib/ai-provider/server/orchestrator");
  const action = payload.action ?? "runBackgroundAnalysis";
  const fn = (mod as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[action];
  if (typeof fn !== "function") {
    throw new Error(`ai worker: unknown action "${action}"`);
  }
  // Most ai-provider fns take (organizationId, ...rest).
  let args = resolveArgs(payload, task);
  if (!Array.isArray(payload.args)) {
    // Auto-prepend orgId for the common single-orgId-arg fns.
    if (
      action === "runBackgroundAnalysis" ||
      action === "gatherBusinessContext" ||
      action === "analyzeBusiness" ||
      action === "analyzeCashFlow" ||
      action === "analyzeGST" ||
      action === "analyzeInvoices" ||
      action === "analyzeExpenses" ||
      action === "predictRevenue" ||
      action === "predictCashFlow" ||
      action === "generateInsights" ||
      action === "generateRecommendations" ||
      action === "generateAlerts" ||
      action === "computeBusinessScore" ||
      action === "computeRiskScore" ||
      action === "generateBrief"
    ) {
      args = [task.orgId, ...args];
    }
  }
  await fn(...args);
});

/** email worker — delegates to communication/email.ts. */
export const emailWorker = wrap("email", async (payload, task) => {
  const mod = await import("@/lib/communication/email");
  const action = payload.action ?? "renderEmailHtml";
  const fn = (mod as unknown as Record<string, ((...a: unknown[]) => unknown) | undefined>)[action];
  if (typeof fn !== "function") {
    throw new Error(`email worker: unknown action "${action}"`);
  }
  // Most email helpers are synchronous — wrap result in Promise.resolve.
  await Promise.resolve(fn(...resolveArgs(payload, task)));
});

/** report worker — delegates to communication/reports.ts. */
export const reportWorker = wrap("email", async (payload, task) => {
  const mod = await import("@/lib/communication/reports");
  const action = payload.action ?? "scheduleReport";
  const fn = (mod as unknown as Record<string, ((...a: unknown[]) => unknown) | undefined>)[action];
  if (typeof fn !== "function") {
    throw new Error(`report worker: unknown action "${action}"`);
  }
  await Promise.resolve(fn(...resolveArgs(payload, task)));
});

/** export worker — delegates to data-intelligence/pipeline.ts. */
export const exportWorker = wrap("erp", async (payload, task) => {
  try {
    const mod = await import("@/lib/data-intelligence/pipeline");
    const action = payload.action ?? "ingestConnectorData";
    const fn = (mod as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[action];
    if (typeof fn !== "function") {
      throw new Error(`export worker: unknown action "${action}"`);
    }
    await fn(...resolveArgs(payload, task));
  } catch (err) {
    // Generic fallback: write the payload as a JSON record via the offline
    // queue so the caller at least has durable evidence of the attempt.
    const { offlineWriteQueue } = await import("@/lib/reliability");
    await offlineWriteQueue.enqueue({
      collection: "exports",
      docId: task.id,
      data: { task, error: err instanceof Error ? err.message : String(err), at: Date.now() },
      type: "set",
      orgId: task.orgId,
    });
    throw err;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Registry + orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/** Map of task type → worker function. */
export const WORKERS: Record<TaskType, WorkerFn> = {
  invoice: invoiceWorker,
  gst: gstWorker,
  erp: erpWorker,
  bank: bankWorker,
  notification: notificationWorker,
  ai: aiWorker,
  email: emailWorker,
  report: reportWorker,
  export: exportWorker,
};

/**
 * Start processing loops for ALL 9 task types. Returns a function that, when
 * called, signals all loops to drain gracefully (via AbortController).
 *
 * @param shutdownSignal Optional external AbortSignal (e.g. SIGTERM handler).
 * @returns A `stop()` function — call it to initiate graceful drain.
 */
export function startAllWorkers(shutdownSignal?: AbortSignal): () => void {
  const controller = new AbortController();
  const queue = getTaskQueue();

  // Start all 9 loops — fire and forget; each loop runs until aborted.
  for (const type of Object.keys(WORKERS) as TaskType[]) {
    const handler = WORKERS[type];
    void queue.process(type, handler, controller.signal).catch((err) => {
       
      console.error(`[workers] loop for "${type}" crashed:`, err);
    });
  }

  if (shutdownSignal) {
    shutdownSignal.addEventListener(
      "abort",
      () => controller.abort(),
      { once: true },
    );
  }

  return () => controller.abort();
}
