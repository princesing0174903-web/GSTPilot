// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books · Customer Sync Service (Phase 4)
//
// Real, production-grade customer sync against the Zoho Books REST API:
//   • listZohoCustomers()       — paginated GET /contacts?contact_type=customer
//   • createZohoCustomer()      — POST /contacts
//   • updateZohoCustomer()      — PUT /contacts/{contact_id}
//   • syncZohoCustomersIntoDb() — fetch every Zoho customer, upsert into the
//                                  ZohoCustomer Prisma table, persist a
//                                  ZohoCustomerSyncRun row with count + duration.
//
// Every network call goes through `zohoFetch` (auto-retry on 5xx/429/network,
// never-throw, returns `{ data, error, status }`). HTTP error codes are
// translated into actionable messages for the UI:
//   401 → token expired / revoked → reconnect
//   403 → permission denied / insufficient scope
//   404 → contact deleted (PUT) / not found
//   429 → rate limit — back off
//   5xx → Zoho unavailable — retry attempted, then surface
//
// SERVER-ONLY. Never import from a 'use client' file — every caller is an
// API route under /api/integrations/zoho/customers/*.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { zohoGet, zohoPost, zohoPut } from './client';
import type { ZohoContact, ZohoContactsResponse, ZohoPageContext } from './sync/types';
import { mapCustomerToClient, syntheticGstinForContact } from './sync/mapper';
import { safeAudit } from '@/lib/audit/safe-write';
import { invalidateSnapshotCache } from '@/lib/financial-engine';

// ─── Client mirror helper (Phase 5 BUG FIX) ─────────────────────────────────
//
// VEYRO's Client Registry (Prisma `Client`) is the SINGLE source of truth
// for every page that needs a customer list:
//   • GST Returns → "Create New Return" client dropdown
//   • Reconciliation, Review, AI Tasks, Audit Logs, Client Health
//   • VEYRO AI (reads db.client.findMany)
//
// Before this fix, the Phase 4 customer sync wrote ONLY to the `ZohoCustomer`
// table — so the GST Return dropdown was empty even after a successful sync.
// Now every synced Zoho customer is ALSO mirrored into `Client` (matched by
// gstin within the same firm). B2C customers (no gstin) get a synthetic key
// `ZOHO-CONTACT-{contactId}` so the unique constraint is satisfied.
//
// This is the bridge between the Zoho-synced world and the VEYRO-native world.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirror a Zoho customer into the Prisma `Client` table so every VEYRO page
 * that reads from `Client` (GST Returns, Reconciliation, Oracle, etc.) sees the
 * synced customer. Idempotent — upserts by gstin.
 */
async function mirrorZohoCustomerToClient(
  organizationId: string,
  contact: ZohoContact,
): Promise<void> {
  const normalized = mapCustomerToClient(contact, `ZOHO-ORG-${contact.contact_id}`);
  const gstin = contact.gstin?.trim() || syntheticGstinForContact(contact.contact_id);

  // Ensure a Firm bridge row exists for this organizationId so the
  // Client.firmId → Firm.id FK constraint is satisfied. Without this, the
  // upsert below fails silently (caught by the caller) and the synced customer
  // never appears in the GST Return / Reconciliation / Oracle dropdowns.
  // The modern org model uses organizationId (Firestore/preview-org); the
  // legacy Prisma Client model uses firmId → Firm.id. This bridge row unifies
  // them so a single tenant scope works across both worlds.
  try {
    await db.firm.upsert({
      where: { id: organizationId },
      create: {
        id: organizationId,
        name: contact.company_name || contact.contact_name
          ? `${contact.company_name || contact.contact_name} (Org)`
          : 'VEYRO Organization',
        subscriptionPlan: 'enterprise',
        maxClients: 100000,
        isActive: true,
      },
      update: { isActive: true },
    });
  } catch {
    /* non-fatal — Firm may already exist or org id may be a preview-mode id */
  }

  await db.client.upsert({
    where: { gstin },
    create: {
      gstin,
      tradeName: normalized.tradeName,
      legalName: normalized.legalName,
      address: normalized.address,
      state: normalized.state,
      stateCode: normalized.stateCode,
      contactEmail: normalized.contactEmail,
      contactPhone: normalized.contactPhone,
      entityType: normalized.entityType,
      status: normalized.status,
      firmId: organizationId,
    },
    update: {
      tradeName: normalized.tradeName,
      legalName: normalized.legalName,
      address: normalized.address,
      state: normalized.state,
      stateCode: normalized.stateCode,
      contactEmail: normalized.contactEmail,
      contactPhone: normalized.contactPhone,
      entityType: normalized.entityType,
      status: normalized.status,
      firmId: organizationId,
    },
  });
}

