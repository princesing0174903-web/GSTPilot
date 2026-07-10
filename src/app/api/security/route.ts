import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, getSecurityOverview, IDENTITY_PROVIDERS, SECURITY_EVENT_TYPES } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const overview = await getSecurityOverview(tenant.id)
    return NextResponse.json({
      ...overview,
      identityProviders: IDENTITY_PROVIDERS,
      eventTypes: SECURITY_EVENT_TYPES,
    })
  } catch (err) {
    console.error('[api/security] error:', err)
    return NextResponse.json({ error: 'Failed to load security overview' }, { status: 500 })
  }
}
