// GET /api/integrations/sync-jobs — list recent sync jobs.
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, listSyncJobs, syncEngineStatus } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await seedMarketplace()
    const sp = req.nextUrl.searchParams
    const [jobs, status] = await Promise.all([
      listSyncJobs({
        limit: sp.get('limit') ? Number(sp.get('limit')) : 50,
        installationId: sp.get('installationId') ?? undefined,
        status: sp.get('status') ?? undefined,
      }),
      syncEngineStatus(),
    ])
    return NextResponse.json({ jobs, status, total: jobs.length })
  } catch (err) {
    console.error('[api/integrations/sync-jobs] error:', err)
    return NextResponse.json({ error: 'Failed to load sync jobs' }, { status: 500 })
  }
}