// ─── Public types ────────────────────────────────────────────────────────────

/** Normalized customer record stored in the ZohoCustomer Prisma table. */
export interface ZohoCustomerRecord {
  id: string;
  organizationId: string;
  zohoOrgId: string;
  zohoContactId: string;
  contactName: string;
  companyName: string | null;
  gstNumber: string | null;
  email: string | null;
  phone: string | null;
  currency: string | null;
  paymentTerms: number | null;
  outstandingReceivable: number;
  status: string;
  billingAddress: string | null;
  shippingAddress: string | null;
  lastSyncedAt: string;
  zohoCreatedAt: string | null;
  zohoUpdatedAt: string | null;
}

/** Payload accepted by createZohoCustomer + updateZohoCustomer. */
export interface ZohoCustomerInput {
  contactName: string;
  companyName?: string | null;
  gstNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  currency?: string | null;
  paymentTerms?: number | null;
  billingAddress?: ZohoContactAddress | null;
  shippingAddress?: ZohoContactAddress | null;
}

export interface ZohoContactAddress {
  attention?: string;
  address?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

/** Result of a customer-sync run. */
export interface CustomerSyncResult {
  ok: boolean;
  status: 'completed' | 'partial' | 'failed';
  totalFetched: number;
  imported: number;
  updated: number;
  failed: number;
  durationMs: number;
  lastSyncedAt: string;
  error: string | null;
  syncRunId: string;
}

/** Result of a single create/update operation. */
export interface CustomerWriteResult {
  ok: boolean;
  httpStatus: number;
  customer: ZohoCustomerRecord | null;
  error: string | null;
  zohoCode: number | null;
  zohoMessage: string | null;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

interface ZohoContactDetailResponse {
  code?: number;
  message?: string;
  contact?: ZohoContact;
}

interface ZohoApiErrorBody {
  code?: number;
  message?: string;
}

/** Build a human-readable, actionable error message from an HTTP status + body. */
function describeHttpError(
  status: number,
  rawError: string | null,
  zohoBody: ZohoApiErrorBody | null,
  context: 'fetch' | 'create' | 'update',
): string {
  const ctxVerb =
    context === 'fetch' ? 'fetching customers' :
    context === 'create' ? 'creating customer' :
    'updating customer';

  let msg: string;
  switch (status) {
    case 401:
      msg = `Zoho rejected the access token while ${ctxVerb} (HTTP 401). The token has expired or been revoked. Click "Refresh Token" or reconnect Zoho Books.`;
      break;
    case 403:
      msg = `Zoho denied permission while ${ctxVerb} (HTTP 403). The connected user lacks the required role/scope for this organization.`;
      break;
    case 404:
      msg = `Zoho customer was not found (HTTP 404) while ${ctxVerb}. It may have been deleted in Zoho Books. Refresh the customer list and try again.`;
      break;
    case 429:
      msg = `Zoho API rate limit exceeded while ${ctxVerb} (HTTP 429). Wait a minute and retry.`;
      break;
    default:
      if (status >= 500) {
        msg = `Zoho Books server error while ${ctxVerb} (HTTP ${status}). The Zoho API is temporarily unavailable. Try again shortly.`;
      } else if (status > 0) {
        msg = `Zoho Books API returned HTTP ${status} while ${ctxVerb}.`;
      } else {
        msg = `Network error while ${ctxVerb}: ${rawError ?? 'unknown error'}`;
      }
  }

  if (zohoBody?.code || zohoBody?.message) {
    msg += ` Zoho error ${zohoBody.code ?? '?'}: ${zohoBody.message ?? 'No message.'}`;
  } else if (rawError) {
    msg += ` Detail: ${rawError.slice(0, 300)}`;
  }
  return msg;
}

/** Pick the primary contact person's email + phone from a Zoho contact. */
function pickPrimaryContact(c: ZohoContact): { email: string | null; phone: string | null } {
  const primary = c.contact_persons?.find((p) => p.is_primary_contact) ?? c.contact_persons?.[0];
  return {
    email: primary?.email ?? c.email ?? null,
    phone: primary?.phone ?? c.phone ?? null,
  };
}

/** Convert a ZohoContact (API shape) → ZohoCustomerRecord (DB shape). */
function toDbRecord(
  row: {
    id: string;
    organizationId: string;
    zohoOrgId: string;
    zohoContactId: string;
    contactName: string;
    companyName: string | null;
    gstNumber: string | null;
    email: string | null;
    phone: string | null;
    currency: string | null;
    paymentTerms: number | null;
    outstandingReceivable: number;
    status: string;
    billingAddress: string | null;
    shippingAddress: string | null;
    lastSyncedAt: Date;
    zohoCreatedAt: Date | null;
    zohoUpdatedAt: Date | null;
  },
): ZohoCustomerRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    zohoOrgId: row.zohoOrgId,
    zohoContactId: row.zohoContactId,
    contactName: row.contactName,
    companyName: row.companyName,
    gstNumber: row.gstNumber,
    email: row.email,
    phone: row.phone,
    currency: row.currency,
    paymentTerms: row.paymentTerms,
    outstandingReceivable: row.outstandingReceivable,
    status: row.status,
    billingAddress: row.billingAddress,
    shippingAddress: row.shippingAddress,
    lastSyncedAt: row.lastSyncedAt.toISOString(),
    zohoCreatedAt: row.zohoCreatedAt ? row.zohoCreatedAt.toISOString() : null,
    zohoUpdatedAt: row.zohoUpdatedAt ? row.zohoUpdatedAt.toISOString() : null,
  };
}

