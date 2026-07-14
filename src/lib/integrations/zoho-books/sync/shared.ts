// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Shared Utilities
//
// Common helpers used by every per-entity sync service:
//   • `paginate` — drives Zoho's page_token pagination, with retry-on-failed-page
//     and resume-from-cursor support.
//   • `EntityMapStore` — idempotent upsert lookup ("no duplicate imports"):
//     finds an existing ZohoEntityMap row by (zohoEntityType, zohoEntityId) and
//     returns the localEntityId, or null if first-time.
//   • `recordEntityMapping` — persists/updates the ZohoEntityMap row with the
//     latest lastModifiedAt watermark.
//   • `getWatermark` — reads the max lastModifiedAt for an entity type (used
//     for incremental sync).
//   • `sellerGstinFromZohoOrg` — best-effort resolve of the connected org's
//     own GSTIN (the "seller" on invoices). Falls back to a sentinel.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { zohoGet } from '../client';
import { parseZohoLastModified } from './mapper';
import type {
  ZohoPageContext,
  EntitySyncStats,
  EntitySyncResult,
  ZohoSyncEntity,
  SyncMode,
} from './types';

// ─── Page-fetch result ───────────────────────────────────────────────────────

export interface PageFetchResult<T> {
  /** The entity records on this page. */
  records: T[];
  /** Zoho's page_context — contains `next_token` for the next page. */
  pageContext: ZohoPageContext | null;
  /** True if Zoho reports more pages (has_more_page=true). */
  hasMore: boolean;
  /** Cursor to resume from after this page (the next_token, or null if no more). */
  nextCursor: string | null;
  /** Error message if the page failed permanently (after retries in zohoGet). */
  error: string | null;
}

// ─── Paginate ────────────────────────────────────────────────────────────────

export interface PaginateOptions {
  /** Zoho Books numeric organization ID. */
  zohoOrgId: string;
  /** Valid Zoho access token. */
  accessToken: string;
  /** API path, e.g. "/invoices" or "/contacts". */
  path: string;
  /** Query params to add (e.g. { type: 'customer' } for /contacts). */
  params?: Record<string, string>;
  /** Per-page size (Zoho default 200, max 200). */
  perPage?: number;
  /** Sync mode — incremental adds last_modified_time to params. */
  mode: SyncMode;
  /** High-water-mark (ISO string) for incremental sync — only fetch records
   * modified after this timestamp. */
  watermark?: string | null;
  /** Cursor to resume from (Zoho's next_token from a prior interrupted run). */
  resumeCursor?: string | null;
  /** Hard cap on total records fetched (safety valve). Default: 10000. */
  maxRecords?: number;
  /** Abort signal (e.g., from the route handler). */
  abortSignal?: AbortSignal;
  /** Key under which the list response holds the entity array. Default: derived
   * from path (e.g., "/invoices" → "invoices"). Override for /contacts which
   * returns "contacts" for both customers and vendors. */
  entityKey?: string;
  /** Max pages to fetch (safety valve). Default: 100. */
  maxPages?: number;
}

/**
 * Drive Zoho Books pagination. Yields one page of records at a time. The
 * caller processes each page (upserts into Prisma) and we continue until
 * Zoho returns has_more_page=false OR we hit the safety cap.
 *
 * Resume: if `resumeCursor` is set, the first request uses it as `page_token`
 * instead of starting from page 1.
 *
 * Incremental: if `mode` is 'incremental' and `watermark` is set, the
 * `last_modified_time` query param is added to fetch only modified records.
 */
