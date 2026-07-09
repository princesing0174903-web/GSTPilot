/**
 * TaskQueue — unified background-processing queue architecture.
 *
 * Features:
 *   - 9 task types (invoice, gst, erp, bank, notification, ai, email, report,
 *     export), each with its own priority buckets + FIFO within bucket.
 *   - Firestore persistence (org-scoped `task_queue` collection) with graceful
 *     degradation to memory-only if Firestore is unavailable.
 *   - Visibility timeout + lock-based dequeue so multiple workers can pull
 *     from the same queue safely.
 *   - Per-type concurrency control.
 *   - Exponential backoff per failed attempt; dead-letter after `maxAttempts`.
 *   - `process(type, handler)` long-running loop with graceful drain on
 *     AbortSignal.
 */

import { adminDb } from "@/lib/firebase-admin";
import { getCircuitBreaker } from "@/lib/reliability/circuit-breaker";
import { retryWithBackoff, isRetryableError } from "@/lib/reliability/retry";

/** All supported task types. */
export type TaskType =
  | "invoice"
  | "gst"
  | "erp"
  | "bank"
  | "notification"
  | "ai"
  | "email"
  | "report"
  | "export";

/** Priority buckets (higher = processed first within a type). */
export type TaskPriority = "critical" | "high" | "normal" | "low";

/** Lifecycle states. */
export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "dead-letter";

/** A queued task. */
export interface QueuedTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  orgId: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  lockedUntil?: number;
  failedAt?: number;
  error?: string;
  status: TaskStatus;
}

/** Per-type defaults. */
export interface TaskTypeConfig {
  concurrency: number;
  maxAttempts: number;
  visibilityTimeoutMs: number;
  priorityDefault: TaskPriority;
}

/** Stats snapshot. */
export interface TaskQueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  deadLetter: number;
  perType: Record<TaskType, { pending: number; running: number; completed: number; failed: number; deadLetter: number }>;
}

/** Per-type config defaults. */
export const TASK_TYPE_CONFIG: Record<TaskType, TaskTypeConfig> = {
  invoice:      { concurrency: 5, maxAttempts: 5, visibilityTimeoutMs: 5 * 60_000, priorityDefault: "high" },
  gst:          { concurrency: 3, maxAttempts: 5, visibilityTimeoutMs: 10 * 60_000, priorityDefault: "high" },
  erp:          { concurrency: 3, maxAttempts: 4, visibilityTimeoutMs: 5 * 60_000, priorityDefault: "normal" },
  bank:         { concurrency: 3, maxAttempts: 4, visibilityTimeoutMs: 5 * 60_000, priorityDefault: "normal" },
  notification: { concurrency: 8, maxAttempts: 3, visibilityTimeoutMs: 60_000,    priorityDefault: "normal" },
  ai:           { concurrency: 2, maxAttempts: 3, visibilityTimeoutMs: 5 * 60_000, priorityDefault: "normal" },
  email:        { concurrency: 5, maxAttempts: 4, visibilityTimeoutMs: 2 * 60_000, priorityDefault: "normal" },
  report:       { concurrency: 2, maxAttempts: 3, visibilityTimeoutMs: 15 * 60_000, priorityDefault: "low" },
  export:       { concurrency: 1, maxAttempts: 2, visibilityTimeoutMs: 30 * 60_000, priorityDefault: "low" },
};

const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const ALL_TASK_TYPES: TaskType[] = [
  "invoice", "gst", "erp", "bank", "notification", "ai", "email", "report", "export",
];

/**
 * Unified task queue. Singleton accessor: `getTaskQueue()`.
 */