/** Build the JSON payload for POST/PUT /contacts from a ZohoCustomerInput. */
function buildZohoPayload(input: ZohoCustomerInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    contact_name: input.contactName,
    contact_type: 'customer',
  };
  if (input.companyName) payload.company_name = input.companyName;
  if (input.gstNumber) payload.gstin = input.gstNumber;
  if (input.currency) payload.currency_code = input.currency;
  if (typeof input.paymentTerms === 'number') payload.payment_terms = input.paymentTerms;

  // Contact persons — Zoho requires at least one with an email for invoicing.
  const persons: Record<string, unknown>[] = [];
  if (input.email || input.phone) {
    persons.push({
      first_name: input.contactName,
      email: input.email ?? undefined,
      phone: input.phone ?? undefined,
      is_primary_contact: true,
    });
  }
  if (persons.length > 0) payload.contact_persons = persons;

  if (input.billingAddress) payload.billing_address = input.billingAddress;
  if (input.shippingAddress) payload.shipping_address = input.shippingAddress;

  return payload;
}

// ─── List (paginated GET /contacts?contact_type=customer) ────────────────────

/**
 * Fetch every customer (contact_type=customer) from Zoho Books, paginating
 * through `page_context.next_token`. Returns `{ contacts, error, status }`.
 *
 * The caller (syncZohoCustomersIntoDb) writes the contacts into the DB.
 *
 * Caps at 10000 records + 100 pages as a safety valve.
 */
