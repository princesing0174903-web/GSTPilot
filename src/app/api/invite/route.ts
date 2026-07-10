import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, inviteUser } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

/**
 * Top-level invite endpoint (alias of /api/admin/invite).
 * Invites a user to the active tenant with a role + optional organization.
 */
export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { email, name, roleKey, organizationId, title } = body as {
      email: string; name?: string; roleKey: string; organizationId?: string; title?: string
    }
    if (!email || !roleKey) {
      return NextResponse.json({ error: 'email and roleKey are required' }, { status: 400 })
    }
    const member = await inviteUser(tenant.id, { email, name, roleKey, organizationId, title })
    return NextResponse.json({ member, invited: true })
  } catch (err) {
    console.error('[api/invite] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to invite user' }, { status: 500 })
  }
}
