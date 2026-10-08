// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Shared GSTR-2B Sync Runner (SERVER-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The single implementation of "fetch GSTR-2B from the configured provider +
// upsert into GSTR2BInvoice + update the sync job + advance the connection
// state machine". Both `/api/gst/sync-2b` (manual trigger) and
// `/api/gst/sync-2b/retry` (retry of a previous job) call into this function.
//
// CONTRACT — Caller Responsibilities:
//   • Auth + org-membership check (requireAuth + requireOrgMembership).
//   • Rate-limiting (the sync HTTP route is rate-limited per user).
//   • Body validation (organizationId, period or jobId).
//   • Mapping the returned `Sync2BOutcome` to an HTTP response.
//
// CONTRACT — This Function Guarantees:
//   • NO silent LIVE→DEMO fallback. If a real provider is configured but its
//     last test failed, returns `{ kind: 'not_tested' }` and the caller MUST
//     surface a 409 to the user. The ONLY time demo/mock is used is when
//     `cfg.providerKey === 'mock'` (explicit demo choice) OR no config exists.
//   • Every GSTR2BInvoice write is scoped by `organizationId` (tenant isolation).
//   • The `source` field on every GSTR2BInvoice row is set to the resolved mode
//     ('live' | 'sandbox' | 'demo') so audit trails can distinguish provenance.
//   • Per-record error isolation: a single bad record does NOT abort the whole
//     sync. `recordsFailed` counts records that threw; the sync continues.
//   • The `GSTSyncJob` row is always transitioned to a terminal status
//     (`completed` | `partial` | `failed`) and `completedAt` is always set.
//   • The `GSPProviderConfig.connectionState` is advanced through the state
//     machine: `syncing` at start, then `synced` | `partial_sync` | `token_expired`
//     | `rate_limited` | `connection_error` based on outcome.
//   • `tokenExpiry` + `lastSyncAt` are persisted after a successful sync.
//
// CONNECTION STATE MACHINE (see prisma/schema.prisma GSPProviderConfig):
//   not_connected | connecting | connected | syncing | synced |
//   token_expired | connection_error | rate_limited | partial_sync
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { decryptString } from '@/lib/gstn-provider/server/crypto';
import { MastersIndiaGSPProvider, type MastersIndiaConfig } from './mastersindia-provider';
import { GenericWebGSPProvider, type GenericWebConfig } from './generic-web-provider';
import { MockGSPProvider } from './mock-provider';
import type { IGSPProvider, GSPSession } from '../types';
import {
  GSPError,
  GSPAuthError,
  GSPRateLimitError,
  GSPGSTNOutageError,
} from '../errors';

/** Sample GSTIN used for demo-mode syncs when no real GSTIN is configured. */
const SAMPLE_GSTIN = '27AAACR5058K1Z5';

// ─── Public types ────────────────────────────────────────────────────────────

export interface Sync2BOptions {
  organizationId: string;
  /** YYYY-MM. */
  period: string;
  /** Defaults to 'manual'. */
  trigger?: 'manual' | 'automatic' | 'retry';
  /** Set when this sync is a retry of a previous job. */
  retryOf?: string;
}

export interface Sync2BSummary {
  recordsFetched: number;
  recordsImported: number;
  /** Existing rows whose values changed (was `recordsChanged` — kept in sync). */
  recordsUpdated: number;
  /** Existing rows whose values did NOT change (no-op). */
  recordsSkipped: number;
  /** Records that threw during insert/update (per-record error isolation). */
  recordsFailed: number;
  /** Legacy alias for `recordsUpdated` — kept for backward compat. */
  recordsChanged: number;
  recordsRemoved: number;
  durationMs: number;
  mode: 'live' | 'sandbox' | 'demo';
  isLive: boolean;
  provider: string;
  configId: string | null;
}

