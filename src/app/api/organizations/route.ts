import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listOrganizations } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const data = await listOrganizations(tenant.id)
    return NextResponse.json({ tenant, ...data })
  } catch (err) {
    console.error('[api/organizations] error:', err)
    return NextResponse.json({ error: 'Failed to load organizations' }, { status: 500 })
  }
}
