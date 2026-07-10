import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, provisionUser } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

/**
 * SCIM-style automatic user provisioning — provisions a user from an
 * identity provider (Google/Microsoft/SAML/Okta/etc.) into the tenant.
 */
export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { email, name, providerKey, roleKey, title } = body as {
      email: string; name: string; providerKey: string; roleKey?: string; title?: string
    }
    if (!email || !name || !providerKey) {
      return NextResponse.json({ error: 'email, name and providerKey are required' }, { status: 400 })
    }
    const result = await provisionUser(tenant.id, { email, name, providerKey, roleKey, title })
    return NextResponse.json({ provisioned: result })
  } catch (err) {
    console.error('[api/provision] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to provision user' }, { status: 500 })
  }
}
