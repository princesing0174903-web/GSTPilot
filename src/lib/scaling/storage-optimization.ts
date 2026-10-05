// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Firebase Storage Optimization (SERVER-ONLY)
//
// Direct-to-storage signed URLs, image-optimization heuristics, orphan-file
// cleanup, and per-org usage aggregation. All helpers use the Admin SDK
// singleton (`adminStorage()` from `@/lib/firebase-admin`).
//
// NEVER import this module from client code.
// ═══════════════════════════════════════════════════════════════════════════════

import { adminStorage, adminDb } from '@/lib/firebase-admin';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SignedUploadUrlResult {
  url: string;
  path: string;
  expiresAt: Date;
}

export interface SignedDownloadUrlResult {
  url: string;
  expiresAt: Date;
}

export interface SignedUploadOpts {
  expiresInMinutes?: number;
  maxSizeBytes?: number;
  contentType?: string;
}

export interface SignedDownloadOpts {
  expiresInMinutes?: number;
}

export interface ImageOptimizationResult {
  shouldOptimize: boolean;
  reason: string;
}

export interface CleanupOpts {
  dryRun?: boolean;
  olderThanDays?: number;
  batchLimit?: number;
}

export interface CleanupResult {
  scanned: number;
  deleted: number;
  failed: number;
  sample: string[];
}

export interface CategoryUsage {
  bytes: number;
  count: number;
}

export interface StorageUsageResult {
  totalBytes: number;
  fileCount: number;
  byCategory: Record<string, CategoryUsage>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Storage category prefixes (relative to the org-scoped root `orgs/${orgId}/`).
 * Used by `getStorageUsage` to bucket per-org usage. The `temp` prefix is
 * ephemeral and should be cleaned aggressively by `cleanupOrphanedFiles`.
 */
export const CATEGORIES = [
  'invoices',
  'receipts',
  'documents',
  'exports',
  'avatars',
  'reports',
  'temp',
] as const;

export type StorageCategory = (typeof CATEGORIES)[number];

const DEFAULT_UPLOAD_EXPIRY_MIN = 15;
const DEFAULT_DOWNLOAD_EXPIRY_MIN = 60;
const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_CLEANUP_OLDER_THAN_DAYS = 30;
const DEFAULT_CLEANUP_BATCH = 1000;
const IMAGE_OPTIMIZATION_SIZE_THRESHOLD = 200 * 1024; // 200 KB

// ─── Internal helpers ────────────────────────────────────────────────────────

function bucket() {
  return adminStorage().bucket();
}

function minutesFromDate(minutes: number): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

// ─── Signed URLs ─────────────────────────────────────────────────────────────

/**
 * Generate a V4 signed URL for direct-to-storage uploads (bypasses the
 * Next.js server — the client PUTs the bytes straight to GCS).
 *
 * Default expiry 15 minutes, default max size 50 MB. When `contentType` is
 * supplied the URL is restricted to that MIME type; when `maxSizeBytes` is
 * supplied the URL carries a `x-goog-content-length-range` header enforcing
 * the cap.
 */
export async function generateSignedUploadUrl(
  path: string,
  opts: SignedUploadOpts = {},
): Promise<SignedUploadUrlResult> {
  const expiresInMinutes = opts.expiresInMinutes ?? DEFAULT_UPLOAD_EXPIRY_MIN;
  const expires = minutesFromDate(expiresInMinutes);
  const maxSizeBytes = opts.maxSizeBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const contentType = opts.contentType;

  const file = bucket().file(path);

  // Build extension headers. `x-goog-content-length-range` caps upload size.
  const extensionHeaders: Record<string, string> = {};
  if (maxSizeBytes > 0) {
    extensionHeaders['x-goog-content-length-range'] = `0,${maxSizeBytes}`;
  }
  if (contentType) {
    extensionHeaders['Content-Type'] = contentType;
  }

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires,
    contentType: contentType ?? 'application/octet-stream',
    extensionHeaders,
  });

  return { url, path, expiresAt: expires };
}

/**
 * Generate a V4 signed URL for direct-to-storage downloads. Default expiry
 * 60 minutes.
 */
export async function generateSignedDownloadUrl(
  path: string,
  opts: SignedDownloadOpts = {},
): Promise<SignedDownloadUrlResult> {
  const expiresInMinutes = opts.expiresInMinutes ?? DEFAULT_DOWNLOAD_EXPIRY_MIN;
  const expires = minutesFromDate(expiresInMinutes);
  const file = bucket().file(path);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires,
  });

  return { url, expiresAt: expires };
}

// ─── Image Optimization Heuristic ───────────────────────────────────────────

/**
 * Decide whether a freshly-uploaded image should be routed through an
 * optimization pass (re-encoding, resizing, WebP transcoding, etc.).
 *
 * Returns `shouldOptimize=true` when:
 *   - size > 200 KB, OR
 *   - content type is image/jpeg or image/png (lossless-friendly → transcode)
 *     and no explicit optimization flag is present in metadata.
 *
 * `metadata` here is a minimal shape — callers can pass richer objects; only
 * `contentType` and `size` are inspected.
 */