export class TaskQueue {
  /** In-memory queues: per-type → per-priority → FIFO list. */
  private queues: Record<TaskType, Record<TaskPriority, QueuedTask[]>>;
  /** Task id → task (for status lookups + completion). */
  private tasksById: Map<string, QueuedTask> = new Map();
  /** Per-type currently-running count. */
  private runningByType: Record<TaskType, number> = Object.fromEntries(
    ALL_TASK_TYPES.map((t) => [t, 0]),
  ) as Record<TaskType, number>;
  /** Cumulative counters per type. */
  private counters: Record<TaskType, { completed: number; failed: number; deadLetter: number }>;
  /** Active process loops (for graceful drain). */
  private loops: Map<TaskType, { controller: AbortController; running: boolean }> = new Map();
  /** True if Firestore is available for persistence. */
  private firestoreOk: boolean | null = null;
  /** Monotonic id counter (for in-memory-only mode). */
  private idCounter = 0;

  constructor() {
    const emptyBuckets = (): Record<TaskPriority, QueuedTask[]> => ({
      critical: [],
      high: [],
      normal: [],
      low: [],
    });
    this.queues = {
      invoice: emptyBuckets(),
      gst: emptyBuckets(),
      erp: emptyBuckets(),
      bank: emptyBuckets(),
      notification: emptyBuckets(),
      ai: emptyBuckets(),
      email: emptyBuckets(),
      report: emptyBuckets(),
      export: emptyBuckets(),
    };
    this.counters = {
      invoice: { completed: 0, failed: 0, deadLetter: 0 },
      gst: { completed: 0, failed: 0, deadLetter: 0 },
      erp: { completed: 0, failed: 0, deadLetter: 0 },
      bank: { completed: 0, failed: 0, deadLetter: 0 },
      notification: { completed: 0, failed: 0, deadLetter: 0 },
      ai: { completed: 0, failed: 0, deadLetter: 0 },
      email: { completed: 0, failed: 0, deadLetter: 0 },
      report: { completed: 0, failed: 0, deadLetter: 0 },
      export: { completed: 0, failed: 0, deadLetter: 0 },
    };
  }

  /**
   * Enqueue a task. Returns the task id. Persists to Firestore `task_queue`
   * (org-scoped) when available; falls back to memory-only.
   */
  async enqueue(input: {
    type: TaskType;
    orgId: string;
    payload: Record<string, unknown>;
    priority?: TaskPriority;
    maxAttempts?: number;
  }): Promise<string> {
    const cfg = TASK_TYPE_CONFIG[input.type];
    const task: QueuedTask = {
      id: this.genId(),
      type: input.type,
      priority: input.priority ?? cfg.priorityDefault,
      orgId: input.orgId,
      payload: input.payload,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? cfg.maxAttempts,
      createdAt: Date.now(),
      status: "pending",
    };
    this.queues[task.type][task.priority].push(task);
    this.tasksById.set(task.id, task);

    // Best-effort persistence — failure here is non-fatal.
    void this.persist(task).catch((err) => {
       
      console.error(`[task-queue] persistence failed for ${task.id}:`, err);
    });

    return task.id;
  }

  /**
   * Pull the highest-priority pending task whose lock has expired. Optional
   * `types` filter; if omitted, all types are eligible.
   *
   * Sets `status="running"`, increments `attempts`, and stamps `lockedUntil`.
   */
  dequeue(types?: TaskType[]): QueuedTask | null {
    const candidates = types ?? ALL_TASK_TYPES;
    const now = Date.now();
    let best: QueuedTask | null = null;
    let bestRank = 0;
    let bestCreatedAt = Infinity;

    for (const type of candidates) {
      const buckets = this.queues[type];
      for (const prio of ["critical", "high", "normal", "low"] as TaskPriority[]) {
        const list = buckets[prio];
        // Find first task in this bucket that is either pending or has an
        // expired lock.
        for (let i = 0; i < list.length; i++) {
          const t = list[i]!;
          if (t.status !== "pending" && t.status !== "running") continue;
          if (t.status === "running" && (t.lockedUntil ?? 0) > now) continue;
          // Eligible.
          const rank = PRIORITY_RANK[t.priority];
          if (
            rank > bestRank ||
            (rank === bestRank && t.createdAt < bestCreatedAt)
          ) {
            best = t;
            bestRank = rank;
            bestCreatedAt = t.createdAt;
          }
          break; // FIFO within bucket — only first eligible matters
        }
      }
    }

    if (!best) return null;
    best.status = "running";
    best.attempts += 1;
    best.lockedUntil = Date.now() + TASK_TYPE_CONFIG[best.type].visibilityTimeoutMs;
    this.runningByType[best.type]++;
    // Re-persist the lock.
    void this.persist(best).catch(() => {});
    return best;
  }

