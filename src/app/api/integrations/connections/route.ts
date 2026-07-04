import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { encryptCredentials } from '@/lib/integrations/crypto'
import { PROVIDER_REGISTRY } from '@/lib/integrations/registry'
import type { ProviderKey } from '@/lib/integrations/types'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/connections — Connection CRUD (Task BACKEND-INTEGRATIONS-1)
//
//   GET  → list all Connections (most-recent first). Empty array when none.
//   POST → create a Connection { provider, label?, credentials?, metadata? }
//
// The `credentialsEnc` field is NEVER returned — only the boolean
// `hasCredentials`. No fake data; empty DB → empty list.
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_PROVIDERS = Object.keys(PROVIDER_REGISTRY) as ProviderKey[]

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

export async function GET() {
  try {
    const connections = await db.connection.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      connections: connections.map(redactConnection),
    })
  } catch (error) {
    console.error('[/api/integrations/connections] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load connections.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { provider, label?, credentials?, metadata? }.' },
        { status: 400 },
      )
    }

    const provider = typeof body.provider === 'string' ? body.provider : null
    if (!provider || !VALID_PROVIDERS.includes(provider as ProviderKey)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}.` },
        { status: 400 },
      )
    }

    const label =
      typeof body.label === 'string' && body.label.trim()
        ? body.label.trim()
        : null

    const credsProvided =
      body.credentials !== undefined &&
      body.credentials !== null &&
      typeof body.credentials === 'object' &&
      Object.keys(body.credentials as object).length > 0

    const meta = PROVIDER_REGISTRY[provider as ProviderKey]

    // For providers that require credentials, an empty creds blob means
    // status="connecting" (awaiting creds). For local providers (excel,
    // clients) we skip creds entirely and mark "connected" immediately.
    let credentialsEnc: string | null = null
    let status: 'disconnected' | 'connecting' | 'connected' =
      'disconnected'

    if (!meta.requiresCredentials) {
      status = 'connected'
    } else if (credsProvided) {
      try {
        credentialsEnc = encryptCredentials(body.credentials as object)
        status = 'connected'
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json(
          { error: `Failed to encrypt credentials: ${msg}` },
          { status: 500 },
        )
      }
    } else {
      status = 'connecting'
    }

    const metadata =
      typeof body.metadata === 'object' && body.metadata !== null
        ? JSON.stringify(body.metadata)
        : typeof body.metadata === 'string'
          ? body.metadata
          : null

    const created = await db.connection.create({
      data: {
        provider,
        label,
        status,
        credentialsEnc,
        metadata,
      },
    })

    return NextResponse.json(
      { connection: redactConnection(created) },
      { status: 201 },
    )
  } catch (error) {
    console.error('[/api/integrations/connections] POST failed:', error)
    return NextResponse.json(
      { error: 'Failed to create connection.' },
      { status: 500 },
    )
  }
}