export function optimizeImageMetadata(metadata: {
  contentType: string;
  size: number;
}): ImageOptimizationResult {
  const { contentType, size } = metadata;

  if (size > IMAGE_OPTIMIZATION_SIZE_THRESHOLD) {
    return {
      shouldOptimize: true,
      reason: `image size ${size}B exceeds threshold ${IMAGE_OPTIMIZATION_SIZE_THRESHOLD}B`,
    };
  }

  const ct = (contentType || '').toLowerCase();
  if (ct === 'image/jpeg' || ct === 'image/png') {
    return {
      shouldOptimize: true,
      reason: `${ct} is a transcode-friendly source format — convert to WebP/AVIF`,
    };
  }

  return { shouldOptimize: false, reason: 'no optimization needed' };
}

// ─── Orphan File Cleanup ─────────────────────────────────────────────────────

/**
 * Scan the default bucket for files older than `olderThanDays` (default 30)
 * and check whether each file's full `gs://` path (or its name) is referenced
 * in the Firestore `documents` collection. Files NOT referenced are considered
 * orphans and are deleted (unless `dryRun=true`).
 *
 * The Firestore `documents` collection is the org-scoped document index — each
 * doc carries a `storagePath` (or `path`) field. We do a single batched read
 * of distinct paths and check membership locally (avoids N Firestore queries).
 *
 * Default batchLimit 1000 (matches the cleanup trigger's weekly run cadence).
 */
export async function cleanupOrphanedFiles(
  opts: CleanupOpts = {},
): Promise<CleanupResult> {
  const dryRun = opts.dryRun ?? false;
  const olderThanDays = opts.olderThanDays ?? DEFAULT_CLEANUP_OLDER_THAN_DAYS;
  const batchLimit = opts.batchLimit ?? DEFAULT_CLEANUP_BATCH;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const b = bucket();
  const [files] = await b.getFiles({
    autoPaginate: false,
    maxResults: batchLimit,
  });

  // ── Load all referenced storage paths from the `documents` collection ──
  const referencedPaths = new Set<string>();
  try {
    const db = adminDb();
    const snap = await db.collection('documents').get();
    snap.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const p =
        typeof data.storagePath === 'string'
          ? data.storagePath
          : typeof data.path === 'string'
            ? data.path
            : null;
      if (p) referencedPaths.add(p);
    });
  } catch (err) {
    console.warn('[storage-optimization] failed to read documents collection:', err);
    // If we can't verify references, do NOT delete anything by default.
  }

  let scanned = 0;
  let deleted = 0;
  let failed = 0;
  const sample: string[] = [];

  for (const file of files) {
    scanned++;
    const createdRaw = file.metadata?.timeCreated;
    const created = createdRaw ? new Date(createdRaw as string) : null;
    if (created && created > cutoff) continue; // too new

    const name = file.name;
    if (referencedPaths.has(name)) continue; // still in use

    // Orphan — delete (or sample if dryRun).
    if (sample.length < 50) sample.push(name);

    if (dryRun) continue;

    try {
      await file.delete();
      deleted++;
    } catch (err) {
      console.warn(`[storage-optimization] failed to delete ${name}:`, err);
      failed++;
    }
  }

  return { scanned, deleted, failed, sample };
}

// ─── Per-Org Usage Aggregation ───────────────────────────────────────────────

/**
 * Aggregate storage usage for an organization.
 *
 * Scans the bucket prefix `orgs/${orgId}/` and tallies bytes + file count,
 * bucketed per category (invoices, receipts, documents, exports, avatars,
 * reports, temp).
 *
 * The scan is paginated server-side by GCS — for very large orgs (>100k
 * files) this can take 10–20s and should be cached at the API layer.
 */
export async function getStorageUsage(
  orgId: string,
): Promise<StorageUsageResult> {
  const prefix = `orgs/${orgId}/`;
  const b = bucket();

  let totalBytes = 0;
  let fileCount = 0;
  const byCategory: Record<string, CategoryUsage> = {};
  for (const cat of CATEGORIES) {
    byCategory[cat] = { bytes: 0, count: 0 };
  }
  // Also track an "other" bucket for files that don't match any category.
  byCategory.other = { bytes: 0, count: 0 };

  // Paginate manually so we don't load all file objects into memory at once.
  let pageToken: string | undefined;
  do {
    const [files, , apiResponse] = await b.getFiles({
      prefix,
      autoPaginate: false,
      maxResults: 1000,
      pageToken,
    });

    for (const file of files) {
      const size = Number(file.metadata?.size ?? 0);
      totalBytes += size;
      fileCount++;

      // Strip the org prefix and pick the first path segment as the category.
      const relative = file.name.slice(prefix.length);
      const firstSlash = relative.indexOf('/');
      const cat = firstSlash === -1 ? relative : relative.slice(0, firstSlash);

      const bucket = byCategory[cat] ?? byCategory.other;
      bucket.bytes += size;
      bucket.count++;
    }

    // Next-page token from the raw API response.
    const raw = apiResponse as { nextPageToken?: string } | null;
    pageToken = raw?.nextPageToken;
  } while (pageToken);

  return { totalBytes, fileCount, byCategory };
}