export async function* paginate<T>(
  opts: PaginateOptions,
): AsyncGenerator<PageFetchResult<T>> {
  const {
    zohoOrgId,
    accessToken,
    path,
    params = {},
    perPage = 200,
    mode,
    watermark,
    resumeCursor,
    maxRecords = 10000,
    abortSignal,
    entityKey,
    maxPages = 100,
  } = opts;

  // Derive the entity key from the path if not provided.
  // "/invoices" → "invoices"; "/contacts" → "contacts"; etc.
  const key = entityKey ?? path.replace(/^\//, '').split('?')[0];

  let cursor: string | null = resumeCursor ?? null;
  let totalFetched = 0;
  let pageCount = 0;

  while (pageCount < maxPages) {
    if (abortSignal?.aborted) {
      yield {
        records: [],
        pageContext: null,
        hasMore: false,
        nextCursor: cursor,
        error: 'Aborted by caller.',
      };
      return;
    }
    if (totalFetched >= maxRecords) {
      yield {
        records: [],
        pageContext: null,
        hasMore: false,
        nextCursor: cursor,
        error: null,
      };
      return;
    }

    const qp: Record<string, string> = {
      ...params,
      per_page: String(perPage),
    };
    // Incremental: only fetch records modified after the watermark.
    if (mode === 'incremental' && watermark) {
      qp.last_modified_time = watermark;
    }
    // Resume: use the cursor Zoho returned on the previous page.
    if (cursor) {
      qp.page_token = cursor;
    }

    // zohoGet doesn't take a separate params arg — encode them into the path
    // directly as a query string.
    const url = new URL(path, 'http://zoho.local');
    for (const [k, v] of Object.entries(qp)) {
      url.searchParams.set(k, v);
    }
    const pathWithQuery = url.pathname + (url.search ? `?${url.searchParams.toString()}` : '');

    const finalRes = await zohoGet<Record<string, unknown>>(
      pathWithQuery,
      accessToken,
      { organizationId: zohoOrgId, signal: abortSignal },
    );

    pageCount++;

    if (finalRes.error || !finalRes.data) {
      yield {
        records: [],
        pageContext: null,
        hasMore: cursor !== null,
        nextCursor: cursor,
        error: finalRes.error ?? 'Empty Zoho response.',
      };
      return;
    }

    const records = (finalRes.data[key] as T[] | undefined) ?? [];
    const pageContext = (finalRes.data.page_context as ZohoPageContext | undefined) ?? null;
    const hasMore = pageContext?.has_more_page === true;
    const nextCursor = pageContext?.next_token ?? null;

    totalFetched += records.length;

    yield {
      records,
      pageContext,
      hasMore,
      nextCursor,
      error: null,
    };

    if (!hasMore || !nextCursor) {
      return;
    }
    cursor = nextCursor;
  }

  // Safety cap reached.
  yield {
    records: [],
    pageContext: null,
    hasMore: false,
    nextCursor: cursor,
    error: `Reached max-pages safety cap (${maxPages}).`,
  };
}

// ─── EntityMap store (idempotent upsert lookup) ──────────────────────────────

/**
 * Look up an existing local entity ID for a given Zoho entity. Returns null if
 * this Zoho record has never been imported (first sync or new record).
 */
export async function findLocalEntityId(
  organizationId: string,
  zohoOrgId: string,
  zohoEntityType: ZohoSyncEntity,
  zohoEntityId: string,
): Promise<{ localEntityId: string; localEntityType: string } | null> {
  const row = await db.zohoEntityMap.findUnique({
    where: {
      organizationId_zohoOrgId_zohoEntityType_zohoEntityId: {
        organizationId,
        zohoOrgId,
        zohoEntityType,
        zohoEntityId,
      },
    },
    select: { localEntityId: true, localEntityType: true },
  });
  return row ?? null;
}

/**
 * Persist (or update) the ZohoEntityMap row for a synced record. Updates
 * lastModifiedAt (the incremental-sync watermark) and lastSyncedAt.
 */
export async function recordEntityMapping(
  organizationId: string,
  zohoOrgId: string,
  zohoEntityType: ZohoSyncEntity,
  zohoEntityId: string,
  localEntityType: string,
  localEntityId: string,
  lastModifiedAt: Date | null,
): Promise<void> {
  try {
    await db.zohoEntityMap.upsert({
      where: {
        organizationId_zohoOrgId_zohoEntityType_zohoEntityId: {
          organizationId,
          zohoOrgId,
          zohoEntityType,
          zohoEntityId,
        },
      },
      create: {
        organizationId,
        zohoOrgId,
        zohoEntityType,
        zohoEntityId,
        localEntityType,
        localEntityId,
        lastModifiedAt,
        lastSyncedAt: new Date(),
      },
      update: {
        localEntityType,
        localEntityId,
        lastModifiedAt,
        lastSyncedAt: new Date(),
      },
    });
  } catch (err) {
    // Non-fatal — the row was already written (concurrent sync?) or the FK
    // check failed. Log and continue; we don't want one mapping failure to
    // abort the entire entity sync.
    console.warn(
      `[zoho-sync] recordEntityMapping failed for ${zohoEntityType}/${zohoEntityId}:`,
      err,
    );
  }
}

/**
 * Read the max lastModifiedAt for a given entity type. Used as the
 * high-water-mark for the next incremental sync run.
 */
export async function getWatermark(
  organizationId: string,
  zohoOrgId: string,
  zohoEntityType: ZohoSyncEntity,
): Promise<string | null> {
  const rows = await db.zohoEntityMap.findMany({
    where: { organizationId, zohoOrgId, zohoEntityType, lastModifiedAt: { not: null } },
    select: { lastModifiedAt: true },
    orderBy: { lastModifiedAt: 'desc' },
    take: 1,
  });
  const latest = rows[0]?.lastModifiedAt;
  return latest ? latest.toISOString() : null;
}

/**
 * Count how many records of each entity type have been imported for this
 * (organizationId, zohoOrgId) pair. Used by the UI's "Records Imported" panel.
 */
export async function countImportedRecords(
  organizationId: string,
  zohoOrgId: string,
): Promise<Partial<Record<ZohoSyncEntity, number>>> {
  const groups = await db.zohoEntityMap.groupBy({
    by: ['zohoEntityType'],
    where: { organizationId, zohoOrgId },
    _count: true,
  });
  const out: Partial<Record<ZohoSyncEntity, number>> = {};
  for (const g of groups) {
    out[g.zohoEntityType as ZohoSyncEntity] = g._count;
  }
  return out;
}

// ─── Seller GSTIN resolution ─────────────────────────────────────────────────

/**
 * Best-effort resolve the "seller" GSTIN for invoices — i.e., the connected
 * Zoho Books organization's own GSTIN. Used as Invoice.sellerGstin.
 *
 * Falls back to a sentinel `ZOHO-ORG-{zohoOrgId}` if the org's GSTIN can't be
 * resolved (the Invoice.sellerGstin field is required but not unique, so the
 * sentinel is safe).
 */
export async function resolveSellerGstin(
  accessToken: string,
  zohoOrgId: string,
): Promise<string> {
  try {
    const res = await zohoGet<{ organizations?: Array<{ organization_id: string; tax_registrations?: Array<{ gstin?: string; is_primary?: boolean }> }> }>(
      '/organizations',
      accessToken,
      { organizationId: zohoOrgId },
    );
    const org = res.data?.organizations?.find((o) => o.organization_id === zohoOrgId);
    const primary = org?.tax_registrations?.find((t) => t.is_primary) ?? org?.tax_registrations?.[0];
    if (primary?.gstin) return primary.gstin;
  } catch {
    /* fall through to sentinel */
  }
  return `ZOHO-ORG-${zohoOrgId}`;
}

// ─── Stats helpers ───────────────────────────────────────────────────────────

export function emptyStats(): EntitySyncStats {
  return {
    imported: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    pages: 0,
    lastError: null,
  };
}

export function buildEntityResult(
  entity: ZohoSyncEntity,
  stats: EntitySyncStats,
  watermark: string | null,
  resumeCursor: string | null,
  error: string | null,
): EntitySyncResult {
  return { entity, stats, watermark, resumeCursor, error };
}

/**
 * Compute the new high-water-mark for an entity after a sync run. Takes the
 * max of the existing watermark and the latest last_modified_time seen in the
 * current batch.
 */
export function bumpWatermark(
  current: string | null,
  candidate: Date | null,
): string | null {
  if (!candidate) return current;
  const candidateIso = candidate.toISOString();
  if (!current) return candidateIso;
  return candidateIso > current ? candidateIso : current;
}

/** Parse a Zoho record's last_modified_time into a Date (for watermark bumping). */
export { parseZohoLastModified };
