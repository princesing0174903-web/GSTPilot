#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Firestore Backup Script
//
// Exports all collections (paginated, 500 docs/page) to JSON files in
// backups/{timestamp}/, then compresses to backups/{timestamp}.tar.gz.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json bun run scripts/backup.ts
//
// Required env:
//   • GOOGLE_APPLICATION_CREDENTIALS — path to a Firebase service account JSON
//     (must have Cloud Datastore User + Firestore Reader roles).
//
// Output:
//   backups/
//     2024-01-15T10-30-00-000Z/
//       organizations.json
//       users.json
//       ... (32 collections)
//       _summary.json
//     2024-01-15T10-30-00-000Z.tar.gz
// ═══════════════════════════════════════════════════════════════════════════════

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

// ─── Collections to back up ───────────────────────────────────────────────────
// Source of truth for all top-level GSTPilot collections. Keep in sync with
// docs/BACKUP_RECOVERY.md and firestore.rules.
const COLLECTIONS: readonly string[] = [
  "organizations",
  "users",
  "organization_members",
  "clients",
  "invoices",
  "returns",
  "payments",
  "expenses",
  "tasks",
  "notifications",
  "audit_logs",
  "error_reports",
  "performance_metrics",
  "alerts",
  "subscriptions",
  "billing_accounts",
  "billing_invoices",
  "receipts",
  "usage_records",
  "erp_connections",
  "erp_sync_jobs",
  "erp_customers",
  "erp_invoices",
  "banking_connections",
  "banking_transactions",
  "scheduled_messages",
  "gmail_messages",
  "whatsapp_messages",
  "ai_memory",
  "ai_conversations",
  "documents",
] as const;

const PAGE_SIZE = 500; // Firestore read page size — stays well under 1 MB limits.

interface CollectionSummary {
  collection: string;
  docs: number;
  bytes: number;
  durationMs: number;
  error?: string;
}

interface BackupSummary {
  startedAt: string;
  endedAt: string;
  totalDurationMs: number;
  outputDir: string;
  archivePath: string;
  collections: CollectionSummary[];
  totalDocs: number;
  totalBytes: number;
  collectionsExported: number;
  collectionsFailed: number;
}

function timestamp(): string {
  // ISO 8601 with colons replaced (filesystem-safe).
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function initAdmin(): Firestore {
  if (getApps().length === 0) {
    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!saPath) {
      console.error("ERROR: GOOGLE_APPLICATION_CREDENTIALS env var is not set.");
      console.error("Create a service account in Firebase Console →");
      console.error("  Project settings → Service accounts → Generate new private key.");
      console.error("Then run:");
      console.error("  GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json bun run scripts/backup.ts");
      process.exit(1);
    }
    initializeApp({ credential: cert(saPath) });
  }
  return getFirestore();
}

async function exportCollection(
  db: Firestore,
  name: string,
  outDir: string,
): Promise<CollectionSummary> {
  const startedAt = Date.now();
  const summary: CollectionSummary = {
    collection: name,
    docs: 0,
    bytes: 0,
    durationMs: 0,
  };
  try {
    const allDocs: unknown[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    // Paginated read — 500 docs per page, walk the cursor.
    while (true) {
      let q = db.collection(name).limit(PAGE_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      for (const doc of snap.docs) {
        allDocs.push({ id: doc.id, data: doc.data() });
        lastDoc = doc;
      }
      if (snap.docs.length < PAGE_SIZE) break; // last page
    }

    const json = JSON.stringify(allDocs, null, 2);
    const filePath = join(outDir, `${name}.json`);
    writeFileSync(filePath, json);
    summary.docs = allDocs.length;
    summary.bytes = Buffer.byteLength(json, "utf8");
    summary.durationMs = Date.now() - startedAt;
    console.log(
      `  ✓ ${name.padEnd(28)} ${summary.docs.toString().padStart(8)} docs  ${(summary.bytes / 1024).toFixed(1).padStart(10)} KB  ${summary.durationMs}ms`,
    );
  } catch (err) {
    summary.error = err instanceof Error ? err.message : String(err);
    summary.durationMs = Date.now() - startedAt;
    console.error(`  ✗ ${name} FAILED: ${summary.error}`);
  }
  return summary;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function main(): Promise<void> {
  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();
  const ts = timestamp();
  const outDir = join(process.cwd(), "backups", ts);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  GSTPilot Infinity™ — Firestore Backup");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Started:  ${startedAtIso}`);
  console.log(`  Output:   ${outDir}`);
  console.log(`  Collections: ${COLLECTIONS.length}`);
  console.log("");

  mkdirSync(outDir, { recursive: true });

  const db = initAdmin();
  const collections: CollectionSummary[] = [];
  for (const name of COLLECTIONS) {
    collections.push(await exportCollection(db, name, outDir));
  }

  const totalDocs = collections.reduce((s, c) => s + c.docs, 0);
  const totalBytes = collections.reduce((s, c) => s + c.bytes, 0);
  const collectionsExported = collections.filter((c) => !c.error).length;
  const collectionsFailed = collections.filter((c) => c.error).length;

  // ─── Write summary JSON ────────────────────────────────────────────────────
  const summary: BackupSummary = {
    startedAt: startedAtIso,
    endedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startedAtMs,
    outputDir: outDir,
    archivePath: `${outDir}.tar.gz`,
    collections,
    totalDocs,
    totalBytes,
    collectionsExported,
    collectionsFailed,
  };
  writeFileSync(join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));

  // ─── Compress to .tar.gz ───────────────────────────────────────────────────
  const archivePath = `${outDir}.tar.gz`;
  try {
    execSync(`tar -czf "${archivePath}" -C "${join(process.cwd(), "backups")}" "${ts}"`, {
      stdio: "inherit",
    });
    console.log(`\n  ✓ Archive: ${archivePath}`);
    if (existsSync(archivePath)) {
      const archiveBytes = statSync(archivePath).size;
      console.log(`    Size:    ${formatBytes(archiveBytes)}`);
    }
  } catch (err) {
    console.error(`  ✗ Archive failed: ${err}`);
  }

  console.log("\n───────────────────────────────────────────────────────────");
  console.log("  BACKUP SUMMARY");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`  Collections exported: ${collectionsExported} / ${COLLECTIONS.length}`);
  console.log(`  Collections failed:   ${collectionsFailed}`);
  console.log(`  Total documents:      ${totalDocs}`);
  console.log(`  Total JSON size:      ${formatBytes(totalBytes)}`);
  console.log(`  Total duration:       ${(summary.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`  Output directory:     ${outDir}`);
  console.log(`  Archive:              ${archivePath}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (collectionsFailed > 0) {
    console.error(`WARNING: ${collectionsFailed} collection(s) failed. Review errors above.`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