export async function listZohoCustomers(
  accessToken: string,
  zohoOrgId: string,
  opts?: { maxPages?: number; perPage?: number },
): Promise<{
  contacts: ZohoContact[];
  error: string | null;
  status: number;
}> {
  const maxPages = opts?.maxPages ?? 100;
  const perPage = opts?.perPage ?? 200;
  const all: ZohoContact[] = [];
  let cursor: string | null = null;
  let lastStatus = 0;
  let lastError: string | null = null;
  let pages = 0;

  while (pages < maxPages) {
    const qp = new URLSearchParams({
      contact_type: 'customer',
      per_page: String(perPage),
    });
    if (cursor) qp.set('page_token', cursor);

    const path = `/contacts?${qp.toString()}`;
    const res = await zohoGet<ZohoContactsResponse>(path, accessToken, {
      organizationId: zohoOrgId,
    });

    lastStatus = res.status;

    if (res.error || !res.data) {
      // Parse the embedded Zoho error body if present (for richer messaging).
      let zohoBody: ZohoApiErrorBody | null = null;
      if (res.data) {
        zohoBody = {
          code: (res.data as unknown as ZohoApiErrorBody).code,
          message: (res.data as unknown as ZohoApiErrorBody).message,
        };
      }
      lastError = describeHttpError(res.status, res.error, zohoBody, 'fetch');
      // 429/5xx were retried inside zohoFetch; if we still failed, return what
      // we have (partial result) plus the error.
      return { contacts: all, error: lastError, status: res.status };
    }

    const batch = res.data.contacts ?? [];
    all.push(...batch);
    pages++;

    const ctx: ZohoPageContext | undefined = res.data.page_context;
    if (!ctx?.has_more_page || !ctx?.next_token) {
      return { contacts: all, error: null, status: 200 };
    }
    cursor = ctx.next_token;
  }

  // Safety cap reached — return partial result with a notice.
  return {
    contacts: all,
    error: `Reached max-pages safety cap (${maxPages}). Additional customers may exist in Zoho Books.`,
    status: 200,
  };
}

// ─── Sync (fetch + upsert into DB + persist run log) ─────────────────────────

/**
 * Sync every customer from Zoho Books into the ZohoCustomer table.
 *
 * Behavior:
 *   1. Creates a ZohoCustomerSyncRun row (status=running).
 *   2. Calls listZohoCustomers() — paginated GET /contacts?contact_type=customer.
 *   3. For each contact: upsert by (organizationId, zohoOrgId, zohoContactId).
 *      Counts imported vs updated based on whether the row existed before.
 *   4. Updates the sync-run row with final counts + duration + status.
 *   5. Audits the sync (best-effort).
 *
 * Status:
 *   • completed — all contacts upserted, no errors
 *   • partial   — some contacts upserted, but listZohoCustomers returned an
 *                 error (e.g. rate limit mid-pagination) OR some rows failed
 *   • failed    — listZohoCustomers failed on the first page (zero records
 *                 fetched) OR an unexpected exception was thrown
 *
 * Never throws. Returns CustomerSyncResult.
 */
