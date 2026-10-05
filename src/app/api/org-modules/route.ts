import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listModules, browseCatalog, getModuleStats, installModule, uninstallModule } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const [installed, catalog, stats] = await Promise.all([
      listModules(tenant.id),
      browseCatalog(),
      getModuleStats(tenant.id),
    ])
    return NextResponse.json({ installed, catalog, stats, total: installed.length })
  } catch (err) {
    console.error('[api/org-modules] error:', err)
    return NextResponse.json({ error: 'Failed to load org modules' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { action, moduleKey, organizationId } = body as { action: 'install' | 'uninstall'; moduleKey: string; organizationId?: string }
    if (!action || !moduleKey) return NextResponse.json({ error: 'action and moduleKey required' }, { status: 400 })
    if (action === 'install') {
      const mod = await installModule(tenant.id, moduleKey, organizationId)
      return NextResponse.json({ module: mod, installed: true })
    }
    await uninstallModule(tenant.id, moduleKey)
    return NextResponse.json({ uninstalled: true, moduleKey })
  } catch (err) {
    console.error('[api/org-modules POST] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to update module' }, { status: 500 })
  }
}
