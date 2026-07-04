import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ─── POST handler ───────────────────────────────────────────────────────────
export async function POST() {
  try {
    // 1. Clear existing data (respect foreign key order)
    await db.clientBenchmark.deleteMany()
    await db.executiveReport.deleteMany()
    await db.documentChatSession.deleteMany()
    await db.knowledgeEntry.deleteMany()
    await db.aITask.deleteMany()
    await db.clientInsight.deleteMany()
    await db.complianceForecast.deleteMany()
    await db.riskScore.deleteMany()
    await db.aIPrediction.deleteMany()
    await db.automationLog.deleteMany()
    await db.automationRule.deleteMany()
    await db.workloadAssignment.deleteMany()
    await db.teamPerformance.deleteMany()
    await db.notice.deleteMany()
    await db.document.deleteMany()
    await db.firmMetrics.deleteMany()
    await db.firmSettings.deleteMany()
    await db.teamMember.deleteMany()
    await db.filingEvent.deleteMany()
    await db.reconciliationResult.deleteMany()
    await db.reconciliationRun.deleteMany()
    await db.issue.deleteMany()
    await db.auditLog.deleteMany()
    await db.healthScore.deleteMany()
    await db.gSTRFiling.deleteMany()
    await db.invoice.deleteMany()
    await db.client.deleteMany()
    await db.user.deleteMany()
    await db.firm.deleteMany()

    // 2. Create default CA Firm
    const firm = await db.firm.create({
      data: {
        name: 'GSTPilot Demo Firm',
        state: 'Maharashtra',
      },
    })

    // 3. Create default admin user
    await db.user.create({
      data: {
        email: 'admin@gstpilot.ai',
        name: 'Rajesh Kumar',
        role: 'admin',
        firmId: firm.id,
      },
    })

    // 4. Create default FirmSettings
    await db.firmSettings.create({
      data: {
        firmId: firm.id,
        firmName: 'GSTPilot Demo Firm',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Database cleared and default firm created',
    })
  } catch (error) {
    console.error('[SEED ERROR]', error)
    return NextResponse.json(
      { success: false, message: 'Seed failed', error: String(error) },
      { status: 500 }
    )
  }
}
