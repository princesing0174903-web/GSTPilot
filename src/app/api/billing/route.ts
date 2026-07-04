import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listBillingInvoices, createBillingInvoice } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const invoices = await listBillingInvoices(tenant.id)
    return NextResponse.json({ invoices, total: invoices.length })
  } catch (err) {
    console.error('[api/billing] error:', err)
    return NextResponse.json({ error: 'Failed to load billing' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { subtotal, tax, total, items, type, dueAt } = body as {
      subtotal: number; tax: number; total: number
      items: { description: string; quantity: number; amount: number }[]
      type?: 'invoice' | 'credit_note' | 'refund'
      dueAt?: string
    }
    if (typeof subtotal !== 'number' || typeof total !== 'number') {
      return NextResponse.json({ error: 'subtotal and total are required' }, { status: 400 })
    }
    const inv = await createBillingInvoice(tenant.id, {
      subtotal, tax, total, items: items ?? [], type,
      dueAt: dueAt ? new Date(dueAt) : undefined,
    })
    return NextResponse.json({ invoice: inv })
  } catch (err) {
    console.error('[api/billing POST] error:', err)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
