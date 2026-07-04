import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    return NextResponse.json(tenant)
  } catch (err) {
    console.error('[api/tenant] error:', err)
    return NextResponse.json({ error: 'Failed to load tenant' }, { status: 500 })
  }
}