/**
 * Discriminated outcome. Callers map `kind` → HTTP status:
 *   success              → 200
 *   partial              → 200 (with `partial: true` flag in the summary)
 *   not_tested           → 409
 *   no_gstin             → 400
 *   unsupported_provider → 400
 *   rate_limited         → 429
 *   auth_error           → 401
 *   outage               → 502
 *   error                → 500
 */
export type Sync2BOutcome =
  | { kind: 'success'; jobId: string; summary: Sync2BSummary }
  | { kind: 'partial'; jobId: string; summary: Sync2BSummary }
  | { kind: 'not_tested' }
  | { kind: 'no_gstin' }
  | { kind: 'unsupported_provider'; providerKey: string }
  | { kind: 'rate_limited'; jobId: string; message: string }
  | { kind: 'auth_error'; jobId: string; message: string }
  | { kind: 'outage'; jobId: string; message: string }
  | { kind: 'error'; jobId: string | null; message: string };

// ─── Internal: provider config row (subset we use) ───────────────────────────

interface ProviderConfigRow {
  id: string;
  providerKey: string;
  clientId: string | null;
  clientSecret: string | null;
  apikey: string | null;
  apiEndpoint: string | null;
  authEndpoint: string | null;
  mode: string | null;
  gstin: string | null;
  lastTestOk: boolean;
}

interface ResolvedProvider {
  provider: IGSPProvider;
  mode: 'live' | 'sandbox' | 'demo';
  gstin: string;
  configId: string | null;
  cfg: ProviderConfigRow | null;
}

/**
 * Resolve the active GSP provider for an org. CRITICAL: does NOT silently fall
 * back to demo when a real provider is configured but untested — instead
 * returns the `not_tested` outcome so the caller can surface a 409.
 */
async function resolveProvider(
  organizationId: string,
): Promise<
  | { ok: true; resolved: ResolvedProvider }
  | { ok: false; outcome: Sync2BOutcome }
> {
  const cfg = (await db.gSPProviderConfig.findFirst({
    where: { organizationId, enabled: true },
    orderBy: { updatedAt: 'desc' },
  })) as ProviderConfigRow | null;

  // Demo mode — explicit mock provider OR no config at all. This is the ONLY
  // path that uses MockGSPProvider. A real provider that failed its test does
  // NOT fall back to demo (see below).
  if (!cfg || cfg.providerKey === 'mock') {
    return {
      ok: true,
      resolved: {
        provider: new MockGSPProvider(),
        mode: 'demo',
        gstin: cfg?.gstin ?? SAMPLE_GSTIN,
        configId: cfg?.id ?? null,
        cfg: cfg ?? null,
      },
    };
  }

  // Real provider configured but never successfully tested (or last test
  // failed). REFUSE to silently fall back to demo — caller must surface a 409
  // and instruct the user to run "Test Connection" first.
  if (!cfg.lastTestOk) {
    return { ok: false, outcome: { kind: 'not_tested' } };
  }

  const gstin = cfg.gstin ?? '';
  if (!gstin || gstin.length !== 15) {
    return { ok: false, outcome: { kind: 'no_gstin' } };
  }

  const mode: 'live' | 'sandbox' = cfg.mode === 'production' ? 'live' : 'sandbox';

  // Decrypt secrets (best-effort — corrupt ciphertext is treated as a config
  // error, but we don't fail the whole resolution; the provider will throw a
  // GSPConfigError on authenticate if it can't use them).
  let decryptedSecret = '';
  try {
    decryptedSecret = cfg.clientSecret ? decryptString(cfg.clientSecret) : '';
  } catch {
    /* swallow — provider will throw GSPConfigError if needed */
  }
  let decryptedApikey = '';
  try {
    decryptedApikey = cfg.apikey ? decryptString(cfg.apikey) : '';
  } catch {
    /* swallow */
  }

  let provider: IGSPProvider;
  if (cfg.providerKey === 'mastersindia') {
    const miConfig: MastersIndiaConfig = {
      clientId: cfg.clientId ?? '',
      clientSecret: decryptedSecret,
      apikey: decryptedApikey,
      apiEndpoint: cfg.apiEndpoint ?? '',
      mode: (cfg.mode ?? 'sandbox') as 'sandbox' | 'production',
    };
    provider = new MastersIndiaGSPProvider(miConfig);
  } else if (cfg.providerKey === 'generic') {
    const genConfig: GenericWebConfig = {
      apikey: decryptedSecret || decryptedApikey,
      apiEndpoint: cfg.apiEndpoint ?? '',
      mode: (cfg.mode ?? 'sandbox') as 'sandbox' | 'production',
    };
    provider = new GenericWebGSPProvider(genConfig);
  } else {
    return {
      ok: false,
      outcome: { kind: 'unsupported_provider', providerKey: cfg.providerKey },
    };
  }

  return {
    ok: true,
    resolved: { provider, mode, gstin, configId: cfg.id, cfg },
  };
}

