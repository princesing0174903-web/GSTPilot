import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, switchCompany } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { companyId } = body as { companyId: string }
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    const result = await switchCompany(tenant.id, companyId)
    return NextResponse.json({ company: result })
  } catch (err) {
    console.error('[api/admin/switch-company] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to switch company' }, { status: 500 })
  }
}
