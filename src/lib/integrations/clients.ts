// ═══════════════════════════════════════════════════════════════════════════════
// clients.ts — Client Database adapter (REAL — uses Prisma)
//
// Internal CRUD on the existing `Client` Prisma model. No external API, no
// credentials required. Validates GSTIN format (15-char pattern). Soft-deletes
// by setting status="inactive" — never hard-deletes (audit trail preserved).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import type { ParsedClient } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ListClientsFilter {
  search?: string // matches tradeName / legalName / gstin
  status?: string // "active" | "inactive"
  limit?: number
  offset?: number
}

export interface ClientRow {
  id: string
  gstin: string
  tradeName: string
  legalName: string | null
  address: string | null
  state: string | null
  stateCode: string | null
  contactEmail: string | null
  contactPhone: string | null
  entityType: string
  returnPeriod: string | null
  lastFilingDate: string | null
  status: string
  healthScore: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateClientInput {
  gstin: string
  tradeName: string
  legalName?: string | null
  address?: string | null
  state?: string | null
  stateCode?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  entityType?: string
  returnPeriod?: string | null
}

export type UpdateClientInput = Partial<CreateClientInput>

// ─── Validation ─────────────────────────────────────────────────────────────────

/**
 * Standard GSTIN regex: 2 digits + 5 letters + 4 digits + 1 letter + 1
 * alphanumeric + Z + 1 alphanumeric.
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export function isValidGstin(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin.toUpperCase().trim())
}

/**
 * Validate + throw on bad GSTIN. Used by createClient() and updateClient().
 */
function assertValidGstin(gstin: string): string {
  const trimmed = gstin.trim().toUpperCase()
  if (!isValidGstin(trimmed)) {
    throw new Error(
      `Invalid GSTIN format: "${gstin}". Expected 15 chars matching pattern: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric.`,
    )
  }
  return trimmed
}

// ─── Mappers ────────────────────────────────────────────────────────────────────

function toRow(c: {
  id: string
  gstin: string
  tradeName: string
  legalName: string | null
  address: string | null
  state: string | null
  stateCode: string | null
  contactEmail: string | null
  contactPhone: string | null
  entityType: string
  returnPeriod: string | null
  lastFilingDate: string | null
  status: string
  healthScore: number
  createdAt: Date
  updatedAt: Date
}): ClientRow {
  return { ...c }
}

// ─── Public adapter methods ─────────────────────────────────────────────────────

/**
 * List clients with optional search + pagination. Never throws — returns
 * empty array when no matches.
 */
export async function listClients(filter: ListClientsFilter = {}): Promise<{
  clients: ClientRow[]
  total: number
}> {
  const limit = Math.min(filter.limit ?? 50, 200)
  const offset = filter.offset ?? 0

  const where: { status?: string; OR?: Array<Record<string, unknown>> } = {}
  if (filter.status) where.status = filter.status
  if (filter.search) {
    where.OR = [
      { tradeName: { contains: filter.search } },
      { legalName: { contains: filter.search } },
      { gstin: { contains: filter.search } },
    ]
  }

  const [rows, total] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.client.count({ where }),
  ])

  return { clients: rows.map(toRow), total }
}

/**
 * Get a single client by id. Returns null when not found.
 */
export async function getClient(id: string): Promise<ClientRow | null> {
  const c = await db.client.findUnique({ where: { id } })
  return c ? toRow(c) : null
}

/**
 * Find a client by GSTIN (case-insensitive). Returns null when not found.
 */
export async function findByGstin(gstin: string): Promise<ClientRow | null> {
  const normalized = gstin.trim().toUpperCase()
  const c = await db.client.findUnique({ where: { gstin: normalized } })
  return c ? toRow(c) : null
}

/**
 * Create a new client. Validates GSTIN format; throws on duplicate GSTIN.
 */