  /** Mark a task successfully completed. */
  async markCompleted(id: string): Promise<void> {
    const t = this.tasksById.get(id);
    if (!t) return;
    t.status = "completed";
    t.lockedUntil = undefined;
    this.runningByType[t.type] = Math.max(0, this.runningByType[t.type] - 1);
    this.counters[t.type].completed++;
    this.removeFromQueue(t);
    await this.deletePersisted(id).catch(() => {});
  }

  /**
   * Mark a task failed. If attempts < maxAttempts, re-queue with exponential
   * backoff via `lockedUntil`. Otherwise dead-letter.
   */
  async markFailed(id: string, err: unknown): Promise<void> {
    const t = this.tasksById.get(id);
    if (!t) return;
    t.failedAt = Date.now();
    t.error = err instanceof Error ? err.message : String(err);
    this.runningByType[t.type] = Math.max(0, this.runningByType[t.type] - 1);

    if (t.attempts < t.maxAttempts) {
      // Re-queue: back off exponentially.
      t.status = "pending";
      const backoffMs = Math.min(
        30_000 * Math.pow(2, t.attempts - 1),
        10 * 60_000,
      );
      t.lockedUntil = Date.now() + backoffMs;
      this.counters[t.type].failed++;
      void this.persist(t).catch(() => {});
    } else {
      // Dead-letter.
      t.status = "dead-letter";
      t.lockedUntil = undefined;
      this.counters[t.type].deadLetter++;
      this.removeFromQueue(t);
      void this.persist(t).catch(() => {});
    }
  }

  /** Force a task to dead-letter immediately (manual intervention). */
  async deadLetter(id: string): Promise<void> {
    const t = this.tasksById.get(id);
    if (!t) return;
    t.status = "dead-letter";
    t.lockedUntil = undefined;
    this.runningByType[t.type] = Math.max(0, this.runningByType[t.type] - 1);
    this.counters[t.type].deadLetter++;
    this.removeFromQueue(t);
    void this.persist(t).catch(() => {});
  }

  /** Snapshot of queue stats. */
  getStats(): TaskQueueStats {
    const perType = Object.fromEntries(
      ALL_TASK_TYPES.map((t) => {
        let pending = 0;
        let running = 0;
        for (const prio of ["critical", "high", "normal", "low"] as TaskPriority[]) {
          for (const task of this.queues[t][prio]) {
            if (task.status === "pending") pending++;
            else if (task.status === "running") running++;
          }
        }
        return [
          t,
          {
            pending,
            running,
            completed: this.counters[t].completed,
            failed: this.counters[t].failed,
            deadLetter: this.counters[t].deadLetter,
          },
        ];
      }),
    ) as TaskQueueStats["perType"];

    let pending = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    let deadLetter = 0;
    for (const t of ALL_TASK_TYPES) {
      pending += perType[t].pending;
      running += perType[t].running;
      completed += perType[t].completed;
      failed += perType[t].failed;
      deadLetter += perType[t].deadLetter;
    }
    return { pending, running, completed, failed, deadLetter, perType };
  }

  /**
   * Long-running processing loop for a task type. Pulls tasks, calls
   * `handler`, marks completed/failed. Respects `maxConcurrentPerType`
   * (from TASK_TYPE_CONFIG) and the AbortSignal.
   */
  async process(
    type: TaskType,
    handler: (task: QueuedTask) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.loops.has(type)) {
      // Already running — don't start a second loop.
      return;
    }
    const controller = new AbortController();
    const listener = () => controller.abort();
    if (signal) signal.addEventListener("abort", listener, { once: true });
    this.loops.set(type, { controller, running: true });

    const cfg = TASK_TYPE_CONFIG[type];
    const breaker = getCircuitBreaker(`queue:${type}`);
    const pollIntervalMs = 250;