// ─── Internal: map a thrown GSP error to a connection state + outcome kind ────

interface ErrorMapping {
  outcomeKind: 'rate_limited' | 'auth_error' | 'outage' | 'error';
  connectionState: 'rate_limited' | 'token_expired' | 'connection_error';
  httpStatus: number;
}

function mapGspError(err: unknown): ErrorMapping {
  if (err instanceof GSPRateLimitError) {
    return { outcomeKind: 'rate_limited', connectionState: 'rate_limited', httpStatus: 429 };
  }
  if (err instanceof GSPAuthError) {
    // Auth failure → token is no longer valid → token_expired (UI shows
    // reconnect banner). Distinct from connection_error (network/outage).
    return { outcomeKind: 'auth_error', connectionState: 'token_expired', httpStatus: 401 };
  }
  if (err instanceof GSPGSTNOutageError) {
    return { outcomeKind: 'outage', connectionState: 'connection_error', httpStatus: 502 };
  }
  return { outcomeKind: 'error', connectionState: 'connection_error', httpStatus: 500 };
}

// ─── Internal: transition the job + config to a failure state ────────────────

async function failSync(
  jobId: string,
  configId: string | null,
  startedAt: number,
  err: unknown,
): Promise<Sync2BOutcome> {
  const message =
    err instanceof GSPError
      ? err.message
      : err instanceof Error
        ? err.message
        : 'Sync failed.';
  const mapping = mapGspError(err);
  const durationMs = Date.now() - startedAt;

  await db.gSTSyncJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      errorMessage: message.slice(0, 500),
      durationMs,
      completedAt: new Date(),
    },
  });

  if (configId) {
    await db.gSPProviderConfig.update({
      where: { id: configId },
      data: { connectionState: mapping.connectionState },
    });
  }

  const partial: Pick<Sync2BOutcome, 'jobId' | 'message'> = { jobId, message };
  switch (mapping.outcomeKind) {
    case 'rate_limited':
      return { kind: 'rate_limited', ...partial };
    case 'auth_error':
      return { kind: 'auth_error', ...partial };
    case 'outage':
      return { kind: 'outage', ...partial };
    default:
      return { kind: 'error', ...partial };
  }
}

// ─── Public: run a GSTR-2B sync ──────────────────────────────────────────────

