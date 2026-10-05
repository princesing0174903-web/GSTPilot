import { NextResponse } from 'next/server'
import { seedEnterprise, createTenant } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const body = await req.json().catch(() => ({}))
    const { name, slug, plan, ownerId } = body as {
      name: string; slug: string; plan?: string; ownerId?: string
    }
    if (!name || !slug) return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
    const tenant = await createTenant({ name, slug, plan, ownerId: ownerId ?? null })
    return NextResponse.json({ tenant })
  } catch (err) {
    console.error('[api/admin/create-tenant] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to create tenant' }, { status: 500 })
  }
}
