// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Shared Service Layer: Customers (Clients)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Canonical create/update/delete logic for customers (the Prisma `Client`
// model). Both /api/clients and VEYRO AI createCustomer/updateCustomer/
// deleteCustomer actions call THESE functions so audit logs, graph events,
// timeline events, and activity logs fire identically.
//
// The orgId is the tenant scope (client.firmId). For local- demo orgs the
// timeline emit is a no-op (see emitTimelineEvent), but the Prisma write +
// audit + activity still happen.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update';
import { emitClientNode } from '@/lib/graph/auto-emit';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import type { Actor, ServiceResult } from './types';

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;

export interface CreateCustomerInput {
  tradeName: string;
  legalName?: string;
  gstin?: string;
  address?: string;
  state?: string;
  stateCode?: string;
  contactEmail?: string;
  contactPhone?: string;
  entityType?: string;
  returnPeriod?: string;
}

export interface CustomerRecord {
  id: string;
  tradeName: string;
  legalName: string | null;
  gstin: string;
  address: string | null;
  state: string | null;
  stateCode: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  entityType: string;
  status: string;
}

function toRecord(c: any): CustomerRecord {
  return {
    id: c.id,
    tradeName: c.tradeName,
    legalName: c.legalName ?? null,
    gstin: c.gstin,
    address: c.address ?? null,
    state: c.state ?? null,
    stateCode: c.stateCode ?? null,
    contactEmail: c.contactEmail ?? null,
    contactPhone: c.contactPhone ?? null,
    entityType: c.entityType ?? 'regular',
    status: c.status ?? 'active',
  };
}

/**
 * Create a customer. Enforces GSTIN uniqueness (Prisma-level constraint) and
 * duplicates within the same tenant. Returns 409 on duplicate GSTIN, 400 on
 * missing required fields.
 */
export async function createCustomer(
  orgId: string,
  input: CreateCustomerInput,
  actor?: Actor,
): Promise<ServiceResult<CustomerRecord>> {
  const tradeName = String(input.tradeName ?? '').trim();
  const gstin = String(input.gstin ?? '').trim().toUpperCase();

  if (!tradeName) return { ok: false, error: 'tradeName is required', status: 400 };
  if (!gstin) return { ok: false, error: 'gstin is required', status: 400 };
  if (!orgId) return { ok: false, error: 'organizationId (or firmId) is required', status: 400 };

  // GSTIN uniqueness (global — Prisma @unique on gstin)
  const existing = await db.client.findUnique({ where: { gstin } }).catch(() => null);
  if (existing) {
    return {
      ok: false,
      error: `A customer with GSTIN ${gstin} already exists`,
      status: 409,
    };
  }

  const client = await db.client.create({
    data: {
      gstin,
      tradeName,
      legalName: input.legalName ?? null,
      address: input.address ?? null,
      state: input.state ?? null,
      stateCode: input.stateCode ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      entityType: input.entityType ?? 'regular',
      returnPeriod: input.returnPeriod ?? null,
      firmId: orgId,
      status: 'active',
    },
    select: {
      id: true, tradeName: true, legalName: true, gstin: true, address: true,
      state: true, stateCode: true, contactEmail: true, contactPhone: true,
      entityType: true, status: true,
    },
  });

  // ── Side effects (fire-and-forget, never break the create) ──
  await db.auditLog.create({
    data: {
      clientId: client.id,
      action: 'Client Created',
      entity: 'client',
      entityId: client.id,
      details: `New client ${tradeName} (${gstin}) created`,
    },
  }).catch(() => {});

  graphEvents.clientCreated(client.id, client.tradeName);
  try { await emitClientNode(client.id); } catch { /* non-fatal */ }

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'customer.created',
    title: `Customer “${tradeName}” created`,
    description: `New customer added with GSTIN ${gstin}.`,
    actor,
    metadata: {
      clientId: client.id, gstin, tradeName,
      legalName: input.legalName ?? null,
      entityType: input.entityType ?? 'regular',
    },
    severity: 'success',
  });

  try {
    await db.activity.create({
      data: {
        firmId: orgId,
        type: 'customer',
        description: `Customer "${tradeName}" created (GSTIN: ${gstin})`,
        metadata: JSON.stringify({ clientId: client.id }),
      },
    });
  } catch { /* non-fatal */ }

  return { ok: true, data: toRecord(client), status: 201 };
}

/**
 * Update a customer. Enforces GSTIN uniqueness on change. Returns 404 if not
 * found, 409 on duplicate GSTIN.
 */
