/**
 * OfflineWriteQueue — durable client/server-side write buffer for Firestore.
 *
 * Pending writes are persisted to a local JSON file
 * (`/tmp/gstpilot-offline-queue.json`) so they survive process restarts. On
 * `flush()`, writes are committed to Firestore via the admin SDK with
 * exponential backoff per write. Writes that exhaust their retries are kept in
 * the queue for the next flush.
 *
 * Use case: when the network or Firestore is degraded, callers can enqueue
 * writes locally and continue serving requests. A periodic `flush()` drains
 * the queue when connectivity is restored.
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { adminDb } from "@/lib/firebase-admin";
import { retryWithBackoff, isRetryableError } from "./retry";

/** Operation types supported by the queue. */
export type OfflineWriteType = "set" | "update" | "delete";

/** A single queued write. */
export interface OfflineWriteOp {
  /** Firestore collection path (top-level, e.g. "orgs" or "invoices"). */
  collection: string;
  /** Document id within the collection. */
  docId: string;
  /** Payload for set/update; ignored for delete. */
  data?: unknown;
  /** Operation kind. */
  type: OfflineWriteType;
  /** Monotonic id assigned by the queue. */
  seq: number;
  /** Timestamp the op was enqueued. */
  enqueuedAt: number;
  /** Number of flush attempts so far. */
  attempts: number;
  /** Optional org id for scoping/debugging. */
  orgId?: string;
}

/** Result of a `flush()` call. */
export interface FlushResult {
  success: number;
  failed: number;
  remaining: number;
}

const QUEUE_FILE = "/tmp/gstpilot-offline-queue.json";
const MAX_ATTEMPTS_PER_OP = 5;

/**
 * OfflineWriteQueue — see module docs.
 */
export class OfflineWriteQueue {
  private ops: OfflineWriteOp[] = [];
  private nextSeq = 1;
  private loaded = false;
  private flushing = false;
  private persistPending = false;

  /** Add an op to the queue. Persists immediately. */
  async enqueue(
    op: Omit<OfflineWriteOp, "seq" | "enqueuedAt" | "attempts">,
  ): Promise<number> {
    await this.ensureLoaded();
    const full: OfflineWriteOp = {
      ...op,
      seq: this.nextSeq++,
      enqueuedAt: Date.now(),
      attempts: 0,
    };
    this.ops.push(full);
    await this.persist();
    return full.seq;
  }

  /** Current number of pending ops. */
  async pendingCount(): Promise<number> {
    await this.ensureLoaded();
    return this.ops.length;
  }

  /** Remove all pending ops. Persists immediately. */
  async clear(): Promise<void> {
    await this.ensureLoaded();
    this.ops = [];
    this.nextSeq = 1;
    await this.persist();
  }

  /**
   * Attempt to commit all pending ops to Firestore. Each op is retried with
   * exponential backoff; ops that exhaust retries stay in the queue.
   */
  async flush(): Promise<FlushResult> {
    if (this.flushing) {
      // Re-entrancy guard — coalesce concurrent flush calls.
      return { success: 0, failed: 0, remaining: this.ops.length };
    }
    this.flushing = true;
    try {
      await this.ensureLoaded();
      if (this.ops.length === 0) {
        return { success: 0, failed: 0, remaining: 0 };
      }

      let success = 0;
      let failed = 0;
      const stillPending: OfflineWriteOp[] = [];

      for (const op of this.ops) {
        try {
          await retryWithBackoff(
            async (attempt) => {
              op.attempts = attempt;
              await this.commitOne(op);
            },
            {
              maxAttempts: MAX_ATTEMPTS_PER_OP,
              shouldRetry: (err) => isRetryableError(err),
            },
          );
          success++;
        } catch (err) {
          failed++;
          // Keep the op in the queue for a future flush; reset attempts so the
          // next flush starts fresh (the underlying issue may be transient).
          op.attempts = 0;
          stillPending.push(op);
           
          console.error(
            `[offline-sync] op ${op.seq} (${op.type} ${op.collection}/${op.docId}) failed permanently:`,
            err,
          );
        }
      }

      this.ops = stillPending;
      await this.persist();
      return { success, failed, remaining: stillPending.length };
    } finally {
      this.flushing = false;
    }
  }

  /** Commit a single op to Firestore via the admin SDK. */
  private async commitOne(op: OfflineWriteOp): Promise<void> {
    let firestore;
    try {
      firestore = adminDb();
    } catch (err) {
      // Admin SDK not initialized — rethrow as retryable.
      const e = new Error(
        `offline-sync: admin SDK unavailable: ${(err as Error).message}`,
      );
      (e as Error & { retryable?: boolean }).retryable = true;
      throw e;
    }

    const ref = firestore.collection(op.collection).doc(op.docId);
    if (op.type === "delete") {
      await ref.delete();
      return;
    }
    if (op.type === "set") {
      await ref.set(op.data ?? {}, { merge: false });
      return;
    }
    // update
    await ref.set(op.data ?? {}, { merge: true });
  }

  /** Lazy-load the queue from disk on first access. */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (existsSync(QUEUE_FILE)) {
        const raw = await fs.readFile(QUEUE_FILE, "utf8");
        const parsed = JSON.parse(raw) as { ops?: OfflineWriteOp[]; nextSeq?: number };
        if (Array.isArray(parsed.ops)) {
          this.ops = parsed.ops;
        }
        if (typeof parsed.nextSeq === "number") {
          this.nextSeq = parsed.nextSeq;
        } else if (this.ops.length > 0) {
          this.nextSeq = Math.max(...this.ops.map((o) => o.seq)) + 1;
        }
      }
    } catch (err) {
      // Corrupt queue file — start fresh, but back up the bad file.
       
      console.error("[offline-sync] failed to load queue file, starting fresh:", err);
      try {
        await fs.copyFile(QUEUE_FILE, `${QUEUE_FILE}.corrupt.${Date.now()}`);
      } catch {
        /* best-effort */
      }
      this.ops = [];
      this.nextSeq = 1;
    }
  }

  /** Persist the queue to disk. Coalesces concurrent writes. */
  private async persist(): Promise<void> {
    if (this.persistPending) return;
    this.persistPending = true;
    try {
      const payload = JSON.stringify({ ops: this.ops, nextSeq: this.nextSeq });
      // Atomic write: write to temp file then rename.
      const tmp = `${QUEUE_FILE}.${process.pid}.tmp`;
      await fs.mkdir(path.dirname(QUEUE_FILE), { recursive: true });
      await fs.writeFile(tmp, payload, "utf8");
      await fs.rename(tmp, QUEUE_FILE);
    } catch (err) {
       
      console.error("[offline-sync] failed to persist queue:", err);
    } finally {
      this.persistPending = false;
    }
  }
}

/** Process-wide singleton. */
export const offlineWriteQueue = new OfflineWriteQueue();