export async function syncZohoCustomersIntoDb(opts: {
  organizationId: string;
  userId: string | null;
  userEmail?: string | null;
  zohoOrgId: string;
  accessToken: string;
  trigger?: 'manual' | 'auto';
}): Promise<CustomerSyncResult> {
  const startedAt = Date.now();
  const trigger = opts.trigger ?? 'manual';
  const now = new Date();

  // 1. Create the sync-run row (status=running).
  const syncRun = await db.zohoCustomerSyncRun.create({
    data: {
      organizationId: opts.organizationId,
      userId: opts.userId,
      zohoOrgId: opts.zohoOrgId,
      trigger,
      status: 'running',
      startedAt: now,
    },
  });

  const finish = async (
    result: Omit<CustomerSyncResult, 'lastSyncedAt' | 'syncRunId'>,
  ): Promise<CustomerSyncResult> => {
    const completedAt = new Date();
    const durationMs = Date.now() - startedAt;
    await db.zohoCustomerSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: result.status,
        totalFetched: result.totalFetched,
        imported: result.imported,
        updated: result.updated,
        failed: result.failed,
        durationMs,
        error: result.error,
        completedAt,
      },
    });

    // Best-effort audit.
    try {
      await safeAudit({
        userId: opts.userId,
        action:
          result.status === 'completed'
            ? 'ZOHO_CUSTOMER_SYNC_COMPLETED'
            : result.status === 'partial'
            ? 'ZOHO_CUSTOMER_SYNC_PARTIAL'
            : 'ZOHO_CUSTOMER_SYNC_FAILED',
        entity: 'ZohoCustomerSyncRun',
        entityId: syncRun.id,
        details: `Trigger=${trigger} | fetched=${result.totalFetched} imported=${result.imported} updated=${result.updated} failed=${result.failed} duration=${durationMs}ms${result.error ? ` | error=${result.error.slice(0, 200)}` : ''}`,
      });
    } catch {
      /* non-fatal */
    }

    return {
      ...result,
      durationMs,
      lastSyncedAt: completedAt.toISOString(),
      syncRunId: syncRun.id,
    };
  };

  // 2. Fetch every customer from Zoho.
  let fetched: ZohoContact[];
  try {
    const list = await listZohoCustomers(opts.accessToken, opts.zohoOrgId);
    fetched = list.contacts;
    // If the very first page failed AND we have zero records → failed.
    if (list.error && fetched.length === 0) {
      return await finish({
        ok: false,
        status: 'failed',
        totalFetched: 0,
        imported: 0,
        updated: 0,
        failed: 0,
        error: list.error,
      });
    }
    // If we have some records but also an error → we'll mark as partial below.
    const listError = list.error;

    // 3. Upsert each contact.
    let imported = 0;
    let updated = 0;
    let failed = 0;
    let firstRowError: string | null = null;

    for (const c of fetched) {
      try {
        if (!c.contact_id || !c.contact_name) {
          // Skip malformed records — Zoho should always have these.
          failed++;
          continue;
        }
        const { email, phone } = pickPrimaryContact(c);
        const existing = await db.zohoCustomer.findUnique({
          where: {
            organizationId_zohoOrgId_zohoContactId: {
              organizationId: opts.organizationId,
              zohoOrgId: opts.zohoOrgId,
              zohoContactId: c.contact_id,
            },
          },
          select: { id: true },
        });

        const data = {
          contactName: c.contact_name,
          companyName: c.company_name ?? null,
          gstNumber: c.gstin ?? null,
          email,
          phone,
          currency: c.currency_code ?? null,
          paymentTerms: null, // Zoho's contact-level payment_terms isn't on the list shape; we leave null on sync (set on manual create/edit)
          outstandingReceivable: c.outstanding_receivable_amount ?? 0,
          status: c.status ?? 'active',
          billingAddress: c.billing_address ? JSON.stringify(c.billing_address) : null,
          shippingAddress: c.shipping_address ? JSON.stringify(c.shipping_address) : null,
          lastSyncedAt: new Date(),
          zohoCreatedAt: c.created_time ? new Date(c.created_time) : null,
          zohoUpdatedAt: c.last_modified_time ? new Date(c.last_modified_time) : null,
        };

        if (existing) {
          await db.zohoCustomer.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await db.zohoCustomer.create({
            data: {
              organizationId: opts.organizationId,
              zohoOrgId: opts.zohoOrgId,
              zohoContactId: c.contact_id,
              ...data,
            },
          });
          imported++;
        }

        // Mirror into the Client table so every VEYRO page (GST Returns,
        // Reconciliation, Oracle, Client Health, etc.) sees this customer.
        // Best-effort — a failure here does NOT fail the ZohoCustomer upsert.
        try {
          await mirrorZohoCustomerToClient(opts.organizationId, c);
        } catch {
          /* non-fatal — Client mirror is best-effort */
        }
      } catch (err) {
        failed++;
        if (!firstRowError) {
          firstRowError = err instanceof Error ? err.message : 'Failed to upsert customer.';
        }
        // Continue — one bad row shouldn't abort the batch.
      }
    }

    // 4. Determine final status.
    const rowError = firstRowError && failed > 0 ? `${failed} record(s) failed: ${firstRowError}` : null;
    const finalError = [listError, rowError].filter(Boolean).join(' | ') || null;
    const status: CustomerSyncResult['status'] =
      finalError ? (imported + updated > 0 ? 'partial' : 'failed') : 'completed';

    return await finish({
      ok: status !== 'failed',
      status,
      totalFetched: fetched.length,
      imported,
      updated,
      failed,
      error: finalError,
    });
  } catch (err) {
    // Unexpected exception — mark the run failed.
    const msg = err instanceof Error ? err.message : 'Unexpected error during customer sync.';
    return await finish({
      ok: false,
      status: 'failed',
      totalFetched: 0,
      imported: 0,
      updated: 0,
      failed: 0,
      error: msg,
    });
  }
}