export async function runSync2B(options: Sync2BOptions): Promise<Sync2BOutcome> {
  const startedAt = Date.now();
  const { organizationId, period, trigger = 'manual', retryOf } = options;

  // 1. Resolve provider config + credentials (or refuse with NOT_TESTED etc.).
  const resolution = await resolveProvider(organizationId);
  if (!resolution.ok) return resolution.outcome;
  const { provider, mode, gstin, configId, cfg } = resolution.resolved;

  // 2. Create the sync job (status = 'running').
  const job = await db.gSTSyncJob.create({
    data: {
      organizationId,
      configId,
      gstin,
      period,
      providerKey: cfg?.providerKey ?? 'mock',
      mode,
      status: 'running',
      trigger,
      retryOf: retryOf ?? null,
      startedAt: new Date(),
    },
  });

  // 3. Set connectionState = 'syncing' BEFORE fetching — so the UI can show a
  //    live "syncing" state even if the provider is slow.
  if (cfg) {
    try {
      await db.gSPProviderConfig.update({
        where: { id: cfg.id },
        data: { connectionState: 'syncing' },
      });
    } catch {
      /* non-fatal — don't block the sync on a state-machine update */
    }
  }

  // 4. Authenticate + fetch GSTR-2B. Both can throw typed GSP errors.
  let session: GSPSession;
  try {
    session = await provider.authenticate({
      clientId: cfg?.clientId ?? undefined,
      apikey: cfg?.apikey ?? undefined,
      clientSecret: cfg?.clientSecret ?? undefined,
      authEndpoint: cfg?.authEndpoint ?? undefined,
    });
  } catch (err) {
    return await failSync(job.id, configId, startedAt, err);
  }

  let result;
  try {
    result = await provider.fetchGSTR2B(session, gstin, period);
  } catch (err) {
    return await failSync(job.id, configId, startedAt, err);
  }

  // 5. Upsert records with per-record error isolation.
  //    - recordsImported  = NEW rows successfully created
  //    - recordsUpdated   = EXISTING rows whose values changed (== recordsChanged legacy)
  //    - recordsSkipped   = EXISTING rows whose values did NOT change
  //    - recordsFailed    = records that threw during insert/update
  //    A bad record never aborts the whole sync — Promise.allSettled swallows
  //    per-record rejections and we count them.
  const records = result.records;
  let recordsImported = 0;
  let recordsUpdated = 0;
  let recordsSkipped = 0;
  let recordsFailed = 0;

  if (records.length > 0) {
    // Fetch existing rows scoped by org + (gstin, period) + composite key.
    const existingRows = await db.gSTR2BInvoice.findMany({
      where: {
        organizationId,
        gstin,
        period,
        OR: records.map((r) => ({
          supplierGSTIN: r.supplierGSTIN,
          invoiceNo: r.invoiceNo,
        })),
      },
      select: {
        id: true,
        supplierGSTIN: true,
        invoiceNo: true,
        taxableValue: true,
        igst: true,
        cgst: true,
        sgst: true,
        cess: true,
      },
    });
    const existingMap = new Map<
      string,
      { id: string; taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }
    >();
    for (const e of existingRows) {
      existingMap.set(`${e.supplierGSTIN}||${e.invoiceNo}`, e);
    }

    // Build update + create workloads.
    const updateOps: Promise<void>[] = [];
    const toCreate: Array<{
      organizationId: string;
      gstin: string;
      period: string;
      supplierGSTIN: string;
      supplierName: string | null;
      invoiceNo: string;
      invoiceDate: string | null;
      taxableValue: number;
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
      itcAvailable: number;
      itcEligible: boolean;
      matched: boolean;
      matchStatus: string;
      source: string;
    }> = [];

    for (const rec of records) {
      const key = `${rec.supplierGSTIN}||${rec.invoiceNo}`;
      const existing = existingMap.get(key);
      if (existing) {
        // Detect value changes (the fields we mirror from the provider).
        const changed =
          existing.taxableValue !== rec.taxableValue ||
          existing.igst !== rec.igst ||
          existing.cgst !== rec.cgst ||
          existing.sgst !== rec.sgst ||
          existing.cess !== rec.cess;
        if (changed) {
          // Per-record error isolation: each update is its own promise; if it
          // rejects we increment recordsFailed (counted after allSettled).
          updateOps.push(
            db.gSTR2BInvoice
              .update({
                where: { id: existing.id },
                data: {
                  invoiceDate: rec.invoiceDate ?? null,
                  taxableValue: rec.taxableValue,
                  igst: rec.igst,
                  cgst: rec.cgst,
                  sgst: rec.sgst,
                  cess: rec.cess,
                  itcAvailable: rec.itcAvailable,
                  itcEligible: rec.itcEligible,
                  supplierName: rec.supplierName ?? null,
                  source: mode,
                },
              })
              .then(() => undefined),
          );
        } else {
          // No-op — record exists with identical values.
          recordsSkipped++;
        }
      } else {
        // New row — include organizationId + source for tenant isolation + audit.
        toCreate.push({
          organizationId,
          gstin,
          period,
          supplierGSTIN: rec.supplierGSTIN,
          supplierName: rec.supplierName ?? null,
          invoiceNo: rec.invoiceNo,
          invoiceDate: rec.invoiceDate ?? null,
          taxableValue: rec.taxableValue,
          igst: rec.igst,
          cgst: rec.cgst,
          sgst: rec.sgst,
          cess: rec.cess,
          itcAvailable: rec.itcAvailable,
          itcEligible: rec.itcEligible,
          matched: false,
          matchStatus: 'unmatched',
          source: mode,
        });
      }
    }

    // Updates: Promise.allSettled so a single bad update doesn't abort the batch.
    if (updateOps.length > 0) {
      const updateResults = await Promise.allSettled(updateOps);
      for (const r of updateResults) {
        if (r.status === 'fulfilled') recordsUpdated++;
        else recordsFailed++;
      }
    }

    // Creates: try createMany first (fast path). If the bulk insert rejects
    // (e.g. a single row fails validation), fall back to per-record creates
    // so we can isolate which rows actually failed.
    if (toCreate.length > 0) {
      try {
        await db.gSTR2BInvoice.createMany({ data: toCreate });
        recordsImported += toCreate.length;
      } catch {
        const createResults = await Promise.allSettled(
          toCreate.map((data) => db.gSTR2BInvoice.create({ data })),
        );
        for (const r of createResults) {
          if (r.status === 'fulfilled') recordsImported++;
          else recordsFailed++;
        }
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  const recordsChanged = recordsUpdated; // legacy alias (backward compat)

  // 6. Determine terminal status: 'partial' if any records failed, else 'completed'.
  const isPartial = recordsFailed > 0;
  const jobStatus: 'completed' | 'partial' = isPartial ? 'partial' : 'completed';

  await db.gSTSyncJob.update({
    where: { id: job.id },
    data: {
      status: jobStatus,
      recordsFetched: records.length,
      recordsImported,
      recordsUpdated,
      recordsSkipped,
      recordsFailed,
      recordsChanged,
      recordsRemoved: 0,
      durationMs,
      completedAt: new Date(),
    },
  });

  // 7. Persist token + connection state on the provider config.
  if (cfg) {
    const configUpdate: {
      connectionState: string;
      lastSyncAt: Date;
      tokenExpiry?: Date;
    } = {
      connectionState: isPartial ? 'partial_sync' : 'synced',
      lastSyncAt: new Date(),
    };
    if (session.expiresAt) {
      const expiresAt = new Date(session.expiresAt);
      if (!isNaN(expiresAt.getTime())) {
        configUpdate.tokenExpiry = expiresAt;
      }
    }
    try {
      await db.gSPProviderConfig.update({
        where: { id: cfg.id },
        data: configUpdate,
      });
    } catch {
      /* non-fatal — job is already marked complete */
    }
  }

  const summary: Sync2BSummary = {
    recordsFetched: records.length,
    recordsImported,
    recordsUpdated,
    recordsSkipped,
    recordsFailed,
    recordsChanged,
    recordsRemoved: 0,
    durationMs,
    mode,
    isLive: result.isLive,
    provider: provider.displayName,
    configId,
  };

  return isPartial
    ? { kind: 'partial', jobId: job.id, summary }
    : { kind: 'success', jobId: job.id, summary };
}
