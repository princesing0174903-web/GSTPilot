import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, getSubscription, listPlans, changePlan } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const subscription = await getSubscription(tenant.id)
    return NextResponse.json({ subscription, plans: listPlans() })
  } catch (err) {
    console.error('[api/subscriptions] error:', err)
    return NextResponse.json({ error: 'Failed to load subscription' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { plan, billingCycle } = body as { plan?: string; billingCycle?: 'monthly' | 'yearly' }
    if (!plan) return NextResponse.json({ error: 'plan is required' }, { status: 400 })
    const sub = await changePlan(tenant.id, plan, billingCycle ?? 'monthly')
    return NextResponse.json({ subscription: sub })
  } catch (err) {
    console.error('[api/subscriptions POST] error:', err)
    return NextResponse.json({ error: 'Failed to change plan' }, { status: 500 })
  }
}