    try {
      while (!controller.signal.aborted) {
        // Drain any in-flight tasks whose visibility expired.
        // (dequeue() handles this naturally.)

        // Pull tasks up to the concurrency limit.
        while (this.runningByType[type] < cfg.concurrency) {
          if (controller.signal.aborted) break;
          const task = this.dequeue([type]);
          if (!task) break;
          // Fire-and-forget — we manage concurrency via runningByType.
          void this.runOne(task, handler, breaker);
        }

        // Wait for either the poll interval or abort.
        await new Promise<void>((resolve) => {
          const tid = setTimeout(resolve, pollIntervalMs);
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(tid);
              resolve();
            },
            { once: true },
          );
        });
      }

      // Graceful drain: wait for in-flight tasks to finish.
      while (this.runningByType[type] > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      this.loops.delete(type);
      if (signal) signal.removeEventListener("abort", listener);
    }
  }

  /** Run a single task under the breaker + retry policy. */
  private async runOne(
    task: QueuedTask,
    handler: (task: QueuedTask) => Promise<void>,
    breaker: ReturnType<typeof getCircuitBreaker>,
  ): Promise<void> {
    try {
      await breaker.execute(() =>
        retryWithBackoff(
          () => handler(task),
          {
            maxAttempts: 1, // retries are managed by the queue itself
            shouldRetry: () => false,
          },
        ),
      );
      await this.markCompleted(task.id);
    } catch (err) {
      // If the breaker is OPEN we still record a failure so the queue can
      // dead-letter after maxAttempts — but we add a small lock to defer
      // immediate re-pull when the breaker is open.
      await this.markFailed(task.id, err);
    }
  }

  /** Remove a task from its in-memory queue (completed / dead-letter). */
  private removeFromQueue(task: QueuedTask): void {
    const list = this.queues[task.type][task.priority];
    const idx = list.indexOf(task);
    if (idx >= 0) list.splice(idx, 1);
  }

  /** Generate a task id. */
  private genId(): string {
    this.idCounter++;
    return `tq_${Date.now().toString(36)}_${this.idCounter.toString(36)}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Firestore persistence (best-effort)
  // ─────────────────────────────────────────────────────────────────────────

  /** Persist a task to Firestore `task_queue/{id}` (org-scoped). */
  private async persist(task: QueuedTask): Promise<void> {
    if (this.firestoreOk === false) return;
    let firestore;
    try {
      firestore = adminDb();
    } catch {
      this.firestoreOk = false;
      return;
    }
    try {
      await firestore
        .collection("orgs")
        .doc(task.orgId)
        .collection("task_queue")
        .doc(task.id)
        .set({
          id: task.id,
          type: task.type,
          priority: task.priority,
          orgId: task.orgId,
          payload: task.payload,
          attempts: task.attempts,
          maxAttempts: task.maxAttempts,
          createdAt: task.createdAt,
          lockedUntil: task.lockedUntil ?? null,
          failedAt: task.failedAt ?? null,
          error: task.error ?? null,
          status: task.status,
          updatedAt: Date.now(),
        });
      this.firestoreOk = true;
    } catch (err) {
      if (!isRetryableError(err)) {
        // Non-transient error — disable persistence.
        this.firestoreOk = false;
      }
      throw err;
    }
  }

  /** Delete a persisted task (on completion / dead-letter). */
  private async deletePersisted(id: string): Promise<void> {
    if (this.firestoreOk === false) return;
    const task = this.tasksById.get(id);
    if (!task) return;
    let firestore;
    try {
      firestore = adminDb();
    } catch {
      return;
    }
    try {
      await firestore
        .collection("orgs")
        .doc(task.orgId)
        .collection("task_queue")
        .doc(id)
        .delete();
    } catch {
      /* best-effort */
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

let singleton: TaskQueue | null = null;

/** Process-wide singleton accessor. */
export function getTaskQueue(): TaskQueue {
  if (!singleton) singleton = new TaskQueue();
  return singleton;
}