// ─── Create (POST /contacts) ─────────────────────────────────────────────────

/**
 * Create a customer inside Zoho Books (POST /contacts), then save the returned
 * contact_id + normalized fields into the ZohoCustomer table.
 *
 * Returns CustomerWriteResult with the new ZohoCustomerRecord on success.
 */
export async function createZohoCustomer(opts: {
  organizationId: string;
  userId: string | null;
  zohoOrgId: string;
  accessToken: string;
  input: ZohoCustomerInput;
}): Promise<CustomerWriteResult> {
  const payload = buildZohoPayload(opts.input);

  const res = await zohoPost<ZohoContactDetailResponse & ZohoApiErrorBody>(
    '/contacts',
    opts.accessToken,
    {
      organizationId: opts.zohoOrgId,
      body: JSON.stringify(payload),
    },
  );

  if (res.error || !res.data || !res.data.contact) {
    const zohoBody = res.data ?? null;
    return {
      ok: false,
      httpStatus: res.status,
      customer: null,
      error: describeHttpError(res.status, res.error, zohoBody, 'create'),
      zohoCode: zohoBody?.code ?? null,
      zohoMessage: zohoBody?.message ?? null,
    };
  }

  const c = res.data.contact;
  const { email, phone } = pickPrimaryContact(c);

  // Persist into our DB.
  try {
    const row = await db.zohoCustomer.create({
      data: {
        organizationId: opts.organizationId,
        zohoOrgId: opts.zohoOrgId,
        zohoContactId: c.contact_id,
        contactName: c.contact_name,
        companyName: c.company_name ?? null,
        gstNumber: c.gstin ?? opts.input.gstNumber ?? null,
        email,
        phone,
        currency: c.currency_code ?? opts.input.currency ?? null,
        paymentTerms: opts.input.paymentTerms ?? null,
        outstandingReceivable: c.outstanding_receivable_amount ?? 0,
        status: c.status ?? 'active',
        billingAddress: c.billing_address ? JSON.stringify(c.billing_address) : null,
        shippingAddress: c.shipping_address ? JSON.stringify(c.shipping_address) : null,
        lastSyncedAt: new Date(),
        zohoCreatedAt: c.created_time ? new Date(c.created_time) : null,
        zohoUpdatedAt: c.last_modified_time ? new Date(c.last_modified_time) : null,
      },
    });

    try {
      await safeAudit({
        userId: opts.userId,
        action: 'ZOHO_CUSTOMER_CREATED',
        entity: 'ZohoCustomer',
        entityId: row.id,
        newValue: `contact_id=${c.contact_id} name=${c.contact_name}`,
      });
    } catch {
      /* non-fatal */
    }

    // Mirror into the Client table so GST Returns + Oracle see this customer.
    try {
      await mirrorZohoCustomerToClient(opts.organizationId, c);
    } catch {
      /* non-fatal — Client mirror is best-effort */
    }

    // Invalidate the server-side business snapshot cache so the next
    // /api/business/snapshot request recomputes the customer count from
    // the fresh DB state (the client hook also fires a window event).
    try {
      invalidateSnapshotCache(opts.organizationId);
    } catch {
      /* non-fatal — cache invalidation is best-effort */
    }

    return {
      ok: true,
      httpStatus: 200,
      customer: toDbRecord(row),
      error: null,
      zohoCode: null,
      zohoMessage: null,
    };
  } catch (err) {
    return {
      ok: false,
      httpStatus: 200,
      customer: null,
      error: `Customer created in Zoho (contact_id=${c.contact_id}) but failed to save locally: ${err instanceof Error ? err.message : 'unknown error'}`,
      zohoCode: null,
      zohoMessage: null,
    };
  }
}

