import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listWorkspaces, ensureDefaultWorkspaces, DEFAULT_WORKSPACES } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    await ensureDefaultWorkspaces(tenant.id)
    const workspaces = await listWorkspaces(tenant.id)
    return NextResponse.json({ workspaces, catalog: DEFAULT_WORKSPACES, total: workspaces.length })
  } catch (err) {
    console.error('[api/workspaces] error:', err)
    return NextResponse.json({ error: 'Failed to load workspaces' }, { status: 500 })
  }
}
