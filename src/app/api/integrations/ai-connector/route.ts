// POST /api/integrations/ai-connector — AI Connector Engine™: parse + execute natural-language command.
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, parseConnectorIntent, executeConnectorIntent } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await seedMarketplace()
    const body = await req.json().catch(() => ({}))
    if (!body.command) return NextResponse.json({ error: 'command required' }, { status: 400 })

    if (body.execute === true) {
      const result = await executeConnectorIntent(body.command)
      return NextResponse.json(result)
    }
    const intent = await parseConnectorIntent(body.command)
    return NextResponse.json({ intent })
  } catch (err) {
    console.error('[api/integrations/ai-connector] error:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'AI Connector failed' }, { status: 500 })
  }
}
