import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { encryptCredentials } from '@/lib/integrations/crypto'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/connections/[key] — single Connection CRUD
//
// `key` is the Connection's id (cuid). Always redacts credentialsEnc.
//
//   GET    → one connection by id
//   PATCH  → { label?, status?, credentials?, metadata? }
//   DELETE → cascade delete (Prisma onDelete cascade for SyncJob; other
//            relations are nullable and remain — the rows keep their data
//            but lose the source link).
// ═══════════════════════════════════════════════════════════════════════════════

function redactConnection(c: {
  id: string
  firmId: string | null
  provider: string
  label: string | null
  status: string
  credentialsEnc: string | null
  metadata: string | null
  lastSyncAt: Date | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  lastSyncSummary: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: c.id,
    firmId: c.firmId,
    provider: c.provider,
    label: c.label,
    status: c.status,
    hasCredentials: !!c.credentialsEnc,
    metadata: c.metadata,
    lastSyncAt: c.lastSyncAt,
    lastSyncStatus: c.lastSyncStatus,
    lastSyncError: c.lastSyncError,
    lastSyncSummary: c.lastSyncSummary,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

interface RouteContext {
  params: Promise<{ key: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { key } = await context.params
    const conn = await db.connection.findUnique({ where: { id: key } })
    if (!conn) {
      return NextResponse.json(
        { error: 'Connection not found.' },
        { status: 404 },
      )
    }
    return NextResponse.json({ connection: redactConnection(conn) })
  } catch (error) {
    console.error('[/api/integrations/connections/[key]] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load connection.' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { key } = await context.params
    const existing = await db.connection.findUnique({ where: { id: key } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Connection not found.' },
        { status: 404 },
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 },
      )
    }

    const data: {
      label?: string | null
      status?: string
      credentialsEnc?: string | null
      metadata?: string | null
    } = {}

    if (typeof body.label === 'string') {
      data.label = body.label.trim() || null
    }

    if (typeof body.status === 'string') {
      const valid = ['disconnected', 'connecting', 'connected', 'error']
      if (!valid.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${valid.join(', ')}.` },
          { status: 400 },
        )
      }
      data.status = body.status
    }

    if (body.credentials !== undefined) {
      if (body.credentials === null) {
        data.credentialsEnc = null
        if (!('status' in data)) data.status = 'disconnected'
      } else if (typeof body.credentials === 'object') {
        try {
          data.credentialsEnc = encryptCredentials(body.credentials as object)
          if (!('status' in data)) data.status = 'connected'
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return NextResponse.json(
            { error: `Failed to encrypt credentials: ${msg}` },
            { status: 500 },
          )
        }
      }
    }

    if (body.metadata !== undefined) {
      data.metadata =
        typeof body.metadata === 'object' && body.metadata !== null
          ? JSON.stringify(body.metadata)
          : typeof body.metadata === 'string'
            ? body.metadata
            : null
    }

    const updated = await db.connection.update({
      where: { id: key },
      data,
    })
    return NextResponse.json({ connection: redactConnection(updated) })
  } catch (error) {
    console.error('[/api/integrations/connections/[key]] PATCH failed:', error)
    return NextResponse.json(
      { error: 'Failed to update connection.' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { key } = await context.params
    const existing = await db.connection.findUnique({ where: { id: key } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Connection not found.' },
        { status: 404 },
      )
    }

    // SyncJob has onDelete: cascade (the only non-nullable relation).
    // Other relations (Payment, BankTransaction, etc.) are nullable and
    // will keep their data with connectionId=null after the connection is
    // gone — this preserves audit trail.
    await db.connection.delete({ where: { id: key } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/integrations/connections/[key]] DELETE failed:', error)
    return NextResponse.json(
      { error: 'Failed to delete connection.' },
      { status: 500 },
    )
  }
}
