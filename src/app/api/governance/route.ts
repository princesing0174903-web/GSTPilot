import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listBackups, listComplianceCerts, getGovernanceStats, COMPLIANCE_FRAMEWORKS } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const [backups, complianceCerts, stats] = await Promise.all([
      listBackups(tenant.id),
      listComplianceCerts(tenant.id),
      getGovernanceStats(tenant.id),
    ])
    return NextResponse.json({ backups, complianceCerts, stats, frameworks: COMPLIANCE_FRAMEWORKS, total: backups.length })
  } catch (err) {
    console.error('[api/governance] error:', err)
    return NextResponse.json({ error: 'Failed to load governance data' }, { status: 500 })
  }
}