// ─── Update (PUT /contacts/{contact_id}) ─────────────────────────────────────

/**
 * Update an existing customer inside Zoho Books (PUT /contacts/{contact_id}),
 * then refresh the local ZohoCustomer row.
 *
 * If the local row doesn't exist (rare — should have been synced), we look up
 * the Zoho contact_id from the input. The local row is upserted.
 */
export async function updateZohoCustomer(opts: {
  organizationId: string;
  userId: string | null;
  zohoOrgId: string;
  accessToken: string;
  zohoContactId: string;
  input: ZohoCustomerInput;
}): Promise<CustomerWriteResult> {
  const payload = buildZohoPayload(opts.input);

  const res = await zohoPut<ZohoContactDetailResponse & ZohoApiErrorBody>(
    `/contacts/${opts.zohoContactId}`,
    opts.accessToken,
    {
      organizationId: opts.zohoOrgId,
      body: JSON.stringify(payload),
    },
  );

  if (res.error || !res.data || !res.data.contact) {
    const zohoBody = res.data ?? null;
    return {
      ok: false,
      httpStatus: res.status,
      customer: null,
      error: describeHttpError(res.status, res.error, zohoBody, 'update'),
      zohoCode: zohoBody?.code ?? null,
      zohoMessage: zohoBody?.message ?? null,
    };
  }

  const c = res.data.contact;
  const { email, phone } = pickPrimaryContact(c);

  try {
    // Upsert by (organizationId, zohoOrgId, zohoContactId) — handles the rare
    // case where the local row was deleted but the customer still exists in Zoho.
    const row = await db.zohoCustomer.upsert({
      where: {
        organizationId_zohoOrgId_zohoContactId: {
          organizationId: opts.organizationId,
          zohoOrgId: opts.zohoOrgId,
          zohoContactId: c.contact_id,
        },
      },
      create: {
        organizationId: opts.organizationId,
        zohoOrgId: opts.zohoOrgId,
        zohoContactId: c.contact_id,
        contactName: c.contact_name,
        companyName: c.company_name ?? null,
        gstNumber: c.gstin ?? opts.input.gstNumber ?? null,
        email,
        phone,
        currency: c.currency_code ?? opts.input.currency ?? null,
        paymentTerms: opts.input.paymentTerms ?? null,
        outstandingReceivable: c.outstanding_receivable_amount ?? 0,
        status: c.status ?? 'active',
        billingAddress: c.billing_address ? JSON.stringify(c.billing_address) : null,
        shippingAddress: c.shipping_address ? JSON.stringify(c.shipping_address) : null,
        lastSyncedAt: new Date(),
        zohoCreatedAt: c.created_time ? new Date(c.created_time) : null,
        zohoUpdatedAt: c.last_modified_time ? new Date(c.last_modified_time) : null,
      },
      update: {
        contactName: c.contact_name,
        companyName: c.company_name ?? null,
        gstNumber: c.gstin ?? opts.input.gstNumber ?? null,
        email,
        phone,
        currency: c.currency_code ?? opts.input.currency ?? null,
        paymentTerms: opts.input.paymentTerms ?? null,
        outstandingReceivable: c.outstanding_receivable_amount ?? 0,
        status: c.status ?? 'active',
        billingAddress: c.billing_address ? JSON.stringify(c.billing_address) : null,
        shippingAddress: c.shipping_address ? JSON.stringify(c.shipping_address) : null,
        lastSyncedAt: new Date(),
        zohoUpdatedAt: c.last_modified_time ? new Date(c.last_modified_time) : null,
      },
    });

    try {
      await safeAudit({
        userId: opts.userId,
        action: 'ZOHO_CUSTOMER_UPDATED',
        entity: 'ZohoCustomer',
        entityId: row.id,
        newValue: `contact_id=${c.contact_id} name=${c.contact_name}`,
      });
    } catch {
      /* non-fatal */
    }

    // Mirror the update into the Client table.
    try {
      await mirrorZohoCustomerToClient(opts.organizationId, c);
    } catch {
      /* non-fatal — Client mirror is best-effort */
    }

    // Invalidate the server-side business snapshot cache.
    try {
      invalidateSnapshotCache(opts.organizationId);
    } catch {
      /* non-fatal */
    }

    return {
      ok: true,
      httpStatus: 200,
      customer: toDbRecord(row),
      error: null,
      zohoCode: null,
      zohoMessage: null,
    };
  } catch (err) {
    return {
      ok: false,
      httpStatus: 200,
      customer: null,
      error: `Customer updated in Zoho (contact_id=${c.contact_id}) but failed to save locally: ${err instanceof Error ? err.message : 'unknown error'}`,
      zohoCode: null,
      zohoMessage: null,
    };
  }
}

