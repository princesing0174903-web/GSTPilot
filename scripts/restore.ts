#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Firestore Restore Script
//
// Reads a backup directory (containing {collection}.json files produced by
// scripts/backup.ts) and imports all collections back to Firestore.
//
// Safety:
//   • DRY-RUN by default — shows what would be written without touching Firestore.
//   • `--confirm` flag required to actually write. Without it, no writes occur.
//   • Batch writes (500 docs/batch) to stay within Firestore limits.
//   • Existing documents are OVERWRITTEN (set merge: false). To preserve
//     existing fields, change `set(...)` to `set(..., { merge: true })` below.
//
// Usage:
//   # Dry-run (safe — no writes):
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json bun run scripts/restore.ts backups/2024-01-15T10-30-00-000Z
//
//   # Real restore (writes to Firestore — IRREVERSIBLE):
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json bun run scripts/restore.ts backups/2024-01-15T10-30-00-000Z --confirm
//
//   # Restrict to specific collections:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json bun run scripts/restore.ts backups/2024-01-15T10-30-00-000Z --confirm --only users,organizations
// ═══════════════════════════════════════════════════════════════════════════════

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";

const BATCH_SIZE = 500; // Firestore batched-write limit is 500 ops.

interface RestoreSummary {
  collection: string;
  docsFound: number;
  docsWritten: number;
  batches: number;
  durationMs: number;
  error?: string;
}

function parseArgs(argv: string[]): {
  backupDir: string;
  confirm: boolean;
  only: Set<string> | null;
} {
  const positional: string[] = [];
  let confirm = false;
  let only: Set<string> | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--confirm") {
      confirm = true;
    } else if (a === "--only") {
      const next = argv[i + 1];
      if (!next) {
        console.error("--only requires a comma-separated list of collection names.");
        process.exit(2);
      }
      only = new Set(next.split(",").map((s) => s.trim()).filter(Boolean));
      i++;
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: bun run scripts/restore.ts <backup-dir> [--confirm] [--only col1,col2]
  --confirm   Actually write to Firestore (default: dry-run, no writes).
  --only      Comma-separated list of collections to restore (default: all in dir).`);
      process.exit(0);
    } else {
      positional.push(a);
    }
  }
  if (positional.length === 0) {
    console.error("ERROR: backup directory argument required.");
    console.error('Example: bun run scripts/restore.ts backups/2024-01-15T10-30-00-000Z');
    process.exit(2);
  }
  return { backupDir: resolve(positional[0]), confirm, only };
}

function initAdmin(): Firestore {
  if (getApps().length === 0) {
    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!saPath) {
      console.error("ERROR: GOOGLE_APPLICATION_CREDENTIALS env var is not set.");
      console.error("Set it to a service account JSON path with Firestore write permission.");
      process.exit(1);
    }
    initializeApp({ credential: cert(saPath) });
  }
  return getFirestore();
}

interface BackupDoc {
  id: string;
  data: Record<string, unknown>;
}

function readBackupFile(filePath: string): BackupDoc[] {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Backup file ${filePath} is not a JSON array — was it produced by scripts/backup.ts?`);
  }
  return parsed as BackupDoc[];
}

async function restoreCollection(
  db: Firestore,
  name: string,
  filePath: string,
  confirm: boolean,
): Promise<RestoreSummary> {
  const startedAt = Date.now();
  const summary: RestoreSummary = {
    collection: name,
    docsFound: 0,
    docsWritten: 0,
    batches: 0,
    durationMs: 0,
  };
  try {
    const docs = readBackupFile(filePath);
    summary.docsFound = docs.length;

    if (docs.length === 0) {
      summary.durationMs = Date.now() - startedAt;
      console.log(`  • ${name.padEnd(28)} 0 docs (empty) — skipping`);
      return summary;
    }

    if (!confirm) {
      summary.durationMs = Date.now() - startedAt;
      console.log(
        `  • ${name.padEnd(28)} ${docs.length.toString().padStart(8)} docs (DRY-RUN — would write ${Math.ceil(docs.length / BATCH_SIZE)} batches)`,
      );
      return summary;
    }

    // Batch writes — 500 ops per batch (Firestore hard limit).
    let batch: WriteBatch = db.batch();
    let opsInBatch = 0;
    let batchCount = 0;

    for (const doc of docs) {
      const ref = db.collection(name).doc(doc.id);
      batch.set(ref, doc.data, { merge: false });
      opsInBatch++;
      summary.docsWritten++;

      if (opsInBatch >= BATCH_SIZE) {
        await batch.commit();
        batchCount++;
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) {
      await batch.commit();
      batchCount++;
    }
    summary.batches = batchCount;
    summary.durationMs = Date.now() - startedAt;
    console.log(
      `  ✓ ${name.padEnd(28)} ${summary.docsWritten.toString().padStart(8)} docs  ${summary.batches} batches  ${summary.durationMs}ms`,
    );
  } catch (err) {
    summary.error = err instanceof Error ? err.message : String(err);
    summary.durationMs = Date.now() - startedAt;
    console.error(`  ✗ ${name} FAILED: ${summary.error}`);
  }
  return summary;
}

async function main(): Promise<void> {
  const { backupDir, confirm, only } = parseArgs(process.argv.slice(2));

  if (!existsSync(backupDir)) {
    console.error(`ERROR: backup directory not found: ${backupDir}`);
    process.exit(2);
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  GSTPilot Infinity™ — Firestore Restore");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Backup dir:  ${backupDir}`);
  console.log(`  Mode:        ${confirm ? "WRITE (irreversible)" : "DRY-RUN (no writes)"}`);
  if (only) console.log(`  Filter:      --only ${[...only].join(",")}`);
  console.log("");

  if (!confirm) {
    console.log("  ⚠ DRY-RUN MODE — no data will be written to Firestore.");
    console.log("  ⚠ Add --confirm to actually perform the restore.\n");
  }

  // Discover {collection}.json files in the backup dir (skip _summary.json).
  const files = readdirSync(backupDir)
    .filter((f) => f.endsWith(".json") && f !== "_summary.json")
    .map((f) => ({ file: f, path: join(backupDir, f) }))
    .filter((entry) => {
      if (!only) return true;
      const name = basename(entry.file, ".json");
      return only.has(name);
    });

  if (files.length === 0) {
    console.error("No .json backup files found in directory (or all filtered out by --only).");
    process.exit(2);
  }

  const db = confirm ? initAdmin() : null;
  const summaries: RestoreSummary[] = [];
  for (const { file, path } of files) {
    const name = basename(file, ".json");
    summaries.push(await restoreCollection(db!, name, path, confirm));
  }

  const totalDocs = summaries.reduce((s, c) => s + c.docsFound, 0);
  const totalWritten = summaries.reduce((s, c) => s + c.docsWritten, 0);
  const totalBatches = summaries.reduce((s, c) => s + c.batches, 0);
  const failed = summaries.filter((s) => s.error).length;

  console.log("\n───────────────────────────────────────────────────────────");
  console.log("  RESTORE SUMMARY");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`  Collections:          ${summaries.length}`);
  console.log(`  Collections failed:   ${failed}`);
  console.log(`  Documents found:      ${totalDocs}`);
  console.log(`  Documents written:    ${totalWritten}`);
  console.log(`  Batches committed:    ${totalBatches}`);
  console.log(`  Mode:                 ${confirm ? "WRITE" : "DRY-RUN"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (failed > 0) {
    console.error(`WARNING: ${failed} collection(s) failed. Review errors above.`);
    process.exit(2);
  }
  if (!confirm) {
    console.log("Re-run with --confirm to perform the actual restore.");
  }
}

main().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
