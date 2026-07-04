import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, getAdminDashboard } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    await resolveTenant()
    const dashboard = await getAdminDashboard()
    return NextResponse.json(dashboard)
  } catch (err) {
    console.error('[api/admin/dashboard] error:', err)
    return NextResponse.json({ error: 'Failed to load admin dashboard' }, { status: 500 })
  }
}
