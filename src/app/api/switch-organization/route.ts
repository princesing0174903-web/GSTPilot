import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, switchCompany } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

/**
 * Top-level switch-organization endpoint (alias of /api/admin/switch-company).
 * Switches the active company context for the tenant.
 */
export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { companyId, organizationId } = body as { companyId?: string; organizationId?: string }
    const target = companyId ?? organizationId
    if (!target) return NextResponse.json({ error: 'companyId (or organizationId) is required' }, { status: 400 })
    const result = await switchCompany(tenant.id, target)
    return NextResponse.json({ switched: true, company: result })
  } catch (err) {
    console.error('[api/switch-organization] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to switch organization' }, { status: 500 })
  }
}