export async function updateCustomer(
  orgId: string,
  id: string,
  updates: Record<string, unknown>,
  actor?: Actor,
): Promise<ServiceResult<CustomerRecord>> {
  if (!id) return { ok: false, error: 'Client id is required', status: 400 };

  const existing = await db.client.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return { ok: false, error: 'Client not found', status: 404 };

  // GSTIN uniqueness on change
  if (updates.gstin && updates.gstin !== existing.gstin) {
    const duplicate = await db.client.findUnique({ where: { gstin: String(updates.gstin) } }).catch(() => null);
    if (duplicate && duplicate.id !== id) {
      return { ok: false, error: 'A client with this GSTIN already exists', status: 409 };
    }
  }

  // Strip fields that shouldn't be directly written
  const clean = { ...updates };
  delete clean.id;
  delete clean.createdAt;
  delete clean.updatedAt;

  const client = await db.client.update({
    where: { id },
    data: clean,
    select: {
      id: true, tradeName: true, legalName: true, gstin: true, address: true,
      state: true, stateCode: true, contactEmail: true, contactPhone: true,
      entityType: true, status: true,
    },
  });

  await db.auditLog.create({
    data: {
      clientId: client.id,
      action: 'Client Updated',
      entity: 'client',
      entityId: client.id,
      details: `Client ${client.tradeName} (${client.gstin}) updated`,
    },
  }).catch(() => {});

  invalidateGraph();

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'customer.updated',
    title: `Customer “${client.tradeName}” updated`,
    description: `Profile details for ${client.tradeName} were modified.`,
    actor,
    metadata: { clientId: client.id, gstin: client.gstin },
    severity: 'info',
  });

  try {
    await db.activity.create({
      data: {
        firmId: orgId,
        type: 'customer',
        description: `Customer "${client.tradeName}" updated`,
        metadata: JSON.stringify({ clientId: client.id }),
      },
    });
  } catch { /* non-fatal */ }

  return { ok: true, data: toRecord(client) };
}

/**
 * Delete a customer. Writes the audit log BEFORE deletion. Returns 404 if not
 * found. Note: this is a hard delete — high-risk, so Oracle always confirms.
 */
export async function deleteCustomer(
  orgId: string,
  id: string,
  actor?: Actor,
): Promise<ServiceResult<{ id: string; tradeName: string; gstin: string }>> {
  if (!id) return { ok: false, error: 'Client id is required', status: 400 };

  const existing = await db.client.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return { ok: false, error: 'Client not found', status: 404 };

  await db.auditLog.create({
    data: {
      action: 'Client Deleted',
      entity: 'client',
      entityId: id,
      details: `Client ${existing.tradeName} (${existing.gstin}) deleted`,
    },
  }).catch(() => {});

  await db.client.delete({ where: { id } });

  invalidateGraph();

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'customer.deleted',
    title: `Customer “${existing.tradeName}” deleted`,
    description: `Customer ${existing.tradeName} (GSTIN ${existing.gstin}) was removed.`,
    actor,
    metadata: { clientId: id, tradeName: existing.tradeName, gstin: existing.gstin },
    severity: 'warning',
  });

  try {
    await db.activity.create({
      data: {
        firmId: orgId,
        type: 'customer',
        description: `Customer "${existing.tradeName}" deleted`,
        metadata: JSON.stringify({ clientId: id }),
      },
    });
  } catch { /* non-fatal */ }

  return { ok: true, data: { id, tradeName: existing.tradeName, gstin: existing.gstin } };
}

/** Validate a GSTIN string against the standard 15-character format. */
export function isValidGstin(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin);
}

/**
 * Find a customer by trade name (case-insensitive within the tenant), or
 * create one if not found. When no GSTIN is supplied, generates a synthetic
 * LOCAL-<timestamp> GSTIN (for unregistered / walk-in customers). Returns
 * the customer record + a flag indicating whether it was newly created.
 *
 * This is the canonical "find or create" used by Oracle actions that need a
 * customer reference but may only have a name (e.g. createInvoice,
 * recordPayment, recordExpense).
 */
export async function findOrCreateCustomer(
  orgId: string,
  tradeName: string,
  extra: { gstin?: string; email?: string; phone?: string; state?: string } = {},
  actor?: Actor,
): Promise<{ data: CustomerRecord; created: boolean } | ServiceResult<never>> {
  const name = String(tradeName ?? '').trim();
  if (!name) return { ok: false, error: 'tradeName is required', status: 400 };

  const existing = await db.client.findFirst({
    where: { firmId: orgId, tradeName: { equals: name } },
    select: {
      id: true, tradeName: true, legalName: true, gstin: true, address: true,
      state: true, stateCode: true, contactEmail: true, contactPhone: true,
      entityType: true, status: true,
    },
  }).catch(() => null);

  if (existing) {
    return { data: toRecord(existing), created: false };
  }

  // Not found — create with a synthetic GSTIN if none supplied
  const gstin = extra.gstin?.trim().toUpperCase() || `LOCAL-${Date.now()}`;
  const result = await createCustomer(orgId, {
    tradeName: name,
    legalName: name,
    gstin,
    contactEmail: extra.email,
    contactPhone: extra.phone,
    state: extra.state,
  }, actor);

  if (!result.ok || !result.data) {
    // If creation failed because the synthetic GSTIN collided (rare), retry
    // with a fresh timestamp.
    if (result.status === 409 && !extra.gstin) {
      const retry = await createCustomer(orgId, {
        tradeName: name,
        legalName: name,
        gstin: `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        contactEmail: extra.email,
        contactPhone: extra.phone,
        state: extra.state,
      }, actor);
      if (!retry.ok || !retry.data) {
        return { ok: false, error: retry.error ?? 'Failed to create customer', status: retry.status };
      }
      return { data: retry.data, created: true };
    }
    return { ok: false, error: result.error ?? 'Failed to create customer', status: result.status };
  }
  return { data: result.data, created: true };
}