// ─── DB read helpers (used by the GET /api/integrations/zoho/customers route) ─

/**
 * List ZohoCustomer rows for the (organizationId, zohoOrgId) pair, with
 * optional search + pagination. Returns rows newest-synced-first.
 */
export async function listLocalCustomers(opts: {
  organizationId: string;
  zohoOrgId: string;
  search?: string | null;
  status?: 'active' | 'inactive' | 'all';
  limit?: number;
  offset?: number;
}): Promise<{ rows: ZohoCustomerRecord[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where: {
    organizationId: string;
    zohoOrgId: string;
    status?: string;
    OR?: Array<Record<string, unknown>>;
  } = {
    organizationId: opts.organizationId,
    zohoOrgId: opts.zohoOrgId,
  };
  if (opts.status && opts.status !== 'all') where.status = opts.status;
  if (opts.search && opts.search.trim()) {
    const q = opts.search.trim();
    where.OR = [
      { contactName: { contains: q } },
      { companyName: { contains: q } },
      { gstNumber: { contains: q } },
      { email: { contains: q } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.zohoCustomer.findMany({
      where,
      orderBy: { lastSyncedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.zohoCustomer.count({ where }),
  ]);

  return { rows: rows.map(toDbRecord), total };
}

/** Get the most-recent sync-run row for the (org, zohoOrgId) pair. */
export async function getLatestCustomerSyncRun(opts: {
  organizationId: string;
  zohoOrgId: string;
}): Promise<{
  id: string;
  trigger: string;
  status: string;
  totalFetched: number;
  imported: number;
  updated: number;
  failed: number;
  durationMs: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
} | null> {
  const row = await db.zohoCustomerSyncRun.findFirst({
    where: { organizationId: opts.organizationId, zohoOrgId: opts.zohoOrgId },
    orderBy: { startedAt: 'desc' },
    take: 1,
  });
  if (!row) return null;
  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    totalFetched: row.totalFetched,
    imported: row.imported,
    updated: row.updated,
    failed: row.failed,
    durationMs: row.durationMs,
    error: row.error,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

/** Read the auto-sync toggle for the (org, user) pair from the token row. */
export async function getAutoSyncFlag(opts: {
  organizationId: string;
  userId: string;
}): Promise<{ enabled: boolean; intervalMinutes: number } | null> {
  const row = await db.zohoBooksToken.findUnique({
    where: {
      organizationId_userId: {
        organizationId: opts.organizationId,
        userId: opts.userId,
      },
    },
    select: { autoSyncCustomers: true, autoSyncIntervalMinutes: true, revokedAt: true },
  });
  if (!row || row.revokedAt) return null;
  return { enabled: row.autoSyncCustomers, intervalMinutes: row.autoSyncIntervalMinutes };
}

/** Persist the auto-sync toggle for the (org, user) pair. */
export async function setAutoSyncFlag(opts: {
  organizationId: string;
  userId: string;
  enabled: boolean;
  intervalMinutes?: number;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    await db.zohoBooksToken.update({
      where: {
        organizationId_userId: {
          organizationId: opts.organizationId,
          userId: opts.userId,
        },
      },
      data: {
        autoSyncCustomers: opts.enabled,
        ...(typeof opts.intervalMinutes === 'number' && opts.intervalMinutes > 0
          ? { autoSyncIntervalMinutes: opts.intervalMinutes }
          : {}),
      },
    });
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update auto-sync setting.',
    };
  }
}
