import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, decideApproval } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

/**
 * Reject a pending policy approval request.
 * Body: { approvalId, role, userId?, comment? }
 */
export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { approvalId, role, userId, comment } = body as {
      approvalId: string; role: string; userId?: string; comment?: string
    }
    if (!approvalId || !role) {
      return NextResponse.json({ error: 'approvalId and role are required' }, { status: 400 })
    }
    const result = await decideApproval(tenant.id, approvalId, 'rejected', { role, userId, comment })
    return NextResponse.json({ approval: result, decision: 'rejected' })
  } catch (err) {
    console.error('[api/policy/reject] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to reject' }, { status: 500 })
  }
}
