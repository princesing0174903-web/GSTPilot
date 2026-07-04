import { NextResponse } from 'next/server'
import { listSyncJobs } from '@/lib/integrations/sync'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/sync-history — per-connector sync history
//
//   GET ?provider=gstn&limit=20
//
// Returns SyncJob rows for a specific provider (or all providers). Each card
// on the Finance page shows the last few sync runs + their status.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const provider = url.searchParams.get('provider') ?? undefined
    const status = url.searchParams.get('status') ?? undefined
    const limit = url.searchParams.get('limit')
      ? Math.min(Number(url.searchParams.get('limit')), 100)
      : 20
    const offset = url.searchParams.get('offset')
      ? Number(url.searchParams.get('offset'))
      : 0

    const { syncJobs, total } = await listSyncJobs({ provider, status, limit, offset })
    return NextResponse.json({ syncJobs, total })
  } catch (error) {
    console.error('[/api/integrations/sync-history] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load sync history.' },
      { status: 500 },
    )
  }
}