export async function createClient(input: CreateClientInput): Promise<ClientRow> {
  const gstin = assertValidGstin(input.gstin)
  if (!input.tradeName?.trim()) {
    throw new Error('tradeName is required to create a client.')
  }

  const existing = await db.client.findUnique({ where: { gstin } })
  if (existing) {
    throw new Error(`A client with GSTIN ${gstin} already exists.`)
  }

  const created = await db.client.create({
    data: {
      gstin,
      tradeName: input.tradeName.trim(),
      legalName: input.legalName ?? null,
      address: input.address ?? null,
      state: input.state ?? null,
      stateCode: input.stateCode ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      entityType: input.entityType ?? 'regular',
      returnPeriod: input.returnPeriod ?? null,
    },
  })
  return toRow(created)
}

/**
 * Update an existing client. If `gstin` is provided it must still pass the
 * GSTIN format check. Returns the updated row.
 */
export async function updateClient(
  id: string,
  patch: UpdateClientInput,
): Promise<ClientRow> {
  const existing = await db.client.findUnique({ where: { id } })
  if (!existing) {
    throw new Error(`Client ${id} not found.`)
  }

  const data: Record<string, unknown> = {}
  if (patch.gstin !== undefined) {
    const gstin = assertValidGstin(patch.gstin)
    if (gstin !== existing.gstin) {
      const dup = await db.client.findUnique({ where: { gstin } })
      if (dup) throw new Error(`A client with GSTIN ${gstin} already exists.`)
    }
    data.gstin = gstin
  }
  if (patch.tradeName !== undefined) data.tradeName = patch.tradeName.trim()
  if (patch.legalName !== undefined) data.legalName = patch.legalName ?? null
  if (patch.address !== undefined) data.address = patch.address ?? null
  if (patch.state !== undefined) data.state = patch.state ?? null
  if (patch.stateCode !== undefined) data.stateCode = patch.stateCode ?? null
  if (patch.contactEmail !== undefined) data.contactEmail = patch.contactEmail ?? null
  if (patch.contactPhone !== undefined) data.contactPhone = patch.contactPhone ?? null
  if (patch.entityType !== undefined) data.entityType = patch.entityType
  if (patch.returnPeriod !== undefined) data.returnPeriod = patch.returnPeriod ?? null

  const updated = await db.client.update({ where: { id }, data })
  return toRow(updated)
}

/**
 * Soft-delete a client by setting status="inactive". Preserves the row for
 * audit trail. Returns void.
 */
export async function deleteClient(id: string): Promise<void> {
  const existing = await db.client.findUnique({ where: { id } })
  if (!existing) {
    throw new Error(`Client ${id} not found.`)
  }
  await db.client.update({ where: { id }, data: { status: 'inactive' } })
}

/**
 * Bulk upsert clients parsed from a spreadsheet. Matches by GSTIN; creates
 * if new, updates tradeName + contact info if existing. Returns counts.
 */
export async function upsertParsedClients(
  parsed: ParsedClient[],
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0
  let updated = 0
  let skipped = 0
  for (const p of parsed) {
    if (!p.gstin || !isValidGstin(p.gstin)) {
      skipped++
      continue
    }
    const existing = await db.client.findUnique({ where: { gstin: p.gstin.toUpperCase() } })
    if (existing) {
      await db.client.update({
        where: { id: existing.id },
        data: {
          tradeName: p.tradeName ?? existing.tradeName,
          legalName: p.legalName ?? existing.legalName,
          state: p.state ?? existing.state,
          stateCode: p.stateCode ?? existing.stateCode,
          contactEmail: p.contactEmail ?? existing.contactEmail,
          contactPhone: p.contactPhone ?? existing.contactPhone,
        },
      })
      updated++
    } else {
      await db.client.create({
        data: {
          gstin: p.gstin.toUpperCase(),
          tradeName: p.tradeName || 'Unnamed',
          legalName: p.legalName ?? null,
          state: p.state ?? null,
          stateCode: p.stateCode ?? null,
          contactEmail: p.contactEmail ?? null,
          contactPhone: p.contactPhone ?? null,
          entityType: 'regular',
        },
      })
      created++
    }
  }
  return { created, updated, skipped }
}
