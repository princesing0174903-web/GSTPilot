import { NextResponse } from 'next/server'
import { getSyncJob } from '@/lib/integrations/sync'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/sync/[id] — fetch a single sync job
//
//   GET → { syncJob: {...} } or 404 when not found.
// ═══════════════════════════════════════════════════════════════════════════════

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const job = await getSyncJob(id)
    if (!job) {
      return NextResponse.json(
        { error: 'Sync job not found.' },
        { status: 404 },
      )
    }
    return NextResponse.json({ syncJob: job })
  } catch (error) {
    console.error('[/api/integrations/sync/[id]] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load sync job.' },
      { status: 500 },
    )
  }
}
